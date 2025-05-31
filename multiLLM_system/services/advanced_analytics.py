"""
Advanced Analytics Service
MultiLLMシステムの詳細なパフォーマンス分析とレポート生成
"""

import asyncio
import logging
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
import statistics
from collections import defaultdict, deque
import aiofiles

logger = logging.getLogger(__name__)


@dataclass
class TaskMetrics:
    """タスクメトリクス"""
    task_id: str
    worker_id: str
    task_type: str
    status: str
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    duration_ms: Optional[int]
    tokens_used: Optional[int]
    cost: Optional[float]
    success: bool
    error_type: Optional[str]
    priority: str


@dataclass
class WorkerMetrics:
    """Workerメトリクス"""
    worker_id: str
    worker_type: str
    model: str
    total_tasks: int
    successful_tasks: int
    failed_tasks: int
    average_duration: float
    median_duration: float
    p95_duration: float
    total_tokens: int
    total_cost: float
    utilization_rate: float
    error_rate: float
    throughput: float  # tasks per hour


@dataclass
class SystemMetrics:
    """システム全体メトリクス"""
    timestamp: datetime
    total_requests: int
    active_workers: int
    total_workers: int
    system_load: float
    memory_usage: float
    cpu_usage: float
    error_rate: float
    average_latency: float
    throughput: float


