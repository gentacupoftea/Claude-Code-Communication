"""
Ollama Local LLM Provider
Ollamaサーバーとの連携を行うプロバイダ
"""

import json
import httpx
from typing import AsyncGenerator, List, Dict, Any
from .base_provider import BaseLocalLLMProvider


class OllamaProvider(BaseLocalLLMProvider):
    """
    Ollamaサーバーとの通信を行うプロバイダクラス
    
    Ollamaは、ローカルでLLMを実行するためのツールです。
    このプロバイダは、OllamaのREST APIを使用してLLMとの通信を行います。
    """
    
    def __init__(self, api_base: str = "http://localhost:11434", timeout: int = 300):
        """
        Ollamaプロバイダの初期化
        
        Args:
            api_base: OllamaサーバーのベースURL
            timeout: リクエストタイムアウト（秒）
        """
        super().__init__(api_base, timeout)
        self.client = httpx.AsyncClient(timeout=timeout)
    
    async def generate_stream(
        self, 
        messages: List[Dict[str, str]], 
        model: str,
        **kwargs: Any
    ) -> AsyncGenerator[str, None]:
        """
        Ollamaを使用したストリーミング生成
        
        Args:
            messages: チャットメッセージのリスト
            model: 使用するモデル名
            **kwargs: Ollama固有のオプションパラメータ
            
        Yields:
            str: LLMからの生成トークン
            
        Raises:
            Exception: API通信エラーやレスポンス解析エラー
        """
        # 入力検証
        self._validate_messages(messages)
        self._validate_model(model)
        
        # リクエストログ
        await self._log_request(messages, model, **kwargs)
        
        try:
            # Ollama APIに送信するペイロードを構築
            payload = {
                "model": model,
                "messages": messages,
                "stream": True,
                "options": kwargs.get("options", {})
            }
            
            # 追加のOllamaオプションを処理
            if "temperature" in kwargs:
                payload["options"]["temperature"] = kwargs["temperature"]
            if "max_tokens" in kwargs:
                payload["options"]["num_predict"] = kwargs["max_tokens"]
            if "top_p" in kwargs:
                payload["options"]["top_p"] = kwargs["top_p"]
            if "top_k" in kwargs:
                payload["options"]["top_k"] = kwargs["top_k"]
            
            url = f"{self.api_base}/api/chat"
            
            async with self.client.stream("POST", url, json=payload) as response:
                response.raise_for_status()
                
                async for line in response.aiter_lines():
                    if line.strip():
                        try:
                            data = json.loads(line)
                            
                            # エラーチェック
                            if "error" in data:
                                error_msg = data["error"]
                                await self._log_error(Exception(error_msg), "stream_generation")
                                raise Exception(f"Ollama API error: {error_msg}")
                            
                            # メッセージの内容を取得
                            if "message" in data and "content" in data["message"]:
                                content = data["message"]["content"]
                                if content:
                                    yield content
                            
                            # ストリーム終了の確認
                            if data.get("done", False):
                                break
                                
                        except json.JSONDecodeError as e:
                            await self._log_error(e, "json_decode")
                            # JSONデコードエラーは無視して続行
                            continue
                            
        except httpx.HTTPStatusError as e:
            error_msg = f"HTTP error {e.response.status_code}: {e.response.text}"
            await self._log_error(e, "http_request")
            raise Exception(error_msg)
        except httpx.RequestError as e:
            error_msg = f"Request error: {str(e)}"
            await self._log_error(e, "request")
            raise Exception(error_msg)
        except Exception as e:
            await self._log_error(e, "unexpected")
            raise
    
    async def generate(
        self, 
        messages: List[Dict[str, str]], 
        model: str,
        **kwargs: Any
    ) -> str:
        """
        Ollamaを使用した非ストリーミング生成
        
        Args:
            messages: チャットメッセージのリスト
            model: 使用するモデル名
            **kwargs: Ollama固有のオプションパラメータ
            
        Returns:
            str: LLMからの完全な応答テキスト
            
        Raises:
            Exception: API通信エラーやレスポンス解析エラー
        """
        # ストリーミング生成の結果を結合
        response_parts = []
        async for chunk in self.generate_stream(messages, model, **kwargs):
            response_parts.append(chunk)
        
        return "".join(response_parts)
    
    async def get_available_models(self) -> List[str]:
        """
        Ollamaで利用可能なモデル一覧を取得
        
        Returns:
            List[str]: 利用可能なモデル名のリスト
            
        Raises:
            Exception: API通信エラー
        """
        try:
            url = f"{self.api_base}/api/tags"
            response = await self.client.get(url)
            response.raise_for_status()
            
            data = response.json()
            
            # エラーチェック
            if "error" in data:
                error_msg = data["error"]
                await self._log_error(Exception(error_msg), "get_models")
                raise Exception(f"Ollama API error: {error_msg}")
            
            # モデル一覧を抽出
            models = []
            if "models" in data:
                for model in data["models"]:
                    if "name" in model:
                        models.append(model["name"])
            
            return models
            
        except httpx.HTTPStatusError as e:
            error_msg = f"HTTP error {e.response.status_code}: {e.response.text}"
            await self._log_error(e, "get_models_http")
            raise Exception(error_msg)
        except httpx.RequestError as e:
            error_msg = f"Request error: {str(e)}"
            await self._log_error(e, "get_models_request")
            raise Exception(error_msg)
        except Exception as e:
            await self._log_error(e, "get_models_unexpected")
            raise
    
    async def health_check(self) -> bool:
        """
        Ollamaサーバーのヘルスチェック
        
        Returns:
            bool: サーバーが正常に動作している場合True
        """
        try:
            url = f"{self.api_base}/api/version"
            response = await self.client.get(url, timeout=5.0)
            response.raise_for_status()
            
            # レスポンスがJSONかどうかチェック
            try:
                data = response.json()
                # バージョン情報があれば正常
                return "version" in data or response.status_code == 200
            except json.JSONDecodeError:
                # JSONでなくても200なら正常とみなす
                return response.status_code == 200
                
        except Exception as e:
            await self._log_error(e, "health_check")
            return False
    
    async def __aenter__(self):
        """非同期コンテキストマネージャー: エントリ"""
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """非同期コンテキストマネージャー: 終了時にクライアントをクローズ"""
        await self.client.aclose()