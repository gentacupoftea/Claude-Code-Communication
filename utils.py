import functools
import time
import hashlib
import json
import logging
import os
import sys
import threading
from collections import OrderedDict
from typing import Any, Dict, Callable, Optional, Tuple, TypeVar, cast, List, NamedTuple

T = TypeVar('T')
CacheDict = Dict[str, Tuple[Any, float]]

DEFAULT_CACHE_TTL = 300  # デフォルトのTTL（秒）
DEFAULT_MAX_CACHE_SIZE = 1000  # デフォルトの最大エントリ数
DEFAULT_MAX_CACHE_MEMORY_MB = 100  # デフォルトの最大メモリ使用量（MB）

CACHE_TTL = int(os.getenv("CACHE_TTL", str(DEFAULT_CACHE_TTL)))
CACHE_MAX_SIZE = int(os.getenv("CACHE_MAX_SIZE", str(DEFAULT_MAX_CACHE_SIZE)))
CACHE_MAX_MEMORY_MB = int(os.getenv("CACHE_MAX_MEMORY_MB", str(DEFAULT_MAX_CACHE_MEMORY_MB)))
CACHE_STRATEGY = os.getenv("CACHE_STRATEGY", "lru")  # lru または ttl

_CACHE: CacheDict = {}
_CACHE_TTL = CACHE_TTL

class CacheEntry(NamedTuple):
    """キャッシュエントリを表す型"""
    key: str
    value: Any
    timestamp: float
    size: int

class CacheStats(NamedTuple):
    """キャッシュ統計情報を表す型"""
    hits: int
    misses: int
    hit_rate: float
    size: int
    memory_usage_bytes: int
    memory_usage_mb: float
    entry_count: int
    evictions: int