class MetricsCollector:
    """メトリクス収集器"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.task_metrics = deque(maxlen=10000)  # 最新10,000タスク
        self.worker_metrics = {}
        self.system_metrics = deque(maxlen=1440)  # 24時間分（1分間隔）
        
        # 統計計算用
        self.worker_durations = defaultdict(list)
        self.worker_tokens = defaultdict(int)
        self.worker_costs = defaultdict(float)
        
        # 時系列データ
        self.hourly_stats = defaultdict(lambda: {
            'tasks': 0,
            'errors': 0,
            'total_duration': 0,
            'total_tokens': 0,
            'total_cost': 0
        })
    
    async def record_task_metrics(self, metrics: TaskMetrics):
        """タスクメトリクスを記録"""
        self.task_metrics.append(metrics)
        
        # Worker別統計を更新
        worker_id = metrics.worker_id
        if metrics.duration_ms:
            self.worker_durations[worker_id].append(metrics.duration_ms)
            # 最新1000件のみ保持
            if len(self.worker_durations[worker_id]) > 1000:
                self.worker_durations[worker_id] = self.worker_durations[worker_id][-1000:]
        
        if metrics.tokens_used:
            self.worker_tokens[worker_id] += metrics.tokens_used
        
        if metrics.cost:
            self.worker_costs[worker_id] += metrics.cost
        
        # 時間別統計を更新
        hour_key = metrics.created_at.strftime('%Y-%m-%d-%H')
        stats = self.hourly_stats[hour_key]
        stats['tasks'] += 1
        if not metrics.success:
            stats['errors'] += 1
        if metrics.duration_ms:
            stats['total_duration'] += metrics.duration_ms
        if metrics.tokens_used:
            stats['total_tokens'] += metrics.tokens_used
        if metrics.cost:
            stats['total_cost'] += metrics.cost
        
        logger.debug(f"Recorded metrics for task {metrics.task_id}")
    
    async def record_system_metrics(self, metrics: SystemMetrics):
        """システムメトリクスを記録"""
        self.system_metrics.append(metrics)
        logger.debug(f"Recorded system metrics: {metrics.total_requests} requests")
    
    def calculate_worker_metrics(self, worker_id: str) -> Optional[WorkerMetrics]:
        """Worker統計を計算"""
        # 最近のタスクからWorker情報を取得
        worker_tasks = [m for m in self.task_metrics if m.worker_id == worker_id]
        
        if not worker_tasks:
            return None
        
        # 基本統計
        total_tasks = len(worker_tasks)
        successful_tasks = sum(1 for t in worker_tasks if t.success)
        failed_tasks = total_tasks - successful_tasks
        
        # 期間統計（最近のタスクのみ）
        durations = self.worker_durations[worker_id]
        if durations:
            average_duration = statistics.mean(durations)
            median_duration = statistics.median(durations)
            p95_duration = self._calculate_percentile(durations, 95)
        else:
            average_duration = median_duration = p95_duration = 0
        
        # レートとコスト
        total_tokens = self.worker_tokens[worker_id]
        total_cost = self.worker_costs[worker_id]
        error_rate = (failed_tasks / total_tasks * 100) if total_tasks > 0 else 0
        
        # スループット計算（最近1時間）
        now = datetime.now()
        recent_tasks = [
            t for t in worker_tasks 
            if t.created_at > now - timedelta(hours=1)
        ]
        throughput = len(recent_tasks)  # tasks per hour
        
        # 使用率計算（簡略化）
        utilization_rate = min(100, throughput * 2)  # 仮の計算
        
        # 最新タスクから基本情報を取得
        latest_task = max(worker_tasks, key=lambda t: t.created_at)
        
        return WorkerMetrics(
            worker_id=worker_id,
            worker_type=latest_task.task_type,  # 簡略化
            model="unknown",  # 実際の実装では設定から取得
            total_tasks=total_tasks,
            successful_tasks=successful_tasks,
            failed_tasks=failed_tasks,
            average_duration=average_duration,
            median_duration=median_duration,
            p95_duration=p95_duration,
            total_tokens=total_tokens,
            total_cost=total_cost,
            utilization_rate=utilization_rate,
            error_rate=error_rate,
            throughput=throughput
        )
    
    def _calculate_percentile(self, data: List[float], percentile: int) -> float:
        """パーセンタイル計算"""
        if not data:
            return 0
        sorted_data = sorted(data)
        index = int(len(sorted_data) * percentile / 100)
        return sorted_data[min(index, len(sorted_data) - 1)]
    
    def get_system_overview(self) -> Dict[str, Any]:
        """システム概要を取得"""
        if not self.system_metrics:
            return {}
        
        latest = self.system_metrics[-1]
        
        # 24時間のトレンド
        last_24h = [m for m in self.system_metrics if m.timestamp > datetime.now() - timedelta(hours=24)]
        
        return {
            'current': asdict(latest),
            'trends': {
                'avg_latency': statistics.mean([m.average_latency for m in last_24h]) if last_24h else 0,
                'avg_throughput': statistics.mean([m.throughput for m in last_24h]) if last_24h else 0,
                'avg_error_rate': statistics.mean([m.error_rate for m in last_24h]) if last_24h else 0,
            },
            'peak_usage': {
                'max_throughput': max([m.throughput for m in last_24h]) if last_24h else 0,
                'max_latency': max([m.average_latency for m in last_24h]) if last_24h else 0,
            }
        }


class AdvancedAnalyticsService:
    """高度な分析サービス"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.metrics_collector = MetricsCollector(config)
        self.report_generator = ReportGenerator(config)
        
        # 分析エンジン
        self.anomaly_detector = AnomalyDetector(config)
        self.cost_optimizer = CostOptimizer(config)
        self.performance_analyzer = PerformanceAnalyzer(config)
        
        # 定期実行タスク
        self.analysis_tasks = []
    
    async def initialize(self):
        """サービス初期化"""
        logger.info("📊 Initializing Advanced Analytics Service...")
        
        # 定期分析タスクを開始
        self.analysis_tasks = [
            asyncio.create_task(self._periodic_analysis()),
            asyncio.create_task(self._anomaly_detection_loop()),
            asyncio.create_task(self._cost_analysis_loop()),
        ]
        
        logger.info("✅ Advanced Analytics Service initialized")
    
    async def shutdown(self):
        """サービス終了"""
        for task in self.analysis_tasks:
            task.cancel()
        
        await asyncio.gather(*self.analysis_tasks, return_exceptions=True)
    
    async def record_task_completion(self, task_data: Dict[str, Any]):
        """タスク完了メトリクスを記録"""
        metrics = TaskMetrics(
            task_id=task_data['id'],
            worker_id=task_data['worker_id'],
            task_type=task_data['type'],
            status=task_data['status'],
            created_at=datetime.fromisoformat(task_data['created_at']),
            started_at=datetime.fromisoformat(task_data['started_at']) if task_data.get('started_at') else None,
            completed_at=datetime.fromisoformat(task_data['completed_at']) if task_data.get('completed_at') else None,
            duration_ms=task_data.get('duration_ms'),
            tokens_used=task_data.get('tokens_used'),
            cost=task_data.get('cost'),
            success=task_data['status'] == 'completed',
            error_type=task_data.get('error_type'),
            priority=task_data.get('priority', 'medium')
        )
        
        await self.metrics_collector.record_task_metrics(metrics)
    
    async def record_system_status(self, status_data: Dict[str, Any]):
        """システムステータスを記録"""
        metrics = SystemMetrics(
            timestamp=datetime.now(),
            total_requests=status_data['total_requests'],
            active_workers=status_data['active_workers'],
            total_workers=status_data['total_workers'],
            system_load=status_data.get('system_load', 0),
            memory_usage=status_data.get('memory_usage', 0),
            cpu_usage=status_data.get('cpu_usage', 0),
            error_rate=status_data.get('error_rate', 0),
            average_latency=status_data.get('average_latency', 0),
            throughput=status_data.get('throughput', 0)
        )
        
        await self.metrics_collector.record_system_metrics(metrics)
    
    async def generate_performance_report(self, time_range: str = '24h') -> Dict[str, Any]:
        """パフォーマンスレポート生成"""
        logger.info(f"📈 Generating performance report for {time_range}")
        
        system_overview = self.metrics_collector.get_system_overview()
        
        # Worker別分析
        worker_analyses = {}
        unique_workers = set(m.worker_id for m in self.metrics_collector.task_metrics)
        
        for worker_id in unique_workers:
            worker_metrics = self.metrics_collector.calculate_worker_metrics(worker_id)
            if worker_metrics:
                worker_analyses[worker_id] = asdict(worker_metrics)
        
        # パフォーマンス分析
        performance_insights = await self.performance_analyzer.analyze_performance()
        
        # コスト分析
        cost_analysis = await self.cost_optimizer.analyze_costs()
        
        # 異常検知結果
        anomalies = await self.anomaly_detector.get_recent_anomalies()
        
        report = {
            'timestamp': datetime.now().isoformat(),
            'time_range': time_range,
            'system_overview': system_overview,
            'worker_analysis': worker_analyses,
            'performance_insights': performance_insights,
            'cost_analysis': cost_analysis,
            'anomalies': anomalies,
            'recommendations': await self._generate_recommendations(
                worker_analyses, performance_insights, cost_analysis, anomalies
            )
        }
        
        return report
    
    async def _generate_recommendations(self, worker_analysis, performance_insights, cost_analysis, anomalies) -> List[Dict[str, Any]]:
        """改善提案を生成"""
        recommendations = []
        
        # Worker効率の改善提案
        for worker_id, metrics in worker_analysis.items():
            if metrics['error_rate'] > 5:
                recommendations.append({
                    'type': 'performance',
                    'priority': 'high',
                    'title': f'Worker {worker_id}のエラー率が高い',
                    'description': f'エラー率 {metrics["error_rate"]:.1f}% - 設定やモデルの見直しを推奨',
                    'impact': 'reliability'
                })
            
            if metrics['average_duration'] > 5000:  # 5秒以上
                recommendations.append({
                    'type': 'performance',
                    'priority': 'medium',
                    'title': f'Worker {worker_id}の応答時間が長い',
                    'description': f'平均応答時間 {metrics["average_duration"]:.0f}ms - リソース増強を検討',
                    'impact': 'latency'
                })
        
        # コスト最適化提案
        if cost_analysis.get('monthly_projection', 0) > 1000:
            recommendations.append({
                'type': 'cost',
                'priority': 'medium',
                'title': 'コスト最適化の機会',
                'description': f'月間予想コスト ${cost_analysis["monthly_projection"]:.2f} - より効率的なモデルの検討を推奨',
                'impact': 'cost'
            })
        
        # 異常検知による提案
        if anomalies:
            recommendations.append({
                'type': 'alert',
                'priority': 'high',
                'title': f'{len(anomalies)}件の異常を検出',
                'description': '詳細な調査と対応が必要です',
                'impact': 'stability'
            })
        
        return recommendations
    
    async def _periodic_analysis(self):
        """定期分析タスク"""
        while True:
            try:
                await asyncio.sleep(3600)  # 1時間ごと
                
                # 定期レポート生成
                report = await self.generate_performance_report()
                
                # レポートを保存
                await self.report_generator.save_report(report)
                
                logger.info("📊 Periodic analysis completed")
                
            except Exception as e:
                logger.error(f"Periodic analysis error: {e}")
    
    async def _anomaly_detection_loop(self):
        """異常検知ループ"""
        while True:
            try:
                await asyncio.sleep(300)  # 5分ごと
                
                await self.anomaly_detector.detect_anomalies(self.metrics_collector)
                
            except Exception as e:
                logger.error(f"Anomaly detection error: {e}")
    
    async def _cost_analysis_loop(self):
        """コスト分析ループ"""
        while True:
            try:
                await asyncio.sleep(1800)  # 30分ごと
                
                await self.cost_optimizer.analyze_usage_patterns(self.metrics_collector)
                
            except Exception as e:
                logger.error(f"Cost analysis error: {e}")


