"""
Claude Worker
Handles AI tasks using Anthropic's Claude models
"""

import os
import json
import logging
import asyncio
from typing import Dict, Any, Optional, List
from .base_worker import BaseWorker, WorkerTask
import anthropic
from anthropic import AsyncAnthropic

logger = logging.getLogger(__name__)

class ClaudeWorker(BaseWorker):
    """Worker that uses Anthropic's Claude models for various tasks"""

    def __init__(self, name: str = "claude-worker", config: Optional[Dict[str, Any]] = None):
        """
        Initializes the ClaudeWorker.

        Args:
            name: The name of the worker
            config: Configuration dictionary for the worker
        """
        if config is None:
            config = {
                'model': os.getenv("ANTHROPIC_MODEL", "claude-3-opus-20240229"),
                'specialization': [
                    "code_generation",
                    "text_generation",
                    "documentation",
                    "analysis",
                    "general_coding"
                ],
                'maxConcurrentTasks': 3,
                'temperature': 0.7
            }
        super().__init__(name=name, config=config)

        # Initialize Anthropic client
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable is required")
        
        self.client = AsyncAnthropic(api_key=api_key)
        self.model_id = self.model

    async def process(self, task: WorkerTask) -> Dict[str, Any]:
        """Process task using Anthropic's Claude API"""
        try:
            content = task.description
            context = task.context
            task_type = task.type
            
            # Build system prompt based on task type
            system_prompt = self._build_system_prompt(task_type, context)
            
            # Create messages
            messages = [{"role": "user", "content": content}]
            
            # Call Anthropic API
            response = await self.client.messages.create(
                model=self.model_id,
                system=system_prompt,
                messages=messages,
                max_tokens=4000,
                temperature=self.temperature,
            )
            
            response_content = response.content[0].text
            
            return {
                "content": response_content,
                "model": self.model_id,
                "usage": {
                    "prompt_tokens": response.usage.input_tokens,
                    "completion_tokens": response.usage.output_tokens,
                },
                "metadata": {
                    "worker_id": self.name,
                    "task_type": task_type,
                    "stop_reason": response.stop_reason
                }
            }
            
        except Exception as e:
            logger.error(f"Error processing task: {str(e)}")
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
        logger.info(f"Starting Claude Worker: {worker.name}")
        await worker.start()
    except KeyboardInterrupt:
        logger.info("Shutting down worker...")
    except Exception as e:
        logger.error(f"Worker error: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())