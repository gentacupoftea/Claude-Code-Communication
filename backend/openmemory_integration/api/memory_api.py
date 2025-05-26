"""
OpenMemory統合強化 REST API
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field

from ..models.extended_memory import ExtendedMemory, MemoryType, ImportanceLevel, MemoryMetadata
from ..repositories.memory_repository import MemoryRepository, create_memory_repository
from ..services.embedding_service import EmbeddingManager
from ..services.memory_service import MemoryService


class MemoryCreateRequest(BaseModel):
    """メモリ作成リクエスト"""
    user_id: str = Field(..., description="ユーザーID")
    content: str = Field(..., description="メモリ内容")
    memory_type: MemoryType = Field(MemoryType.CONVERSATION, description="メモリタイプ")
    importance: ImportanceLevel = Field(ImportanceLevel.MEDIUM, description="重要度")
    source_type: str = Field(..., description="情報源タイプ")
    agent_name: Optional[str] = Field(None, description="作成エージェント名")
    project_id: Optional[str] = Field(None, description="関連プロジェクトID")
    task_id: Optional[str] = Field(None, description="関連タスクID")
    tags: List[str] = Field(default_factory=list, description="タグ")
    metadata: Optional[Dict[str, Any]] = Field(None, description="追加メタデータ")


class MemoryUpdateRequest(BaseModel):
    """メモリ更新リクエスト"""
    content: Optional[str] = Field(None, description="メモリ内容")
    memory_type: Optional[MemoryType] = Field(None, description="メモリタイプ")
    importance: Optional[ImportanceLevel] = Field(None, description="重要度")
    tags: Optional[List[str]] = Field(None, description="タグ")


class MemorySearchRequest(BaseModel):
    """メモリ検索リクエスト"""
    user_id: str = Field(..., description="ユーザーID")
    query: str = Field(..., description="検索クエリ")
    memory_types: Optional[List[MemoryType]] = Field(None, description="検索対象メモリタイプ")
    importance_levels: Optional[List[ImportanceLevel]] = Field(None, description="重要度フィルタ")
    limit: int = Field(10, ge=1, le=100, description="取得件数")
    threshold: float = Field(0.7, ge=0.0, le=1.0, description="類似度閾値")
    tags: Optional[List[str]] = Field(None, description="タグフィルタ")


class MemoryResponse(BaseModel):
    """メモリ応答"""
    id: str
    user_id: str
    content: str
    memory_type: MemoryType
    importance: ImportanceLevel
    metadata: MemoryMetadata
    created_at: datetime
    updated_at: datetime
    relevance_score: Optional[float] = None


class MemoryListResponse(BaseModel):
    """メモリ一覧応答"""
    memories: List[MemoryResponse]
    total: int
    page: int
    per_page: int


# 依存性注入
def get_memory_repository() -> MemoryRepository:
    """メモリリポジトリを取得"""
    return create_memory_repository("file")


def get_embedding_manager() -> EmbeddingManager:
    """埋め込み管理クラスを取得"""
    return EmbeddingManager("hybrid")


def get_memory_service(
    repository: MemoryRepository = Depends(get_memory_repository),
    embedding_manager: EmbeddingManager = Depends(get_embedding_manager)
) -> MemoryService:
    """メモリサービスを取得"""
    return MemoryService(repository, embedding_manager)


# ルーター作成
router = APIRouter(prefix="/api/v1/memories", tags=["memories"])


@router.post("/", response_model=MemoryResponse)
async def create_memory(
    request: MemoryCreateRequest,
    memory_service: MemoryService = Depends(get_memory_service)
):
    """メモリを作成"""
    try:
        # メタデータ作成
        metadata = MemoryMetadata(
            source_type=request.source_type,
            agent_name=request.agent_name,
            project_id=request.project_id,
            task_id=request.task_id,
            tags=request.tags
        )
        
        # メモリ作成
        memory = ExtendedMemory(
            user_id=request.user_id,
            content=request.content,
            memory_type=request.memory_type,
            importance=request.importance,
            metadata=metadata
        )
        
        # 埋め込み生成と保存
        success = await memory_service.save_memory_with_embedding(memory)
        if not success:
            raise HTTPException(status_code=500, detail="メモリの保存に失敗しました")
        
        return MemoryResponse(**memory.dict())
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"メモリ作成エラー: {str(e)}")


@router.get("/{memory_id}", response_model=MemoryResponse)
async def get_memory(
    memory_id: str,
    memory_service: MemoryService = Depends(get_memory_service)
):
    """メモリを取得"""
    memory = await memory_service.get_memory(memory_id)
    if not memory:
        raise HTTPException(status_code=404, detail="メモリが見つかりません")
    
    # アクセス統計を更新
    memory.update_access_stats()
    await memory_service.repository.update(memory)
    
    return MemoryResponse(**memory.dict())


@router.put("/{memory_id}", response_model=MemoryResponse)
async def update_memory(
    memory_id: str,
    request: MemoryUpdateRequest,
    memory_service: MemoryService = Depends(get_memory_service)
):
    """メモリを更新"""
    memory = await memory_service.get_memory(memory_id)
    if not memory:
        raise HTTPException(status_code=404, detail="メモリが見つかりません")
    
    # 更新フィールドを適用
    if request.content is not None:
        memory.content = request.content
        # 内容が変更された場合、埋め込みを再生成
        memory.embedding_vector = None
    
    if request.memory_type is not None:
        memory.memory_type = request.memory_type
    
    if request.importance is not None:
        memory.importance = request.importance
    
    if request.tags is not None:
        memory.metadata.tags = request.tags
    
    # 埋め込み付きで保存
    success = await memory_service.save_memory_with_embedding(memory)
    if not success:
        raise HTTPException(status_code=500, detail="メモリの更新に失敗しました")
    
    return MemoryResponse(**memory.dict())


@router.delete("/{memory_id}")
async def delete_memory(
    memory_id: str,
    memory_service: MemoryService = Depends(get_memory_service)
):
    """メモリを削除"""
    success = await memory_service.delete_memory(memory_id)
    if not success:
        raise HTTPException(status_code=404, detail="メモリが見つかりません")
    
    return {"message": "メモリを削除しました"}


@router.get("/", response_model=MemoryListResponse)
async def list_memories(
    user_id: str = Query(..., description="ユーザーID"),
    page: int = Query(1, ge=1, description="ページ番号"),
    per_page: int = Query(20, ge=1, le=100, description="1ページあたりの件数"),
    memory_type: Optional[MemoryType] = Query(None, description="メモリタイプフィルタ"),
    importance: Optional[ImportanceLevel] = Query(None, description="重要度フィルタ"),
    memory_service: MemoryService = Depends(get_memory_service)
):
    """メモリ一覧を取得"""
    try:
        # 全メモリを取得
        memories = await memory_service.get_user_memories(user_id)
        
        # フィルタリング
        if memory_type:
            memories = [m for m in memories if m.memory_type == memory_type]
        
        if importance:
            memories = [m for m in memories if m.importance == importance]
        
        total = len(memories)
        
        # ページング
        start_index = (page - 1) * per_page
        end_index = start_index + per_page
        paginated_memories = memories[start_index:end_index]
        
        # レスポンス作成
        memory_responses = [MemoryResponse(**memory.dict()) for memory in paginated_memories]
        
        return MemoryListResponse(
            memories=memory_responses,
            total=total,
            page=page,
            per_page=per_page
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"メモリ一覧取得エラー: {str(e)}")


@router.post("/search", response_model=MemoryListResponse)
async def search_memories(
    request: MemorySearchRequest,
    memory_service: MemoryService = Depends(get_memory_service)
):
    """セマンティック検索でメモリを検索"""
    try:
        memories = await memory_service.semantic_search(
            query=request.query,
            user_id=request.user_id,
            limit=request.limit,
            threshold=request.threshold
        )
        
        # フィルタリング
        if request.memory_types:
            memories = [m for m in memories if m.memory_type in request.memory_types]
        
        if request.importance_levels:
            memories = [m for m in memories if m.importance in request.importance_levels]
        
        if request.tags:
            memories = [
                m for m in memories 
                if any(tag in m.metadata.tags for tag in request.tags)
            ]
        
        # レスポンス作成
        memory_responses = []
        for memory in memories:
            response = MemoryResponse(**memory.dict())
            # 関連性スコアを計算（簡易版）
            response.relevance_score = 0.8  # 実際は計算が必要
            memory_responses.append(response)
        
        return MemoryListResponse(
            memories=memory_responses,
            total=len(memory_responses),
            page=1,
            per_page=len(memory_responses)
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"検索エラー: {str(e)}")


@router.post("/{memory_id}/relations")
async def add_memory_relation(
    memory_id: str,
    related_memory_id: str = Query(..., description="関連メモリID"),
    relation_type: str = Query(..., description="関係タイプ"),
    strength: float = Query(..., ge=0.0, le=1.0, description="関係の強さ"),
    memory_service: MemoryService = Depends(get_memory_service)
):
    """メモリ間の関係性を追加"""
    memory = await memory_service.get_memory(memory_id)
    if not memory:
        raise HTTPException(status_code=404, detail="メモリが見つかりません")
    
    related_memory = await memory_service.get_memory(related_memory_id)
    if not related_memory:
        raise HTTPException(status_code=404, detail="関連メモリが見つかりません")
    
    # 関係性を追加
    memory.add_relation(related_memory_id, relation_type, strength)
    
    success = await memory_service.repository.update(memory)
    if not success:
        raise HTTPException(status_code=500, detail="関係性の追加に失敗しました")
    
    return {"message": "関係性を追加しました"}


@router.get("/stats/{user_id}")
async def get_memory_stats(
    user_id: str,
    memory_service: MemoryService = Depends(get_memory_service)
):
    """ユーザーのメモリ統計を取得"""
    try:
        memories = await memory_service.get_user_memories(user_id)
        
        # 統計計算
        total_memories = len(memories)
        type_counts = {}
        importance_counts = {}
        
        for memory in memories:
            # タイプ別カウント
            type_counts[memory.memory_type] = type_counts.get(memory.memory_type, 0) + 1
            # 重要度別カウント
            importance_counts[memory.importance] = importance_counts.get(memory.importance, 0) + 1
        
        recent_memories = len([m for m in memories if (datetime.now() - m.created_at).days <= 7])
        
        return {
            "user_id": user_id,
            "total_memories": total_memories,
            "recent_memories": recent_memories,
            "memory_types": type_counts,
            "importance_levels": importance_counts,
            "last_updated": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"統計取得エラー: {str(e)}")