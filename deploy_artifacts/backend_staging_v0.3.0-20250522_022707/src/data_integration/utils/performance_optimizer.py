"""Performance optimization utilities."""

import time
import asyncio
from typing import List, Dict, Any, Optional, Callable
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
from functools import wraps
import numpy as np
from threading import Lock

class PerformanceOptimizer:
    """パフォーマンス最適化ユーティリティ。"""
    
    def __init__(self, max_threads: int = 10, max_processes: int = 4):
        self.thread_pool = ThreadPoolExecutor(max_workers=max_threads)
        self.process_pool = ProcessPoolExecutor(max_workers=max_processes)
        self.locks = {}
        self.cache = {}
        self.cache_ttl = {}
    
    def __del__(self):
        self.thread_pool.shutdown()
        self.process_pool.shutdown()
    
    def get_lock(self, key: str) -> Lock:
        """指定されたキーのロックを取得します。"""
        if key not in self.locks:
            self.locks[key] = Lock()
        return self.locks[key]
    
    def memoize(self, ttl: int = 3600):
        """関数結果をキャッシュするデコレーター。"""
        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                cache_key = f"{func.__name__}:{args}:{kwargs}"
                
                # Check cache
                if cache_key in self.cache:
                    created_at = self.cache_ttl.get(cache_key, 0)
                    if time.time() - created_at < ttl:
                        return self.cache[cache_key]
                
                # Compute result
                result = func(*args, **kwargs)
                
                # Store in cache
                self.cache[cache_key] = result
                self.cache_ttl[cache_key] = time.time()
                
                return result
            return wrapper
        return decorator
    
    def rate_limit(self, calls_per_second: float):
        """関数の呼び出しレートを制限するデコレーター。"""
        min_interval = 1.0 / calls_per_second
        last_called = [0.0]
        lock = Lock()
        
        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                with lock:
                    elapsed = time.time() - last_called[0]
                    if elapsed < min_interval:
                        time.sleep(min_interval - elapsed)
                    last_called[0] = time.time()
                return func(*args, **kwargs)
            return wrapper
        return decorator
    
    async def run_parallel_async(self, tasks: List[Callable]) -> List[Any]:
        """非同期タスクを並列実行します。"""
        return await asyncio.gather(*[task() for task in tasks])
    
    def run_parallel_threaded(self, tasks: List[Callable]) -> List[Any]:
        """スレッドプールでタスクを並列実行します。"""
        futures = [self.thread_pool.submit(task) for task in tasks]
        return [future.result() for future in futures]
    
    def batch_process(self, items: List[Any], processor: Callable, batch_size: int = 100) -> List[Any]:
        """アイテムをバッチ処理します。"""
        results = []
        
        for i in range(0, len(items), batch_size):
            batch = items[i:i + batch_size]
            batch_results = processor(batch)
            results.extend(batch_results)
        
        return results
    
    def calculate_optimal_batch_size(self, total_items: int, processing_time_per_item: float = 0.01) -> int:
        """最適なバッチサイズを計算します。"""
        # Simple heuristic based on total items and processing time
        if total_items < 100:
            return 10
        elif total_items < 1000:
            return 50
        elif total_items < 10000:
            return 100
        else:
            return 500
    
    def profile_function(self, func: Callable) -> Callable:
        """関数の実行時間をプロファイルするデコレーター。"""
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            result = func(*args, **kwargs)
            end_time = time.time()
            print(f"{func.__name__} took {end_time - start_time:.4f} seconds")
            return result
        return wrapper
    
    def optimize_dataframe_memory(self, df: Any) -> Any:
        """データフレームのメモリ使用量を最適化します。"""
        import pandas as pd
        
        for col in df.columns:
            col_type = df[col].dtype
            
            if col_type != 'object':
                c_min = df[col].min()
                c_max = df[col].max()
                
                if str(col_type)[:3] == 'int':
                    if c_min > np.iinfo(np.int8).min and c_max < np.iinfo(np.int8).max:
                        df[col] = df[col].astype(np.int8)
                    elif c_min > np.iinfo(np.int16).min and c_max < np.iinfo(np.int16).max:
                        df[col] = df[col].astype(np.int16)
                    elif c_min > np.iinfo(np.int32).min and c_max < np.iinfo(np.int32).max:
                        df[col] = df[col].astype(np.int32)
                    elif c_min > np.iinfo(np.int64).min and c_max < np.iinfo(np.int64).max:
                        df[col] = df[col].astype(np.int64)
                else:
                    if c_min > np.finfo(np.float16).min and c_max < np.finfo(np.float16).max:
                        df[col] = df[col].astype(np.float16)
                    elif c_min > np.finfo(np.float32).min and c_max < np.finfo(np.float32).max:
                        df[col] = df[col].astype(np.float32)
                    else:
                        df[col] = df[col].astype(np.float64)
        
        return df

# Global optimizer instance
optimizer = PerformanceOptimizer()

# Export commonly used decorators
memoize = optimizer.memoize
rate_limit = optimizer.rate_limit
profile_function = optimizer.profile_function
