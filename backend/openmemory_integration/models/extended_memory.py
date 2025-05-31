"""
拡張メモリモデル - セマンティック検索とベクトル埋め込み対応
"""

from datetime import datetime
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
from enum import Enum
import uuid


class MemoryType(str, Enum):
    """メモリタイプ分類"""
    CONVERSATION = "conversation"      # 会話履歴
    CODE_KNOWLEDGE = "code_knowledge"  # コード知識
    PROJECT_INFO = "project_info"      # プロジェクト情報
    TASK_CONTEXT = "task_context"      # タスクコンテキスト
    DECISION_LOG = "decision_log"      # 意思決定ログ
    ERROR_SOLUTION = "error_solution"  # エラー解決方法
    LEARNING_INSIGHT = "learning_insight"  # 学習洞察


class ImportanceLevel(str, Enum):
    """重要度レベル"""
    CRITICAL = "critical"    # 重要：必須情報
    HIGH = "high"           # 高：重要情報
    MEDIUM = "medium"       # 中：一般情報
    LOW = "low"            # 低：参考情報


class MemoryMetadata(BaseModel):
    """メモリメタデータ"""
    source_type: str = Field(..., description="情報源タイプ（slack, api, file等）")
    agent_name: Optional[str] = Field(None, description="作成エージェント名")
    project_id: Optional[str] = Field(None, description="関連プロジェクトID")
    task_id: Optional[str] = Field(None, description="関連タスクID")
    confidence_score: float = Field(0.0, ge=0.0, le=1.0, description="信頼度スコア")
    access_count: int = Field(0, description="アクセス回数")
    last_accessed: Optional[datetime] = Field(None, description="最終アクセス日時")
    tags: List[str] = Field(default_factory=list, description="分類タグ")
    keywords: List[str] = Field(default_factory=list, description="キーワード")
    language: str = Field("ja", description="言語コード")


class MemoryRelation(BaseModel):
    """メモリ間の関係性"""
    related_memory_id: str = Field(..., description="関連メモリID")
    relation_type: str = Field(..., description="関係タイプ（similar, references, follows等）")
    strength: float = Field(..., ge=0.0, le=1.0, description="関係の強さ")
    created_at: datetime = Field(default_factory=datetime.now)


class ExtendedMemory(BaseModel):
    """拡張メモリモデル - OpenMemoryの機能拡張版"""
    
    # 基本情報
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = Field(..., description="ユーザーID")
    content: str = Field(..., description="メモリ内容")
    
    # 分類・属性
    memory_type: MemoryType = Field(MemoryType.CONVERSATION, description="メモリタイプ")
    importance: ImportanceLevel = Field(ImportanceLevel.MEDIUM, description="重要度")
    
    # ベクトル埋め込み関連
    embedding_vector: Optional[List[float]] = Field(None, description="ベクトル埋め込み")
    embedding_model: Optional[str] = Field(None, description="使用した埋め込みモデル")
    
    # メタデータ
    metadata: MemoryMetadata = Field(default_factory=MemoryMetadata)
    
    # 関係性
    relations: List[MemoryRelation] = Field(default_factory=list, description="他メモリとの関係")
    
    # 時間情報
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    expires_at: Optional[datetime] = Field(None, description="有効期限")
    
    # 検索・分析用
    summary: Optional[str] = Field(None, description="自動生成サマリー")
    extracted_entities: List[str] = Field(default_factory=list, description="抽出されたエンティティ")
    sentiment_score: Optional[float] = Field(None, description="感情スコア")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
    
    def add_relation(self, memory_id: str, relation_type: str, strength: float):
        """関係性を追加"""
        relation = MemoryRelation(
            related_memory_id=memory_id,
            relation_type=relation_type,
            strength=strength
        )
        self.relations.append(relation)
        self.updated_at = datetime.now()
    
    def update_access_stats(self):
        """アクセス統計を更新"""
        self.metadata.access_count += 1
        self.metadata.last_accessed = datetime.now()
        self.updated_at = datetime.now()
    
    def get_related_memories(self, relation_type: Optional[str] = None) -> List[str]:
        """関連メモリIDのリストを取得"""
        if relation_type:
            return [r.related_memory_id for r in self.relations if r.relation_type == relation_type]
        return [r.related_memory_id for r in self.relations]
    
    def calculate_relevance_score(self, query_embedding: List[float], alpha: float = 0.7) -> float:
        """クエリとの関連性スコアを計算（ベクトル類似度 + メタデータ重み）"""
        if not self.embedding_vector or not query_embedding:
            return 0.0
        
        # コサイン類似度計算
        from math import sqrt
        dot_product = sum(a * b for a, b in zip(self.embedding_vector, query_embedding))
        magnitude_a = sqrt(sum(a * a for a in self.embedding_vector))
        magnitude_b = sqrt(sum(b * b for b in query_embedding))
        
        if magnitude_a == 0 or magnitude_b == 0:
            return 0.0
        
        cosine_similarity = dot_product / (magnitude_a * magnitude_b)
        
        # メタデータによる重み調整
        importance_weight = {
            ImportanceLevel.CRITICAL: 1.0,
            ImportanceLevel.HIGH: 0.8,
            ImportanceLevel.MEDIUM: 0.6,
            ImportanceLevel.LOW: 0.4
        }.get(self.importance, 0.5)
        
        # 最終スコア計算
        relevance_score = alpha * cosine_similarity + (1 - alpha) * importance_weight
        return max(0.0, min(1.0, relevance_score))