"""
MultiLLM Orchestrator - 統括AI
ユーザーとの対話を管理し、タスクを適切なWorker LLMに振り分ける
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from enum import Enum
import json
import uuid
import random

logger = logging.getLogger(__name__)


class TaskType(Enum):
    """タスクタイプの定義"""
    CODE_IMPLEMENTATION = "code_implementation"
    UI_DESIGN = "ui_design"
    DOCUMENTATION = "documentation"
    PR_REVIEW = "pr_review"
    DATA_ANALYSIS = "data_analysis"
    IMAGE_GENERATION = "image_generation"
    GENERAL = "general"


class TaskPriority(Enum):
    """タスク優先度"""
    CRITICAL = 1
    HIGH = 2
    MEDIUM = 3
    LOW = 4


@dataclass
class Task:
    """タスク定義"""
    id: str
    type: TaskType
    description: str
    priority: TaskPriority
    user_id: str
    created_at: datetime
    status: str = "pending"
    assigned_worker: Optional[str] = None
    result: Optional[Dict] = None
    metadata: Dict = None


class MultiLLMOrchestrator:
    """
    MultiLLMシステムの統括者
    タスクの分析、振り分け、進捗管理を行う
    """
    
    def __init__(self, config: Dict):
        self.config = config
        self.workers = {}
        self.task_queue = asyncio.Queue()
        self.active_tasks = {}
        self.memory_sync_interval = config.get('memory', {}).get('syncInterval', 300)
        self.llm_client = None  # LLMクライアント（後で注入）
        
        # リトライ設定
        self.max_retries = config.get('maxRetries', 3)
        self.base_delay = config.get('baseDelay', 1.0)  # 基本遅延時間（秒）
        self.max_delay = config.get('maxDelay', 60.0)  # 最大遅延時間（秒）
        
        # タスク振り分けルール
        self.task_routing = {
            TaskType.CODE_IMPLEMENTATION: "backend_worker",
            TaskType.UI_DESIGN: "frontend_worker",
            TaskType.DOCUMENTATION: "documentation_worker",
            TaskType.PR_REVIEW: "review_worker",
            TaskType.DATA_ANALYSIS: "analytics_worker",
            TaskType.IMAGE_GENERATION: "creative_worker"
        }
        
        # キーワードベースのタスク分類
        self.task_keywords = {
            TaskType.CODE_IMPLEMENTATION: [
                'コード', 'code', '実装', 'implement', 'バグ', 'bug', 'API', 
                'データベース', 'database', 'バックエンド', 'backend'
            ],
            TaskType.UI_DESIGN: [
                'UI', 'UX', 'デザイン', 'design', 'フロントエンド', 'frontend',
                'レイアウト', 'layout', 'スタイル', 'style', 'React'
            ],
            TaskType.DOCUMENTATION: [
                'ドキュメント', 'document', 'README', 'マニュアル', 'manual',
                'ガイド', 'guide', '説明', 'explain'
            ],
            TaskType.PR_REVIEW: [
                'PR', 'プルリク', 'レビュー', 'review', 'コードレビュー',
                'マージ', 'merge'
            ],
            TaskType.DATA_ANALYSIS: [
                '分析', 'analyze', 'analysis', 'データ', 'data', '統計',
                'statistics', 'レポート', 'report'
            ],
            TaskType.IMAGE_GENERATION: [
                '画像', 'image', 'イラスト', 'illustration', '図', 'diagram',
                'デザイン生成', 'generate'
            ]
        }
    
    async def initialize(self):
        """Orchestratorの初期化"""
        logger.info("🎯 MultiLLM Orchestrator initializing...")
        
        # Worker LLMsの初期化
        await self._initialize_workers()
        
        # メモリ同期サービスの開始
        asyncio.create_task(self._memory_sync_loop())
        
        # タスク処理ループの開始
        asyncio.create_task(self._task_processing_loop())
        
        logger.info("✅ Orchestrator initialized successfully")
    
    async def _initialize_workers(self):
        """Worker LLMsの初期化"""
        worker_configs = self.config.get('workers', {})
        
        for worker_name, worker_config in worker_configs.items():
            # ここでWorker LLMインスタンスを作成
            # 実際の実装では、各Workerクラスをインポートして初期化
            self.workers[worker_name] = {
                'config': worker_config,
                'status': 'active',
                'current_task': None
            }
            logger.info(f"✅ Initialized worker: {worker_name}")
    
    async def process_user_request(self, request: str, user_id: str, context: Dict = None) -> Dict:
        """
        ユーザーリクエストを処理
        1. リクエストを分析
        2. サブタスクに分解
        3. 各Workerに振り分け
        4. 結果を統合して返す
        """
        logger.info(f"📥 Processing user request: {request[:100]}...")
        
        # タスクタイプを判定
        task_type = self._analyze_task_type(request)
        
        # タスクを作成
        task = Task(
            id=str(uuid.uuid4()),
            type=task_type,
            description=request,
            priority=self._determine_priority(request),
            user_id=user_id,
            created_at=datetime.now(),
            metadata=context or {}
        )
        
        # 複雑なタスクの場合はサブタスクに分解
        if self._is_complex_task(request):
            subtasks = await self._decompose_task(task)
            results = await self._process_parallel_tasks(subtasks)
            return await self._integrate_results(results)
        else:
            # 単一タスクとして処理
            return await self._process_single_task(task)
    
    def _analyze_task_type(self, request: str) -> TaskType:
        """リクエスト内容からタスクタイプを判定"""
        request_lower = request.lower()
        scores = {}
        
        for task_type, keywords in self.task_keywords.items():
            score = sum(1 for keyword in keywords if keyword in request_lower)
            if score > 0:
                scores[task_type] = score
        
        if scores:
            return max(scores, key=scores.get)
        
        return TaskType.GENERAL
    
    def _determine_priority(self, request: str) -> TaskPriority:
        """リクエストから優先度を判定"""
        urgent_keywords = ['緊急', 'urgent', '至急', 'ASAP', 'critical']
        high_keywords = ['重要', 'important', '優先', 'priority']
        
        request_lower = request.lower()
        
        if any(keyword in request_lower for keyword in urgent_keywords):
            return TaskPriority.CRITICAL
        elif any(keyword in request_lower for keyword in high_keywords):
            return TaskPriority.HIGH
        
        return TaskPriority.MEDIUM
    
    def _is_complex_task(self, request: str) -> bool:
        """複雑なタスクかどうかを判定"""
        # 複数の動詞や接続詞を含む場合は複雑なタスクと判定
        complex_indicators = ['そして', 'また', 'さらに', 'and', 'also', 'then']
        return any(indicator in request for indicator in complex_indicators)
    
    async def _decompose_task(self, task: Task) -> List[Task]:
        """複雑なタスクをサブタスクに分解"""
        # LLMを使用してタスクを分解
        prompt = f"""
以下のタスクをサブタスクに分解してください：

タスク: {task.description}

サブタスクをJSON形式で出力してください：
[
  {{
    "description": "サブタスクの説明",
    "type": "タスクタイプ",
    "dependencies": []
  }}
]
"""
        
        # LLMに問い合わせ（実際の実装）
        # response = await self.llm_client.generate(prompt)
        
        # デモ用の簡易実装
        subtasks = []
        if "実装" in task.description and "テスト" in task.description:
            subtasks.append(Task(
                id=f"{task.id}_1",
                type=TaskType.CODE_IMPLEMENTATION,
                description="実装部分",
                priority=task.priority,
                user_id=task.user_id,
                created_at=datetime.now()
            ))
            subtasks.append(Task(
                id=f"{task.id}_2",
                type=TaskType.CODE_IMPLEMENTATION,
                description="テスト作成",
                priority=task.priority,
                user_id=task.user_id,
                created_at=datetime.now()
            ))
        else:
            subtasks.append(task)
        
        return subtasks
    
    async def _process_single_task(self, task: Task) -> Dict:
        """単一タスクを処理"""
        # 適切なWorkerを選択
        worker_name = self.task_routing.get(task.type, "backend_worker")
        worker = self.workers.get(worker_name)
        
        if not worker:
            logger.error(f"Worker not found: {worker_name}")
            return {"error": "適切なWorkerが見つかりません"}
        
        # タスクをキューに追加
        await self.task_queue.put(task)
        self.active_tasks[task.id] = task
        
        # Workerでタスクを実行（実際の実装では非同期で実行）
        result = await self._execute_task_on_worker(task, worker)
        
        # 結果を更新
        task.result = result
        task.status = "completed"
        del self.active_tasks[task.id]
        
        return result
    
    async def _process_parallel_tasks(self, tasks: List[Task]) -> List[Dict]:
        """複数のタスクを並列処理"""
        tasks_coroutines = [self._process_single_task(task) for task in tasks]
        results = await asyncio.gather(*tasks_coroutines, return_exceptions=True)
        
        # エラーハンドリング
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Task {tasks[i].id} failed: {result}")
                processed_results.append({"error": str(result)})
            else:
                processed_results.append(result)
        
        return processed_results
    
    async def _integrate_results(self, results: List[Dict]) -> Dict:
        """複数の結果を統合"""
        # 結果を統合するロジック
        integrated = {
            "type": "integrated_result",
            "subtask_count": len(results),
            "results": results,
            "summary": "タスクが正常に完了しました"
        }
        
        # エラーがある場合は報告
        errors = [r for r in results if "error" in r]
        if errors:
            integrated["errors"] = errors
            integrated["summary"] = f"一部のタスクでエラーが発生しました: {len(errors)}件"
        
        return integrated
    
    async def _execute_task_on_worker(self, task: Task, worker: Dict) -> Dict:
        """Workerでタスクを実行（実際の実装はWorkerクラスで）"""
        # エクスポネンシャルバックオフでリトライ
        last_error = None
        
        for attempt in range(self.max_retries):
            try:
                # デモ用の簡易実装（実際はWorkerクラスで実行）
                await asyncio.sleep(1)  # 処理時間のシミュレーション
                
                # ランダムにエラーを発生させる（デモ用）
                # if random.random() < 0.3:  # 30%の確率でエラー
                #     raise Exception("Simulated worker error")
                
                return {
                    "task_id": task.id,
                    "worker": worker['config'].get('model', 'unknown'),
                    "result": f"{task.type.value}の処理が完了しました",
                    "timestamp": datetime.now().isoformat(),
                    "attempts": attempt + 1
                }
                
            except Exception as e:
                last_error = e
                
                if attempt < self.max_retries - 1:
                    # エクスポネンシャルバックオフ計算
                    delay = min(
                        self.base_delay * (2 ** attempt) + random.uniform(0, 1),
                        self.max_delay
                    )
                    
                    logger.warning(
                        f"Task {task.id} failed on attempt {attempt + 1}/{self.max_retries}. "
                        f"Retrying in {delay:.1f}s... Error: {e}"
                    )
                    
                    await asyncio.sleep(delay)
                else:
                    logger.error(f"Task {task.id} failed after {self.max_retries} attempts: {e}")
        
        # すべてのリトライが失敗した場合
        return {
            "task_id": task.id,
            "worker": worker['config'].get('model', 'unknown'),
            "error": str(last_error),
            "attempts": self.max_retries,
            "status": "failed"
        }
    
    async def _memory_sync_loop(self):
        """定期的なメモリ同期"""
        while True:
            await asyncio.sleep(self.memory_sync_interval)
            await self._sync_memory()
    
    async def _sync_memory(self):
        """全LLMの記憶をOpenMemoryに同期"""
        logger.info("🔄 Syncing memory across all LLMs...")
        
        # 各Workerの記憶を収集
        memories = {}
        for worker_name, worker in self.workers.items():
            # Worker固有の記憶を取得（実装は各Workerクラスで）
            memories[worker_name] = {
                "last_sync": datetime.now().isoformat(),
                "status": worker['status']
            }
        
        # OpenMemoryに保存（実際の実装）
        # await self.memory_service.sync(memories)
        
        logger.info("✅ Memory sync completed")
    
    async def _task_processing_loop(self):
        """タスク処理のメインループ"""
        while True:
            try:
                # キューからタスクを取得
                task = await self.task_queue.get()
                logger.info(f"📋 Processing task: {task.id}")
                
                # タスクの処理（実際はWorkerに委譲）
                # ここでは処理済みとマーク
                
            except Exception as e:
                logger.error(f"Task processing error: {e}")
            
            await asyncio.sleep(0.1)  # CPU使用率を抑える
    
    def get_status(self) -> Dict:
        """Orchestratorのステータスを取得"""
        return {
            "status": "active",
            "workers": {name: w['status'] for name, w in self.workers.items()},
            "active_tasks": len(self.active_tasks),
            "queued_tasks": self.task_queue.qsize(),
            "timestamp": datetime.now().isoformat()
        }
    
    async def handle_conversation_overflow(self, conversation_id: str, token_usage: float):
        """会話のトークン使用率が閾値を超えた場合の処理"""
        if token_usage > 0.8:
            logger.warning(f"⚠️ Conversation {conversation_id} reaching token limit: {token_usage:.1%}")
            
            # 会話を要約
            summary = await self._summarize_conversation(conversation_id)
            
            # OpenMemoryに保存
            await self._save_to_memory(conversation_id, summary)
            
            # 新しいLLMインスタンスに切り替え
            await self._rotate_llm_instance(conversation_id, summary)
    
    async def _summarize_conversation(self, conversation_id: str) -> str:
        """会話を要約"""
        # 実際の実装では会話履歴を取得して要約
        return f"Conversation {conversation_id} summary"
    
    async def _save_to_memory(self, conversation_id: str, summary: str):
        """OpenMemoryに保存"""
        # 実際の実装
        pass
    
    async def _rotate_llm_instance(self, conversation_id: str, context: str):
        """新しいLLMインスタンスに切り替え"""
        # 実際の実装
        pass


# 使用例
async def main():
    config = {
        "workers": {
            "backend_worker": {"model": "gpt-4-turbo"},
            "frontend_worker": {"model": "claude-3-sonnet"},
            "review_worker": {"model": "gpt-4"}
        },
        "memory": {
            "syncInterval": 300
        }
    }
    
    orchestrator = MultiLLMOrchestrator(config)
    await orchestrator.initialize()
    
    # ユーザーリクエストを処理
    result = await orchestrator.process_user_request(
        "バグ修正とテストコードの作成をお願いします",
        user_id="user123"
    )
    
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())