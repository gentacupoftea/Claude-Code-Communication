"""
Orchestrator API Server
Provides HTTP endpoints for the MultiLLM Orchestrator
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import uvicorn
from orchestrator import MultiLLMOrchestrator, TaskType, TaskPriority
import uuid

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI(title="MultiLLM Orchestrator API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://multillm-demo-2025.web.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global orchestrator instance
orchestrator: Optional[MultiLLMOrchestrator] = None

# Request/Response models
class ChatRequest(BaseModel):
    content: str
    context: Optional[Dict] = {}
    user_id: Optional[str] = None
    include_thinking: bool = True

class ChatResponse(BaseModel):
    message_id: str
    status: str = "processing"

class ThinkingUpdate(BaseModel):
    type: Dict[str, str]
    stage: str
    steps: Optional[List[Dict]] = []

# Initialize orchestrator on startup
@app.on_event("startup")
async def startup_event():
    global orchestrator
    
    config = {
        "workers": {
            "backend_worker": {"model": "gpt-4-turbo", "specialties": ["code", "api", "backend"]},
            "frontend_worker": {"model": "claude-3-sonnet", "specialties": ["ui", "react", "design"]},
            "documentation_worker": {"model": "gpt-4", "specialties": ["docs", "explanation"]},
            "review_worker": {"model": "claude-3-opus", "specialties": ["review", "analysis"]},
            "analytics_worker": {"model": "gpt-4", "specialties": ["data", "statistics"]},
            "creative_worker": {"model": "dall-e-3", "specialties": ["image", "design"]}
        },
        "memory": {
            "syncInterval": 300
        },
        "maxRetries": 3,
        "baseDelay": 1.0,
        "maxDelay": 60.0
    }
    
    orchestrator = MultiLLMOrchestrator(config)
    await orchestrator.initialize()
    logger.info("✅ Orchestrator API Server started")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("🛑 Shutting down Orchestrator API Server")

# Health check endpoint
@app.get("/health")
async def health_check():
    if orchestrator:
        status = orchestrator.get_status()
        return {"status": "healthy", "orchestrator": status}
    return {"status": "unhealthy", "error": "Orchestrator not initialized"}

# Chat endpoint with streaming
@app.post("/api/chat")
async def chat(request: ChatRequest):
    """
    Process chat message through the orchestrator
    Returns streaming response with thinking updates and message chunks
    """
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not available")
    
    # Generate message ID
    message_id = f"msg_{datetime.now().timestamp()}_{uuid.uuid4().hex[:8]}"
    user_id = request.user_id or f"anonymous_{uuid.uuid4().hex[:8]}"
    
    async def generate():
        try:
            # Send initial acknowledgment
            yield f"data: {json.dumps({'type': 'start', 'message_id': message_id})}\n\n"
            
            # Thinking process updates
            if request.include_thinking:
                # Analyzing request
                thinking_update = {
                    "type": "thinking",
                    "data": {
                        "type": {"icon": "🤔", "label": "分析中"},
                        "stage": "リクエストを理解しています",
                        "steps": [{
                            "description": "ユーザーの質問を分析中...",
                            "timestamp": datetime.now().isoformat()
                        }]
                    }
                }
                yield f"data: {json.dumps(thinking_update)}\n\n"
                await asyncio.sleep(0.5)
                
                # Task type detection
                task_type = orchestrator._analyze_task_type(request.content)
                thinking_update = {
                    "type": "thinking",
                    "data": {
                        "type": {"icon": "🎯", "label": "タスク判定"},
                        "stage": "タスクタイプを判定しています",
                        "steps": [{
                            "description": f"タスクタイプ: {task_type.value}",
                            "detail": f"適切なWorkerを選択中",
                            "timestamp": datetime.now().isoformat()
                        }]
                    }
                }
                yield f"data: {json.dumps(thinking_update)}\n\n"
                await asyncio.sleep(0.5)
            
            # Process request through orchestrator
            result = await orchestrator.process_user_request(
                request.content,
                user_id,
                request.context
            )
            
            # Stream the response
            if isinstance(result, dict) and "error" not in result:
                response_text = result.get("result", str(result))
                
                # If it's an integrated result, format it nicely
                if result.get("type") == "integrated_result":
                    response_parts = []
                    for i, sub_result in enumerate(result.get("results", [])):
                        if isinstance(sub_result, dict) and "result" in sub_result:
                            response_parts.append(f"{i+1}. {sub_result['result']}")
                    response_text = "\n\n".join(response_parts)
                
                # Chunk the response for streaming
                chunk_size = 20
                for i in range(0, len(response_text), chunk_size):
                    chunk = response_text[i:i + chunk_size]
                    message_chunk = {
                        "type": "chunk",
                        "data": {
                            "content": chunk,
                            "message_id": message_id,
                            "is_complete": i + chunk_size >= len(response_text)
                        }
                    }
                    yield f"data: {json.dumps(message_chunk)}\n\n"
                    await asyncio.sleep(0.05)  # Streaming effect
            else:
                # Error response
                error_msg = result.get("error", "Unknown error occurred")
                error_chunk = {
                    "type": "error",
                    "data": {
                        "error": error_msg,
                        "message_id": message_id
                    }
                }
                yield f"data: {json.dumps(error_chunk)}\n\n"
            
            # Send completion signal
            yield f"data: {json.dumps({'type': 'complete', 'message_id': message_id})}\n\n"
            
        except Exception as e:
            logger.error(f"Error processing chat request: {e}")
            error_response = {
                "type": "error",
                "data": {
                    "error": str(e),
                    "message_id": message_id
                }
            }
            yield f"data: {json.dumps(error_response)}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

# Get orchestrator status
@app.get("/api/status")
async def get_status():
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not available")
    
    return orchestrator.get_status()

# Get available workers
@app.get("/api/workers")
async def get_workers():
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not available")
    
    workers = []
    for name, worker in orchestrator.workers.items():
        workers.append({
            "name": name,
            "model": worker["config"].get("model", "unknown"),
            "status": worker["status"],
            "specialties": worker["config"].get("specialties", [])
        })
    
    return {"workers": workers}

# Main entry point
if __name__ == "__main__":
    uvicorn.run(
        "api_server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )