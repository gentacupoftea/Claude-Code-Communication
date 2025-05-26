"""
Error Detector - エラー検知システム
リアルタイムエラー検知・分類・自動修復トリガーシステム
"""

import asyncio
import logging
import json
import os
import re
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum
import subprocess
import traceback
from pathlib import Path
import warnings

# Optional imports with graceful fallbacks
try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False
    warnings.warn("psutil not available - system resource monitoring will be disabled", UserWarning)

class ErrorSeverity(Enum):
    """エラー重要度"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"

class ErrorCategory(Enum):
    """エラーカテゴリ"""
    SYSTEM = "system"
    APPLICATION = "application"
    DATABASE = "database"
    NETWORK = "network"
    SECURITY = "security"
    PERFORMANCE = "performance"
    BUILD = "build"
    DEPLOYMENT = "deployment"

@dataclass
class DetectedError:
    """検知されたエラー"""
    id: str
    category: ErrorCategory
    severity: ErrorSeverity
    title: str
    description: str
    source: str
    timestamp: datetime
    data: Dict[str, Any]
    stack_trace: str = None
    affected_systems: List[str] = None
    user_impact: str = None
    auto_fixable: bool = False
    fix_confidence: float = 0.0
    
    def __post_init__(self):
        if self.affected_systems is None:
            self.affected_systems = []

class ErrorDetector:
    """リアルタイムエラー検知システム"""
    
    def __init__(self, project_root: str = None):
        """初期化"""
        self.logger = logging.getLogger(__name__)
        self.project_root = project_root or os.getcwd()
        
        # 検知設定
        self.detection_enabled = os.getenv('ERROR_DETECTION_ENABLED', 'true').lower() == 'true'
        self.monitoring_interval = int(os.getenv('MONITORING_INTERVAL', 5))
        
        # 検知したエラー
        self.detected_errors: Dict[str, DetectedError] = {}
        self.error_callbacks: List[Callable[[DetectedError], None]] = []
        
        # ファイル監視
        self.monitored_files = set()
        self.file_checksums = {}
        
        # ログパターン
        self.error_patterns = {
            'javascript': [
                r'Error: (.+)',
                r'TypeError: (.+)',
                r'ReferenceError: (.+)',
                r'SyntaxError: (.+)',
                r'Uncaught \(in promise\) (.+)',
                r'Failed to compile\.(.+)',
                r'Module not found: (.+)'
            ],
            'python': [
                r'Traceback \(most recent call last\):',
                r'(\w+Error): (.+)',
                r'Exception: (.+)',
                r'AttributeError: (.+)',
                r'ModuleNotFoundError: (.+)',
                r'ImportError: (.+)'
            ],
            'system': [
                r'Error: (.+)',
                r'FAILED: (.+)',
                r'ERROR: (.+)',
                r'CRITICAL: (.+)',
                r'FATAL: (.+)'
            ]
        }
        
        # パフォーマンス閾値
        self.performance_thresholds = {
            'cpu_usage': 90,  # %
            'memory_usage': 85,  # %
            'disk_usage': 90,  # %
            'response_time': 5000,  # ms
            'error_rate': 5  # %
        }
    
    async def start_monitoring(self):
        """監視開始"""
        if not self.detection_enabled:
            self.logger.info("Error detection is disabled")
            return
        
        self.logger.info("🔍 Starting error detection monitoring...")
        
        # 並行監視タスク開始
        await asyncio.gather(
            self._monitor_log_files(),
            self._monitor_system_resources(),
            self._monitor_application_health(),
            self._monitor_build_processes(),
            self._monitor_network_connectivity(),
            return_exceptions=True
        )
    
    def add_error_callback(self, callback: Callable[[DetectedError], None]):
        """エラー検知時のコールバック追加"""
        self.error_callbacks.append(callback)
    
    async def _monitor_log_files(self):
        """ログファイル監視"""
        log_files = [
            'frontend/build_error.txt',
            'backend.log',
            'frontend-server.log',
            'logs/*.log'
        ]
        
        while True:
            try:
                for log_pattern in log_files:
                    log_paths = list(Path(self.project_root).glob(log_pattern))
                    
                    for log_path in log_paths:
                        if log_path.exists() and log_path.is_file():
                            await self._check_log_file(str(log_path))
                
                await asyncio.sleep(self.monitoring_interval)
                
            except Exception as e:
                self.logger.error(f"Log monitoring error: {e}")
                await asyncio.sleep(30)
    
    async def _check_log_file(self, file_path: str):
        """個別ログファイルチェック"""
        try:
            # ファイル変更チェック
            current_mtime = os.path.getmtime(file_path)
            last_mtime = self.file_checksums.get(file_path, 0)
            
            if current_mtime > last_mtime:
                self.file_checksums[file_path] = current_mtime
                
                # 新しい内容を読み取り
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                
                # エラーパターンマッチング
                errors = self._extract_errors_from_content(content, file_path)
                
                for error in errors:
                    await self._handle_detected_error(error)
        
        except Exception as e:
            self.logger.debug(f"Log file check error for {file_path}: {e}")
    
    def _extract_errors_from_content(self, content: str, source: str) -> List[DetectedError]:
        """コンテンツからエラー抽出"""
        errors = []
        lines = content.split('\n')
        
        for i, line in enumerate(lines):
            # JavaScriptエラー検出
            for pattern in self.error_patterns['javascript']:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    error = self._create_error_from_match(
                        match, line, source, i + 1, ErrorCategory.APPLICATION
                    )
                    errors.append(error)
            
            # Pythonエラー検出
            for pattern in self.error_patterns['python']:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    # Pythonトレースバック情報収集
                    stack_trace = self._extract_python_traceback(lines, i)
                    error = self._create_error_from_match(
                        match, line, source, i + 1, ErrorCategory.APPLICATION, stack_trace
                    )
                    errors.append(error)
            
            # システムエラー検出
            for pattern in self.error_patterns['system']:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    error = self._create_error_from_match(
                        match, line, source, i + 1, ErrorCategory.SYSTEM
                    )
                    errors.append(error)
        
        return errors
    
    def _create_error_from_match(self, 
                                match, 
                                line: str, 
                                source: str, 
                                line_number: int,
                                category: ErrorCategory,
                                stack_trace: str = None) -> DetectedError:
        """マッチしたパターンからエラーオブジェクト作成"""
        error_text = match.group(1) if match.groups() else match.group(0)
        
        # エラー重要度判定
        severity = self._determine_severity(error_text, line)
        
        # 自動修復可能性判定
        auto_fixable, fix_confidence = self._assess_auto_fix_potential(error_text, category)
        
        # 影響システム特定
        affected_systems = self._identify_affected_systems(error_text, source)
        
        error_id = f"{source}:{line_number}:{hash(error_text) % 10000}"
        
        return DetectedError(
            id=error_id,
            category=category,
            severity=severity,
            title=f"{category.value.title()} Error",
            description=error_text[:200],
            source=source,
            timestamp=datetime.now(),
            data={
                'line_number': line_number,
                'full_line': line,
                'error_pattern': error_text
            },
            stack_trace=stack_trace,
            affected_systems=affected_systems,
            auto_fixable=auto_fixable,
            fix_confidence=fix_confidence
        )
    
    def _extract_python_traceback(self, lines: List[str], start_index: int) -> str:
        """Pythonトレースバック抽出"""
        traceback_lines = []
        
        # トレースバック開始検出
        if "Traceback (most recent call last):" in lines[start_index]:
            i = start_index
            while i < len(lines) and i < start_index + 20:  # 最大20行
                traceback_lines.append(lines[i])
                if re.match(r'^\w+Error:', lines[i]):
                    break
                i += 1
        
        return '\n'.join(traceback_lines) if traceback_lines else None
    
    def _determine_severity(self, error_text: str, context: str) -> ErrorSeverity:
        """エラー重要度判定"""
        error_lower = error_text.lower()
        context_lower = context.lower()
        
        # CRITICAL条件
        critical_keywords = ['fatal', 'critical', 'crash', 'segmentation fault', 'core dump']
        if any(keyword in error_lower for keyword in critical_keywords):
            return ErrorSeverity.CRITICAL
        
        # HIGH条件  
        high_keywords = ['failed to compile', 'module not found', 'cannot read', 'permission denied']
        if any(keyword in error_lower for keyword in high_keywords):
            return ErrorSeverity.HIGH
        
        # MEDIUM条件
        medium_keywords = ['warning', 'deprecated', 'missing']
        if any(keyword in error_lower for keyword in medium_keywords):
            return ErrorSeverity.MEDIUM
        
        # LOW条件
        low_keywords = ['info', 'debug', 'verbose']
        if any(keyword in context_lower for keyword in low_keywords):
            return ErrorSeverity.LOW
        
        return ErrorSeverity.MEDIUM
    
    def _assess_auto_fix_potential(self, error_text: str, category: ErrorCategory) -> tuple[bool, float]:
        """自動修復可能性評価"""
        error_lower = error_text.lower()
        
        # 高い自動修復可能性
        high_confidence_patterns = [
            'module not found',
            'missing dependency',
            'import error',
            'package not installed'
        ]
        
        for pattern in high_confidence_patterns:
            if pattern in error_lower:
                return True, 0.8
        
        # 中程度の自動修復可能性
        medium_confidence_patterns = [
            'syntax error',
            'type error',
            'reference error',
            'configuration error'
        ]
        
        for pattern in medium_confidence_patterns:
            if pattern in error_lower:
                return True, 0.6
        
        # 低い自動修復可能性
        if category in [ErrorCategory.APPLICATION, ErrorCategory.BUILD]:
            return True, 0.4
        
        return False, 0.0
    
    def _identify_affected_systems(self, error_text: str, source: str) -> List[str]:
        """影響システム特定"""
        affected = []
        error_lower = error_text.lower()
        
        # フロントエンド
        if any(keyword in source.lower() for keyword in ['frontend', 'react', 'js', 'tsx']):
            affected.append('frontend')
        
        # バックエンド
        if any(keyword in source.lower() for keyword in ['backend', 'server', 'api', 'py']):
            affected.append('backend')
        
        # データベース
        if any(keyword in error_lower for keyword in ['database', 'sql', 'connection', 'postgresql']):
            affected.append('database')
        
        # ビルドシステム
        if any(keyword in source.lower() for keyword in ['build', 'webpack', 'babel', 'typescript']):
            affected.append('build_system')
        
        return affected or ['unknown']
    
    async def _monitor_system_resources(self):
        """システムリソース監視"""
        if not PSUTIL_AVAILABLE:
            self.logger.warning("psutil not available - skipping system resource monitoring")
            return
            
        while True:
            try:
                # CPU使用率チェック
                cpu_percent = psutil.cpu_percent(interval=1)
                if cpu_percent > self.performance_thresholds['cpu_usage']:
                    await self._create_performance_error(
                        'High CPU Usage',
                        f'CPU usage is {cpu_percent}%',
                        {'cpu_percent': cpu_percent}
                    )
                
                # メモリ使用率チェック
                memory = psutil.virtual_memory()
                if memory.percent > self.performance_thresholds['memory_usage']:
                    await self._create_performance_error(
                        'High Memory Usage',
                        f'Memory usage is {memory.percent}%',
                        {'memory_percent': memory.percent, 'available_gb': memory.available / (1024**3)}
                    )
                
                # ディスク使用率チェック
                disk = psutil.disk_usage('/')
                disk_percent = (disk.used / disk.total) * 100
                if disk_percent > self.performance_thresholds['disk_usage']:
                    await self._create_performance_error(
                        'High Disk Usage',
                        f'Disk usage is {disk_percent:.1f}%',
                        {'disk_percent': disk_percent, 'free_gb': disk.free / (1024**3)}
                    )
                
                await asyncio.sleep(self.monitoring_interval * 2)
                
            except Exception as e:
                self.logger.error(f"System resource monitoring error: {e}")
                await asyncio.sleep(60)
    
    async def _create_performance_error(self, title: str, description: str, data: Dict[str, Any]):
        """パフォーマンスエラー作成"""
        error = DetectedError(
            id=f"perf:{title.lower().replace(' ', '_')}:{int(datetime.now().timestamp())}",
            category=ErrorCategory.PERFORMANCE,
            severity=ErrorSeverity.HIGH,
            title=title,
            description=description,
            source="system_monitor",
            timestamp=datetime.now(),
            data=data,
            affected_systems=["system"],
            auto_fixable=True,
            fix_confidence=0.7
        )
        
        await self._handle_detected_error(error)
    
    async def _monitor_application_health(self):
        """アプリケーション健全性監視"""
        while True:
            try:
                # フロントエンド開発サーバーチェック
                await self._check_frontend_health()
                
                # バックエンドAPIチェック
                await self._check_backend_health()
                
                await asyncio.sleep(self.monitoring_interval * 3)
                
            except Exception as e:
                self.logger.error(f"Application health monitoring error: {e}")
                await asyncio.sleep(60)
    
    async def _check_frontend_health(self):
        """フロントエンド健全性チェック"""
        try:
            # package.jsonの存在確認
            package_json_path = Path(self.project_root) / 'frontend' / 'package.json'
            if not package_json_path.exists():
                await self._create_app_error(
                    'Frontend Configuration Missing',
                    'package.json not found in frontend directory',
                    ErrorSeverity.HIGH
                )
            
            # node_modulesの存在確認
            node_modules_path = Path(self.project_root) / 'frontend' / 'node_modules'
            if not node_modules_path.exists():
                await self._create_app_error(
                    'Frontend Dependencies Missing',
                    'node_modules directory not found',
                    ErrorSeverity.MEDIUM
                )
        
        except Exception as e:
            self.logger.debug(f"Frontend health check error: {e}")
    
    async def _check_backend_health(self):
        """バックエンド健全性チェック"""
        try:
            # requirements.txtの存在確認
            requirements_path = Path(self.project_root) / 'requirements.txt'
            if not requirements_path.exists():
                await self._create_app_error(
                    'Backend Dependencies Configuration Missing',
                    'requirements.txt not found',
                    ErrorSeverity.MEDIUM
                )
            
            # Pythonファイルの基本構文チェック
            python_files = list(Path(self.project_root).glob('**/*.py'))
            for py_file in python_files[:5]:  # 最初の5ファイルのみチェック
                await self._check_python_syntax(py_file)
        
        except Exception as e:
            self.logger.debug(f"Backend health check error: {e}")
    
    async def _check_python_syntax(self, file_path: Path):
        """Python構文チェック"""
        try:
            result = subprocess.run(
                ['python', '-m', 'py_compile', str(file_path)],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode != 0:
                await self._create_app_error(
                    'Python Syntax Error',
                    f'Syntax error in {file_path.name}: {result.stderr}',
                    ErrorSeverity.HIGH
                )
        
        except subprocess.TimeoutExpired:
            pass
        except Exception as e:
            self.logger.debug(f"Python syntax check error for {file_path}: {e}")
    
    async def _create_app_error(self, title: str, description: str, severity: ErrorSeverity):
        """アプリケーションエラー作成"""
        error = DetectedError(
            id=f"app:{title.lower().replace(' ', '_')}:{int(datetime.now().timestamp())}",
            category=ErrorCategory.APPLICATION,
            severity=severity,
            title=title,
            description=description,
            source="application_monitor",
            timestamp=datetime.now(),
            data={'monitor_type': 'application_health'},
            affected_systems=["application"],
            auto_fixable=True,
            fix_confidence=0.6
        )
        
        await self._handle_detected_error(error)
    
    async def _monitor_build_processes(self):
        """ビルドプロセス監視"""
        while True:
            try:
                # ビルドエラーファイル監視
                build_error_files = [
                    'frontend/build_error.txt',
                    'build.log',
                    'npm-debug.log'
                ]
                
                for error_file in build_error_files:
                    error_path = Path(self.project_root) / error_file
                    if error_path.exists():
                        await self._check_build_errors(error_path)
                
                await asyncio.sleep(self.monitoring_interval)
                
            except Exception as e:
                self.logger.error(f"Build process monitoring error: {e}")
                await asyncio.sleep(30)
    
    async def _check_build_errors(self, file_path: Path):
        """ビルドエラーチェック"""
        try:
            if file_path.stat().st_size > 0:  # ファイルが空でない
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                
                # ビルドエラーパターン検出
                build_errors = self._extract_build_errors(content, str(file_path))
                
                for error in build_errors:
                    await self._handle_detected_error(error)
        
        except Exception as e:
            self.logger.debug(f"Build error check failed for {file_path}: {e}")
    
    def _extract_build_errors(self, content: str, source: str) -> List[DetectedError]:
        """ビルドエラー抽出"""
        errors = []
        build_patterns = [
            r'Failed to compile',
            r'Module not found: (.+)',
            r'Syntax error: (.+)',
            r'Type error: (.+)',
            r'Build failed with (\d+) error',
            r'npm ERR! (.+)'
        ]
        
        for pattern in build_patterns:
            matches = re.finditer(pattern, content, re.IGNORECASE | re.MULTILINE)
            for match in matches:
                error_text = match.group(1) if match.groups() else match.group(0)
                
                error = DetectedError(
                    id=f"build:{hash(error_text) % 10000}:{int(datetime.now().timestamp())}",
                    category=ErrorCategory.BUILD,
                    severity=ErrorSeverity.HIGH,
                    title="Build Error",
                    description=error_text[:200],
                    source=source,
                    timestamp=datetime.now(),
                    data={'build_error': error_text},
                    affected_systems=["build_system"],
                    auto_fixable=True,
                    fix_confidence=0.7
                )
                errors.append(error)
        
        return errors
    
    async def _monitor_network_connectivity(self):
        """ネットワーク接続監視"""
        while True:
            try:
                # 重要なネットワーク接続チェック
                endpoints = [
                    'api.github.com',
                    'registry.npmjs.org',
                    'pypi.org'
                ]
                
                for endpoint in endpoints:
                    await self._check_network_endpoint(endpoint)
                
                await asyncio.sleep(self.monitoring_interval * 4)
                
            except Exception as e:
                self.logger.error(f"Network monitoring error: {e}")
                await asyncio.sleep(120)
    
    async def _check_network_endpoint(self, endpoint: str):
        """ネットワークエンドポイントチェック"""
        try:
            result = subprocess.run(
                ['ping', '-c', '1', '-W', '5000', endpoint],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode != 0:
                error = DetectedError(
                    id=f"network:{endpoint}:{int(datetime.now().timestamp())}",
                    category=ErrorCategory.NETWORK,
                    severity=ErrorSeverity.MEDIUM,
                    title="Network Connectivity Issue",
                    description=f"Cannot reach {endpoint}",
                    source="network_monitor",
                    timestamp=datetime.now(),
                    data={'endpoint': endpoint, 'ping_result': result.stderr},
                    affected_systems=["network"],
                    auto_fixable=False,
                    fix_confidence=0.2
                )
                
                await self._handle_detected_error(error)
        
        except subprocess.TimeoutExpired:
            pass
        except Exception as e:
            self.logger.debug(f"Network check error for {endpoint}: {e}")
    
    async def _handle_detected_error(self, error: DetectedError):
        """検知されたエラーの処理"""
        # 重複エラーチェック
        if error.id in self.detected_errors:
            return
        
        self.detected_errors[error.id] = error
        
        self.logger.error(
            f"🚨 Error detected: [{error.severity.value.upper()}] {error.title} - {error.description}"
        )
        
        # コールバック実行
        for callback in self.error_callbacks:
            try:
                await callback(error) if asyncio.iscoroutinefunction(callback) else callback(error)
            except Exception as e:
                self.logger.error(f"Error callback failed: {e}")
    
    def get_detected_errors(self, 
                           severity: ErrorSeverity = None,
                           category: ErrorCategory = None,
                           limit: int = 50) -> List[DetectedError]:
        """検知されたエラー取得"""
        errors = list(self.detected_errors.values())
        
        # フィルタリング
        if severity:
            errors = [e for e in errors if e.severity == severity]
        if category:
            errors = [e for e in errors if e.category == category]
        
        # 時間順ソート（新しい順）
        errors.sort(key=lambda e: e.timestamp, reverse=True)
        
        return errors[:limit]
    
    def get_error_statistics(self) -> Dict[str, Any]:
        """エラー統計情報取得"""
        errors = list(self.detected_errors.values())
        
        # カテゴリ別統計
        category_stats = {}
        for category in ErrorCategory:
            category_errors = [e for e in errors if e.category == category]
            category_stats[category.value] = len(category_errors)
        
        # 重要度別統計
        severity_stats = {}
        for severity in ErrorSeverity:
            severity_errors = [e for e in errors if e.severity == severity]
            severity_stats[severity.value] = len(severity_errors)
        
        # 自動修復可能性統計
        auto_fixable_count = len([e for e in errors if e.auto_fixable])
        
        return {
            'total_errors': len(errors),
            'category_breakdown': category_stats,
            'severity_breakdown': severity_stats,
            'auto_fixable_errors': auto_fixable_count,
            'auto_fix_percentage': (auto_fixable_count / len(errors) * 100) if errors else 0,
            'recent_errors_24h': len([e for e in errors if e.timestamp > datetime.now() - timedelta(hours=24)])
        }
    
    def clear_old_errors(self, hours: int = 24):
        """古いエラーのクリア"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        
        old_error_ids = [
            error_id for error_id, error in self.detected_errors.items()
            if error.timestamp < cutoff_time
        ]
        
        for error_id in old_error_ids:
            del self.detected_errors[error_id]
        
        if old_error_ids:
            self.logger.info(f"Cleared {len(old_error_ids)} old errors (older than {hours}h)")
    
    async def stop_monitoring(self):
        """監視停止"""
        self.detection_enabled = False
        self.logger.info("🛑 Error detection monitoring stopped")