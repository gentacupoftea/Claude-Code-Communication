"""Cache management for data integration."""

import json
import time
from typing import Optional, Dict, Any
import redis
from datetime import datetime, timedelta

class CacheManager:
    """データキャッシュを管理します。"""
    
    def __init__(self, redis_host: str = "localhost", redis_port: int = 6379):
        self.redis_client = redis.Redis(host=redis_host, port=redis_port, decode_responses=True)
        self.default_ttl = 3600  # 1時間
    
    def get(self, key: str) -> Optional[Any]:
        """キャッシュからデータを取得します。"""
        data = self.redis_client.get(key)
        if data:
            return json.loads(data)
        return None
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None):
        """キャッシュにデータを保存します。"""
        ttl = ttl or self.default_ttl
        self.redis_client.setex(key, ttl, json.dumps(value))
    
    def delete(self, key: str):
        """キャッシュからデータを削除します。"""
        self.redis_client.delete(key)
    
    def clear_pattern(self, pattern: str):
        """パターンに一致するキーを削除します。"""
        keys = self.redis_client.keys(pattern)
        if keys:
            self.redis_client.delete(*keys)
    
    def get_or_set(self, key: str, fetch_function, ttl: Optional[int] = None) -> Any:
        """キャッシュから取得するか、存在しない場合は生成して保存します。"""
        data = self.get(key)
        if data is None:
            data = fetch_function()
            self.set(key, data, ttl)
        return data
    
    def invalidate_store_cache(self, store_domain: str):
        """特定のストアのキャッシュを無効化します。"""
        self.clear_pattern(f"{store_domain}:*")
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """キャッシュ統計を取得します。"""
        info = self.redis_client.info("stats")
        return {
            "total_commands_processed": info.get("total_commands_processed", 0),
            "evicted_keys": info.get("evicted_keys", 0),
            "expired_keys": info.get("expired_keys", 0),
            "keyspace_hits": info.get("keyspace_hits", 0),
            "keyspace_misses": info.get("keyspace_misses", 0),
        }

class LocalCacheManager:
    """簡易的なインメモリキャッシュマネージャー。"""
    
    def __init__(self):
        self.cache: Dict[str, Dict[str, Any]] = {}
    
    def get(self, key: str) -> Optional[Any]:
        """キャッシュからデータを取得します。"""
        if key in self.cache:
            entry = self.cache[key]
            if entry["expires_at"] > time.time():
                return entry["value"]
            else:
                del self.cache[key]
        return None
    
    def set(self, key: str, value: Any, ttl: int = 3600):
        """キャッシュにデータを保存します。"""
        self.cache[key] = {
            "value": value,
            "expires_at": time.time() + ttl
        }
    
    def delete(self, key: str):
        """キャッシュからデータを削除します。"""
        if key in self.cache:
            del self.cache[key]
    
    def clear_pattern(self, pattern: str):
        """パターンに一致するキーを削除します。"""
        import fnmatch
        keys_to_delete = [k for k in self.cache.keys() if fnmatch.fnmatch(k, pattern)]
        for key in keys_to_delete:
            self.delete(key)
    
    def get_or_set(self, key: str, fetch_function, ttl: int = 3600) -> Any:
        """キャッシュから取得するか、存在しない場合は生成して保存します。"""
        data = self.get(key)
        if data is None:
            data = fetch_function()
            self.set(key, data, ttl)
        return data
