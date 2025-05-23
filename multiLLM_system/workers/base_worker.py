"""
Base Worker - すべてのWorker LLMの基底クラス
共通機能とインターフェースを提供
"""

import asyncio
import logging
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
import json
import uuid

logger = logging.getLogger(__name__)


@dataclass
class WorkerTask:
    """Workerが処理するタスク"""
    id: str
    type: str
    description: str
    context: Dict[str, Any]
    priority: str = "medium"
    created_at: datetime = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    status: str = "pending"
    result: Optional[Dict] = None
    error: Optional[str] = None


class BaseWorker(ABC):
    """
    すべてのWorker LLMの基底クラス
    共通の機能とインターフェースを提供
    """
    
    def __init__(self, name: str, config: Dict):
        self.name = name
        self.config = config
        self.model = config.get('model', 'gpt-4')
        self.specialization = config.get('specialization', [])
        self.max_concurrent_tasks = config.get('maxConcurrentTasks', 3)
        self.temperature = config.get('temperature', 0.7)
        
        # LLMクライアント（後で注入）
        self.llm_client = None
        
        # タスク管理
        self.active_tasks = {}
        self.task_queue = asyncio.Queue()
        self.processing = False
        
        # メトリクス
        self.metrics = {
            'total_tasks': 0,
            'successful_tasks': 0,
            'failed_tasks': 0,
            'total_tokens': 0,
            'total_cost': 0.0,
            'average_latency': 0.0
        }
        
        # メモリ（コンテキスト保持）
        self.memory = {
            'short_term': [],  # 最近の10タスク
            'long_term': {},   # 重要な決定事項
            'context': {}      # 永続的なコンテキスト
        }
    
    async def initialize(self):
        """Workerの初期化"""
        logger.info(f"🚀 Initializing {self.name} worker...")
        
        # タスク処理ループを開始
        self.processing = True
        for i in range(self.max_concurrent_tasks):
            asyncio.create_task(self._process_task_loop(i))
        
        logger.info(f"✅ {self.name} worker initialized with {self.max_concurrent_tasks} concurrent processors")
    
    async def shutdown(self):
        """Workerのシャットダウン"""
        logger.info(f"🛑 Shutting down {self.name} worker...")
        self.processing = False
        
        # アクティブタスクの完了を待つ
        if self.active_tasks:
            await asyncio.gather(*[
                self._wait_for_task(task_id) 
                for task_id in self.active_tasks
            ])
        
        logger.info(f"✅ {self.name} worker shut down")
    
    async def submit_task(self, task: WorkerTask) -> str:
        """タスクを送信"""
        task.id = task.id or str(uuid.uuid4())
        task.created_at = task.created_at or datetime.now()
        
        await self.task_queue.put(task)
        logger.info(f"📥 Task {task.id} submitted to {self.name} worker")
        
        return task.id
    
    async def _process_task_loop(self, processor_id: int):
        """タスク処理ループ"""
        while self.processing:
            try:
                # タスクを取得（タイムアウト付き）
                task = await asyncio.wait_for(
                    self.task_queue.get(), 
                    timeout=1.0
                )
                
                # タスクを処理
                await self._process_task(task, processor_id)
                
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Task processing error in {self.name}[{processor_id}]: {e}")
    
    async def _process_task(self, task: WorkerTask, processor_id: int):
        """タスクを処理"""
        logger.info(f"🔧 {self.name}[{processor_id}] processing task {task.id}")
        
        task.started_at = datetime.now()
        task.status = "processing"
        self.active_tasks[task.id] = task
        
        try:
            # Worker固有の処理を実行
            result = await self.process(task)
            
            # 成功
            task.completed_at = datetime.now()
            task.status = "completed"
            task.result = result
            
            # メトリクス更新
            self._update_metrics(task, success=True)
            
            # 短期記憶に追加
            self._update_memory(task)
            
            logger.info(f"✅ {self.name}[{processor_id}] completed task {task.id}")
            
        except Exception as e:
            # エラー
            task.completed_at = datetime.now()
            task.status = "failed"
            task.error = str(e)
            
            # メトリクス更新
            self._update_metrics(task, success=False)
            
            logger.error(f"❌ {self.name}[{processor_id}] failed task {task.id}: {e}")
        
        finally:
            del self.active_tasks[task.id]
    
    @abstractmethod
    async def process(self, task: WorkerTask) -> Dict[str, Any]:
        """
        Worker固有の処理を実装
        サブクラスで必ず実装する
        """
        pass
    
    async def generate_llm_response(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """LLMを使用してレスポンスを生成"""
        if not self.llm_client:
            raise ValueError("LLM client not initialized")
        
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        # モデルに応じてクライアントを選択
        if self.model.startswith('gpt'):
            response = await self.llm_client.openai_generate(
                messages=messages,
                model=self.model,
                temperature=self.temperature
            )
        elif self.model.startswith('claude'):
            response = await self.llm_client.anthropic_generate(
                messages=messages,
                model=self.model,
                temperature=self.temperature
            )
        else:
            response = await self.llm_client.generate(
                prompt=prompt,
                model=self.model,
                temperature=self.temperature
            )
        
        return response
    
    def _update_metrics(self, task: WorkerTask, success: bool):
        """メトリクスを更新"""
        self.metrics['total_tasks'] += 1
        
        if success:
            self.metrics['successful_tasks'] += 1
        else:
            self.metrics['failed_tasks'] += 1
        
        # レイテンシ計算
        if task.started_at and task.completed_at:
            latency = (task.completed_at - task.started_at).total_seconds()
            # 移動平均でレイテンシを更新
            self.metrics['average_latency'] = (
                self.metrics['average_latency'] * 0.9 + latency * 0.1
            )
    
    def _update_memory(self, task: WorkerTask):
        """メモリを更新"""
        # 短期記憶に追加（最大10件）
        self.memory['short_term'].append({
            'task_id': task.id,
            'type': task.type,
            'description': task.description[:100],
            'result': task.result,
            'timestamp': task.completed_at.isoformat()
        })
        
        if len(self.memory['short_term']) > 10:
            self.memory['short_term'].pop(0)
        
        # 重要なタスクは長期記憶に保存
        if task.priority == 'high' or 'important' in task.description.lower():
            self.memory['long_term'][task.id] = {
                'description': task.description,
                'result': task.result,
                'timestamp': task.completed_at.isoformat()
            }
    
    async def _wait_for_task(self, task_id: str, timeout: float = 60.0):
        """タスクの完了を待つ"""
        start_time = asyncio.get_event_loop().time()
        
        while task_id in self.active_tasks:
            if asyncio.get_event_loop().time() - start_time > timeout:
                logger.warning(f"Task {task_id} timed out")
                break
            await asyncio.sleep(0.1)
    
    def get_status(self) -> Dict[str, Any]:
        """Workerのステータスを取得"""
        return {
            'name': self.name,
            'model': self.model,
            'specialization': self.specialization,
            'status': 'active' if self.processing else 'inactive',
            'active_tasks': len(self.active_tasks),
            'queued_tasks': self.task_queue.qsize(),
            'metrics': self.metrics,
            'memory': {
                'short_term_count': len(self.memory['short_term']),
                'long_term_count': len(self.memory['long_term'])
            }
        }
    
    def get_memory_snapshot(self) -> Dict[str, Any]:
        """メモリのスナップショットを取得"""
        return {
            'worker': self.name,
            'timestamp': datetime.now().isoformat(),
            'short_term': self.memory['short_term'][-5:],  # 最新5件
            'long_term_keys': list(self.memory['long_term'].keys()),
            'context': self.memory['context']
        }
    
    def load_memory_snapshot(self, snapshot: Dict[str, Any]):
        """メモリスナップショットをロード"""
        if snapshot.get('context'):
            self.memory['context'].update(snapshot['context'])
        
        logger.info(f"📥 Loaded memory snapshot for {self.name}")
    
    async def handle_emergency(self, emergency_type: str, data: Dict):
        """緊急事態への対応"""
        logger.warning(f"🚨 {self.name} handling emergency: {emergency_type}")
        
        # 処理中のタスクを一時停止
        self.processing = False
        
        # Worker固有の緊急対応
        await self.emergency_response(emergency_type, data)
        
        # 処理を再開
        self.processing = True
    
    async def emergency_response(self, emergency_type: str, data: Dict):
        """Worker固有の緊急対応（オーバーライド可能）"""
        pass


# 使用例：具体的なWorkerの実装
class BackendWorker(BaseWorker):
    """バックエンド開発専門Worker"""
    
    async def process(self, task: WorkerTask) -> Dict[str, Any]:
        """バックエンドタスクを処理"""
        
        # タスクタイプに応じた処理
        if 'bug' in task.description.lower() or 'fix' in task.description.lower():
            return await self._fix_bug(task)
        elif 'api' in task.description.lower():
            return await self._implement_api(task)
        else:
            return await self._general_backend_task(task)
    
    async def _fix_bug(self, task: WorkerTask) -> Dict[str, Any]:
        """バグ修正処理"""
        prompt = f"""
以下のバグを修正してください：

{task.description}

コンテキスト：
{json.dumps(task.context, ensure_ascii=False, indent=2)}

修正方法と修正後のコードを提供してください。
"""
        
        response = await self.generate_llm_response(
            prompt,
            system_prompt="あなたは経験豊富なバックエンドエンジニアです。"
        )
        
        return {
            'type': 'bug_fix',
            'solution': response,
            'confidence': 0.85
        }
    
    async def _implement_api(self, task: WorkerTask) -> Dict[str, Any]:
        """API実装処理"""
        # API実装のロジック
        return {
            'type': 'api_implementation',
            'code': '// API implementation code',
            'documentation': '// API documentation'
        }
    
    async def _general_backend_task(self, task: WorkerTask) -> Dict[str, Any]:
        """一般的なバックエンドタスク"""
        response = await self.generate_llm_response(task.description)
        
        return {
            'type': 'general',
            'response': response
        }


# Worker ファクトリー
def create_worker(worker_type: str, config: Dict) -> BaseWorker:
    """Workerインスタンスを作成"""
    worker_classes = {
        'backend': BackendWorker,
        # 'frontend': FrontendWorker,
        # 'review': ReviewWorker,
        # 他のWorkerクラスを追加
    }
    
    worker_class = worker_classes.get(worker_type, BaseWorker)
    return worker_class(name=f"{worker_type}_worker", config=config)