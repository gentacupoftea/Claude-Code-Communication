"""
MultiLLM API Server - SSE対応のストリーミングAPIサーバー
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime
from typing import Dict, Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
import sys
import os

# 親ディレクトリをパスに追加
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from orchestrator.orchestrator import MultiLLMOrchestrator
from orchestrator.response_formatter import ResponseFormatter, MessageProcessor

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# FastAPIアプリケーション
app = FastAPI(title="MultiLLM API", version="1.0.0")

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3500", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    """チャットリクエスト"""
    message: str
    conversation_id: Optional[str] = None
    user_id: str = "default_user"
    context: Optional[Dict] = None


class ConversationDebugRequest(BaseModel):
    """会話デバッグリクエスト"""
    conversation_id: str


# グローバルオーケストレーター
orchestrator = None


@app.on_event("startup")
async def startup_event():
    """サーバー起動時の初期化"""
    global orchestrator
    
    config = {
        "workers": {
            "backend_worker": {"model": "claude-3.5-sonnet"},
            "frontend_worker": {"model": "claude-3.5-sonnet"},
            "review_worker": {"model": "claude-3.5-sonnet"},
            "analytics_worker": {"model": "claude-3.5-sonnet"},
            "documentation_worker": {"model": "claude-3.5-sonnet"}
        },
        "memory": {
            "syncInterval": 300
        }
    }
    
    orchestrator = MultiLLMOrchestrator(config)
    await orchestrator.initialize()
    logger.info("✅ MultiLLM API Server started")


@app.on_event("shutdown")
async def shutdown_event():
    """サーバー終了時のクリーンアップ"""
    global orchestrator
    if orchestrator:
        await orchestrator.shutdown()
    logger.info("👋 MultiLLM API Server shutdown")


@app.get("/")
async def root():
    """ルートエンドポイント"""
    return {
        "service": "MultiLLM API",
        "version": "1.0.0",
        "status": "active"
    }


@app.get("/health")
async def health():
    """ヘルスチェック"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "orchestrator": orchestrator.get_status() if orchestrator else None
    }


@app.post("/chat")
async def chat(request: ChatRequest):
    """通常のチャットエンドポイント（非ストリーミング）"""
    try:
        result = await orchestrator.process_user_request(
            request=request.message,
            user_id=request.user_id,
            context=request.context,
            conversation_id=request.conversation_id
        )
        
        return JSONResponse({
            "success": True,
            "response": result.get('response'),
            "conversation_id": result.get('conversation_log', {}).get('conversation_id'),
            "task_analysis": result.get('task_analysis')
        })
        
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
                await stream_queue.put(('chunk', chunk))
            
            # メッセージ処理のタスクタイプを判定
            message_lower = request.message.lower()
            
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
            result = await process_task
            
            # 最終応答を整形して送信
            if result:
                # resultまたはresponseキーから内容を取得
                content = result.get('response') or result.get('result') or result.get('summary', '')
                
                if content:
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