class AnomalyDetector:
    """異常検知エンジン"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.anomalies = deque(maxlen=100)
        
        # 閾値設定
        self.thresholds = {
            'error_rate': 10.0,  # 10%以上
            'latency_p95': 10000,  # 10秒以上
            'throughput_drop': 0.5,  # 50%以上の低下
        }
    
    async def detect_anomalies(self, metrics_collector: MetricsCollector):
        """異常を検知"""
        now = datetime.now()
        
        # 最近のメトリクス分析
        recent_tasks = [
            m for m in metrics_collector.task_metrics 
            if m.created_at > now - timedelta(minutes=30)
        ]
        
        if not recent_tasks:
            return
        
        # エラー率チェック
        error_rate = sum(1 for t in recent_tasks if not t.success) / len(recent_tasks) * 100
        if error_rate > self.thresholds['error_rate']:
            await self._record_anomaly('high_error_rate', f'エラー率 {error_rate:.1f}%', 'high')
        
        # レイテンシチェック
        durations = [t.duration_ms for t in recent_tasks if t.duration_ms]
        if durations:
            p95 = sorted(durations)[int(len(durations) * 0.95)]
            if p95 > self.thresholds['latency_p95']:
                await self._record_anomaly('high_latency', f'P95レイテンシ {p95}ms', 'medium')
        
        logger.debug(f"Anomaly detection completed: {len(recent_tasks)} tasks analyzed")
    
    async def _record_anomaly(self, anomaly_type: str, description: str, severity: str):
        """異常を記録"""
        anomaly = {
            'type': anomaly_type,
            'description': description,
            'severity': severity,
            'timestamp': datetime.now().isoformat(),
            'id': f"anomaly_{int(datetime.now().timestamp())}"
        }
        
        self.anomalies.append(anomaly)
        logger.warning(f"🚨 Anomaly detected: {description}")
    
    async def get_recent_anomalies(self, hours: int = 24) -> List[Dict[str, Any]]:
        """最近の異常を取得"""
        cutoff = datetime.now() - timedelta(hours=hours)
        return [
            a for a in self.anomalies 
            if datetime.fromisoformat(a['timestamp']) > cutoff
        ]


class CostOptimizer:
    """コスト最適化エンジン"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.usage_patterns = {}
        
        # モデル別コスト情報
        self.model_costs = {
            'gpt-4-turbo': {'input': 0.01, 'output': 0.03},
            'gpt-4': {'input': 0.03, 'output': 0.06},
            'claude-3-sonnet': {'input': 0.003, 'output': 0.015},
            'gemini-1.5-flash': {'input': 0.00075, 'output': 0.003},
        }
    
    async def analyze_costs(self) -> Dict[str, Any]:
        """コスト分析"""
        # ダミー実装
        return {
            'daily_cost': 45.67,
            'monthly_projection': 1370.10,
            'cost_by_model': {
                'gpt-4-turbo': 18.45,
                'claude-3-sonnet': 15.23,
                'gemini-1.5-flash': 11.99
            },
            'optimization_potential': 125.50,
            'recommendations': [
                'Claude-3-Sonnetの使用を増やすことで20%のコスト削減が可能',
                '非重要タスクでGemini-1.5-Flashを使用することを推奨'
            ]
        }
    
    async def analyze_usage_patterns(self, metrics_collector: MetricsCollector):
        """使用パターン分析"""
        # 実装は簡略化
        logger.debug("Cost usage pattern analysis completed")


