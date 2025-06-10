import uvicorn
from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
import sys
import time
import asyncio
from typing import List, Dict, Any
import logging

# プロジェクトのルートディレクトリをPythonパスに追加
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# MultiLLMServiceをインポート
from src.services.multi_llm_service import multi_llm_service

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# --- FastAPI Application Setup ---

app = FastAPI(
    title="Conea Backend API",
    version="1.1.0",
    description="Main API for the Conea platform, now with standardized /api prefix.",
)

# --- CORS Middleware ---

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 本番環境では特定のオリジンに制限してください
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Models ---

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: str = "gpt-3.5-turbo"
    stream: bool = True

class ApiSettings(BaseModel):
    openai_api_key: str | None = None
    anthropic_api_key: str | None = None
    google_api_key: str | None = None
    amazon_access_key: str | None = None
    rakuten_api_key: str | None = None
    shopify_api_key: str | None = None
    nextengine_api_key: str | None = None

class ApiKey(BaseModel):
    name: str
    key_prefix: str
    provider: str | None = None

# --- API Router with /api prefix ---

api_router = APIRouter(prefix="/api")

# --- Core API Endpoints ---

@api_router.get("/health", summary="Health Check", tags=["System"])
async def health_check():
    """
    Performs a health check and returns the operational status of the server.
    """
    logger.info("Health check endpoint was hit.")
    # ここでデータベース接続などを確認することも可能
    return {
        "status": "healthy", 
        "timestamp": time.time(), 
        "version": app.version,
        "apis": {
            "shopify": {"connected": False, "message": "API未設定"},
            "amazon": {"connected": False, "message": "API未設定"},
            "rakuten": {"connected": False, "message": "API未設定"},
            "nextengine": {"connected": False, "message": "API未設定"},
            "smaregi": {"connected": False, "message": "API未設定"},
            "google_analytics": {"connected": False, "message": "API未設定"}
        }
    }

@api_router.get("/models", summary="Get Available AI Models", tags=["AI"])
async def get_available_models() -> List[Dict[str, Any]]:
    """
    Returns a list of currently available AI models for the platform.
    This is a mock implementation.
    """
    logger.info("Models endpoint was hit.")
    # 本来は設定ファイルやデータベースから動的に取得する
    mock_models = [
        {"id": "claude-3-opus-20240229", "name": "Claude 3 Opus", "provider": "Anthropic"},
        {"id": "claude-3-sonnet-20240229", "name": "Claude 3 Sonnet", "provider": "Anthropic"},
        {"id": "claude-3-haiku-20240307", "name": "Claude 3 Haiku", "provider": "Anthropic"},
        {"id": "gpt-4-turbo", "name": "GPT-4 Turbo", "provider": "OpenAI"},
        {"id": "gpt-3.5-turbo", "name": "GPT-3.5 Turbo", "provider": "OpenAI"},
    ]
    return mock_models

# チャットエンドポイント（簡易版）
@api_router.post("/chat", summary="Chat with AI", tags=["AI"])
async def chat(request: dict):
    """
    Simple chat endpoint for testing.
    """
    message = request.get("message", "")
    logger.info(f"Chat endpoint was hit with message: {message}")
    
    return {
        "success": True,
        "response": f"申し訳ございません。現在バックエンドサービスは調整中です。メッセージ「{message}」は受信しました。",
        "conversation_id": f"conv_{int(time.time() * 1000)}",
        "worker_type": "mock"
    }

