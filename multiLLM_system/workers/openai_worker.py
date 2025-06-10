"""
OpenAI GPT Worker
Handles general AI tasks using OpenAI's GPT models
"""

import os
import json
import logging
import asyncio
from typing import Dict, Any, Optional, List
from .base_worker import BaseWorker, WorkerTask
import openai
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

class OpenAIWorker(BaseWorker):
    """Worker that uses OpenAI's GPT models for various tasks"""
    
    def __init__(self, name: str = "openai-worker", config: Optional[Dict[str, Any]] = None):
        """
        Initializes the OpenAIWorker.

        Args:
            name: The name of the worker
            config: Configuration dictionary for the worker
        """
        if config is None:
            config = {
                'model': os.getenv("OPENAI_MODEL", "gpt-4-turbo-preview"),
                'specialization': [
                    "code_generation",
                    "text_generation",
                    "documentation",
                    "analysis",
                    "general"
                ],
                'maxConcurrentTasks': 3,
                'temperature': 0.7
            }
        
        super().__init__(name=name, config=config)
        
        # Initialize OpenAI client
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable is required")
        
        self.client = AsyncOpenAI(api_key=api_key)
        self.model_id = self.model
        
    async def process(self, task: WorkerTask) -> Dict[str, Any]:
        """Process task using OpenAI API"""
        try:
            content = task.description
            context = task.context
            task_type = task.type
            
            # Build system prompt based on task type
            system_prompt = self._build_system_prompt(task_type, context)
            
            # Create messages
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": content}
            ]
            
            # Call OpenAI API
            response = await self.client.chat.completions.create(
                model=self.model_id,
                messages=messages,
                temperature=self.temperature,
                max_tokens=2000,
            )
            
            response_content = response.choices[0].message.content
            
            return {
                "content": response_content,
                "model": self.model_id,
                "usage": {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                },
                "metadata": {
                    "worker_id": self.name,
                    "task_type": task_type,
                }
            }
            
        except Exception as e:
            logger.error(f"Error processing task: {str(e)}")
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
    
    async def list_models(self) -> List[str]:
        """
        利用可能なモデルのリストを返す
        OpenAIが公式に提供しているモデルリストをハードコードで返却
        
        Returns:
            List[str]: 利用可能なモデルIDのリスト
        """
        # OpenAI GPT models (as of 2024)
        return [
            "gpt-4-turbo-preview",
            "gpt-4-turbo",
            "gpt-4",
            "gpt-3.5-turbo",
            "gpt-3.5-turbo-16k",
            "gpt-4-32k"
        ]

async def main():
    """Main function to run the worker"""
    try:
        worker = OpenAIWorker()
        logger.info(f"Starting OpenAI Worker: {worker.name}")
        await worker.start()
    except KeyboardInterrupt:
        logger.info("Shutting down worker...")
    except Exception as e:
        logger.error(f"Worker error: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())