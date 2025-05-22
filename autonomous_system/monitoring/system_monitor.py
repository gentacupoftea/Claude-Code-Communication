"""
System Monitor - システム監視
包括的システム監視・パフォーマンス追跡・健全性評価システム
"""

import asyncio
import logging
import json
import os
import psutil
import time
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from collections import deque
import subprocess
import socket

@dataclass
class SystemMetrics:
    """システムメトリクス"""
    timestamp: datetime
    cpu_percent: float
    memory_percent: float
    memory_available_gb: float
    disk_percent: float
    disk_free_gb: float
    network_bytes_sent: int
    network_bytes_recv: int
    process_count: int
    load_average_1m: float
    uptime_hours: float

@dataclass
class ServiceStatus:
    """サービス状態"""
    name: str
    status: str  # running, stopped, error
    pid: Optional[int]
    cpu_percent: float
    memory_percent: float
    started_at: Optional[datetime]
    port: Optional[int] = None
    health_check_url: Optional[str] = None
    last_health_check: Optional[datetime] = None
    health_status: str = "unknown"  # healthy, unhealthy, unknown

class SystemMonitor:
    """包括的システム監視"""
    
    def __init__(self, project_root: str = None):
        """初期化"""
        self.logger = logging.getLogger(__name__)
        self.project_root = project_root or os.getcwd()
        
        # 監視設定
        self.monitoring_enabled = True
        self.monitoring_interval = int(os.getenv('MONITORING_INTERVAL', 5))
        self.metrics_retention_hours = 24
        
        # メトリクス履歴
        self.metrics_history: deque = deque(maxlen=int(self.metrics_retention_hours * 3600 / self.monitoring_interval))
        
        # サービス監視
        self.monitored_services = {
            'frontend': {
                'port': 3000,
                'process_pattern': 'react-scripts',
                'health_url': 'http://localhost:3000'
            },
            'backend': {
                'port': 8000,
                'process_pattern': 'uvicorn',
                'health_url': 'http://localhost:8000/health'
            }
        }
        
        # アラート閾値
        self.alert_thresholds = {
            'cpu_percent': 85.0,
            'memory_percent': 90.0,
            'disk_percent': 95.0,
            'response_time_ms': 5000,
            'error_rate_percent': 10.0
        }
        
        # コールバック
        self.alert_callbacks: List[Callable[[str, Dict[str, Any]], None]] = []
        
        # システム情報キャッシュ
        self.system_info_cache = None
        self.cache_timestamp = None
        
    async def start_monitoring(self):
        """監視開始"""
        if not self.monitoring_enabled:
            self.logger.info("System monitoring is disabled")
            return
        
        self.logger.info("📊 Starting comprehensive system monitoring...")
        
        # 並行監視タスク開始
        await asyncio.gather(
            self._collect_system_metrics(),
            self._monitor_services(),
            self._monitor_network_health(),
            self._monitor_application_performance(),
            self._cleanup_old_metrics(),
            return_exceptions=True
        )
    
    def add_alert_callback(self, callback: Callable[[str, Dict[str, Any]], None]):
        """アラートコールバック追加"""
        self.alert_callbacks.append(callback)
    
    async def _collect_system_metrics(self):
        """システムメトリクス収集"""
        while self.monitoring_enabled:
            try:
                # システムメトリクス取得
                metrics = await self._get_current_metrics()
                self.metrics_history.append(metrics)
                
                # アラートチェック
                await self._check_metric_alerts(metrics)
                
                await asyncio.sleep(self.monitoring_interval)
                
            except Exception as e:
                self.logger.error(f"System metrics collection error: {e}")
                await asyncio.sleep(30)
    
    async def _get_current_metrics(self) -> SystemMetrics:
        """現在のシステムメトリクス取得"""
        # CPU情報
        cpu_percent = psutil.cpu_percent(interval=0.1)
        
        # メモリ情報
        memory = psutil.virtual_memory()
        
        # ディスク情報
        disk = psutil.disk_usage('/')
        
        # ネットワーク情報
        network = psutil.net_io_counters()
        
        # プロセス情報
        process_count = len(psutil.pids())
        
        # 負荷平均（Unixのみ）
        try:
            load_avg = os.getloadavg()[0]
        except:
            load_avg = 0.0
        
        # アップタイム
        boot_time = psutil.boot_time()
        uptime_hours = (time.time() - boot_time) / 3600
        
        return SystemMetrics(
            timestamp=datetime.now(),
            cpu_percent=cpu_percent,
            memory_percent=memory.percent,
            memory_available_gb=memory.available / (1024**3),
            disk_percent=(disk.used / disk.total) * 100,
            disk_free_gb=disk.free / (1024**3),
            network_bytes_sent=network.bytes_sent,
            network_bytes_recv=network.bytes_recv,
            process_count=process_count,
            load_average_1m=load_avg,
            uptime_hours=uptime_hours
        )
    
    async def _check_metric_alerts(self, metrics: SystemMetrics):
        """メトリクスアラートチェック"""
        alerts = []
        
        # CPU使用率チェック
        if metrics.cpu_percent > self.alert_thresholds['cpu_percent']:
            alerts.append({
                'type': 'high_cpu',
                'message': f'High CPU usage: {metrics.cpu_percent:.1f}%',
                'value': metrics.cpu_percent,
                'threshold': self.alert_thresholds['cpu_percent']
            })
        
        # メモリ使用率チェック
        if metrics.memory_percent > self.alert_thresholds['memory_percent']:
            alerts.append({
                'type': 'high_memory',
                'message': f'High memory usage: {metrics.memory_percent:.1f}%',
                'value': metrics.memory_percent,
                'threshold': self.alert_thresholds['memory_percent']
            })
        
        # ディスク使用率チェック
        if metrics.disk_percent > self.alert_thresholds['disk_percent']:
            alerts.append({
                'type': 'high_disk',
                'message': f'High disk usage: {metrics.disk_percent:.1f}%',
                'value': metrics.disk_percent,
                'threshold': self.alert_thresholds['disk_percent']
            })
        
        # アラート送信
        for alert in alerts:
            await self._send_alert(alert['type'], alert)
    
    async def _monitor_services(self):
        """サービス監視"""
        while self.monitoring_enabled:
            try:
                for service_name, config in self.monitored_services.items():
                    status = await self._check_service_status(service_name, config)
                    
                    # サービス停止アラート
                    if status.status == 'stopped':
                        await self._send_alert('service_down', {
                            'service': service_name,
                            'message': f'Service {service_name} is not running'
                        })
                    
                    # ヘルスチェック失敗アラート
                    if status.health_status == 'unhealthy':
                        await self._send_alert('service_unhealthy', {
                            'service': service_name,
                            'message': f'Service {service_name} health check failed'
                        })
                
                await asyncio.sleep(self.monitoring_interval * 2)
                
            except Exception as e:
                self.logger.error(f"Service monitoring error: {e}")
                await asyncio.sleep(30)
    
    async def _check_service_status(self, service_name: str, config: Dict[str, Any]) -> ServiceStatus:
        """個別サービス状況チェック"""
        # プロセス検索
        process = self._find_service_process(config.get('process_pattern', service_name))
        
        if process:
            status = ServiceStatus(
                name=service_name,
                status='running',
                pid=process.pid,
                cpu_percent=process.cpu_percent(),
                memory_percent=process.memory_percent(),
                started_at=datetime.fromtimestamp(process.create_time()),
                port=config.get('port')
            )
            
            # ヘルスチェック実行
            if config.get('health_url'):
                health_status = await self._perform_health_check(config['health_url'])
                status.health_status = health_status
                status.last_health_check = datetime.now()
        else:
            status = ServiceStatus(
                name=service_name,
                status='stopped',
                pid=None,
                cpu_percent=0.0,
                memory_percent=0.0,
                started_at=None,
                port=config.get('port')
            )
        
        return status
    
    def _find_service_process(self, pattern: str) -> Optional[psutil.Process]:
        """サービスプロセス検索"""
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                cmdline = ' '.join(proc.info['cmdline'] or [])
                if pattern.lower() in cmdline.lower():
                    return psutil.Process(proc.info['pid'])
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        return None
    
    async def _perform_health_check(self, url: str) -> str:
        """ヘルスチェック実行"""
        try:
            import aiohttp
            timeout = aiohttp.ClientTimeout(total=5)
            
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(url) as response:
                    if response.status == 200:
                        return 'healthy'
                    else:
                        return 'unhealthy'
        except Exception:
            return 'unhealthy'
    
    async def _monitor_network_health(self):
        """ネットワーク健全性監視"""
        while self.monitoring_enabled:
            try:
                # ポート監視
                for service_name, config in self.monitored_services.items():
                    port = config.get('port')
                    if port:
                        is_open = await self._check_port_open('localhost', port)
                        if not is_open:
                            await self._send_alert('port_closed', {
                                'service': service_name,
                                'port': port,
                                'message': f'Port {port} for {service_name} is not accessible'
                            })
                
                await asyncio.sleep(self.monitoring_interval * 3)
                
            except Exception as e:
                self.logger.error(f"Network health monitoring error: {e}")
                await asyncio.sleep(60)
    
    async def _check_port_open(self, host: str, port: int) -> bool:
        """ポート開放チェック"""
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(5)
            result = sock.connect_ex((host, port))
            sock.close()
            return result == 0
        except Exception:
            return False
    
    async def _monitor_application_performance(self):
        """アプリケーションパフォーマンス監視"""
        while self.monitoring_enabled:
            try:
                # アプリケーション固有のメトリクス収集
                perf_metrics = await self._collect_application_metrics()
                
                # パフォーマンス異常検出
                await self._detect_performance_anomalies(perf_metrics)
                
                await asyncio.sleep(self.monitoring_interval * 2)
                
            except Exception as e:
                self.logger.error(f"Application performance monitoring error: {e}")
                await asyncio.sleep(60)
    
    async def _collect_application_metrics(self) -> Dict[str, Any]:
        """アプリケーションメトリクス収集"""
        metrics = {
            'timestamp': datetime.now().isoformat(),
            'frontend': await self._get_frontend_metrics(),
            'backend': await self._get_backend_metrics()
        }
        return metrics
    
    async def _get_frontend_metrics(self) -> Dict[str, Any]:
        """フロントエンドメトリクス取得"""
        try:
            # React開発サーバーの応答時間測定
            start_time = time.time()
            health_status = await self._perform_health_check('http://localhost:3000')
            response_time = (time.time() - start_time) * 1000
            
            return {
                'health_status': health_status,
                'response_time_ms': response_time,
                'is_responsive': response_time < self.alert_thresholds['response_time_ms']
            }
        except Exception as e:
            return {
                'health_status': 'error',
                'response_time_ms': 0,
                'is_responsive': False,
                'error': str(e)
            }
    
    async def _get_backend_metrics(self) -> Dict[str, Any]:
        """バックエンドメトリクス取得"""
        try:
            # FastAPIサーバーの応答時間測定
            start_time = time.time()
            health_status = await self._perform_health_check('http://localhost:8000/health')
            response_time = (time.time() - start_time) * 1000
            
            return {
                'health_status': health_status,
                'response_time_ms': response_time,
                'is_responsive': response_time < self.alert_thresholds['response_time_ms']
            }
        except Exception as e:
            return {
                'health_status': 'error',
                'response_time_ms': 0,
                'is_responsive': False,
                'error': str(e)
            }
    
    async def _detect_performance_anomalies(self, metrics: Dict[str, Any]):
        """パフォーマンス異常検出"""
        # フロントエンド応答時間チェック
        frontend_metrics = metrics.get('frontend', {})
        if not frontend_metrics.get('is_responsive', True):
            await self._send_alert('slow_response', {
                'component': 'frontend',
                'response_time': frontend_metrics.get('response_time_ms', 0),
                'threshold': self.alert_thresholds['response_time_ms']
            })
        
        # バックエンド応答時間チェック
        backend_metrics = metrics.get('backend', {})
        if not backend_metrics.get('is_responsive', True):
            await self._send_alert('slow_response', {
                'component': 'backend',
                'response_time': backend_metrics.get('response_time_ms', 0),
                'threshold': self.alert_thresholds['response_time_ms']
            })
    
    async def _cleanup_old_metrics(self):
        """古いメトリクスのクリーンアップ"""
        while self.monitoring_enabled:
            try:
                await asyncio.sleep(3600)  # 1時間ごと
                
                if not self.monitoring_enabled:
                    break
                
                # メトリクス履歴のクリーンアップは deque の maxlen で自動処理
                self.logger.info(f"Metrics history size: {len(self.metrics_history)}")
                
            except Exception as e:
                self.logger.error(f"Metrics cleanup error: {e}")
    
    async def _send_alert(self, alert_type: str, alert_data: Dict[str, Any]):
        """アラート送信"""
        alert_info = {
            'type': alert_type,
            'timestamp': datetime.now().isoformat(),
            'data': alert_data
        }
        
        self.logger.warning(f"🚨 ALERT [{alert_type}]: {alert_data.get('message', 'Unknown alert')}")
        
        # コールバック実行
        for callback in self.alert_callbacks:
            try:
                await callback(alert_type, alert_info) if asyncio.iscoroutinefunction(callback) else callback(alert_type, alert_info)
            except Exception as e:
                self.logger.error(f"Alert callback failed: {e}")
    
    def get_current_status(self) -> Dict[str, Any]:
        """現在のシステム状況取得"""
        if not self.metrics_history:
            return {'status': 'no_data', 'message': 'No metrics available'}
        
        latest_metrics = self.metrics_history[-1]
        
        return {
            'timestamp': latest_metrics.timestamp.isoformat(),
            'system': {
                'cpu_percent': latest_metrics.cpu_percent,
                'memory_percent': latest_metrics.memory_percent,
                'disk_percent': latest_metrics.disk_percent,
                'uptime_hours': latest_metrics.uptime_hours,
                'process_count': latest_metrics.process_count
            },
            'resources': {
                'memory_available_gb': latest_metrics.memory_available_gb,
                'disk_free_gb': latest_metrics.disk_free_gb,
                'load_average': latest_metrics.load_average_1m
            },
            'network': {
                'bytes_sent': latest_metrics.network_bytes_sent,
                'bytes_recv': latest_metrics.network_bytes_recv
            }
        }
    
    def get_metrics_history(self, hours: int = 1) -> List[Dict[str, Any]]:
        """メトリクス履歴取得"""
        if hours <= 0:
            return []
        
        cutoff_time = datetime.now() - timedelta(hours=hours)
        filtered_metrics = [
            asdict(metrics) for metrics in self.metrics_history
            if metrics.timestamp > cutoff_time
        ]
        
        # timestampをISO文字列に変換
        for metric in filtered_metrics:
            if isinstance(metric['timestamp'], datetime):
                metric['timestamp'] = metric['timestamp'].isoformat()
        
        return filtered_metrics
    
    def get_performance_summary(self) -> Dict[str, Any]:
        """パフォーマンス概要取得"""
        if len(self.metrics_history) < 2:
            return {'status': 'insufficient_data'}
        
        recent_metrics = list(self.metrics_history)[-60:]  # 直近60データポイント
        
        # 平均値計算
        avg_cpu = sum(m.cpu_percent for m in recent_metrics) / len(recent_metrics)
        avg_memory = sum(m.memory_percent for m in recent_metrics) / len(recent_metrics)
        avg_disk = sum(m.disk_percent for m in recent_metrics) / len(recent_metrics)
        
        # 最大値
        max_cpu = max(m.cpu_percent for m in recent_metrics)
        max_memory = max(m.memory_percent for m in recent_metrics)
        
        # 健全性評価
        health_score = self._calculate_health_score(avg_cpu, avg_memory, avg_disk)
        
        return {
            'time_range_minutes': len(recent_metrics) * (self.monitoring_interval / 60),
            'averages': {
                'cpu_percent': round(avg_cpu, 1),
                'memory_percent': round(avg_memory, 1),
                'disk_percent': round(avg_disk, 1)
            },
            'peaks': {
                'cpu_percent': round(max_cpu, 1),
                'memory_percent': round(max_memory, 1)
            },
            'health_score': health_score,
            'status': self._get_status_from_score(health_score)
        }
    
    def _calculate_health_score(self, cpu: float, memory: float, disk: float) -> int:
        """健全性スコア計算 (0-100)"""
        score = 100
        
        # CPU使用率影響
        if cpu > 80:
            score -= 30
        elif cpu > 60:
            score -= 15
        
        # メモリ使用率影響
        if memory > 85:
            score -= 25
        elif memory > 70:
            score -= 10
        
        # ディスク使用率影響
        if disk > 90:
            score -= 20
        elif disk > 80:
            score -= 10
        
        return max(0, score)
    
    def _get_status_from_score(self, score: int) -> str:
        """スコアからステータス文字列取得"""
        if score >= 90:
            return "excellent"
        elif score >= 80:
            return "good"
        elif score >= 60:
            return "warning"
        elif score >= 40:
            return "critical"
        else:
            return "emergency"
    
    async def get_system_info(self) -> Dict[str, Any]:
        """システム情報取得（キャッシュ付き）"""
        now = datetime.now()
        
        # 5分間キャッシュ
        if (self.system_info_cache and self.cache_timestamp and 
            (now - self.cache_timestamp).total_seconds() < 300):
            return self.system_info_cache
        
        try:
            # システム情報収集
            system_info = {
                'platform': {
                    'system': os.uname().sysname,
                    'node': os.uname().nodename,
                    'release': os.uname().release,
                    'machine': os.uname().machine
                },
                'cpu': {
                    'count': psutil.cpu_count(),
                    'count_logical': psutil.cpu_count(logical=True),
                    'frequency_mhz': psutil.cpu_freq().current if psutil.cpu_freq() else 0
                },
                'memory': {
                    'total_gb': psutil.virtual_memory().total / (1024**3),
                    'total_swap_gb': psutil.swap_memory().total / (1024**3)
                },
                'disk': {
                    'total_gb': psutil.disk_usage('/').total / (1024**3)
                },
                'network': {
                    'interfaces': list(psutil.net_if_addrs().keys())
                },
                'python': {
                    'version': os.sys.version,
                    'executable': os.sys.executable
                }
            }
            
            self.system_info_cache = system_info
            self.cache_timestamp = now
            
            return system_info
            
        except Exception as e:
            self.logger.error(f"Failed to collect system info: {e}")
            return {'error': str(e)}
    
    async def stop_monitoring(self):
        """監視停止"""
        self.monitoring_enabled = False
        self.logger.info("🛑 System monitoring stopped")