"""
メモリリポジトリ - データアクセス層の実装
"""

from typing import List, Optional, Dict, Any
from abc import ABC, abstractmethod
import json
import os
from datetime import datetime
import redis
import numpy as np
from ..models.extended_memory import ExtendedMemory, MemoryType, ImportanceLevel


class MemoryRepository(ABC):
    """メモリリポジトリの抽象基底クラス"""
    
    @abstractmethod
    async def save(self, memory: ExtendedMemory) -> bool:
        """メモリを保存"""
        pass
    
    @abstractmethod
    async def find_by_id(self, memory_id: str) -> Optional[ExtendedMemory]:
        """IDでメモリを検索"""
        pass
    
    @abstractmethod
    async def find_by_user_id(self, user_id: str, limit: int = 100) -> List[ExtendedMemory]:
        """ユーザーIDでメモリを検索"""
        pass
    
    @abstractmethod
    async def semantic_search(self, query_embedding: List[float], user_id: str, 
                            limit: int = 10, threshold: float = 0.7) -> List[ExtendedMemory]:
        """セマンティック検索"""
        pass
    
    @abstractmethod
    async def delete(self, memory_id: str) -> bool:
        """メモリを削除"""
        pass
    
    @abstractmethod
    async def update(self, memory: ExtendedMemory) -> bool:
        """メモリを更新"""
        pass


class InMemoryRepository(MemoryRepository):
    """インメモリ実装（開発・テスト用）"""
    
    def __init__(self):
        self._memories: Dict[str, ExtendedMemory] = {}
    
    async def save(self, memory: ExtendedMemory) -> bool:
        """メモリを保存"""
        try:
            self._memories[memory.id] = memory
            return True
        except Exception:
            return False
    
    async def find_by_id(self, memory_id: str) -> Optional[ExtendedMemory]:
        """IDでメモリを検索"""
        return self._memories.get(memory_id)
    
    async def find_by_user_id(self, user_id: str, limit: int = 100) -> List[ExtendedMemory]:
        """ユーザーIDでメモリを検索"""
        user_memories = [
            memory for memory in self._memories.values() 
            if memory.user_id == user_id
        ]
        # 作成日時でソート（新しい順）
        user_memories.sort(key=lambda x: x.created_at, reverse=True)
        return user_memories[:limit]
    
    async def semantic_search(self, query_embedding: List[float], user_id: str, 
                            limit: int = 10, threshold: float = 0.7) -> List[ExtendedMemory]:
        """セマンティック検索"""
        user_memories = await self.find_by_user_id(user_id)
        
        # 関連性スコアを計算
        scored_memories = []
        for memory in user_memories:
            if memory.embedding_vector:
                relevance_score = memory.calculate_relevance_score(query_embedding)
                if relevance_score >= threshold:
                    scored_memories.append((memory, relevance_score))
        
        # スコア順でソート
        scored_memories.sort(key=lambda x: x[1], reverse=True)
        return [memory for memory, score in scored_memories[:limit]]
    
    async def delete(self, memory_id: str) -> bool:
        """メモリを削除"""
        if memory_id in self._memories:
            del self._memories[memory_id]
            return True
        return False
    
    async def update(self, memory: ExtendedMemory) -> bool:
        """メモリを更新"""
        if memory.id in self._memories:
            memory.updated_at = datetime.now()
            self._memories[memory.id] = memory
            return True
        return False


