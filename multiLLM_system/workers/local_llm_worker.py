# multiLLM_system/workers/local_llm_worker.py

import requests
import asyncio
import logging
from typing import Dict, Any, List, Optional, TypedDict
from datetime import datetime

from .base_worker import BaseWorker, WorkerTask
from ..config.settings import settings

logger = logging.getLogger(__name__)

# 型定義を追加
class OllamaResponse(TypedDict):
    response: str
    done: bool
    context: List[int]
    total_duration: int
    load_duration: int
    prompt_eval_count: int
    eval_count: int

class LocalLLMWorker(BaseWorker):
    """
    A worker that interacts with a local LLM served via the Ollama API.
    """

    def __init__(self, name: str = "local_llm_worker", config: Optional[Dict[str, Any]] = None):
        """
        Initializes the LocalLLMWorker.

        Args:
            name: The name of the worker
            config: Configuration dictionary for the worker
        """
        if config is None:
            config = {
                'model': settings.LOCAL_LLM_MODEL,
                'specialization': ['general', 'analysis', 'code_generation'],
                'maxConcurrentTasks': 3,
                'temperature': 0.7
            }
        
        super().__init__(name=name, config=config)
        
        self.model_id = config.get('model', settings.LOCAL_LLM_MODEL)
        self.api_url = f"{settings.OLLAMA_API_URL}/api/generate"
        
        logger.info(f"Initialized LocalLLMWorker with model: {self.model_id}")

    async def process(self, task: WorkerTask) -> Dict[str, Any]:
        """
        Process task using Ollama API.
        Worker固有の処理を実装
        
        Args:
            task: The WorkerTask to process
            
        Returns:
            A dictionary containing the response from the LLM
        """
        try:
            # タスクの内容を取得
            prompt = task.description
            context = task.context
            
            # コンテキストがある場合は追加
            if context:
                context_str = "\n".join([f"{k}: {v}" for k, v in context.items()])
                prompt = f"Context:\n{context_str}\n\nTask:\n{prompt}"
            
            # Ollama APIを呼び出し（同期APIを非同期で実行）
            response = await self._call_ollama_api(prompt, task.context.get('params', {}))
            
            # レスポンスを整形
            result = {
                'type': task.type,
                'model': self.model_id,
                'response': response.get('response', ''),
                'done': response.get('done', False),
                'context': response.get('context', []),
                'total_duration': response.get('total_duration', 0),
                'load_duration': response.get('load_duration', 0),
                'prompt_eval_count': response.get('prompt_eval_count', 0),
                'eval_count': response.get('eval_count', 0),
                'timestamp': datetime.now().isoformat()
            }
            
            return result
            
        except Exception as e:
            logger.error(f"Error processing task with LocalLLM: {str(e)}")
            raise

    async def _call_ollama_api(self, prompt: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Call Ollama API asynchronously.
        
        Args:
            prompt: The input prompt for the LLM
            params: Additional parameters for the Ollama API call
            
        Returns:
            A dictionary containing the response from the API
        """
        payload = {
            "model": self.model_id,
            "prompt": prompt,
            "stream": False,  # For now, we'll use non-streaming responses
            "options": {
                "temperature": self.temperature
            }
        }
        
        # パラメータがある場合は追加
        if params:
            payload.update(params)
        
        # 同期的なrequests呼び出しを非同期で実行
        loop = asyncio.get_event_loop()
        
        def make_request():
            try:
                response = requests.post(
                    self.api_url, 
                    json=payload, 
                    timeout=settings.LLM_TIMEOUT
                )
                response.raise_for_status()
                return response.json()
            except requests.exceptions.RequestException as e:
                logger.error(f"Error calling Ollama API: {e}")
                raise
        
        # 同期関数を非同期で実行
        result = await loop.run_in_executor(None, make_request)
        return result

    def get_supported_models(self) -> List[str]:
        """
        Returns a list of models this worker supports.
        For now, it's just the one configured model.
        """
        return [self.model_id]
    
    async def list_models(self) -> List[str]:
        """
        利用可能なモデルのリストを返す
        Ollama APIから動的に取得
        
        Returns:
            List[str]: 利用可能なモデルIDのリスト
        """
        try:
            # Ollama APIのモデルリストを取得
            loop = asyncio.get_event_loop()
            
            def fetch_models():
                try:
                    response = requests.get(
                        f"{settings.OLLAMA_API_URL}/api/tags",
                        timeout=settings.LLM_TIMEOUT
                    )
                    response.raise_for_status()
                    return response.json()
                except requests.exceptions.RequestException as e:
                    logger.error(f"Failed to fetch models from Ollama: {e}")
                    raise
            
            models_info = await loop.run_in_executor(None, fetch_models)
            
            # モデル名のリストを抽出
            available_models = []
            for model in models_info.get('models', []):
                model_name = model.get('name')
                if model_name:
                    # タグを削除してベースモデル名のみを取得
                    base_name = model_name.split(':')[0]
                    if base_name not in available_models:
                        available_models.append(base_name)
            
            return available_models
            
        except Exception as e:
            logger.error(f"Error listing Ollama models: {str(e)}")
            # エラー時は設定されたデフォルトモデルのみを返す
            return [self.model_id]

    async def health_check(self) -> Dict[str, Any]:
        """
        Check if Ollama API is accessible and the model is available.
        
        Returns:
            A dictionary with health status information
        """
        try:
            # Ollama APIのモデルリストを取得
            loop = asyncio.get_event_loop()
            
            def check_models():
                try:
                    response = requests.get(
                        f"{settings.OLLAMA_API_URL}/api/tags",
                        timeout=5
                    )
                    response.raise_for_status()
                    return response.json()
                except requests.exceptions.Timeout:
                    logger.error("Ollama API timeout")
                    return {"models": []}
                except requests.exceptions.RequestException as e:
                    logger.error(f"Failed to fetch models: {e}")
                    return {"models": []}
            
            models_info = await loop.run_in_executor(None, check_models)
            
            # モデルが利用可能かチェック
            available_models = [m['name'] for m in models_info.get('models', [])]
            model_available = self.model_id in available_models
            
            # モデルが利用不可の場合は緊急対応
            if not model_available and available_models:
                await self.emergency_response("model_unavailable", {"available_models": available_models})
            
            return {
                'status': 'healthy' if model_available else 'unhealthy',
                'model': self.model_id,
                'model_available': model_available,
                'available_models': available_models,
                'ollama_url': settings.OLLAMA_API_URL
            }
            
        except Exception as e:
            logger.error(f"Health check failed: {str(e)}")
            return {
                'status': 'unhealthy',
                'error': str(e),
                'model': self.model_id,
                'ollama_url': settings.OLLAMA_API_URL
            }

    async def emergency_response(self, emergency_type: str, data: Dict):
        """
        Worker固有の緊急対応
        
        Args:
            emergency_type: Type of emergency
            data: Emergency data
        """
        logger.warning(f"LocalLLMWorker handling emergency: {emergency_type}")
        
        if emergency_type == "model_unavailable":
            logger.error(f"Model {self.model_id} is unavailable")
            # フォールバックモデルへの切り替え
            available_models = data.get("available_models", [])
            fallback_models = ["llama2", "mistral", "vicuna", "default"]
            
            for model in fallback_models:
                if model in available_models:
                    self.model_id = model
                    logger.info(f"Switched to fallback model: {model}")
                    break
            else:
                logger.error("No fallback models available")
                self.processing = False
                
        elif emergency_type == "api_down":
            logger.error("Ollama API is down")
            # 処理キューを一時停止
            self.processing = False
            # 再接続の試行をスケジュール
            logger.info("Scheduling reconnection attempt in 5 seconds...")
            await asyncio.sleep(5)
            health_status = await self.health_check()
            if health_status.get('status') == 'healthy':
                self.processing = True
                logger.info("Reconnection successful, resuming processing")