# multiLLM_system/schemas/chat.py
from pydantic import BaseModel
from typing import List

class Message(BaseModel):
    role: str
    content: str

class ChatCompletionRequest(BaseModel):
    messages: List[Message]
    model: str

class ChatCompletionResponse(BaseModel):
    role: str
    content: str