class FileBasedRepository(MemoryRepository):
    """ファイルベース実装"""
    
    def __init__(self, storage_path: str = "memory_storage.json"):
        self.storage_path = storage_path
        self._load_memories()
    
    def _load_memories(self):
        """メモリをファイルから読み込み"""
        self._memories: Dict[str, ExtendedMemory] = {}
        if os.path.exists(self.storage_path):
            try:
                with open(self.storage_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    for memory_data in data.values():
                        memory = ExtendedMemory(**memory_data)
                        self._memories[memory.id] = memory
            except Exception as e:
                print(f"メモリ読み込みエラー: {e}")
    
    def _save_memories(self):
        """メモリをファイルに保存"""
        try:
            data = {}
            for memory_id, memory in self._memories.items():
                data[memory_id] = memory.dict()
            
            with open(self.storage_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2, default=str)
            return True
        except Exception as e:
            print(f"メモリ保存エラー: {e}")
            return False
    
    async def save(self, memory: ExtendedMemory) -> bool:
        """メモリを保存"""
        self._memories[memory.id] = memory
        return self._save_memories()
    
    async def find_by_id(self, memory_id: str) -> Optional[ExtendedMemory]:
        """IDでメモリを検索"""
        return self._memories.get(memory_id)
    
    async def find_by_user_id(self, user_id: str, limit: int = 100) -> List[ExtendedMemory]:
        """ユーザーIDでメモリを検索"""
        user_memories = [
            memory for memory in self._memories.values() 
            if memory.user_id == user_id
        ]
        user_memories.sort(key=lambda x: x.created_at, reverse=True)
        return user_memories[:limit]
    
    async def semantic_search(self, query_embedding: List[float], user_id: str, 
                            limit: int = 10, threshold: float = 0.7) -> List[ExtendedMemory]:
        """セマンティック検索"""
        user_memories = await self.find_by_user_id(user_id)
        
        scored_memories = []
        for memory in user_memories:
            if memory.embedding_vector:
                relevance_score = memory.calculate_relevance_score(query_embedding)
                if relevance_score >= threshold:
                    scored_memories.append((memory, relevance_score))
        
        scored_memories.sort(key=lambda x: x[1], reverse=True)
        return [memory for memory, score in scored_memories[:limit]]
    
    async def delete(self, memory_id: str) -> bool:
        """メモリを削除"""
        if memory_id in self._memories:
            del self._memories[memory_id]
            return self._save_memories()
        return False
    
    async def update(self, memory: ExtendedMemory) -> bool:
        """メモリを更新"""
        if memory.id in self._memories:
            memory.updated_at = datetime.now()
            self._memories[memory.id] = memory
            return self._save_memories()
        return False


class RedisRepository(MemoryRepository):
    """Redis実装（本番環境用）"""
    
    def __init__(self, redis_url: str = "redis://localhost:6379", db: int = 0):
        try:
            self.redis_client = redis.from_url(redis_url, db=db, decode_responses=True)
            self.redis_client.ping()  # 接続テスト
        except Exception as e:
            print(f"Redis接続エラー: {e}")
            # フォールバックとしてInMemoryRepositoryを使用
            self._fallback = InMemoryRepository()
            self.redis_client = None
    
    def _memory_key(self, memory_id: str) -> str:
        """メモリキーを生成"""
        return f"memory:{memory_id}"
    
    def _user_memories_key(self, user_id: str) -> str:
        """ユーザーメモリキーを生成"""
        return f"user_memories:{user_id}"
    
    async def save(self, memory: ExtendedMemory) -> bool:
        """メモリを保存"""
        if not self.redis_client:
            return await self._fallback.save(memory)
        
        try:
            # メモリデータを保存
            memory_data = memory.json()
            self.redis_client.set(self._memory_key(memory.id), memory_data)
            
            # ユーザーメモリリストに追加
            self.redis_client.zadd(
                self._user_memories_key(memory.user_id),
                {memory.id: memory.created_at.timestamp()}
            )
            
            return True
        except Exception as e:
            print(f"Redis保存エラー: {e}")
            return False
    
    async def find_by_id(self, memory_id: str) -> Optional[ExtendedMemory]:
        """IDでメモリを検索"""
        if not self.redis_client:
            return await self._fallback.find_by_id(memory_id)
        
        try:
            memory_data = self.redis_client.get(self._memory_key(memory_id))
            if memory_data:
                return ExtendedMemory.parse_raw(memory_data)
            return None
        except Exception as e:
            print(f"Redis検索エラー: {e}")
            return None
    
    async def find_by_user_id(self, user_id: str, limit: int = 100) -> List[ExtendedMemory]:
        """ユーザーIDでメモリを検索"""
        if not self.redis_client:
            return await self._fallback.find_by_user_id(user_id, limit)
        
        try:
            # 新しい順でメモリIDを取得
            memory_ids = self.redis_client.zrevrange(
                self._user_memories_key(user_id), 0, limit - 1
            )
            
            memories = []
            for memory_id in memory_ids:
                memory = await self.find_by_id(memory_id)
                if memory:
                    memories.append(memory)
            
            return memories
        except Exception as e:
            print(f"Redis検索エラー: {e}")
            return []
    
    async def semantic_search(self, query_embedding: List[float], user_id: str, 
                            limit: int = 10, threshold: float = 0.7) -> List[ExtendedMemory]:
        """セマンティック検索"""
        if not self.redis_client:
            return await self._fallback.semantic_search(query_embedding, user_id, limit, threshold)
        
        # Redis Vector Search未実装のため、全メモリを取得してフィルタリング
        user_memories = await self.find_by_user_id(user_id)
        
        scored_memories = []
        for memory in user_memories:
            if memory.embedding_vector:
                relevance_score = memory.calculate_relevance_score(query_embedding)
                if relevance_score >= threshold:
                    scored_memories.append((memory, relevance_score))
        
        scored_memories.sort(key=lambda x: x[1], reverse=True)
        return [memory for memory, score in scored_memories[:limit]]
    
    async def delete(self, memory_id: str) -> bool:
        """メモリを削除"""
        if not self.redis_client:
            return await self._fallback.delete(memory_id)
        
        try:
            # メモリを取得してユーザーIDを確認
            memory = await self.find_by_id(memory_id)
            if not memory:
                return False
            
            # メモリデータを削除
            self.redis_client.delete(self._memory_key(memory_id))
            
            # ユーザーメモリリストから削除
            self.redis_client.zrem(self._user_memories_key(memory.user_id), memory_id)
            
            return True
        except Exception as e:
            print(f"Redis削除エラー: {e}")
            return False
    
    async def update(self, memory: ExtendedMemory) -> bool:
        """メモリを更新"""
        if not self.redis_client:
            return await self._fallback.update(memory)
        
        memory.updated_at = datetime.now()
        return await self.save(memory)


def create_memory_repository(repo_type: str = "file", **kwargs) -> MemoryRepository:
    """メモリリポジトリファクトリ"""
    if repo_type == "memory":
        return InMemoryRepository()
    elif repo_type == "file":
        return FileBasedRepository(kwargs.get("storage_path", "memory_storage.json"))
    elif repo_type == "redis":
        return RedisRepository(kwargs.get("redis_url", "redis://localhost:6379"))
    else:
        raise ValueError(f"未対応のリポジトリタイプ: {repo_type}")