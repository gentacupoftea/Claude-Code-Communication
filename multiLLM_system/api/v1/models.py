# multiLLM_system/api/v1/models.py
import logging
from typing import List
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from multiLLM_system.services.local_llm.llm_factory import LocalLLMManager

logger = logging.getLogger(__name__)
router = APIRouter()

# --- Pydantic Models ---
class ModelsResponse(BaseModel):
    models: List[str]

# --- Dependency ---
async def get_llm_manager() -> LocalLLMManager:
    """
    LocalLLMManagerのインスタンスを生成し、デフォルトプロバイダを設定する依存関係。
    """
    llm_manager = LocalLLMManager()
    # デフォルトでOllamaプロバイダを追加しておく
    # TODO: 本来は設定ファイルから読み込むべき
    try:
        await llm_manager.add_provider("ollama", {"provider": "ollama"})
    except Exception as e:
        logger.error(f"Failed to add default ollama provider: {e}")
    return llm_manager

# --- API Endpoints ---
@router.get("/models", response_model=ModelsResponse)
async def get_available_models(llm_manager: LocalLLMManager = Depends(get_llm_manager)):
    """
    利用可能なすべてのLLMモデルのリストを取得します。
    
    現在接続されているすべてのプロバイダ（Ollamaなど）からモデルを収集します。
    """
    try:
        models_dict = await llm_manager.get_all_models()
        # フロントエンドはフラットなリストを期待しているので、辞書の値からモデル名をすべて集める
        flat_model_list = [model for models in models_dict.values() for model in models]
        # 重複を除外
        unique_models = sorted(list(set(flat_model_list)))
        
        return ModelsResponse(models=unique_models)
    except Exception as e:
        logger.error(f"Error getting available models: {e}", exc_info=True)
        # エラーが発生した場合は空のリストを返す
        return ModelsResponse(models=[])
    finally:
        # クリーンアップ
        await llm_manager.shutdown_all()