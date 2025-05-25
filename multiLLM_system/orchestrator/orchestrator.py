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
from .llm_client import ClaudeClient, TaskAnalysis, LLMMessage
from .response_formatter import ResponseFormatter, MessageProcessor
import time

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
    MEMORY_OPERATION = "memory_operation"  # OpenMemory操作用


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


@dataclass
class LLMResponse:
    """LLM応答の記録"""
    id: str
    provider: str
    model: str
    content: str
    tokens: Dict[str, int]
    metadata: Dict
    timestamp: datetime
    duration: float
    error: Optional[str] = None


@dataclass
class MCPConnection:
    """MCP接続の記録"""
    id: str
    service: str
    action: str
    request: Dict
    response: Dict
    timestamp: datetime
    duration: float
    success: bool
    error: Optional[str] = None


@dataclass
class ConversationLog:
    """会話ログ"""
    conversation_id: str
    messages: List[Dict]
    llm_responses: List[LLMResponse]
    mcp_connections: List[MCPConnection]
    total_tokens: int
    start_time: datetime
    end_time: Optional[datetime] = None


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
        # Claude APIクライアント（デモモード）
        self.claude_client = ClaudeClient(None)  # APIキーなしでデモモード
        
        # 会話ログの管理
        self.conversations = {}
        self.stream_handlers = {}  # ストリーミング用のハンドラー
        
        # レスポンスフォーマッター
        self.formatter = ResponseFormatter()
        self.message_processor = MessageProcessor()
        
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
            TaskType.IMAGE_GENERATION: "creative_worker",
            TaskType.GENERAL: "backend_worker",  # GENERALタスクはbackend_workerに割り当て
            TaskType.MEMORY_OPERATION: "mcp_worker"  # OpenMemory操作はMCP Workerに割り当て
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
            ],
            TaskType.GENERAL: [
                'こんにちは', 'hello', 'ハロー', 'やあ', 'help', 'ヘルプ',
                '教えて', 'tell me', '何ができる', 'what can you do'
            ],
            TaskType.MEMORY_OPERATION: [
                '記憶して', '保存して', 'メモリに保存', 'save memory',
                '思い出して', '検索して', 'search memory', 'recall',
                'メモリを全部見せて', '記憶を表示', '一覧表示', 'list memory',
                'メモリをすべて削除', '全削除', 'delete all', '削除して'
            ]
        }
    
    async def initialize(self):
        """Orchestratorの初期化"""
        logger.info("🎯 MultiLLM Orchestrator initializing...")
        
        # Claude-4クライアントの初期化
        await self.claude_client.initialize()
        
        # Worker LLMsの初期化
        await self._initialize_workers()
        
        # メモリ同期サービスの開始
        asyncio.create_task(self._memory_sync_loop())
        
        # タスク処理ループの開始
        asyncio.create_task(self._task_processing_loop())
        
        logger.info("✅ Orchestrator initialized successfully")
    
    async def shutdown(self):
        """Orchestratorの終了処理"""
        logger.info("🛑 Shutting down MultiLLM Orchestrator...")
        await self.claude_client.shutdown()
        logger.info("✅ Orchestrator shutdown complete")
    
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
        
        # MCPワーカーを追加
        self.workers['mcp_worker'] = {
            'config': {'model': 'mcp-integration'},
            'status': 'active',
            'current_task': None
        }
        logger.info("✅ Initialized worker: mcp_worker")
    
    async def process_user_request(self, request: str, user_id: str, context: Dict = None, conversation_id: str = None, stream_handler=None) -> Dict:
        """
        ユーザーリクエストを処理
        1. リクエストを分析
        2. サブタスクに分解
        3. 各Workerに振り分け
        4. 結果を統合して返す
        """
        logger.info(f"📥 Processing user request: {request[:100]}...")
        start_time = time.time()
        
        # 会話IDの生成または取得
        if not conversation_id:
            conversation_id = f"conv_{uuid.uuid4()}"
        
        # 会話ログの初期化または取得
        if conversation_id not in self.conversations:
            self.conversations[conversation_id] = ConversationLog(
                conversation_id=conversation_id,
                messages=[],
                llm_responses=[],
                mcp_connections=[],
                total_tokens=0,
                start_time=datetime.now()
            )
        
        conversation = self.conversations[conversation_id]
        
        # ストリームハンドラーの登録
        if stream_handler:
            self.stream_handlers[conversation_id] = stream_handler
        
        # ユーザーメッセージを記録
        conversation.messages.append({
            'role': 'user',
            'content': request,
            'timestamp': datetime.now().isoformat()
        })
        
        # Claude-4による知的タスク分析
        analysis_start = time.time()
        
        # ストリーミングイベント: 分析開始
        if stream_handler:
            await stream_handler(json.dumps({
                'type': 'analysis',
                'content': 'タスクを分析中...',
                'timestamp': datetime.now().isoformat()
            }) + '\n')
        
        task_analysis = await self.claude_client.analyze_task(request, context)
        analysis_duration = time.time() - analysis_start
        logger.info(f"🧠 Task analysis: {task_analysis.task_type} - {task_analysis.reasoning}")
        
        # ストリーミングイベント: 分析完了
        if stream_handler:
            await stream_handler(json.dumps({
                'type': 'analysis',
                'content': f'タスクタイプ: {task_analysis.task_type}',
                'details': {
                    'task_type': task_analysis.task_type,
                    'priority': task_analysis.priority,
                    'complexity': task_analysis.complexity,
                    'reasoning': task_analysis.reasoning
                },
                'timestamp': datetime.now().isoformat()
            }) + '\n')
        
        # タスク分析をLLM応答として記録
        analysis_response = LLMResponse(
            id=str(uuid.uuid4()),
            provider='anthropic',
            model='claude-3.5-sonnet',
            content=f"Task Type: {task_analysis.task_type}\nReasoning: {task_analysis.reasoning}",
            tokens={'prompt': 0, 'completion': 0, 'total': 0},  # デモモードでは0
            metadata={'task': 'analysis'},
            timestamp=datetime.now(),
            duration=analysis_duration
        )
        conversation.llm_responses.append(analysis_response)
        
        # タスクタイプを設定
        try:
            task_type = TaskType(task_analysis.task_type.lower())
        except ValueError:
            task_type = TaskType.GENERAL
        
        # 「思い出して」キーワードがある場合は、直接レスポンスを生成
        if '思い出して' in request:
            # LLMクライアントで直接処理
            messages = [LLMMessage(role='user', content=request)]
            response = await self.claude_client.generate_response(
                messages=messages,
                context=context,
                stream_callback=stream_handler
            )
            
            # 会話ログに記録
            conversation.messages.append({
                'role': 'assistant',
                'content': response,
                'timestamp': datetime.now().isoformat(),
                'provider': 'claude-4.0'
            })
            
            return {
                'response': response,
                'conversation_log': asdict(conversation),
                'task_analysis': asdict(task_analysis)
            }
        
        # タスクを作成
        task = Task(
            id=str(uuid.uuid4()),
            type=task_type,
            description=request,
            priority=TaskPriority[task_analysis.priority] if task_analysis.priority in TaskPriority.__members__ else TaskPriority.MEDIUM,
            user_id=user_id,
            created_at=datetime.now(),
            metadata=context or {}
        )
        
        # 複雑度に応じた処理分岐
        if task_analysis.complexity == "complex":
            # 複数のサブタスクに分解して並列処理
            subtasks = []
            for i, subtask_desc in enumerate(task_analysis.subtasks):
                subtask = Task(
                    id=f"{task.id}_sub_{i}",
                    type=task.type,
                    description=subtask_desc,
                    priority=task.priority,
                    user_id=user_id,
                    created_at=datetime.now(),
                    metadata={"parent_task": task.id, "worker": task_analysis.assigned_workers[i] if i < len(task_analysis.assigned_workers) else "backend_worker"}
                )
                subtasks.append(subtask)
            
            results = await self._process_parallel_tasks(subtasks, conversation)
            final_result = await self._integrate_results(results)
        else:
            # 単一タスクとして処理
            preferred_worker = task_analysis.assigned_workers[0] if task_analysis.assigned_workers else None
            final_result = await self._process_single_task(task, preferred_worker, conversation)
        
        # アシスタントメッセージを記録
        conversation.messages.append({
            'role': 'assistant',
            'content': final_result.get('result', final_result.get('summary', 'Task completed')),
            'timestamp': datetime.now().isoformat(),
            'provider': 'claude-4.0',
            'connections': [asdict(conn) for conn in conversation.mcp_connections[-5:]]  # 最新5件のMCP接続を含める
        })
        
        # 会話終了時刻を記録
        conversation.end_time = datetime.now()
        
        # ストリームハンドラーのクリーンアップ
        if conversation_id in self.stream_handlers:
            del self.stream_handlers[conversation_id]
        
        return {
            'response': final_result.get('result', final_result.get('summary', 'Task completed')),
            'conversation_log': asdict(conversation),
            'task_analysis': asdict(task_analysis)
        }
    
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
    
    async def _process_single_task(self, task: Task, preferred_worker: str = None, conversation: ConversationLog = None) -> Dict:
        """単一タスクを処理"""
        # 適切なWorkerを選択（Claude-4の推奨を優先）
        worker_name = preferred_worker or self.task_routing.get(task.type, "backend_worker")
        worker = self.workers.get(worker_name)
        
        if not worker:
            logger.error(f"Worker not found: {worker_name}")
            return {"error": "適切なWorkerが見つかりません"}
        
        # ストリーミングイベント: ワーカー割り当て
        if conversation and conversation.conversation_id in self.stream_handlers:
            stream_handler = self.stream_handlers[conversation.conversation_id]
            await stream_handler(json.dumps({
                'type': 'worker',
                'worker': worker_name,
                'content': f'{worker_name}にタスクを割り当て中...',
                'timestamp': datetime.now().isoformat()
            }) + '\n')
        
        # タスクをキューに追加
        await self.task_queue.put(task)
        self.active_tasks[task.id] = task
        
        # Workerでタスクを実行（実際の実装では非同期で実行）
        result = await self._execute_task_on_worker(task, worker, conversation)
        
        # 結果を更新
        task.result = result
        task.status = "completed"
        del self.active_tasks[task.id]
        
        return result
    
    async def _process_parallel_tasks(self, tasks: List[Task], conversation: ConversationLog = None) -> List[Dict]:
        """複数のタスクを並列処理"""
        tasks_coroutines = [self._process_single_task(task, conversation=conversation) for task in tasks]
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
    
    async def _execute_task_on_worker(self, task: Task, worker: Dict, conversation: ConversationLog = None) -> Dict:
        """Workerでタスクを実行（実際の実装はWorkerクラスで）"""
        # エクスポネンシャルバックオフでリトライ
        last_error = None
        
        for attempt in range(self.max_retries):
            try:
                # 処理開始時刻
                task_start = time.time()
                
                # ランダムにエラーを発生させる（デモ用）
                # if random.random() < 0.3:  # 30%の確率でエラー
                #     raise Exception("Simulated worker error")
                
                # タスクタイプに応じて処理を分岐
                if task.type == TaskType.MEMORY_OPERATION:
                    # MCP接続の記録
                    mcp_start = time.time()
                    try:
                        result = await self._generate_memory_response(task.description, conversation)
                        mcp_duration = time.time() - mcp_start
                        
                        if conversation and hasattr(self, 'last_mcp_connection'):
                            conversation.mcp_connections.append(self.last_mcp_connection)
                    except Exception as mcp_error:
                        mcp_duration = time.time() - mcp_start
                        if conversation:
                            mcp_connection = MCPConnection(
                                id=str(uuid.uuid4()),
                                service='openmemory',
                                action='operation',
                                request={'description': task.description},
                                response={},
                                timestamp=datetime.now(),
                                duration=mcp_duration,
                                success=False,
                                error=str(mcp_error)
                            )
                            conversation.mcp_connections.append(mcp_connection)
                        raise
                        
                elif task.type == TaskType.GENERAL:
                    # Claude-4による実際の応答生成
                    llm_start = time.time()
                    messages = [LLMMessage(role="user", content=task.description)]
                    
                    # ストリーミング対応
                    if conversation and conversation.conversation_id in self.stream_handlers:
                        stream_handler = self.stream_handlers[conversation.conversation_id]
                        result = await self.claude_client.generate_response(
                            messages, 
                            stream_callback=lambda chunk: asyncio.create_task(stream_handler(chunk))
                        )
                    else:
                        result = await self.claude_client.generate_response(messages)
                    
                    llm_duration = time.time() - llm_start
                    
                    # LLM応答を記録
                    if conversation:
                        llm_response = LLMResponse(
                            id=str(uuid.uuid4()),
                            provider='anthropic',
                            model='claude-3.5-sonnet',
                            content=result,
                            tokens={'prompt': 0, 'completion': 0, 'total': 0},  # デモモードでは0
                            metadata={'task_type': task.type.value},
                            timestamp=datetime.now(),
                            duration=llm_duration
                        )
                        conversation.llm_responses.append(llm_response)
                else:
                    # 他のタスクタイプも将来的にはLLMで処理
                    result = f"{task.type.value}の処理が完了しました。専用Workerによる詳細な処理は開発中です。"
                
                return {
                    "task_id": task.id,
                    "worker": worker['config'].get('model', 'unknown'),
                    "result": result,
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
    
    async def _generate_memory_response(self, description: str, conversation: ConversationLog = None) -> str:
        """OpenMemory操作のデモ応答（実際にはMCP Workerが処理）"""
        # MCPサービスを使用してOpenMemoryと通信
        try:
            # MCP統合サービスのインスタンスを取得または作成
            if not hasattr(self, 'mcp_service'):
                import sys
                import os
                # 親ディレクトリをパスに追加
                sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
                from services.mcp_integration import MCPIntegrationService, MCPWorker
                mcp_config = {
                    'providers': {
                        'openmemory': {
                            'type': 'openmemory',
                            'url': 'http://localhost:8765',
                            'userId': 'mourigenta'
                        }
                    }
                }
                self.mcp_service = MCPIntegrationService(mcp_config)
                await self.mcp_service.initialize()
                self.mcp_worker = MCPWorker(self.mcp_service)
            
            # MCPワーカーでタスクを処理
            mcp_start = time.time()
            result = await self.mcp_worker.process_mcp_task(description, {})
            mcp_duration = time.time() - mcp_start
            
            # MCP接続を記録
            if conversation:
                mcp_connection = MCPConnection(
                    id=str(uuid.uuid4()),
                    service='openmemory',
                    action=self._extract_mcp_action(description),
                    request={'description': description},
                    response=result,
                    timestamp=datetime.now(),
                    duration=mcp_duration,
                    success=not result.get('error'),
                    error=result.get('error')
                )
                conversation.mcp_connections.append(mcp_connection)
                self.last_mcp_connection = mcp_connection
            
            if result.get('error'):
                return f"❌ エラーが発生しました: {result['error']}"
            
            # 成功時の応答を整形
            mcp_result = result.get('result', {})
            
            if 'save' in description or '記憶して' in description or '保存して' in description:
                return f"""✅ メモリに保存しました！

**保存内容**: {mcp_result.get('content', description)}
**メモリID**: {mcp_result.get('id', 'N/A')}
**タイムスタンプ**: {mcp_result.get('timestamp', 'N/A')}

メモリに正常に保存されました。後で「思い出して」と言えば検索できます。"""
            
            elif 'search' in description or '思い出して' in description or '検索して' in description:
                memories = mcp_result.get('memories', [])
                if not memories:
                    return "🔍 該当するメモリが見つかりませんでした。"
                
                response = f"🔍 {len(memories)}件のメモリが見つかりました：\n\n"
                for i, memory in enumerate(memories[:5], 1):  # 最大5件表示
                    response += f"**{i}. {memory.get('content', 'N/A')}**\n"
                    response += f"   - ID: {memory.get('id', 'N/A')}\n"
                    response += f"   - 保存日時: {memory.get('timestamp', 'N/A')}\n"
                    response += f"   - 関連度: {memory.get('similarity', 0):.2f}\n\n"
                
                return response
            
            elif 'list' in description or '一覧' in description or '全部見せて' in description:
                memories = mcp_result.get('memories', [])
                if not memories:
                    return "📝 現在保存されているメモリはありません。"
                
                response = f"📝 {len(memories)}件のメモリが保存されています：\n\n"
                for i, memory in enumerate(memories[:10], 1):  # 最大10件表示
                    response += f"**{i}. {memory.get('content', 'N/A')[:50]}{'...' if len(memory.get('content', '')) > 50 else ''}**\n"
                    response += f"   - ID: {memory.get('id', 'N/A')}\n"
                    response += f"   - 保存日時: {memory.get('timestamp', 'N/A')}\n\n"
                
                if len(memories) > 10:
                    response += f"\n（他 {len(memories) - 10} 件のメモリがあります）"
                
                return response
            
            elif 'delete' in description or '削除' in description:
                if 'すべて' in description or '全部' in description:
                    return f"🗑️ {mcp_result.get('message', 'すべてのメモリを削除しました')}"
                else:
                    return f"🗑️ {mcp_result.get('message', 'メモリを削除しました')}"
            
            else:
                return f"✅ メモリ操作が完了しました: {mcp_result.get('message', '処理完了')}"
                
        except Exception as e:
            logger.error(f"Memory operation error: {e}")
            return f"❌ メモリ操作中にエラーが発生しました: {str(e)}\n\nOpenMemoryサービスが起動していることを確認してください。"
    
    def _extract_mcp_action(self, description: str) -> str:
        """説明文からMCPアクションを抽出"""
        if any(word in description for word in ['記憶して', '保存して', 'save']):
            return 'save'
        elif any(word in description for word in ['思い出して', '検索して', 'search']):
            return 'search'
        elif any(word in description for word in ['一覧', '全部見せて', 'list']):
            return 'list'
        elif any(word in description for word in ['削除', 'delete']):
            return 'delete'
        else:
            return 'unknown'
    
    def get_conversation_log(self, conversation_id: str) -> Optional[Dict]:
        """会話ログを取得"""
        if conversation_id in self.conversations:
            return asdict(self.conversations[conversation_id])
        return None
    
    def get_all_conversations(self) -> List[Dict]:
        """全会話ログを取得"""
        return [asdict(conv) for conv in self.conversations.values()]


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