class CacheManager:
    """
    LRUアルゴリズムとメモリ管理機能を持つキャッシュマネージャー
    """
    def __init__(self, max_size: int = CACHE_MAX_SIZE, max_memory_mb: int = CACHE_MAX_MEMORY_MB, 
                default_ttl: int = CACHE_TTL, strategy: str = CACHE_STRATEGY):
        """
        キャッシュマネージャーを初期化
        
        Args:
            max_size: 最大エントリ数
            max_memory_mb: 最大メモリ使用量（MB）
            default_ttl: デフォルトのTTL（秒）
            strategy: キャッシュ戦略 ("lru" または "ttl")
        """
        self._cache = OrderedDict()  # LRU用のOrderedDict
        self._lock = threading.Lock()  # スレッドセーフティのためのロック
        self._max_size = max_size
        self._max_memory_bytes = max_memory_mb * 1024 * 1024  # MBをバイトに変換
        self._default_ttl = default_ttl
        self._strategy = strategy.lower()
        
        self._hits = 0
        self._misses = 0
        self._evictions = 0
        self._memory_usage = 0
    
    def get(self, key: str) -> Optional[Any]:
        """
        キャッシュからキーに対応する値を取得
        
        Args:
            key: キャッシュキー
            
        Returns:
            キャッシュされた値またはNone（キャッシュミス時）
        """
        with self._lock:
            if key in self._cache:
                entry = self._cache[key]
                
                current_time = time.time()
                if current_time - entry.timestamp >= self._default_ttl:
                    self._remove_entry(key)
                    self._misses += 1
                    return None
                
                if self._strategy == "lru":
                    self._cache.move_to_end(key)
                
                self._hits += 1
                return entry.value
            
            self._misses += 1
            return None
    
    def set(self, key: str, value: Any) -> None:
        """
        キャッシュに値を設定
        
        Args:
            key: キャッシュキー
            value: キャッシュする値
        """
        with self._lock:
            if key in self._cache:
                old_entry = self._cache[key]
                self._memory_usage -= old_entry.size
            
            size = self._estimate_size(value)
            
            entry = CacheEntry(key=key, value=value, timestamp=time.time(), size=size)
            
            if size > self._max_memory_bytes:
                logging.warning(f"キャッシュエントリが大きすぎます: {size} bytes > {self._max_memory_bytes} bytes")
                return
            
            self._cache[key] = entry
            self._memory_usage += size
            
            self._enforce_size_limits()
    
    def _enforce_size_limits(self) -> None:
        """キャッシュサイズとメモリ使用量の制限を適用"""
        while len(self._cache) > self._max_size:
            self._evict_entry()
        
        while self._memory_usage > self._max_memory_bytes and self._cache:
            self._evict_entry()
    
    def _evict_entry(self) -> None:
        """
        キャッシュからエントリを削除する（LRUまたは最も古いエントリ）
        """
        if not self._cache:
            return
        
        key, entry = self._cache.popitem(last=False)
        self._memory_usage -= entry.size
        self._evictions += 1
        logging.debug(f"キャッシュからエントリを削除: {key}")
    
    def _remove_entry(self, key: str) -> None:
        """指定したキーのエントリを削除"""
        if key in self._cache:
            entry = self._cache.pop(key)
            self._memory_usage -= entry.size
            logging.debug(f"キャッシュからエントリを削除: {key}")
    
    def _estimate_size(self, obj: Any) -> int:
        """
        オブジェクトのメモリ使用量を推定する
        
        Args:
            obj: サイズを推定するオブジェクト
            
        Returns:
            推定サイズ（バイト）
        """
        try:
            return sys.getsizeof(obj)
        except (TypeError, AttributeError):
            if isinstance(obj, dict):
                return (sys.getsizeof(obj) + 
                       sum(self._estimate_size(k) + self._estimate_size(v) for k, v in obj.items()))
            elif isinstance(obj, (list, tuple, set)):
                return sys.getsizeof(obj) + sum(self._estimate_size(i) for i in obj)
            else:
                return sys.getsizeof(obj)
    
    def clear(self) -> None:
        """キャッシュを完全にクリアする"""
        with self._lock:
            self._cache.clear()
            self._memory_usage = 0
    
    def clear_for_function(self, func_name: str) -> None:
        """特定の関数のキャッシュエントリをクリアする"""
        with self._lock:
            keys_to_delete = [k for k in self._cache if k.startswith(func_name)]
            for key in keys_to_delete:
                entry = self._cache.pop(key)
                self._memory_usage -= entry.size
    
    def get_stats(self) -> CacheStats:
        """キャッシュの統計情報を取得"""
        with self._lock:
            total_requests = self._hits + self._misses
            hit_rate = self._hits / total_requests if total_requests > 0 else 0
            
            return CacheStats(
                hits=self._hits,
                misses=self._misses,
                hit_rate=hit_rate,
                size=len(self._cache),
                memory_usage_bytes=self._memory_usage,
                memory_usage_mb=self._memory_usage / (1024 * 1024),
                entry_count=len(self._cache),
                evictions=self._evictions
            )
    
    def memoize(self, ttl: Optional[int] = None) -> Callable[[Callable[..., T]], Callable[..., T]]:
        """
        関数の結果をキャッシュするデコレータ
        
        Args:
            ttl: キャッシュのTTL（秒）。Noneの場合はデフォルト値を使用
            
        Returns:
            デコレータ関数
        """
        ttl = ttl or self._default_ttl
        
        def decorator(func: Callable[..., T]) -> Callable[..., T]:
            @functools.wraps(func)
            def wrapper(*args: Any, **kwargs: Any) -> T:
                cache_key = get_cache_key(func.__name__, args, kwargs)
                
                cached_value = self.get(cache_key)
                if cached_value is not None:
                    return cast(T, cached_value)
                
                result = func(*args, **kwargs)
                
                self.set(cache_key, result)
                
                return result
            return wrapper
        return decorator

cache_manager = CacheManager()

def get_cache_key(func_name: str, args: Tuple, kwargs: Dict) -> str:
    """関数名と引数からキャッシュキーを生成する"""
    key_dict = {
        'func': func_name,
        'args': args,
        'kwargs': kwargs
    }
    key_str = json.dumps(key_dict, sort_keys=True, default=str)
    return hashlib.md5(key_str.encode()).hexdigest()

def memoize(ttl: int = _CACHE_TTL) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """
    関数の結果をキャッシュするデコレータ（後方互換性のため）
    """
    return cache_manager.memoize(ttl)

def clear_cache() -> None:
    """キャッシュを完全にクリアする（後方互換性のため）"""
    global _CACHE
    _CACHE = {}
    cache_manager.clear()

def clear_cache_for_function(func_name: str) -> None:
    """特定の関数のキャッシュエントリをクリアする（後方互換性のため）"""
    global _CACHE
    keys_to_delete = [k for k in _CACHE if k.startswith(func_name)]
    for key in keys_to_delete:
        del _CACHE[key]
    cache_manager.clear_for_function(func_name)

def optimize_dataframe_dtypes(df):
    """DataFrameのメモリ使用量を最適化する"""
    for col in df.select_dtypes(include=['float']).columns:
        df[col] = df[col].astype('float32')
    
    for col in df.select_dtypes(include=['int']).columns:
        df[col] = df[col].astype('int32')
    
    for col in df.select_dtypes(include=['object']).columns:
        if df[col].nunique() < 50:  # カテゴリ型に変換する価値がある場合
            df[col] = df[col].astype('category')
    
    return df
