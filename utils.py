import functools
import time
import hashlib
import json
import logging
from typing import Any, Dict, Callable, Optional, Tuple, TypeVar, cast

T = TypeVar('T')
CacheDict = Dict[str, Tuple[Any, float]]

_CACHE: CacheDict = {}
_CACHE_TTL = 300  # デフォルトのTTL（秒）

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
    """関数の結果をキャッシュするデコレータ"""
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> T:
            cache_key = get_cache_key(func.__name__, args, kwargs)
            
            if cache_key in _CACHE:
                result, timestamp = _CACHE[cache_key]
                if time.time() - timestamp < ttl:
                    logging.debug(f"Cache hit for {func.__name__}")
                    return cast(T, result)
            
            result = func(*args, **kwargs)
            _CACHE[cache_key] = (result, time.time())
            return result
        return wrapper
    return decorator

def clear_cache() -> None:
    """キャッシュを完全にクリアする"""
    global _CACHE
    _CACHE = {}

def clear_cache_for_function(func_name: str) -> None:
    """特定の関数のキャッシュエントリをクリアする"""
    global _CACHE
    keys_to_delete = [k for k in _CACHE if k.startswith(func_name)]
    for key in keys_to_delete:
        del _CACHE[key]

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
