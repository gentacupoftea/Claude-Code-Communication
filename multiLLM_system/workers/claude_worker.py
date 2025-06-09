"""
Claude Worker
Handles AI tasks using Anthropic's Claude models
"""

import os
import json
import logging
import asyncio
from typing import Dict, Any, Optional, List
from base_worker import BaseWorker, WorkerCapability
import anthropic
from anthropic import AsyncAnthropic

logger = logging.getLogger(__name__)

class ClaudeWorker(BaseWorker):
    """Worker that uses Anthropic's Claude models for various tasks"""
    
    def __init__(self, worker_id: str = "claude-worker-001"):
        super().__init__(
            worker_id=worker_id,
            worker_type="claude",
            capabilities=[
                WorkerCapability.CODE_GENERATION,
                WorkerCapability.TEXT_GENERATION,
                WorkerCapability.DOCUMENTATION,
                WorkerCapability.ANALYSIS,
                WorkerCapability.GENERAL,
                WorkerCapability.PR_REVIEW,
            ]
        )
        
        # Initialize Anthropic client
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable is required")
        
        self.client = AsyncAnthropic(api_key=api_key)
        self.model = os.getenv("CLAUDE_MODEL", "claude-3-opus-20240229")
        
    async def _process_task_internal(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Process task using Claude API"""
        try:
            content = task.get("content", "")
            context = task.get("context", {})
            task_type = task.get("task_type", "GENERAL")
            
            # Update thinking process
            await self.update_thinking(task["id"], {
                "type": {"icon": "🤖", "label": "Claude"},
                "stage": "タスクを分析中",
                "steps": [{
                    "description": f"タスクタイプ: {task_type}",
                    "detail": f"モデル: {self.model}",
                }]
            })
            
            # Build system prompt based on task type
            system_prompt = self._build_system_prompt(task_type, context)
            
            # Build messages for Claude
            messages = []
            
            # Add context messages if available
            if context.get("previous_messages"):
                for msg in context["previous_messages"][-5:]:  # Last 5 messages
                    messages.append({
                        "role": msg.get("role", "user"),
                        "content": msg.get("content", "")
                    })
            
            # Add current message
            messages.append({"role": "user", "content": content})
            
            # Update thinking
            await self.update_thinking(task["id"], {
                "type": {"icon": "💭", "label": "生成中"},
                "stage": "Claude APIを呼び出し中",
                "steps": [{
                    "description": "応答を生成しています...",
                    "detail": f"トークン数: ~{len(content.split()) * 1.3:.0f}",
                }]
            })
            
            # Call Claude API with streaming
            response_content = ""
            chunk_count = 0
            
            async with self.client.messages.stream(
                model=self.model,
                messages=messages,
                system=system_prompt,
                max_tokens=2000,
                temperature=0.7,
            ) as stream:
                async for text in stream.text_stream:
                    response_content += text
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
        base_prompt = "あなたは高度なAIアシスタントのClaudeです。"
        
        type_prompts = {
            "CODE_GENERATION": "プログラミングとコード生成に特化しています。コードは明確で、効率的で、ベストプラクティスに従うようにしてください。特に、セキュリティとパフォーマンスに注意を払ってください。",
            "TEXT_GENERATION": "クリエイティブで有益なテキストコンテンツの生成に特化しています。読みやすく、魅力的な文章を心がけてください。",
            "DOCUMENTATION": "技術文書とドキュメントの作成に特化しています。明確で構造化された、開発者に優しい文書を作成してください。",
            "ANALYSIS": "データ分析と洞察の提供に特化しています。論理的で根拠のある、実用的な分析を行ってください。",
            "PR_REVIEW": "プルリクエストのレビューに特化しています。コードの品質、セキュリティ、パフォーマンス、可読性を評価してください。",
            "GENERAL": "幅広い知識を活用して、様々な質問に答えます。正確で有用な情報を提供することを心がけてください。"
        }
        
        prompt = base_prompt + " " + type_prompts.get(task_type, type_prompts["GENERAL"])
        
        # Add project context if available
        if context.get("project_name"):
            prompt += f"\n\n現在のプロジェクト: {context['project_name']}"
        if context.get("task_name"):
            prompt += f"\n現在のタスク: {context['task_name']}"
        
        # Add language preference
        prompt += "\n\n日本語で応答してください。コードやテクニカルな用語は英語のままで構いません。"
        
        return prompt
    
    async def list_models(self) -> List[str]:
        """
        利用可能なモデルのリストを返す
        Anthropicが公式に提供しているモデルリストをハードコードで返却
        
        Returns:
            List[str]: 利用可能なモデルIDのリスト
        """
        # Anthropic Claude models (as of 2024)
        return [
            "claude-3-opus-20240229",
            "claude-3-sonnet-20240229",
            "claude-3-haiku-20240307",
            "claude-2.1",
            "claude-2.0",
            "claude-instant-1.2"
        ]

async def main():
    """Main function to run the worker"""
    try:
        worker = ClaudeWorker()
        logger.info(f"Starting Claude Worker: {worker.worker_id}")
        await worker.start()
    except KeyboardInterrupt:
        logger.info("Shutting down worker...")
    except Exception as e:
        logger.error(f"Worker error: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())