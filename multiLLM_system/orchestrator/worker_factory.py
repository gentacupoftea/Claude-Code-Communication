# multiLLM_system/orchestrator/worker_factory.py

import logging
import uuid
from typing import Dict, Any, Optional, List

from ..workers.claude_worker import ClaudeWorker
from ..workers.openai_worker import OpenAIWorker
from ..workers.local_llm_worker import LocalLLMWorker
from ..workers.base_worker import BaseWorker
from ..services.local_llm import LocalLLMFactory, LocalLLMManager

logger = logging.getLogger(__name__)

class WorkerFactory:
    """
    Factory class for creating worker instances based on type
    ローカルLLMプロバイダの管理機能も含む
    """
    
    # ローカルLLMマネージャーのインスタンス
    _local_llm_manager: Optional[LocalLLMManager] = None
    
    @staticmethod
    def create_worker(worker_type: str, model_id: Optional[str] = None, config: Optional[Dict[str, Any]] = None) -> BaseWorker:
        """
        Create a worker instance based on the worker type
        
        Args:
            worker_type: Type of worker to create ('anthropic', 'openai', 'local_llm')
            model_id: Optional model ID to use
            config: Optional configuration dictionary
            
        Returns:
            An instance of the appropriate worker class
            
        Raises:
            ValueError: If worker_type is not supported
        """
        # デフォルト設定を準備
        if config is None:
            config = {}
        
        # モデルIDが指定されている場合は設定に追加
        if model_id:
            config['model'] = model_id
        
        # ワーカータイプに基づいてインスタンスを作成
        if worker_type == "anthropic" or worker_type == "claude":
            logger.info(f"Creating Claude/Anthropic worker with model: {config.get('model', 'default')}")
            return ClaudeWorker(name=f"claude_worker_{uuid.uuid4().hex[:8]}", config=config)
            
        elif worker_type == "openai":
            logger.info(f"Creating OpenAI worker with model: {config.get('model', 'default')}")
            return OpenAIWorker(name=f"openai_worker_{uuid.uuid4().hex[:8]}", config=config)
            
        elif worker_type == "local_llm":
            logger.info(f"Creating LocalLLM worker with model: {config.get('model', 'default')}")
            # ローカルLLMマネージャーを設定に追加
            if WorkerFactory._local_llm_manager:
                config['llm_manager'] = WorkerFactory._local_llm_manager
            return LocalLLMWorker(name=f"local_llm_worker_{uuid.uuid4().hex[:8]}", config=config)
            
        else:
            raise ValueError(f"Unsupported worker type: {worker_type}")
    
    @staticmethod
    def get_supported_worker_types() -> List[str]:
        """
        Get list of supported worker types
        
        Returns:
            List of supported worker type strings
        """
        return ["anthropic", "claude", "openai", "local_llm"]
    
    @staticmethod
    def list_worker_types() -> List[str]:
        """
        現在システムに登録されているすべてのLLMワーカーの種別を一覧で返す
        
        Returns:
            List[str]: 利用可能なワーカータイプのリスト
        """
        return WorkerFactory.get_supported_worker_types()
    
    @staticmethod
    async def get_available_models(worker_type: str) -> List[str]:
        """
        指定されたワーカータイプの利用可能なモデル一覧を取得
        
        Args:
            worker_type: ワーカータイプ ('anthropic', 'openai', 'local_llm' など)
            
        Returns:
            List[str]: 利用可能なモデルIDのリスト
            
        Raises:
            ValueError: サポートされていないワーカータイプの場合
        """
        # 一時的にワーカーインスタンスを作成
        try:
            worker = WorkerFactory.create_worker(worker_type)
            # list_modelsメソッドを呼び出し
            models = await worker.list_models()
            return models
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error getting models for {worker_type}: {str(e)}")
            return []
    
    @staticmethod
    def create_worker_pool(worker_configs: Dict[str, Dict[str, Any]]) -> Dict[str, BaseWorker]:
        """
        Create multiple workers based on configuration
        
        Args:
            worker_configs: Dictionary mapping worker names to their configurations
            
        Returns:
            Dictionary mapping worker names to worker instances
        """
        worker_pool = {}
        
        for worker_name, config in worker_configs.items():
            worker_type = config.get('type', 'anthropic')
            model_id = config.get('model')
            
            try:
                worker = WorkerFactory.create_worker(worker_type, model_id, config)
                worker_pool[worker_name] = worker
                logger.info(f"Created worker: {worker_name} (type: {worker_type})")
            except Exception as e:
                logger.error(f"Failed to create worker {worker_name}: {str(e)}")
                
        return worker_pool
    
    @staticmethod
    async def initialize_local_llm_manager() -> LocalLLMManager:
        """
        ローカルLLMマネージャーを初期化
        
        Returns:
            LocalLLMManager: 初期化されたマネージャー
        """
        if WorkerFactory._local_llm_manager is None:
            WorkerFactory._local_llm_manager = LocalLLMManager()
            logger.info("LocalLLMManager initialized")
        
        return WorkerFactory._local_llm_manager
    
    @staticmethod
    async def add_local_llm_provider(name: str, provider_type: str, **kwargs) -> None:
        """
        ローカルLLMプロバイダを追加
        
        Args:
            name: プロバイダの識別名
            provider_type: プロバイダタイプ ("ollama", "deepseek")
            **kwargs: プロバイダ固有の設定パラメータ
        """
        if WorkerFactory._local_llm_manager is None:
            await WorkerFactory.initialize_local_llm_manager()
        
        config = {"provider": provider_type, **kwargs}
        await WorkerFactory._local_llm_manager.add_provider(name, config)
        logger.info(f"Added local LLM provider: {name} ({provider_type})")
    
    @staticmethod
    def get_local_llm_manager() -> Optional[LocalLLMManager]:
        """
        ローカルLLMマネージャーを取得
        
        Returns:
            LocalLLMManager: マネージャーインスタンス、またはNone
        """
        return WorkerFactory._local_llm_manager
    
    @staticmethod
    async def get_local_llm_providers() -> List[str]:
        """
        登録されているローカルLLMプロバイダの一覧を取得
        
        Returns:
            List[str]: プロバイダ名のリスト
        """
        if WorkerFactory._local_llm_manager is None:
            return []
        
        return WorkerFactory._local_llm_manager.get_available_providers()
    
    @staticmethod
    async def health_check_local_llm_providers() -> Dict[str, bool]:
        """
        ローカルLLMプロバイダのヘルスチェック
        
        Returns:
            Dict[str, bool]: プロバイダ名とヘルスチェック結果のマップ
        """
        if WorkerFactory._local_llm_manager is None:
            return {}
        
        return await WorkerFactory._local_llm_manager.health_check_all()
    
    @staticmethod
    def get_supported_local_llm_providers() -> List[str]:
        """
        サポートされているローカルLLMプロバイダタイプの一覧を取得
        
        Returns:
            List[str]: サポートされているプロバイダタイプのリスト
        """
        return LocalLLMFactory.get_available_providers()
    
    @staticmethod
    async def shutdown_local_llm_manager() -> None:
        """
        ローカルLLMマネージャーをシャットダウン
        """
        if WorkerFactory._local_llm_manager is not None:
            await WorkerFactory._local_llm_manager.shutdown_all()
            WorkerFactory._local_llm_manager = None
            logger.info("LocalLLMManager shutdown completed")