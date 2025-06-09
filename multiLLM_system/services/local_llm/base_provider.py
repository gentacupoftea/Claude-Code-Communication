"""
Base Local LLM Provider
ローカルLLMプロバイダの抽象ベースクラス
"""

from abc import ABC, abstractmethod
from typing import AsyncGenerator, List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


class BaseLocalLLMProvider(ABC):
    """
    全てのローカルLLMプロバイダが継承する抽象ベースクラス
    
    このクラスは、Ollama、Deepseek、その他のローカルLLMプロバイダの
    共通インターフェースを定義します。
    """
    
    def __init__(self, api_base: str, timeout: int = 300):
        """
        プロバイダの初期化
        
        Args:
            api_base: APIのベースURL
            timeout: リクエストタイムアウト（秒）
        """
        self.api_base = api_base.rstrip('/')
        self.timeout = timeout
        
    @abstractmethod
    async def generate_stream(
        self, 
        messages: List[Dict[str, str]], 
        model: str,
        **kwargs: Any
    ) -> AsyncGenerator[str, None]:
        """
        ストリーミング生成メソッド
        
        Args:
            messages: チャットメッセージのリスト
            model: 使用するモデル名
            **kwargs: プロバイダ固有のオプションパラメータ
            
        Yields:
            str: LLMからの生成トークン
            
        Raises:
            Exception: API通信エラーやレスポンス解析エラー
        """
        pass
    
    @abstractmethod
    async def generate(
        self, 
        messages: List[Dict[str, str]], 
        model: str,
        **kwargs: Any
    ) -> str:
        """
        非ストリーミング生成メソッド
        
        Args:
            messages: チャットメッセージのリスト
            model: 使用するモデル名
            **kwargs: プロバイダ固有のオプションパラメータ
            
        Returns:
            str: LLMからの完全な応答テキスト
            
        Raises:
            Exception: API通信エラーやレスポンス解析エラー
        """
        pass
    
    @abstractmethod
    async def get_available_models(self) -> List[str]:
        """
        利用可能なモデル一覧を取得
        
        Returns:
            List[str]: 利用可能なモデル名のリスト
            
        Raises:
            Exception: API通信エラー
        """
        pass
    
    @abstractmethod
    async def health_check(self) -> bool:
        """
        プロバイダのヘルスチェック
        
        Returns:
            bool: プロバイダが正常に動作している場合True
        """
        pass
    
    def _validate_messages(self, messages: List[Dict[str, str]]) -> None:
        """
        メッセージフォーマットの検証
        
        Args:
            messages: 検証するメッセージリスト
            
        Raises:
            ValueError: メッセージフォーマットが不正な場合
        """
        if not messages:
            raise ValueError("Messages list cannot be empty")
        
        for i, message in enumerate(messages):
            if not isinstance(message, dict):
                raise ValueError(f"Message {i} must be a dictionary")
            
            if 'role' not in message or 'content' not in message:
                raise ValueError(f"Message {i} must have 'role' and 'content' fields")
            
            if message['role'] not in ['user', 'assistant', 'system']:
                raise ValueError(f"Message {i} has invalid role: {message['role']}")
            
            if not isinstance(message['content'], str):
                raise ValueError(f"Message {i} content must be a string")
    
    def _validate_model(self, model: str) -> None:
        """
        モデル名の検証
        
        Args:
            model: 検証するモデル名
            
        Raises:
            ValueError: モデル名が不正な場合
        """
        if not model or not isinstance(model, str):
            raise ValueError("Model must be a non-empty string")
    
    async def _log_request(
        self, 
        messages: List[Dict[str, str]], 
        model: str, 
        **kwargs: Any
    ) -> None:
        """
        リクエストのログ出力
        
        Args:
            messages: チャットメッセージ
            model: モデル名
            **kwargs: 追加パラメータ
        """
        logger.info(
            f"Requesting {self.__class__.__name__} - Model: {model}, "
            f"Messages: {len(messages)}, Params: {kwargs}"
        )
    
    async def _log_error(self, error: Exception, context: str = "") -> None:
        """
        エラーのログ出力
        
        Args:
            error: 発生したエラー
            context: エラーのコンテキスト情報
        """
        logger.error(
            f"{self.__class__.__name__} error {context}: {type(error).__name__}: {error}"
        )