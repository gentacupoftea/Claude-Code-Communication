"""
Local LLM Factory
ローカルLLMプロバイダのファクトリークラス
"""

from typing import Dict, Optional, Type, List
from .base_provider import BaseLocalLLMProvider
from .ollama_provider import OllamaProvider
from .deepseek_provider import DeepseekProvider
import logging

logger = logging.getLogger(__name__)


class LocalLLMFactory:
    """
    ローカルLLMプロバイダのファクトリークラス
    
    利用可能なプロバイダの管理と、適切なプロバイダの作成を行います。
    """
    
    # 利用可能なプロバイダのレジストリ
    _providers: Dict[str, Type[BaseLocalLLMProvider]] = {
        "ollama": OllamaProvider,
        "deepseek": DeepseekProvider,
    }
    
    @classmethod
    def register_provider(cls, name: str, provider_class: Type[BaseLocalLLMProvider]) -> None:
        """
        新しいプロバイダを登録
        
        Args:
            name: プロバイダ名
            provider_class: プロバイダクラス
        """
        if not issubclass(provider_class, BaseLocalLLMProvider):
            raise ValueError(f"Provider class must inherit from BaseLocalLLMProvider")
        
        cls._providers[name] = provider_class
        logger.info(f"Registered new provider: {name}")
    
    @classmethod
    def get_available_providers(cls) -> List[str]:
        """
        利用可能なプロバイダ名のリストを取得
        
        Returns:
            List[str]: プロバイダ名のリスト
        """
        return list(cls._providers.keys())
    
    @classmethod
    def create_provider(
        cls, 
        provider_name: str, 
        **kwargs
    ) -> BaseLocalLLMProvider:
        """
        指定されたプロバイダのインスタンスを作成
        
        Args:
            provider_name: プロバイダ名 ("ollama", "deepseek")
            **kwargs: プロバイダ固有の初期化パラメータ
            
        Returns:
            BaseLocalLLMProvider: プロバイダインスタンス
            
        Raises:
            ValueError: 不明なプロバイダ名の場合
        """
        if provider_name not in cls._providers:
            available = ", ".join(cls._providers.keys())
            raise ValueError(f"Unknown provider: {provider_name}. Available providers: {available}")
        
        provider_class = cls._providers[provider_name]
        
        try:
            # プロバイダ固有の設定を適用
            if provider_name == "ollama":
                default_kwargs = {
                    "api_base": kwargs.get("api_base", "http://localhost:11434"),
                    "timeout": kwargs.get("timeout", 300)
                }
                instance = provider_class(**default_kwargs)
            
            elif provider_name == "deepseek":
                default_kwargs = {
                    "api_base": kwargs.get("api_base", "https://api.deepseek.com/v1"),
                    "api_key": kwargs.get("api_key"),
                    "timeout": kwargs.get("timeout", 300)
                }
                instance = provider_class(**default_kwargs)
            
            else:
                # その他のプロバイダ（将来の拡張用）
                instance = provider_class(**kwargs)
            
            logger.info(f"Created provider instance: {provider_name}")
            return instance
            
        except Exception as e:
            logger.error(f"Failed to create provider {provider_name}: {e}")
            raise
    
    @classmethod
    def create_provider_from_config(cls, config: Dict) -> BaseLocalLLMProvider:
        """
        設定辞書からプロバイダを作成
        
        Args:
            config: プロバイダ設定
                例: {
                    "provider": "ollama",
                    "api_base": "http://localhost:11434",
                    "timeout": 300
                }
                
        Returns:
            BaseLocalLLMProvider: プロバイダインスタンス
            
        Raises:
            ValueError: 設定が不正な場合
        """
        if "provider" not in config:
            raise ValueError("Config must contain 'provider' key")
        
        provider_name = config.pop("provider")
        return cls.create_provider(provider_name, **config)
    
    @classmethod
    async def health_check_all(cls, configs: List[Dict]) -> Dict[str, bool]:
        """
        全プロバイダのヘルスチェックを実行
        
        Args:
            configs: プロバイダ設定のリスト
            
        Returns:
            Dict[str, bool]: プロバイダ名とヘルスチェック結果のマップ
        """
        results = {}
        
        for config in configs:
            provider_name = config.get("provider")
            if not provider_name:
                continue
                
            try:
                provider = cls.create_provider_from_config(config.copy())
                is_healthy = await provider.health_check()
                results[provider_name] = is_healthy
                
                # クリーンアップ
                if hasattr(provider, '__aexit__'):
                    await provider.__aexit__(None, None, None)
                    
            except Exception as e:
                logger.error(f"Health check failed for {provider_name}: {e}")
                results[provider_name] = False
        
        return results


