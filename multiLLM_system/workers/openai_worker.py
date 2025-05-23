"""
OpenAI GPT Worker
Handles general AI tasks using OpenAI's GPT models
"""

import os
import json
import logging
import asyncio
from typing import Dict, Any, Optional
from base_worker import BaseWorker, WorkerCapability
import openai
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

class OpenAIWorker(BaseWorker):
    """Worker that uses OpenAI's GPT models for various tasks"""
    
    def __init__(self, worker_id: str = "openai-worker-001"):
        super().__init__(
            worker_id=worker_id,
            worker_type="openai",
            capabilities=[
                WorkerCapability.CODE_GENERATION,
                WorkerCapability.TEXT_GENERATION,
                WorkerCapability.DOCUMENTATION,
                WorkerCapability.ANALYSIS,
                WorkerCapability.GENERAL,
            ]
        )
        
        # Initialize OpenAI client
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable is required")
        
        self.client = AsyncOpenAI(api_key=api_key)
        self.model = os.getenv("OPENAI_MODEL", "gpt-4-turbo-preview")
        
    async def _process_task_internal(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Process task using OpenAI API"""
        try:
            content = task.get("content", "")
            context = task.get("context", {})
            task_type = task.get("task_type", "GENERAL")
            
            # Update thinking process
            await self.update_thinking(task["id"], {
                "type": {"icon": "🤖", "label": "OpenAI GPT"},
                "stage": "タスクを分析中",
                "steps": [{
                    "description": f"タスクタイプ: {task_type}",
                    "detail": f"モデル: {self.model}",
                }]
            })
            
            # Build system prompt based on task type
            system_prompt = self._build_system_prompt(task_type, context)
            
            # Create messages
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": content}
            ]
            
            # Add context if available
            if context.get("previous_messages"):
                for msg in context["previous_messages"][-5:]:  # Last 5 messages
                    messages.append({
                        "role": msg.get("role", "user"),
                        "content": msg.get("content", "")
                    })
            
            # Update thinking
            await self.update_thinking(task["id"], {
                "type": {"icon": "💭", "label": "生成中"},
                "stage": "OpenAI APIを呼び出し中",
                "steps": [{
                    "description": "応答を生成しています...",
                    "detail": f"トークン数: ~{len(content.split()) * 1.3:.0f}",
                }]
            })
            
            # Call OpenAI API with streaming
            response_content = ""
            chunk_count = 0
            
            stream = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.7,
                max_tokens=2000,
                stream=True
            )
            
            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    chunk_content = chunk.choices[0].delta.content
                    response_content += chunk_content
                    chunk_count += 1
                    
                    # Send streaming update every 10 chunks
                    if chunk_count % 10 == 0:
                        await self.send_streaming_update(task["id"], response_content)
            
            # Final update
            await self.send_streaming_update(task["id"], response_content, is_complete=True)
            
            # Update thinking
            await self.update_thinking(task["id"], {
                "type": {"icon": "✅", "label": "完了"},
                "stage": "応答生成完了",
                "steps": [{
                    "description": "応答の生成が完了しました",
                    "detail": f"文字数: {len(response_content)}",
                }]
            })
            
            return {
                "content": response_content,
                "model": self.model,
                "usage": {
                    "prompt_tokens": len(str(messages)) // 4,  # Rough estimate
                    "completion_tokens": len(response_content) // 4,
                },
                "metadata": {
                    "worker_id": self.worker_id,
                    "task_type": task_type,
                }
            }
            
        except Exception as e:
            logger.error(f"Error processing task: {str(e)}")
            await self.update_thinking(task["id"], {
                "type": {"icon": "❌", "label": "エラー"},
                "stage": "エラーが発生しました",
                "steps": [{
                    "description": f"エラー: {str(e)}",
                    "detail": "タスクの処理中にエラーが発生しました",
                }]
            })
            raise
    
    def _build_system_prompt(self, task_type: str, context: Dict[str, Any]) -> str:
        """Build system prompt based on task type"""
        base_prompt = "あなたは高度なAIアシスタントです。"
        
        type_prompts = {
            "CODE_GENERATION": "プログラミングとコード生成に特化しています。コードは明確で、効率的で、ベストプラクティスに従うようにしてください。",
            "TEXT_GENERATION": "クリエイティブで有益なテキストコンテンツの生成に特化しています。",
            "DOCUMENTATION": "技術文書とドキュメントの作成に特化しています。明確で構造化された文書を作成してください。",
            "ANALYSIS": "データ分析と洞察の提供に特化しています。論理的で根拠のある分析を行ってください。",
            "UI_DESIGN": "UIデザインとユーザーエクスペリエンスに特化しています。",
            "GENERAL": "幅広い知識を活用して、様々な質問に答えます。"
        }
        
        prompt = base_prompt + " " + type_prompts.get(task_type, type_prompts["GENERAL"])
        
        # Add project context if available
        if context.get("project_name"):
            prompt += f"\n\n現在のプロジェクト: {context['project_name']}"
        if context.get("task_name"):
            prompt += f"\n現在のタスク: {context['task_name']}"
        
        return prompt

async def main():
    """Main function to run the worker"""
    try:
        worker = OpenAIWorker()
        logger.info(f"Starting OpenAI Worker: {worker.worker_id}")
        await worker.start()
    except KeyboardInterrupt:
        logger.info("Shutting down worker...")
    except Exception as e:
        logger.error(f"Worker error: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())