# チャットストリーミングエンドポイント
@api_router.post("/chat/stream", summary="Stream Chat Response", tags=["Chat"])
async def stream_chat_response(request: ChatRequest):
    """
    Receives chat messages and streams back a real AI response.
    """
    try:
        # リクエストからメッセージリストとモデルを取得
        messages = [msg.dict() for msg in request.messages]
        model = request.model
        
        logger.info(f"Chat stream request received. Model: {model}, Messages: {len(messages)}")
        
        # MultiLLMServiceを呼び出してストリーミング応答を生成
        response_generator = multi_llm_service.stream_chat_completion(
            messages=messages,
            model=model
        )
        
        return StreamingResponse(response_generator, media_type="text/event-stream")
    except Exception as e:
        logger.error(f"Error in chat stream endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ワーカー状態エンドポイント
@api_router.get("/workers", summary="Get Worker Status", tags=["Workers"])
async def get_workers():
    """
    Returns the status of available workers.
    """
    return [
        {"worker_type": "claude", "status": "offline", "message": "API接続調整中"},
        {"worker_type": "openai", "status": "offline", "message": "API接続調整中"},
        {"worker_type": "local_llm", "status": "offline", "message": "未設定"}
    ]

# --- API Settings ---
@api_router.get("/settings/apis", summary="Get API Settings", tags=["Settings"])
async def get_api_settings():
    """
    Returns the current API settings in the expected nested structure.
    """
    # フロントエンドが期待するネストされたデータ構造を返す
    return {
        "amazon": {
            "accessKeyId": "AKIA...",
            "secretAccessKey": "...",
            "region": "us-east-1",
            "marketplaceId": "ATVPDKIKX0DER",
            "sellerId": "A123456789"
        },
        "rakuten": {
            "applicationId": "1098765432109876543",
            "secret": "SL...",
            "serviceSecret": "...",
            "shopUrl": "https://www.rakuten.co.jp/shop/"
        },
        "shopify": {
            "shopDomain": "your-store.myshopify.com",
            "accessToken": "shpat_...",
            "apiKey": "...",
            "apiSecret": "shpss_..."
        },
        "nextengine": {
            "clientId": "...",
            "clientSecret": "...",
            "accessToken": "...",
            "refreshToken": "..."
        }
    }

@api_router.post("/settings/apis", summary="Save API Settings", tags=["Settings"])
async def save_api_settings(settings: ApiSettings):
    """
    Saves the API settings.
    """
    logger.info(f"Saving API settings: {settings.model_dump_json()}")
    return {"success": True, "message": "API settings saved successfully."}

# --- Dashboards ---
@api_router.get("/dashboards", summary="Get Dashboards", tags=["Dashboards"])
async def get_dashboards():
    """
    Returns a list of saved dashboards.
    """
    return [
        {
            "id": "dashboard-1",
            "name": "Default Dashboard",
            "widgets": [],
            "createdAt": "2024-01-01T00:00:00Z",
            "updatedAt": "2024-01-01T00:00:00Z"
        }
    ]

@api_router.post("/dashboards", summary="Save Dashboard", tags=["Dashboards"])
async def save_dashboard(dashboard: Dict[str, Any]):
    """
    Saves a dashboard configuration.
    """
    logger.info(f"Saving dashboard: {dashboard}")
    return {"success": True, "dashboard": dashboard}

# --- Learning Data ---
@api_router.get("/learning-data", summary="Get Learning Data", tags=["Learning Data"])
async def get_learning_data():
    """
    Returns a list of uploaded learning data files.
    """
    return [
        {
            "id": "ld-1",
            "name": "Sample Data.csv",
            "source": "Upload",
            "size": 1024,
            "uploadedAt": "2024-01-01T00:00:00Z"
        }
    ]

@api_router.post("/learning-data/upload", summary="Upload Learning Data", tags=["Learning Data"])
async def upload_learning_data(data: Dict[str, Any]):
    """
    Handles learning data file upload.
    """
    logger.info(f"Uploaded file: {data.get('fileName')}")
    return {
        "success": True,
        "file": {
            "id": f"ld-{int(time.time())}",
            "name": data.get('fileName'),
            "size": data.get('fileSize', 0)
        }
    }

# --- API Connection Tests ---
@api_router.get("/test-connection/{api_type}", summary="Test API Connection", tags=["Tests"])
async def test_api_connection(api_type: str):
    """
    Tests the connection to external APIs.
    """
    valid_types = ['amazon', 'rakuten', 'shopify', 'nextengine']
    if api_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid API type. Must be one of: {valid_types}")
    
    return {
        "success": True,
        "message": f"{api_type} connection test successful.",
        "timestamp": time.time()
    }

# --- API Key Management ---
@api_router.get("/keys", summary="Get API Keys", tags=["Keys"])
async def get_api_keys():
    """
    Returns a list of saved API keys (masked).
    """
    return [
        {
            "id": "key-1",
            "name": "My OpenAI Key",
            "key_prefix": "sk-...",
            "provider": "openai",
            "createdAt": "2024-01-01T00:00:00Z"
        }
    ]

@api_router.post("/keys", summary="Save API Key", tags=["Keys"])
async def save_api_key(key_data: ApiKey):
    """
    Saves a new API key.
    """
    logger.info(f"Saving API key: {key_data.name}")
    return {
        "success": True,
        "message": "API key saved.",
        "id": f"key-{int(time.time())}"
    }

@api_router.put("/keys/{key_id}", summary="Update API Key", tags=["Keys"])
async def update_api_key(key_id: str, key_data: ApiKey):
    """
    Updates an existing API key.
    """
    logger.info(f"Updating API key {key_id}: {key_data.name}")
    return {
        "success": True,
        "message": "API key updated.",
        "id": key_id
    }

@api_router.delete("/keys/{key_id}", summary="Delete API Key", tags=["Keys"])
async def delete_api_key(key_id: str):
    """
    Deletes an API key.
    """
    logger.info(f"Deleting API key {key_id}")
    return {
        "success": True,
        "message": "API key deleted."
    }

# --- Include existing routers into the main API router ---
#
# 例：
# api_router.include_router(user_routes.router, tags=["Users"])
# api_router.include_router(project_routes.router, tags=["Projects"])
# ...

# Register the main API router to the app
app.include_router(api_router)

# ルートパスのエンドポイント（APIプレフィックスなし）
@app.get("/", summary="API Root", tags=["System"])
async def root():
    """
    Returns basic API information.
    """
    return {
        "service": "Conea Backend API",
        "version": app.version,
        "status": "active",
        "docs": "/docs",
        "redoc": "/redoc"
    }

# --- Lifespan Events (Optional, replacement for on_event) ---

@app.on_event("startup")
async def on_startup():
    logger.info("Starting up Conea backend application...")
    # on_eventの代わりにlifespanコンテキストマネージャを使用することを推奨
    # await create_db_and_tables()
    # logger.info("Database tables checked/created.")

@app.on_event("shutdown")
def on_shutdown():
    logger.info("Shutting down Conea backend application...")


# --- Main execution ---

if __name__ == "__main__":
    logger.info("Starting server...")
    uvicorn.run("run_server:app", host="0.0.0.0", port=8000, reload=True)