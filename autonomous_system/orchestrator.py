"""
Autonomous Orchestrator - 自律オーケストレーター
マルチLLMエージェントの調整・タスク管理・自動修復を統括する中央制御システム
"""

import asyncio
import logging
import json
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from enum import Enum
import uuid

from .multi_llm_client import MultiLLMClient
from .agents.claude_agent import ClaudeAnalysisAgent
from .agents.openai_agent import OpenAICodeAgent
from .agents.gemini_agent import GeminiInfraAgent

class TaskStatus(Enum):
    """タスク実行状況"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    RETRY = "retry"

class TaskPriority(Enum):
    """タスク優先度"""
    CRITICAL = 1
    HIGH = 2
    MEDIUM = 3
    LOW = 4

@dataclass
class AutonomousTask:
    """自律タスク定義"""
    id: str
    task_type: str
    priority: TaskPriority
    description: str
    data: Dict[str, Any]
    dependencies: List[str] = None
    assigned_agent: str = None
    status: TaskStatus = TaskStatus.PENDING
    created_at: datetime = None
    started_at: datetime = None
    completed_at: datetime = None
    result: Dict[str, Any] = None
    error: str = None
    retry_count: int = 0
    max_retries: int = 3
    estimated_duration: int = 300  # seconds
    
    def __post_init__(self):
        if self.dependencies is None:
            self.dependencies = []
        if self.created_at is None:
            self.created_at = datetime.now()

class AutonomousOrchestrator:
    """自律システムオーケストレーター"""
    
    def __init__(self):
        """初期化"""
        self.logger = logging.getLogger(__name__)
        
        # LLMクライアントとエージェント初期化
        self.llm_client = MultiLLMClient()
        self.claude_agent = ClaudeAnalysisAgent(self.llm_client)
        self.openai_agent = OpenAICodeAgent(self.llm_client)
        self.gemini_agent = GeminiInfraAgent(self.llm_client)
        
        # タスク管理
        self.tasks: Dict[str, AutonomousTask] = {}
        self.task_queue: List[str] = []
        self.running_tasks: Dict[str, asyncio.Task] = {}
        
        # システム状態
        self.is_running = False
        self.max_concurrent_tasks = 3
        self.health_check_interval = 60  # seconds
        self.auto_repair_enabled = True
        
        # 統計情報
        self.execution_stats = {
            'total_tasks': 0,
            'completed_tasks': 0,
            'failed_tasks': 0,
            'auto_repairs': 0,
            'uptime_start': datetime.now()
        }
        
        # エージェントマッピング
        self.agent_mapping = {
            'claude': self.claude_agent,
            'openai': self.openai_agent,
            'gemini': self.gemini_agent
        }
    
    async def start(self):
        """オーケストレーター開始"""
        if self.is_running:
            self.logger.warning("Orchestrator is already running")
            return
        
        self.is_running = True
        self.logger.info("🤖 Autonomous Orchestrator started")
        
        # バックグラウンドタスク開始
        await asyncio.gather(
            self._task_executor(),
            self._health_monitor(),
            self._system_optimizer(),
            return_exceptions=True
        )
    
    async def stop(self):
        """オーケストレーター停止"""
        self.is_running = False
        
        # 実行中タスクの完了待機
        if self.running_tasks:
            self.logger.info(f"Waiting for {len(self.running_tasks)} running tasks to complete...")
            await asyncio.gather(*self.running_tasks.values(), return_exceptions=True)
        
        self.logger.info("🛑 Autonomous Orchestrator stopped")
    
    def create_task(self, 
                   task_type: str,
                   description: str,
                   data: Dict[str, Any],
                   priority: TaskPriority = TaskPriority.MEDIUM,
                   dependencies: List[str] = None) -> str:
        """新規タスク作成"""
        task_id = str(uuid.uuid4())
        
        task = AutonomousTask(
            id=task_id,
            task_type=task_type,
            priority=priority,
            description=description,
            data=data,
            dependencies=dependencies or []
        )
        
        # 最適エージェント自動選択
        task.assigned_agent = self._select_optimal_agent(task_type)
        
        self.tasks[task_id] = task
        self._add_to_queue(task_id)
        
        self.logger.info(f"📋 Task created: {task_id} ({task_type}) -> {task.assigned_agent}")
        return task_id
    
    async def execute_emergency_response(self, incident_data: Dict[str, Any]) -> Dict[str, Any]:
        """緊急事態対応実行"""
        self.logger.critical(f"🚨 Emergency response triggered: {incident_data}")
        
        # 緊急タスク作成（最高優先度）
        emergency_tasks = []
        
        # 1. Claude による緊急事態分析
        analysis_task_id = self.create_task(
            task_type="strategic_analysis",
            description="Emergency incident analysis",
            data=incident_data,
            priority=TaskPriority.CRITICAL
        )
        emergency_tasks.append(analysis_task_id)
        
        # 2. Gemini による即座のシステム監視強化
        monitoring_task_id = self.create_task(
            task_type="real_time_monitoring", 
            description="Enhanced emergency monitoring",
            data=incident_data,
            priority=TaskPriority.CRITICAL
        )
        emergency_tasks.append(monitoring_task_id)
        
        # 3. 分析結果待機後のOpenAI修復実行
        # (依存関係設定で順次実行)
        
        # 緊急実行（通常キューをバイパス）
        results = {}
        for task_id in emergency_tasks:
            result = await self._execute_task_immediately(task_id)
            results[task_id] = result
        
        # 修復タスクの動的生成
        if analysis_task_id in results and results[analysis_task_id].get('success'):
            analysis_result = results[analysis_task_id]
            
            # Claude分析結果に基づく修復タスク生成
            if 'structured_analysis' in analysis_result:
                fix_tasks = await self._generate_fix_tasks(analysis_result['structured_analysis'])
                for fix_task_id in fix_tasks:
                    fix_result = await self._execute_task_immediately(fix_task_id)
                    results[fix_task_id] = fix_result
        
        self.execution_stats['auto_repairs'] += 1
        return {
            'emergency_id': str(uuid.uuid4()),
            'handled_at': datetime.now().isoformat(),
            'tasks_executed': list(results.keys()),
            'results': results,
            'success': all(r.get('success', False) for r in results.values())
        }
    
    async def health_check(self) -> Dict[str, Any]:
        """システム健全性チェック"""
        health_status = {
            'orchestrator': {
                'status': 'healthy' if self.is_running else 'stopped',
                'uptime_hours': (datetime.now() - self.execution_stats['uptime_start']).total_seconds() / 3600,
                'task_queue_size': len(self.task_queue),
                'running_tasks': len(self.running_tasks)
            },
            'agents': {
                'claude': self.claude_agent.get_agent_info(),
                'openai': self.openai_agent.get_agent_info(), 
                'gemini': self.gemini_agent.get_agent_info()
            },
            'llm_health': await self.llm_client.health_check(),
            'execution_stats': self.execution_stats.copy()
        }
        
        # 総合健全性スコア計算
        health_score = self._calculate_health_score(health_status)
        health_status['overall_health_score'] = health_score
        health_status['status'] = 'healthy' if health_score > 80 else 'degraded' if health_score > 50 else 'critical'
        
        return health_status
    
    async def _task_executor(self):
        """タスク実行エンジン"""
        while self.is_running:
            try:
                # 実行可能タスクの特定
                executable_tasks = self._get_executable_tasks()
                
                # 同時実行数制限内でタスク実行
                for task_id in executable_tasks[:self.max_concurrent_tasks - len(self.running_tasks)]:
                    if task_id not in self.running_tasks:
                        task_coroutine = self._execute_task(task_id)
                        self.running_tasks[task_id] = asyncio.create_task(task_coroutine)
                
                # 完了タスクのクリーンアップ
                completed_tasks = []
                for task_id, task_future in self.running_tasks.items():
                    if task_future.done():
                        completed_tasks.append(task_id)
                
                for task_id in completed_tasks:
                    del self.running_tasks[task_id]
                
                await asyncio.sleep(1)  # 1秒間隔でチェック
                
            except Exception as e:
                self.logger.error(f"Task executor error: {e}")
                await asyncio.sleep(5)
    
    async def _execute_task(self, task_id: str) -> Dict[str, Any]:
        """個別タスク実行"""
        task = self.tasks[task_id]
        task.status = TaskStatus.RUNNING
        task.started_at = datetime.now()
        
        try:
            self.logger.info(f"🔄 Executing task: {task_id} ({task.task_type})")
            
            # エージェント取得
            agent = self.agent_mapping[task.assigned_agent]
            
            # タスクタイプに応じた実行
            result = await self._dispatch_task_to_agent(agent, task)
            
            if result.get('success'):
                task.status = TaskStatus.COMPLETED
                task.result = result
                self.execution_stats['completed_tasks'] += 1
                self.logger.info(f"✅ Task completed: {task_id}")
            else:
                raise Exception(result.get('error', 'Unknown error'))
                
        except Exception as e:
            self.logger.error(f"❌ Task failed: {task_id} - {e}")
            task.error = str(e)
            task.retry_count += 1
            
            if task.retry_count < task.max_retries:
                task.status = TaskStatus.RETRY
                self._add_to_queue(task_id)  # 再キューイング
                self.logger.info(f"🔄 Task queued for retry: {task_id} (attempt {task.retry_count + 1})")
            else:
                task.status = TaskStatus.FAILED
                self.execution_stats['failed_tasks'] += 1
                
                # 自動修復試行
                if self.auto_repair_enabled:
                    await self._attempt_auto_repair(task)
        
        finally:
            task.completed_at = datetime.now()
            
        return task.result or {'success': False, 'error': task.error}
    
    async def _execute_task_immediately(self, task_id: str) -> Dict[str, Any]:
        """緊急タスクの即座実行（キューをバイパス）"""
        return await self._execute_task(task_id)
    
    async def _dispatch_task_to_agent(self, agent, task: AutonomousTask) -> Dict[str, Any]:
        """エージェントへのタスク振り分け実行"""
        if task.assigned_agent == 'claude':
            if task.task_type == 'strategic_analysis':
                return await agent.strategic_analysis(task.data)
            elif task.task_type == 'quality_review':
                return await agent.quality_review(task.data)
            elif task.task_type == 'incident_coordination':
                return await agent.incident_coordination(task.data)
            elif task.task_type == 'architecture_design':
                return await agent.architecture_design(task.data)
            elif task.task_type == 'business_intelligence':
                return await agent.business_intelligence_analysis(task.data)
        
        elif task.assigned_agent == 'openai':
            if task.task_type == 'code_generation' or task.task_type == 'bug_fixing':
                return await agent.generate_fix_code(task.data, task.data.get('requirements', {}))
            elif task.task_type == 'api_integration':
                return await agent.api_integration(task.data)
            elif task.task_type == 'test_generation':
                return await agent.automated_testing(task.data)
            elif task.task_type == 'refactoring':
                return await agent.code_refactoring(task.data)
            elif task.task_type == 'bug_diagnosis':
                return await agent.bug_diagnosis_and_fix(task.data)
        
        elif task.assigned_agent == 'gemini':
            if task.task_type == 'real_time_monitoring':
                return await agent.real_time_monitoring(task.data)
            elif task.task_type == 'cloud_operations':
                return await agent.cloud_operations(task.data)
            elif task.task_type == 'performance_optimization':
                return await agent.performance_optimization(task.data)
            elif task.task_type == 'data_processing':
                return await agent.data_processing_optimization(task.data)
            elif task.task_type == 'infrastructure_management':
                return await agent.infrastructure_as_code(task.data)
        
        return {'success': False, 'error': f'Unknown task type: {task.task_type}'}
    
    def _select_optimal_agent(self, task_type: str) -> str:
        """タスクタイプに基づく最適エージェント選択"""
        return self.llm_client.task_routing.get(task_type, 'claude')
    
    def _add_to_queue(self, task_id: str):
        """タスクをキューに追加（優先度順）"""
        task = self.tasks[task_id]
        
        # 優先度順でソートして挿入
        inserted = False
        for i, queued_task_id in enumerate(self.task_queue):
            queued_task = self.tasks[queued_task_id]
            if task.priority.value < queued_task.priority.value:
                self.task_queue.insert(i, task_id)
                inserted = True
                break
        
        if not inserted:
            self.task_queue.append(task_id)
    
    def _get_executable_tasks(self) -> List[str]:
        """実行可能タスクの取得（依存関係チェック）"""
        executable = []
        
        for task_id in self.task_queue[:]:
            task = self.tasks[task_id]
            
            # 依存関係チェック
            if self._check_dependencies(task):
                executable.append(task_id)
                self.task_queue.remove(task_id)
        
        return executable
    
    def _check_dependencies(self, task: AutonomousTask) -> bool:
        """タスク依存関係チェック"""
        for dep_id in task.dependencies:
            if dep_id in self.tasks:
                dep_task = self.tasks[dep_id]
                if dep_task.status != TaskStatus.COMPLETED:
                    return False
        return True
    
    async def _health_monitor(self):
        """健全性監視バックグラウンドタスク"""
        while self.is_running:
            try:
                health = await self.health_check()
                
                if health['overall_health_score'] < 50:
                    self.logger.warning(f"⚠️ System health degraded: {health['overall_health_score']}/100")
                    # 自動修復トリガー
                    if self.auto_repair_enabled:
                        await self._trigger_system_repair(health)
                
                await asyncio.sleep(self.health_check_interval)
                
            except Exception as e:
                self.logger.error(f"Health monitor error: {e}")
                await asyncio.sleep(30)
    
    async def _system_optimizer(self):
        """システム最適化バックグラウンドタスク"""
        while self.is_running:
            try:
                # 30分ごとにシステム最適化実行
                await asyncio.sleep(1800)
                
                if not self.is_running:
                    break
                
                self.logger.info("🔧 Running system optimization...")
                
                # パフォーマンス最適化タスク生成
                optimization_task_id = self.create_task(
                    task_type="performance_optimization",
                    description="Scheduled system optimization",
                    data={
                        'performance_data': await self._collect_performance_metrics(),
                        'optimization_type': 'scheduled_maintenance'
                    },
                    priority=TaskPriority.LOW
                )
                
            except Exception as e:
                self.logger.error(f"System optimizer error: {e}")
    
    async def _generate_fix_tasks(self, analysis_result: Dict[str, Any]) -> List[str]:
        """分析結果に基づく修復タスク生成"""
        fix_tasks = []
        
        if 'agent_assignment' in analysis_result:
            assignment = analysis_result['agent_assignment']
            
            if assignment.get('primary_agent') == 'openai':
                # コード修復タスク生成
                fix_task_id = self.create_task(
                    task_type="bug_fixing",
                    description="Auto-generated fix from analysis",
                    data={
                        'error_data': analysis_result,
                        'requirements': {
                            'tech_stack': 'React, Node.js, TypeScript',
                            'auto_generated': True
                        }
                    },
                    priority=TaskPriority.HIGH
                )
                fix_tasks.append(fix_task_id)
            
            elif assignment.get('primary_agent') == 'gemini':
                # インフラ修復タスク生成
                fix_task_id = self.create_task(
                    task_type="cloud_operations",
                    description="Auto-generated infrastructure fix",
                    data={
                        'cloud_config': analysis_result,
                        'auto_repair': True
                    },
                    priority=TaskPriority.HIGH
                )
                fix_tasks.append(fix_task_id)
        
        return fix_tasks
    
    async def _attempt_auto_repair(self, failed_task: AutonomousTask):
        """失敗タスクの自動修復試行"""
        self.logger.info(f"🔧 Attempting auto-repair for failed task: {failed_task.id}")
        
        # 修復方針分析タスク生成
        repair_analysis_id = self.create_task(
            task_type="strategic_analysis",
            description=f"Auto-repair analysis for {failed_task.id}",
            data={
                'type': 'task_failure',
                'details': f"Task {failed_task.task_type} failed: {failed_task.error}",
                'task_data': failed_task.data,
                'retry_count': failed_task.retry_count
            },
            priority=TaskPriority.HIGH
        )
    
    async def _trigger_system_repair(self, health_data: Dict[str, Any]):
        """システム修復トリガー"""
        self.logger.warning("🚨 Triggering system repair due to health degradation")
        
        # システム修復タスク生成
        repair_task_id = self.create_task(
            task_type="real_time_monitoring",
            description="System health repair",
            data={
                'system_data': health_data,
                'repair_mode': True
            },
            priority=TaskPriority.CRITICAL
        )
    
    async def _collect_performance_metrics(self) -> Dict[str, Any]:
        """パフォーマンスメトリクス収集"""
        return {
            'task_execution_stats': self.execution_stats,
            'queue_metrics': {
                'queue_size': len(self.task_queue),
                'running_tasks': len(self.running_tasks),
                'avg_execution_time': self._calculate_avg_execution_time()
            },
            'agent_stats': self.llm_client.get_execution_stats()
        }
    
    def _calculate_avg_execution_time(self) -> float:
        """平均実行時間計算"""
        completed_tasks = [t for t in self.tasks.values() if t.status == TaskStatus.COMPLETED]
        if not completed_tasks:
            return 0
        
        total_time = sum((t.completed_at - t.started_at).total_seconds() for t in completed_tasks)
        return total_time / len(completed_tasks)
    
    def _calculate_health_score(self, health_data: Dict[str, Any]) -> int:
        """健全性スコア計算（0-100）"""
        score = 100
        
        # LLM健全性チェック
        llm_health = health_data.get('llm_health', {})
        for llm, status in llm_health.items():
            if status.get('status') != 'healthy':
                score -= 20
        
        # タスク実行成功率
        stats = health_data.get('execution_stats', {})
        total_tasks = stats.get('total_tasks', 0)
        if total_tasks > 0:
            success_rate = stats.get('completed_tasks', 0) / total_tasks
            score = int(score * success_rate)
        
        # キュー滞留チェック
        if health_data.get('orchestrator', {}).get('task_queue_size', 0) > 10:
            score -= 10
        
        return max(0, min(100, score))
    
    def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """タスク状況取得"""
        if task_id not in self.tasks:
            return None
        
        task = self.tasks[task_id]
        return {
            'id': task.id,
            'type': task.task_type,
            'status': task.status.value,
            'priority': task.priority.value,
            'description': task.description,
            'assigned_agent': task.assigned_agent,
            'created_at': task.created_at.isoformat(),
            'started_at': task.started_at.isoformat() if task.started_at else None,
            'completed_at': task.completed_at.isoformat() if task.completed_at else None,
            'retry_count': task.retry_count,
            'error': task.error,
            'result_available': task.result is not None
        }
    
    def get_system_overview(self) -> Dict[str, Any]:
        """システム概要取得"""
        return {
            'orchestrator_status': 'running' if self.is_running else 'stopped',
            'total_tasks': len(self.tasks),
            'pending_tasks': len([t for t in self.tasks.values() if t.status == TaskStatus.PENDING]),
            'running_tasks': len([t for t in self.tasks.values() if t.status == TaskStatus.RUNNING]),
            'completed_tasks': len([t for t in self.tasks.values() if t.status == TaskStatus.COMPLETED]),
            'failed_tasks': len([t for t in self.tasks.values() if t.status == TaskStatus.FAILED]),
            'queue_size': len(self.task_queue),
            'active_concurrent_tasks': len(self.running_tasks),
            'execution_stats': self.execution_stats,
            'uptime_hours': (datetime.now() - self.execution_stats['uptime_start']).total_seconds() / 3600
        }


# グローバルインスタンス
_orchestrator = None

def get_orchestrator() -> AutonomousOrchestrator:
    """シングルトンパターンでオーケストレーター取得"""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = AutonomousOrchestrator()
    return _orchestrator