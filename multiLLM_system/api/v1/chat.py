import json
from fastapi import APIRouter
from pydantic import BaseModel
from starlette.responses import StreamingResponse

# 修正点1: ThinkingStepを正しくインポートする
from multiLLM_system.orchestrator.chat_orchestrator import ChatOrchestrator, ThinkingStep
from multiLLM_system.services.local_llm.llm_manager import LocalLLMManager

router = APIRouter()

class ChatRequest(BaseModel):
    message: str

async def stream_generator(message: str):
    try:
        llm_manager = LocalLLMManager()
        chat_orchestrator = ChatOrchestrator(llm_manager=llm_manager)
        
        # 修正点2: オーケストレーターには単純な文字列を渡す
        async for step in chat_orchestrator.handle_chat(message):
            # 修正点3: Pydantic v2の .model_dump() を使い、安全かつモダンにシリアライズする
            step_dict = step.model_dump()
            yield f"data: {json.dumps(step_dict)}\n\n"

    except Exception as e:
        # 修正点4: エラー発生時もThinkingStepの形式に統一して返し、クライアントの処理をシンプルにする
        error_step = ThinkingStep(type="error", details=f"An error occurred in the backend: {str(e)}")
        error_dict = error_step.model_dump()
        yield f"data: {json.dumps(error_dict)}\n\n"

# APIのプレフィックスは server.py で /api/v1 が設定されるため、ここは /chat/ とする
@router.post("/chat/", response_class=StreamingResponse)
async def chat_endpoint(request: ChatRequest):
    """
    ユーザーからのメッセージを受け取り、LLMの思考プロセスをSSEでストリーミングするエンドポイント。
    """
    return StreamingResponse(
        stream_generator(request.message),
        media_type="text/event-stream"
    )