class PerformanceAnalyzer:
    """パフォーマンス分析エンジン"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
    
    async def analyze_performance(self) -> Dict[str, Any]:
        """パフォーマンス分析"""
        # ダミー実装
        return {
            'overall_score': 85,
            'bottlenecks': [
                {'component': 'Review Worker', 'impact': 'medium', 'description': 'レスポンス時間が平均より長い'},
                {'component': 'Memory Sync', 'impact': 'low', 'description': '同期頻度を最適化可能'}
            ],
            'efficiency_metrics': {
                'resource_utilization': 78,
                'task_success_rate': 98.5,
                'average_queue_time': 125
            },
            'improvement_areas': [
                'Worker間の負荷バランス調整',
                'キャッシュ戦略の最適化',
                '並列処理の改善'
            ]
        }


class ReportGenerator:
    """レポート生成器"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.reports_dir = config.get('reportsDir', './reports')
    
    async def save_report(self, report: Dict[str, Any]):
        """レポートをファイルに保存"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{self.reports_dir}/performance_report_{timestamp}.json"
        
        try:
            async with aiofiles.open(filename, 'w') as f:
                await f.write(json.dumps(report, indent=2, ensure_ascii=False))
            
            logger.info(f"📄 Report saved: {filename}")
            
        except Exception as e:
            logger.error(f"Failed to save report: {e}")


# 使用例
async def main():
    config = {
        'reportsDir': './reports',
        'anomalyThresholds': {
            'error_rate': 5.0,
            'latency_p95': 5000
        }
    }
    
    analytics = AdvancedAnalyticsService(config)
    await analytics.initialize()
    
    # テストデータ記録
    await analytics.record_task_completion({
        'id': 'test-001',
        'worker_id': 'worker-001',
        'type': 'code_generation',
        'status': 'completed',
        'created_at': datetime.now().isoformat(),
        'started_at': datetime.now().isoformat(),
        'completed_at': datetime.now().isoformat(),
        'duration_ms': 1500,
        'tokens_used': 250,
        'cost': 0.05,
        'priority': 'medium'
    })
    
    # レポート生成
    report = await analytics.generate_performance_report('1h')
    print(f"📊 Generated report with {len(report['worker_analysis'])} workers analyzed")
    
    await analytics.shutdown()


if __name__ == "__main__":
    asyncio.run(main())