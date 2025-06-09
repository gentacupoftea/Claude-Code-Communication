# multiLLM_system/api/v1/chat.py
from fastapi import APIRouter
from ...schemas.chat import ChatCompletionRequest, ChatCompletionResponse

router = APIRouter()

@router.post("/completions", response_model=ChatCompletionResponse)
async def get_chat_completion(request: ChatCompletionRequest):
    # 今はダミーレスポンスを返す
    last_user_message = ""
    for message in reversed(request.messages):
        if message.role == 'user':
            last_user_message = message.content
            break
    
    return ChatCompletionResponse(
        role="assistant",
        content=f"Received your message about '{last_user_message}' with model {request.model}. This is a dummy response."
    )