class LocalLLMManager:
    """
    ローカルLLMプロバイダの管理クラス
    
    複数のプロバイダインスタンスを管理し、統一されたインターフェースを提供します。
    """
    
    def __init__(self):
        self._providers: Dict[str, BaseLocalLLMProvider] = {}
        self._active_provider: Optional[str] = None
    
    async def add_provider(self, name: str, config: Dict) -> None:
        """
        プロバイダを追加
        
        Args:
            name: プロバイダの識別名
            config: プロバイダ設定
        """
        try:
            provider = LocalLLMFactory.create_provider_from_config(config)
            
            # ヘルスチェック
            is_healthy = await provider.health_check()
            if not is_healthy:
                logger.warning(f"Provider {name} health check failed, but adding anyway")
            
            self._providers[name] = provider
            
            # 最初のプロバイダをアクティブに設定
            if not self._active_provider:
                self._active_provider = name
                
            logger.info(f"Added provider: {name} (healthy: {is_healthy})")
            
        except Exception as e:
            logger.error(f"Failed to add provider {name}: {e}")
            raise
    
    def set_active_provider(self, name: str) -> None:
        """
        アクティブなプロバイダを設定
        
        Args:
            name: プロバイダ名
            
        Raises:
            ValueError: 存在しないプロバイダ名の場合
        """
        if name not in self._providers:
            available = ", ".join(self._providers.keys())
            raise ValueError(f"Provider {name} not found. Available: {available}")
        
        self._active_provider = name
        logger.info(f"Set active provider: {name}")
    
    def get_active_provider(self) -> Optional[BaseLocalLLMProvider]:
        """
        アクティブなプロバイダを取得
        
        Returns:
            BaseLocalLLMProvider: アクティブなプロバイダ、またはNone
        """
        if self._active_provider and self._active_provider in self._providers:
            return self._providers[self._active_provider]
        return None
    
    def get_provider(self, name: str) -> Optional[BaseLocalLLMProvider]:
        """
        指定されたプロバイダを取得
        
        Args:
            name: プロバイダ名
            
        Returns:
            BaseLocalLLMProvider: プロバイダインスタンス、またはNone
        """
        return self._providers.get(name)
    
    def get_available_providers(self) -> List[str]:
        """
        登録されているプロバイダ名のリストを取得
        
        Returns:
            List[str]: プロバイダ名のリスト
        """
        return list(self._providers.keys())

    async def get_all_models(self) -> Dict[str, List[str]]:
        """
        登録されている全プロバイダから利用可能なモデルを全て取得
        
        Returns:
            Dict[str, List[str]]: プロバイダ名とモデルリストの辞書
        """
        all_models = {}
        for name, provider in self._providers.items():
            try:
                models = await provider.get_available_models()
                all_models[name] = models
            except Exception as e:
                logger.error(f"Failed to get models from {name}: {e}")
                all_models[name] = []
        
        return all_models

    async def health_check_all(self) -> Dict[str, bool]:
        """
        全プロバイダのヘルスチェックを実行
        
        Returns:
            Dict[str, bool]: プロバイダ名とヘルスチェック結果のマップ
        """
        results = {}
        for name, provider in self._providers.items():
            try:
                is_healthy = await provider.health_check()
                results[name] = is_healthy
            except Exception as e:
                logger.error(f"Health check failed for {name}: {e}")
                results[name] = False
        return results

    async def shutdown_all(self) -> None:
        """全プロバイダのクリーンアップ処理を実行"""
        for name, provider in self._providers.items():
            try:
                if hasattr(provider, '__aexit__'):
                    await provider.__aexit__(None, None, None)
                logger.info(f"Provider {name} shut down successfully.")
            except Exception as e:
                logger.error(f"Error shutting down provider {name}: {e}")