"""
Deepseek Local LLM Provider
DeepseekのAPIとの連携を行うプロバイダ
"""

import json
import httpx
from typing import AsyncGenerator, List, Dict, Any
from .base_provider import BaseLocalLLMProvider


class DeepseekProvider(BaseLocalLLMProvider):
    """
    DeepseekのAPIとの通信を行うプロバイダクラス
    
    DeepseekはOpenAI互換のAPIを提供するため、
    OpenAIと同様のインターフェースでアクセス可能です。
    """
    
    def __init__(
        self, 
        api_base: str = "https://api.deepseek.com/v1", 
        api_key: str = None,
        timeout: int = 300
    ):
        """
        Deepseekプロバイダの初期化
        
        Args:
            api_base: DeepseekのAPIベースURL
            api_key: Deepseek APIキー
            timeout: リクエストタイムアウト（秒）
        """
        super().__init__(api_base, timeout)
        self.api_key = api_key
        self.client = httpx.AsyncClient(timeout=timeout)
    
    def _get_headers(self) -> Dict[str, str]:
        """
        APIリクエスト用のヘッダーを取得
        
        Returns:
            Dict[str, str]: HTTPヘッダー
        """
        headers = {
            "Content-Type": "application/json"
        }
        
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        
        return headers
    
    async def generate_stream(
        self, 
        messages: List[Dict[str, str]], 
        model: str,
        **kwargs: Any
    ) -> AsyncGenerator[str, None]:
        """
        Deepseekを使用したストリーミング生成
        
        Args:
            messages: チャットメッセージのリスト
            model: 使用するモデル名
            **kwargs: Deepseek固有のオプションパラメータ
            
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
            # Deepseek APIに送信するペイロードを構築（OpenAI互換）
            payload = {
                "model": model,
                "messages": messages,
                "stream": True
            }
            
            # 追加のDeepseekオプションを処理
            if "temperature" in kwargs:
                payload["temperature"] = kwargs["temperature"]
            if "max_tokens" in kwargs:
                payload["max_tokens"] = kwargs["max_tokens"]
            if "top_p" in kwargs:
                payload["top_p"] = kwargs["top_p"]
            if "frequency_penalty" in kwargs:
                payload["frequency_penalty"] = kwargs["frequency_penalty"]
            if "presence_penalty" in kwargs:
                payload["presence_penalty"] = kwargs["presence_penalty"]
            
            url = f"{self.api_base}/chat/completions"
            headers = self._get_headers()
            
            async with self.client.stream("POST", url, json=payload, headers=headers) as response:
                response.raise_for_status()
                
                async for line in response.aiter_lines():
                    if line.strip():
                        # Server-Sent Eventsフォーマットを処理
                        if line.startswith("data: "):
                            data_str = line[6:]  # "data: " を除去
                            
                            # ストリーム終了の確認
                            if data_str.strip() == "[DONE]":
                                break
                            
                            try:
                                data = json.loads(data_str)
                                
                                # エラーチェック
                                if "error" in data:
                                    error_msg = data["error"].get("message", "Unknown error")
                                    await self._log_error(Exception(error_msg), "stream_generation")
                                    raise Exception(f"Deepseek API error: {error_msg}")
                                
                                # メッセージの内容を取得
                                choices = data.get("choices", [])
                                if choices:
                                    delta = choices[0].get("delta", {})
                                    content = delta.get("content", "")
                                    if content:
                                        yield content
                                        
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
        Deepseekを使用した非ストリーミング生成
        
        Args:
            messages: チャットメッセージのリスト
            model: 使用するモデル名
            **kwargs: Deepseek固有のオプションパラメータ
            
        Returns:
            str: LLMからの完全な応答テキスト
            
        Raises:
            Exception: API通信エラーやレスポンス解析エラー
        """
        # 入力検証
        self._validate_messages(messages)
        self._validate_model(model)
        
        # リクエストログ
        await self._log_request(messages, model, **kwargs)
        
        try:
            # Deepseek APIに送信するペイロードを構築（OpenAI互換）
            payload = {
                "model": model,
                "messages": messages,
                "stream": False
            }
            
            # 追加のDeepseekオプションを処理
            if "temperature" in kwargs:
                payload["temperature"] = kwargs["temperature"]
            if "max_tokens" in kwargs:
                payload["max_tokens"] = kwargs["max_tokens"]
            if "top_p" in kwargs:
                payload["top_p"] = kwargs["top_p"]
            if "frequency_penalty" in kwargs:
                payload["frequency_penalty"] = kwargs["frequency_penalty"]
            if "presence_penalty" in kwargs:
                payload["presence_penalty"] = kwargs["presence_penalty"]
            
            url = f"{self.api_base}/chat/completions"
            headers = self._get_headers()
            
            response = await self.client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            
            data = response.json()
            
            # エラーチェック
            if "error" in data:
                error_msg = data["error"].get("message", "Unknown error")
                await self._log_error(Exception(error_msg), "generation")
                raise Exception(f"Deepseek API error: {error_msg}")
            
            # レスポンスから内容を抽出
            choices = data.get("choices", [])
            if not choices:
                raise Exception("No choices returned from Deepseek API")
            
            message = choices[0].get("message", {})
            content = message.get("content", "")
            
            if not content:
                raise Exception("Empty response from Deepseek API")
            
            return content
            
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
    
    async def get_available_models(self) -> List[str]:
        """
        Deepseekで利用可能なモデル一覧を取得
        
        Returns:
            List[str]: 利用可能なモデル名のリスト
            
        Raises:
            Exception: API通信エラー
        """
        try:
            url = f"{self.api_base}/models"
            headers = self._get_headers()
            
            response = await self.client.get(url, headers=headers)
            response.raise_for_status()
            
            data = response.json()
            
            # エラーチェック
            if "error" in data:
                error_msg = data["error"].get("message", "Unknown error")
                await self._log_error(Exception(error_msg), "get_models")
                raise Exception(f"Deepseek API error: {error_msg}")
            
            # モデル一覧を抽出
            models = []
            model_data = data.get("data", [])
            for model in model_data:
                if "id" in model:
                    models.append(model["id"])
            
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
        DeepseekのAPIヘルスチェック
        
        Returns:
            bool: サーバーが正常に動作している場合True
        """
        try:
            url = f"{self.api_base}/models"
            headers = self._get_headers()
            
            response = await self.client.get(url, headers=headers, timeout=5.0)
            response.raise_for_status()
            
            # レスポンスがJSONかどうかチェック
            try:
                data = response.json()
                # data フィールドがあれば正常
                return "data" in data or response.status_code == 200
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