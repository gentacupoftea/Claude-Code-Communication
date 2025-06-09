# multiLLM_system/server.py
import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware

# Sprint 2で導入されたモジュール
from .config.logging_config import setup_logging
from .utils.exceptions import BaseCustomException
from .config.settings import settings

# Sprint 3でAI-2が追加すべきだったモジュール
from .api.v1 import chat as chat_v1

# ログ設定を適用
setup_logging()
logger = logging.getLogger(__name__)

app = FastAPI(
    title="MultiLLM System API",
    description="Multi-LLM System with unified API endpoints",
    version="1.0.0"
)

# Sprint 2で導入されたCORSミドルウェア
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Sprint 2で導入されたカスタム例外ハンドラ
@app.exception_handler(BaseCustomException)
async def custom_exception_handler(request: Request, exc: BaseCustomException):
    logger.error(f"Custom exception caught: {exc.detail}", exc_info=True)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )

# Sprint 3でAI-2が追加したかったルーター
app.include_router(chat_v1.router, prefix="/api/v1", tags=["v1_chat"])

@app.get("/")
async def root():
    logger.info("Root endpoint was hit from IP: %s", request.client.host)
    return {"message": "MultiLLM System API is running"}

# uvicornでの直接実行に関する部分は、DockerfileやCIスクリプトで管理されるべきなので、
# server.py本体からは削除するのが一般的です。
# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run(app, host="0.0.0.0", port=8000)