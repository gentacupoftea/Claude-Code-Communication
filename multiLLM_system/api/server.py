"""
MultiLLM API Server - SSE対応のストリーミングAPIサーバー

このAPIサーバーは複数のLLMプロバイダー（Claude、GPT-4、Gemini、Local LLM）を
統合的に管理し、リアルタイムチャット、分析、自動化機能を提供します。

主な機能:
- マルチLLMチャット（ストリーミング対応）
- ワーカー管理とヘルスチェック
- 高度なデータ分析とレポート
- 自動化ルール作成・実行
- プロメテウス対応メトリクス
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime
from typing import Dict, Optional, List, Any, Union
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field, validator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import sys
import os
import requests

# 親ディレクトリをパスに追加
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from orchestrator.orchestrator import MultiLLMOrchestrator
from orchestrator.response_formatter import ResponseFormatter, MessageProcessor
from orchestrator.analyzers.data_analyzer import DataAnalyzer
from orchestrator.automation.task_automator import TaskAutomator
from orchestrator.worker_factory import WorkerFactory
from config.settings import settings
from utils.exceptions import (
    MultiLLMBaseException, OllamaServerError, OllamaConnectionError, 
    APIKeyError, ModelNotFoundError, WorkerNotFoundError,
    GenerationError, ValidationError, exception_to_http_status
)
from config.logging_config import setup_logging, get_logger, request_context
import traceback

# ログ設定の初期化
setup_logging(
    log_level=settings.LOG_LEVEL,
    log_file="logs/multillm_api.log",
    enable_json_format=not settings.DEBUG
)
logger = get_logger("multiLLM.api")

# レート制限の設定
limiter = Limiter(key_func=get_remote_address)

# FastAPIアプリケーション設定
app = FastAPI(
    title="Conea MultiLLM Integration API",
    version="1.0.0",
    description="""
    ## Conea MultiLLM統合プラットフォーム API

    複数のLLMプロバイダーを統合し、エンタープライズ向けAI機能を提供するAPIサーバーです。

    ### 主要機能:
    - **マルチLLMチャット**: Claude、GPT-4、Gemini、Local LLMによるインテリジェントチャット
    - **ストリーミング対応**: リアルタイムSSEストリーミングレスポンス
    - **ワーカー管理**: 各LLMプロバイダーの状態監視と動的ルーティング
    - **分析エンジン**: 会話パターン分析、タスクパフォーマンス測定
    - **自動化システム**: ルールベース自動化、スケジューリング
    - **ヘルスチェック**: システム状態監視、メトリクス収集

    ### 対応LLMプロバイダー:
    - **Anthropic Claude**: 高度な推論、データ分析、複雑なタスク処理
    - **OpenAI GPT-4**: 汎用的な対話、コード生成、数値計算
    - **Local LLM**: プライベート環境でのオンプレミス処理（Ollama経由）

    ### 認証・セキュリティ:
    - レート制限（30リクエスト/分）
    - CORS対応
    - エラーハンドリング

    *Powered by Conea AI Platform v1.0.0*
    """,
    terms_of_service="https://conea.ai/terms",
    contact={
        "name": "Conea Support Team",
        "url": "https://conea.ai/support",
        "email": "support@conea.ai",
    },
    license_info={
        "name": "MIT License",
        "url": "https://opensource.org/licenses/MIT",
    },
    openapi_tags=[
        {
            "name": "chat",
            "description": "チャット機能 - LLMとの対話、ストリーミング、会話履歴管理"
        },
        {
            "name": "workers",
            "description": "ワーカー管理 - LLMプロバイダーの状態確認、モデル情報取得"
        },
        {
            "name": "analytics", 
            "description": "分析機能 - データ分析、パフォーマンス測定、レポート生成"
        },
        {
            "name": "automation",
            "description": "自動化機能 - ルール作成、タスク自動実行、スケジューリング"
        },
        {
            "name": "health",
            "description": "ヘルスチェック - システム状態監視、接続確認"
        }
    ]
)

# レート制限エラーハンドラーを追加
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# === グローバル例外ハンドラ ===

@app.exception_handler(MultiLLMBaseException)
async def multillm_exception_handler(request: Request, exc: MultiLLMBaseException):
    """MultiLLMシステム固有の例外ハンドラ"""
    status_code = exception_to_http_status(exc)
    
    logger.log_error(
        exc,
        context={
            "endpoint": str(request.url),
            "method": request.method,
            "status_code": status_code
        }
    )
    
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "error": exc.to_dict(),
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """HTTP例外の構造化ハンドラ"""
    logger.logger.warning(
        f"HTTP {exc.status_code}: {exc.detail}",
        extra={
            "event_type": "http_error",
            "status_code": exc.status_code,
            "endpoint": str(request.url),
            "method": request.method
        }
    )
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "error_code": f"HTTP_{exc.status_code}",
                "message": exc.detail,
                "type": "HTTPException"
            },
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """一般的な例外の構造化ハンドラ"""
    logger.log_error(
        exc,
        context={
            "endpoint": str(request.url),
            "method": request.method,
            "traceback": traceback.format_exc()
        }
    )
    
    # デバッグモードの場合は詳細なエラー情報を返す
    error_detail = str(exc) if settings.DEBUG else "Internal server error"
    
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "error_code": "INTERNAL_SERVER_ERROR",
                "message": error_detail,
                "type": type(exc).__name__,
                "traceback": traceback.format_exc() if settings.DEBUG else None
            },
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
    )

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3500", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============ Pydantic Models (Request/Response Schemas) ============

class ChatRequest(BaseModel):
    """
    チャットリクエストスキーマ
    
    LLMとの対話を開始するためのリクエストデータ。
    複数のワーカータイプとストリーミング対応。
    """
    message: str = Field(
        ..., 
        min_length=1, 
        max_length=10000,
        description="ユーザーからのメッセージ内容",
        example="ECサイトの売上分析を行ってください"
    )
    conversation_id: Optional[str] = Field(
        None,
        description="既存の会話を継続する場合の会話ID",
        example="conv_12345-abcde"
    )
    user_id: str = Field(
        default="default_user",
        description="ユーザー識別子",
        example="user_123"
    )
    context: Optional[Dict[str, Any]] = Field(
        None,
        description="追加のコンテキスト情報（プロジェクトデータ、設定など）",
        example={"project_id": "proj_123", "language": "ja"}
    )
    worker_type: Optional[str] = Field(
        None,
        description="使用するLLMワーカーのタイプ。指定しない場合は自動選択",
        example="claude",
        regex="^(openai|anthropic|claude|local_llm)$"
    )


class ChatResponse(BaseModel):
    """チャットレスポンススキーマ"""
    success: bool = Field(description="リクエストが成功したかどうか")
    response: str = Field(description="LLMからの回答テキスト")
    conversation_id: str = Field(description="会話ID")
    worker_type: Optional[str] = Field(description="実際に使用されたワーカータイプ")
    task_analysis: Optional[Dict[str, Any]] = Field(description="タスク分析結果")
    fallback_info: Optional[Dict[str, Any]] = Field(description="フォールバック情報")
    metadata: Optional[Dict[str, Any]] = Field(description="追加のメタデータ")


class ConversationDebugRequest(BaseModel):
    """
    会話デバッグリクエスト
    
    特定の会話の詳細な実行情報を取得するためのリクエスト。
    """
    conversation_id: str = Field(
        ..., 
        description="デバッグ対象の会話ID",
        example="conv_12345-abcde"
    )


class AnalysisRequest(BaseModel):
    """
    データ分析リクエスト
    
    会話パターン、タスクパフォーマンス、リソース予測などの
    高度なデータ分析を実行するためのリクエスト。
    """
    analysis_type: str = Field(
        ...,
        description="分析タイプ",
        example="conversation_patterns",
        regex="^(conversation_patterns|task_performance|resource_prediction)$"
    )
    data: Optional[Dict[str, Any]] = Field(
        None,
        description="分析対象のデータ",
        example={"tasks": [], "conversations": []}
    )
    time_range: Optional[Dict[str, str]] = Field(
        None,
        description="分析対象の時間範囲",
        example={"start": "2024-01-01", "end": "2024-01-31"}
    )


class AutomationRuleRequest(BaseModel):
    """
    自動化ルール作成リクエスト
    
    システムの自動化ルールを定義し、スケジューリングや
    イベント駆動の自動処理を設定するためのリクエスト。
    """
    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="自動化ルールの名前",
        example="定期売上レポート生成"
    )
    description: str = Field(
        ...,
        max_length=500,
        description="ルールの詳細説明",
        example="毎週月曜日にShopifyの売上データを分析してレポートを生成"
    )
    trigger_type: str = Field(
        ...,
        description="トリガーのタイプ",
        example="time_based",
        regex="^(time_based|event_based|condition_based|pattern_based)$"
    )
    trigger_config: Dict[str, Any] = Field(
        ...,
        description="トリガーの設定",
        example={"schedule": "0 9 * * MON", "timezone": "Asia/Tokyo"}
    )
    actions: List[Dict[str, Any]] = Field(
        ...,
        min_items=1,
        description="実行するアクションのリスト",
        example=[{"type": "analysis", "target": "shopify_sales"}]
    )
    active: bool = Field(
        default=True,
        description="ルールがアクティブかどうか"
    )


class GenerationRequest(BaseModel):
    """
    テキスト生成リクエスト
    
    指定されたLLMワーカーを使用して直接テキスト生成を行うためのリクエスト。
    チャット機能よりもシンプルで、単発の生成タスクに適している。
    """
    prompt: str = Field(
        ...,
        min_length=1,
        max_length=8000,
        description="生成プロンプト",
        example="Pythonでファイル読み込み関数を作成してください"
    )
    worker_type: str = Field(
        default="openai",
        description="使用するワーカータイプ",
        example="claude",
        regex="^(openai|anthropic|claude|local_llm)$"
    )
    model_id: Optional[str] = Field(
        None,
        description="特定のモデルID（ワーカータイプ内での選択）",
        example="gpt-4-turbo"
    )


class GenerationResponse(BaseModel):
    """テキスト生成レスポンス"""
    success: bool = Field(description="生成が成功したかどうか")
    response: str = Field(description="生成されたテキスト")
    worker_type: str = Field(description="使用されたワーカータイプ")
    model_id: Optional[str] = Field(description="使用されたモデルID")
    metadata: Optional[Dict[str, Any]] = Field(description="生成メタデータ")


class HealthResponse(BaseModel):
    """ヘルスチェックレスポンス"""
    status: str = Field(description="システム状態", example="healthy")
    timestamp: str = Field(description="チェック実行時刻")
    orchestrator: Optional[Dict[str, Any]] = Field(description="オーケストレーター状態")
    services: Optional[Dict[str, bool]] = Field(description="各サービスの状態")


class ErrorResponse(BaseModel):
    """エラーレスポンス"""
    success: bool = Field(default=False, description="常にfalse")
    error: str = Field(description="エラーメッセージ")
    error_type: Optional[str] = Field(description="エラータイプ")
    details: Optional[Dict[str, Any]] = Field(description="エラー詳細情報")
    timestamp: str = Field(description="エラー発生時刻")


# グローバルインスタンス
orchestrator = None
data_analyzer = None
task_automator = None


@app.on_event("startup")
async def startup_event():
    """サーバー起動時の初期化"""
    global orchestrator, data_analyzer, task_automator
    
    config = {
        "workers": {
            "backend_worker": {"model": "claude-3.5-sonnet"},
            "frontend_worker": {"model": "claude-3.5-sonnet"},
            "review_worker": {"model": "claude-3.5-sonnet"},
            "analytics_worker": {"model": "claude-3.5-sonnet"},
            "documentation_worker": {"model": "claude-3.5-sonnet"},
            "mcp_worker": {"model": "claude-3.5-sonnet"}
        },
        "memory": {
            "syncInterval": 300
        }
    }
    
    orchestrator = MultiLLMOrchestrator(config)
    await orchestrator.initialize()
    
    # 分析エンジンと自動化エンジンを初期化
    data_analyzer = DataAnalyzer()
    task_automator = TaskAutomator(orchestrator)
    
    logger.info("✅ MultiLLM API Server started with Advanced Analytics")


@app.on_event("shutdown")
async def shutdown_event():
    """サーバー終了時のクリーンアップ"""
    global orchestrator
    if orchestrator:
        await orchestrator.shutdown()
    logger.info("👋 MultiLLM API Server shutdown")


@app.get(
    "/",
    summary="サービス情報取得",
    description="MultiLLM APIサービスの基本情報を取得します",
    response_model=Dict[str, str],
    tags=["system"]
)
async def root():
    """
    ### サービス情報エンドポイント
    
    MultiLLM APIサーバーの基本情報とステータスを返します。
    
    **利用例:**
    ```bash
    curl http://localhost:8000/
    ```
    
    **レスポンス例:**
    ```json
    {
        "service": "MultiLLM API",
        "version": "1.0.0", 
        "status": "active"
    }
    ```
    """
    return {
        "service": "Conea MultiLLM Integration API",
        "version": "1.0.0",
        "status": "active",
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get(
    "/health",
    summary="システムヘルスチェック",
    description="システム全体の稼働状況を確認します",
    response_model=HealthResponse,
    responses={
        200: {"description": "システム正常稼働"},
        503: {"description": "システム異常", "model": ErrorResponse}
    },
    tags=["health"]
)
async def health():
    """
    ### システムヘルスチェック
    
    MultiLLMシステム全体の稼働状況を確認し、各コンポーネントの状態を返します。
    
    **チェック項目:**
    - オーケストレーターの状態
    - 各LLMワーカーの接続状況
    - データベース接続
    - メモリ使用量
    
    **利用例:**
    ```bash
    curl http://localhost:8000/health
    ```
    
    **正常時のレスポンス:**
    ```json
    {
        "status": "healthy",
        "timestamp": "2024-01-01T12:00:00",
        "orchestrator": {
            "status": "active",
            "workers": 4,
            "uptime": 3600
        }
    }
    ```
    """
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "orchestrator": orchestrator.get_status() if orchestrator else None
    }


@app.get("/health/ollama", tags=["Health Checks"])
async def health_check_ollama():
    """
    Ollamaサーバーのヘルスチェックと接続性を確認します。

    Returns:
        dict: サーバーの状態を示すJSONレスポンス
            - status: "ok" (正常) または "error" (異常)
            - message: 状態の説明
            - url: チェックしたOllamaサーバーのURL
    """
    try:
        # A simple GET request to the Ollama base URL should be enough
        # to verify that the server is running and reachable.
        response = requests.get(settings.OLLAMA_API_URL, timeout=settings.HEALTHCHECK_TIMEOUT)
        response.raise_for_status()
        
        # If the request is successful, the service is considered healthy.
        return {
            "status": "ok",
            "message": "Ollama server is reachable.",
            "url": settings.OLLAMA_API_URL
        }
    except requests.exceptions.RequestException as e:
        # If the request fails for any reason (timeout, connection error, etc.)
        return JSONResponse(
            status_code=503,  # Service Unavailable
            content={
                "status": "error",
                "message": "Ollama server is unreachable.",
                "url": settings.OLLAMA_API_URL,
                "error_details": str(e)
            }
        )


@app.post(
    "/chat",
    summary="チャット - 通常レスポンス",
    description="LLMとの対話を行い、完全なレスポンスを一括で返します",
    response_model=ChatResponse,
    responses={
        200: {"description": "チャット成功", "model": ChatResponse},
        400: {"description": "リクエストエラー", "model": ErrorResponse},
        500: {"description": "サーバーエラー", "model": ErrorResponse}
    },
    tags=["chat"]
)
async def chat(request: ChatRequest):
    """
    ### 通常チャットエンドポイント（非ストリーミング）
    
    指定されたメッセージに対してLLMから完全な回答を取得します。
    ストリーミングではなく、完成した回答を一括で返します。
    
    **主な機能:**
    - 複数LLMプロバイダーの自動選択または手動指定
    - 会話の継続（conversation_id指定）
    - コンテキスト情報の活用
    - タスクの自動分析と最適なワーカー選択
    
    **利用例:**
    ```bash
    curl -X POST http://localhost:8000/chat \\
      -H "Content-Type: application/json" \\
      -d '{
        "message": "Shopifyの売上データを分析してください",
        "worker_type": "claude",
        "context": {"project_id": "ecommerce_analysis"}
      }'
    ```
    
    **レスポンス例:**
    ```json
    {
        "success": true,
        "response": "Shopifyの売上データ分析を開始します...",
        "conversation_id": "conv_12345-abcde",
        "worker_type": "claude",
        "task_analysis": {
            "task_type": "data_analysis",
            "complexity": "medium",
            "estimated_duration": 30
        }
    }
    ```
    
    **ワーカータイプ:**
    - `claude`: 高度な分析、複雑な推論
    - `openai`: 汎用的な対話、コード生成
    - `local_llm`: プライベート処理（Ollama）
    - 未指定: 自動選択（メッセージ内容に基づく）
    """
    try:
        fallback_info = None
        
        # worker_typeが指定されている場合は、直接ワーカーを使用
        if request.worker_type:
            try:
                # WorkerFactoryを使用してワーカーを作成
                worker = WorkerFactory.create_worker(
                    worker_type=request.worker_type,
                    model_id=None  # model_idはGenerationRequestでのみサポート
                )
                
                # ワーカーでタスクを処理
                response = await worker.process_task(request.message)
                
                return JSONResponse({
                    "success": True,
                    "response": response,
                    "conversation_id": request.conversation_id,
                    "worker_type": request.worker_type,
                    "task_analysis": None  # 直接ワーカー呼び出しの場合はタスク分析なし
                })
            except ValueError as e:
                # 不明なworker_typeの場合はOrchestratorにフォールバック
                logger.warning(f"Unknown worker_type '{request.worker_type}', falling back to orchestrator: {e}")
                fallback_info = {
                    "used": True,
                    "requested_worker": request.worker_type,
                    "actual_worker": "orchestrator"
                }
        
        # worker_typeが指定されていない、または不明な場合は既存のOrchestratorロジックを使用
        result = await orchestrator.process_user_request(
            request=request.message,
            user_id=request.user_id,
            context=request.context,
            conversation_id=request.conversation_id
        )
        
        response_data = {
            "success": True,
            "response": result.get('response'),
            "conversation_id": result.get('conversation_log', {}).get('conversation_id'),
            "task_analysis": result.get('task_analysis') or {}  # 常にtask_analysisを含める
        }
        
        # フォールバック情報を追加（もしあれば）
        if fallback_info:
            response_data["fallback_info"] = fallback_info
        
        return JSONResponse(response_data)
        
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """ストリーミングチャットエンドポイント（SSE）"""
    conversation_id = request.conversation_id or f"conv_{uuid.uuid4()}"
    formatter = ResponseFormatter()
    message_processor = MessageProcessor()
    
    async def generate():
        """SSEイベントジェネレーター"""
        try:
            # 最初のイベント - 会話開始
            yield f"data: {json.dumps({'type': 'start', 'conversation_id': conversation_id})}\n\n"
            
            # ストリーミング用のキュー
            stream_queue = asyncio.Queue()
            
            # メッセージプロセッサのコールバック
            async def process_callback(message: dict):
                await stream_queue.put(('message', message))
            
            # ストリームハンドラー
            async def stream_handler(chunk: str):
                try:
                    # JSONイベントの場合はパース
                    if chunk.strip().startswith('{'):
                        event = json.loads(chunk.strip())
                        await stream_queue.put(('message', event))
                    else:
                        # テキストチャンクの場合
                        await stream_queue.put(('chunk', chunk))
                except json.JSONDecodeError:
                    # JSONでない場合は通常のチャンクとして扱う
                    await stream_queue.put(('chunk', chunk))
            
            # メッセージ処理のタスクタイプを判定
            message_lower = request.message.lower()
            
            # worker_typeが指定されている場合は、直接ワーカーを使用
            if request.worker_type:
                try:
                    # WorkerFactoryを使用してワーカーを作成
                    worker = WorkerFactory.create_worker(
                        worker_type=request.worker_type,
                        model_id=None
                    )
                    
                    await process_callback(formatter.create_thinking_message(f"{request.worker_type}ワーカーで処理中..."))
                    
                    # ワーカーでタスクを処理（非同期）
                    async def worker_process():
                        response = await worker.process_task(request.message)
                        return {
                            'response': response,
                            'worker_type': request.worker_type
                        }
                    
                    process_task = asyncio.create_task(worker_process())
                    
                except ValueError as e:
                    # 不明なworker_typeの場合はOrchestratorにフォールバック
                    logger.warning(f"Unknown worker_type '{request.worker_type}', falling back to orchestrator: {e}")
                    request.worker_type = None  # フォールバックのためリセット
            
            # worker_typeが指定されていない、または無効な場合は既存のロジックを使用
            if not request.worker_type:
                # 処理前のステータス送信
                if any(kw in message_lower for kw in ['思い出して', '記憶', 'メモリ']):
                    await process_callback(formatter.create_thinking_message("メモリを検索中..."))
                    await process_callback(formatter.create_response_message(
                        "メモリを検索します。少々お待ちください...",
                        intermediate=True
                    ))
                    await process_callback(formatter.create_tool_message("OpenMemory", "search"))
                elif any(kw in message_lower for kw in ['実装', 'コード', '作成']):
                    await process_callback(formatter.create_thinking_message("コード生成の準備中..."))
                else:
                    await process_callback(formatter.create_thinking_message("リクエストを分析中..."))
                
                # Orchestratorでリクエスト処理（非同期）
                logger.info(f"Starting orchestrator processing for conversation {conversation_id}")
                process_task = asyncio.create_task(
                    orchestrator.process_user_request(
                        request=request.message,
                        user_id=request.user_id,
                        context=request.context,
                        conversation_id=conversation_id,
                        stream_handler=stream_handler
                    )
                )
            
            # ストリーミング処理
            while True:
                try:
                    # タイムアウト付きでキューから取得
                    event_type, data = await asyncio.wait_for(
                        stream_queue.get(), 
                        timeout=0.1
                    )
                    
                    if event_type == 'chunk':
                        # テキストチャンクをSSEイベントとして送信
                        yield f"data: {json.dumps({'type': 'chunk', 'content': data})}\n\n"
                    elif event_type == 'message':
                        # フォーマット済みメッセージを送信
                        yield f"data: {json.dumps(data)}\n\n"
                    
                except asyncio.TimeoutError:
                    # タスクが完了しているかチェック
                    if process_task.done():
                        break
                    continue
            
            # 最終結果を取得
            logger.info(f"Waiting for orchestrator result for conversation {conversation_id}")
            result = await process_task
            logger.info(f"Orchestrator result received: {list(result.keys()) if result else 'None'}")
            
            # 最終応答を整形して送信
            if result:
                # resultまたはresponseキーから内容を取得
                content = result.get('response') or result.get('result') or result.get('summary', '')
                
                if content:
                    logger.info(f"Sending final response: {content[:100]}...")
                    final_message = formatter.create_response_message(
                        content,
                        intermediate=False
                    )
                    yield f"data: {json.dumps(final_message)}\n\n"
                else:
                    # コンテンツが見つからない場合のエラーハンドリング
                    logger.warning(f"No content found in result: {result.keys()}")
                    error_msg = formatter.create_error_message(
                        "応答の生成に失敗しました。もう一度お試しください。"
                    )
                    yield f"data: {json.dumps(error_msg)}\n\n"
            
            # 終了イベントのみ送信（completeは不要）
            yield f"data: {json.dumps({'type': 'end'})}\n\n"
            
        except Exception as e:
            logger.error(f"Stream error: {e}")
            error_message = formatter.create_error_message(
                "エラーが発生しました。もう一度お試しください。",
                str(e) if app.debug else None
            )
            yield f"data: {json.dumps(error_message)}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Nginxバッファリング無効化
        }
    )


@app.get("/conversations")
async def get_conversations():
    """全会話ログを取得"""
    conversations = orchestrator.get_all_conversations()
    return {
        "conversations": conversations,
        "count": len(conversations)
    }


@app.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str):
    """特定の会話ログを取得"""
    conversation = orchestrator.get_conversation_log(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@app.post("/debug/conversation")
async def debug_conversation(request: ConversationDebugRequest):
    """会話のデバッグ情報を取得"""
    conversation = orchestrator.get_conversation_log(request.conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # デバッグ情報を整形
    debug_info = {
        "conversation_id": conversation['conversation_id'],
        "message_count": len(conversation['messages']),
        "llm_response_count": len(conversation['llm_responses']),
        "mcp_connection_count": len(conversation['mcp_connections']),
        "total_tokens": conversation['total_tokens'],
        "duration": None,
        "messages": conversation['messages'],
        "llm_responses": [
            {
                "id": resp['id'],
                "provider": resp['provider'],
                "model": resp['model'],
                "tokens": resp['tokens'],
                "duration": resp['duration'],
                "timestamp": resp['timestamp']
            }
            for resp in conversation['llm_responses']
        ],
        "mcp_connections": [
            {
                "id": conn['id'],
                "service": conn['service'],
                "action": conn['action'],
                "success": conn['success'],
                "duration": conn['duration'],
                "timestamp": conn['timestamp'],
                "error": conn.get('error')
            }
            for conn in conversation['mcp_connections']
        ]
    }
    
    # 会話時間を計算
    if conversation['start_time'] and conversation['end_time']:
        start = datetime.fromisoformat(conversation['start_time'].replace('Z', '+00:00'))
        end = datetime.fromisoformat(conversation['end_time'].replace('Z', '+00:00'))
        debug_info['duration'] = (end - start).total_seconds()
    
    return debug_info


@app.get("/test/claude")
async def test_claude():
    """Claude API接続テスト"""
    try:
        # 簡単なテストメッセージ
        result = await orchestrator.process_user_request(
            request="こんにちは",
            user_id="test_user"
        )
        return {
            "success": True,
            "response": result.get('response'),
            "api_status": "connected"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "api_status": "error"
        }


@app.post("/generate", response_model=Dict[str, Any])
@limiter.limit("30/minute")
async def generate(request: Request, generation_request: GenerationRequest):
    """
    指定されたワーカータイプを使用してテキストを生成します。

    Args:
        request (Request): FastAPIのリクエストオブジェクト（レート制限用）。
        generation_request (GenerationRequest): プロンプト、ワーカータイプ、モデルIDを含むリクエスト。

    Returns:
        Dict[str, Any]: 生成されたテキストを含むレスポンス。

    Raises:
        HTTPException(400): サポートされていないワーカータイプが指定された場合に発生します。
        HTTPException(500): ワーカーの処理中に内部エラーが発生した場合に発生します。
    """
    try:
        # WorkerFactoryを使用してワーカーを作成
        worker = WorkerFactory.create_worker(
            worker_type=generation_request.worker_type, 
            model_id=generation_request.model_id
        )
    except ValueError as e:
        # WorkerFactoryが不明なworker_typeに対してValueErrorを発生させることを想定
        raise HTTPException(status_code=400, detail=str(e))

    try:
        # ワーカーでタスクを処理
        # BaseWorkerのprocess_taskメソッドを呼び出す
        response = await worker.process_task(generation_request.prompt)
        
        return {
            "success": True,
            "response": response,
            "worker_type": generation_request.worker_type,
            "model_id": generation_request.model_id
        }
    except Exception as e:
        # ワーカー実行中の一般的なエラーを捕捉
        logger.error(f"Worker execution error: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing task: {e}")


@app.get("/workers/types")
async def get_worker_types():
    """
    サポートされているワーカータイプの一覧を取得
    """
    return {
        "success": True,
        "worker_types": WorkerFactory.get_supported_worker_types(),
        "description": {
            "anthropic": "Claude AI by Anthropic",
            "claude": "Claude AI by Anthropic (alias)",
            "openai": "OpenAI GPT models",
            "local_llm": "Local LLM models (Ollama, etc.)"
        }
    }


@app.get("/workers")
async def get_workers():
    """
    利用可能なワーカー一覧を取得するAPI
    
    Returns:
        dict: ワーカータイプのリストを含むレスポンス
    """
    return {
        "workers": WorkerFactory.list_worker_types()
    }


@app.get("/workers/{worker_type}/models")
async def get_worker_models(worker_type: str):
    """
    特定ワーカーの利用可能なモデル一覧を取得するAPI
    
    Args:
        worker_type: ワーカータイプ ('anthropic', 'openai', 'local_llm' など)
    
    Returns:
        dict: ワーカータイプとモデルリストを含むレスポンス
    
    Raises:
        HTTPException: サポートされていないワーカータイプの場合
    """
    try:
        models = await WorkerFactory.get_available_models(worker_type)
        return {
            "worker_type": worker_type,
            "models": models
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting models for {worker_type}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve models")


# ========== Analytics Endpoints ==========

@app.post("/api/analytics/analyze")
async def analyze_data(request: AnalysisRequest):
    """データ分析エンドポイント"""
    try:
        if request.analysis_type == "conversation_patterns":
            # 会話履歴を取得
            conversations = orchestrator.get_all_conversations()
            result = await data_analyzer.analyze_conversation_patterns(conversations)
            
        elif request.analysis_type == "task_performance":
            # タスク履歴を取得（実装に応じて調整）
            tasks = request.data.get('tasks', []) if request.data else []
            result = await data_analyzer.analyze_task_performance(tasks)
            
        elif request.analysis_type == "resource_prediction":
            # リソース使用履歴を取得
            historical_data = request.data.get('historical_data', []) if request.data else []
            result = await data_analyzer.predict_resource_needs(historical_data)
            
        else:
            raise HTTPException(status_code=400, detail="Invalid analysis type")
        
        return {
            "success": True,
            "analysis_type": request.analysis_type,
            "result": result
        }
        
    except Exception as e:
        logger.error(f"Analytics error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/analytics/conversations")
async def get_conversation_analytics():
    """会話パターン分析の取得"""
    try:
        conversations = orchestrator.get_all_conversations()
        result = await data_analyzer.analyze_conversation_patterns(conversations)
        
        return {
            "success": True,
            "total_conversations": len(conversations),
            "analysis": result
        }
        
    except Exception as e:
        logger.error(f"Conversation analytics error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/analytics/tasks")
async def get_task_analytics():
    """タスクパフォーマンス分析の取得"""
    try:
        # タスク履歴を会話ログから抽出
        conversations = orchestrator.get_all_conversations()
        tasks = []
        
        for conv in conversations:
            if conv.get('task_analysis'):
                tasks.append({
                    'conversation_id': conv['conversation_id'],
                    'task': conv['task_analysis'],
                    'duration': conv.get('duration'),
                    'success': conv.get('success', True),
                    'timestamp': conv['start_time']
                })
        
        result = await data_analyzer.analyze_task_performance(tasks)
        
        return {
            "success": True,
            "total_tasks": len(tasks),
            "analysis": result
        }
        
    except Exception as e:
        logger.error(f"Task analytics error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ========== Automation Endpoints ==========

@app.post("/api/automation/rules")
async def create_automation_rule(request: AutomationRuleRequest):
    """自動化ルールの作成"""
    try:
        rule = {
            "id": f"rule_{uuid.uuid4()}",
            "name": request.name,
            "description": request.description,
            "trigger": {
                "type": request.trigger_type,
                "config": request.trigger_config
            },
            "actions": request.actions,
            "active": request.active,
            "created_at": datetime.now().isoformat()
        }
        
        # AutomationRuleオブジェクトに変換
        from orchestrator.automation.task_automator import AutomationRule, AutomationTrigger
        
        automation_rule = AutomationRule(
            id=rule["id"],
            name=rule["name"],
            description=rule["description"],
            trigger_type=AutomationTrigger(rule["trigger"]["type"]),
            trigger_config=rule["trigger"]["config"],
            actions=rule["actions"],
            enabled=rule["active"],
            created_at=datetime.now()
        )
        
        success = task_automator.add_rule(automation_rule)
        
        if success:
            return {
                "success": True,
                "rule_id": rule["id"],
                "message": "自動化ルールが作成されました"
            }
        else:
            raise HTTPException(status_code=400, detail="ルールの作成に失敗しました")
            
    except Exception as e:
        logger.error(f"Automation rule creation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/automation/rules")
async def get_automation_rules():
    """自動化ルール一覧の取得"""
    try:
        rules = task_automator.list_rules()
        return {
            "success": True,
            "rules": rules,
            "count": len(rules)
        }
        
    except Exception as e:
        logger.error(f"Get automation rules error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/automation/rules/{rule_id}")
async def delete_automation_rule(rule_id: str):
    """自動化ルールの削除"""
    try:
        success = task_automator.remove_rule(rule_id)
        
        if success:
            return {
                "success": True,
                "message": f"ルール {rule_id} が削除されました"
            }
        else:
            raise HTTPException(status_code=404, detail="ルールが見つかりません")
            
    except Exception as e:
        logger.error(f"Delete automation rule error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/automation/execute/{rule_id}")
async def execute_automation_rule(rule_id: str):
    """自動化ルールの手動実行"""
    try:
        result = await task_automator.execute_rule(rule_id)
        
        return {
            "success": result.success,
            "executed_actions": result.executed_actions,
            "results": result.outputs,
            "timestamp": result.timestamp.isoformat() if result.timestamp else None,
            "error": result.error,
            "duration": result.duration
        }
        
    except Exception as e:
        logger.error(f"Execute automation rule error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/automation/suggest")
async def suggest_automations():
    """自動化の提案を取得"""
    try:
        # タスク履歴を取得
        conversations = orchestrator.get_all_conversations()
        task_history = []
        
        for conv in conversations:
            if conv.get('messages'):
                for msg in conv['messages']:
                    task_history.append({
                        'message': msg['content'],
                        'timestamp': msg['timestamp'],
                        'user_id': conv.get('user_id', 'default_user')
                    })
        
        suggestions = task_automator.suggest_automations(task_history)
        
        return {
            "success": True,
            "suggestions": suggestions,
            "count": len(suggestions)
        }
        
    except Exception as e:
        logger.error(f"Suggest automations error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 9000))
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info",
        access_log=True
    )