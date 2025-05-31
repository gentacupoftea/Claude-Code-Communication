#!/usr/bin/env python3
"""
キャッシュパフォーマンス測定用テストスクリプト
"""

import sys
import time
import os
import asyncio
from pathlib import Path
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import io
import base64
import json
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent))

load_dotenv()

def fibonacci(n):
    """テスト用のフィボナッチ計算関数"""
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

def generate_test_data(size=1000):
    """テスト用のデータを生成"""
    return {
        'id': np.arange(size),
        'value': np.random.rand(size) * 1000,
        'name': ['item-' + str(i) for i in range(size)],
        'category': np.random.choice(['A', 'B', 'C', 'D', 'E'], size)
    }

async def test_cache_performance():
    """キャッシュのパフォーマンスをテスト"""
    print("キャッシュパフォーマンステスト実行中...")
    
    from utils import cache_manager, memoize
    
    print("\n環境変数設定:")
    print(f"CACHE_TTL: {os.getenv('CACHE_TTL', '(デフォルト)')}")
    print(f"CACHE_MAX_SIZE: {os.getenv('CACHE_MAX_SIZE', '(デフォルト)')}")
    print(f"CACHE_MAX_MEMORY_MB: {os.getenv('CACHE_MAX_MEMORY_MB', '(デフォルト)')}")
    print(f"CACHE_STRATEGY: {os.getenv('CACHE_STRATEGY', '(デフォルト)')}")
    
    print("\nテスト1: 装飾された関数のキャッシュパフォーマンス")
    
    @memoize(ttl=60)
    def test_function(n):
        """テスト用の重い処理を行う関数"""
        time.sleep(0.1)  # 処理時間をシミュレート
        return n * 2
    
    cache_manager.clear()
    start_time = time.time()
    for i in range(10):
        test_function(i)
    no_cache_time = time.time() - start_time
    print(f"キャッシュなし実行時間: {no_cache_time:.4f}秒")
    
    start_time = time.time()
    for i in range(10):
        test_function(i)
    cached_time = time.time() - start_time
    print(f"キャッシュあり実行時間: {cached_time:.4f}秒")
    print(f"高速化率: {no_cache_time/cached_time:.1f}倍")
    
    stats = cache_manager.get_stats()
    print("\nキャッシュ統計:")
    print(f"ヒット数: {stats.hits}")
    print(f"ミス数: {stats.misses}")
    print(f"ヒット率: {stats.hit_rate:.2%}")
    print(f"エントリ数: {stats.entry_count}")
    print(f"メモリ使用量: {stats.memory_usage_mb:.2f} MB")
    print(f"エビクション回数: {stats.evictions}")
    
    print("\nテスト2: メモリ制限とエビクションのテスト")
    
    original_max_memory = cache_manager._max_memory_bytes
    cache_manager._max_memory_bytes = 1 * 1024 * 1024  # 1MB
    cache_manager.clear()
    
    large_data_sizes = [100, 1000, 10000, 50000, 100000]
    for size in large_data_sizes:
        data = generate_test_data(size)
        cache_manager.set(f"large_data_{size}", data)
        stats = cache_manager.get_stats()
        print(f"データサイズ {size} 追加後: {stats.memory_usage_mb:.2f} MB, エントリ数: {stats.entry_count}, エビクション: {stats.evictions}")
    
    cache_manager._max_memory_bytes = original_max_memory
    
    print("\nテスト3: LRUアルゴリズムのテスト")
    
    cache_manager.clear()
    
    original_max_size = cache_manager._max_size
    cache_manager._max_size = 5
    
    for key in ['A', 'B', 'C', 'D', 'E']:
        cache_manager.set(key, f"値{key}")
        
    print("初期状態:", list(cache_manager._cache.keys()))
    
    cache_manager.get('C')
    cache_manager.get('A')
    print("C, Aアクセス後:", list(cache_manager._cache.keys()))
    
    cache_manager.set('F', "値F")
    cache_manager.set('G', "値G")
    print("F, G追加後:", list(cache_manager._cache.keys()))
    
    cache_manager._max_size = original_max_size
    
    print("\nテスト結果サマリー:")
    cache_manager.clear()
    
    @memoize()
    def cached_fibonacci(n):
        if n <= 1:
            return n
        return cached_fibonacci(n-1) + cached_fibonacci(n-2)
    
    start_time = time.time()
    result1 = fibonacci(30)
    no_cache_time = time.time() - start_time
    print(f"フィボナッチ(30) キャッシュなし: {no_cache_time:.4f}秒")
    
    start_time = time.time()
    result2 = cached_fibonacci(30)
    cached_time = time.time() - start_time
    print(f"フィボナッチ(30) キャッシュあり: {cached_time:.4f}秒")
    print(f"高速化率: {no_cache_time/cached_time:.1f}倍")
    
    print(f"結果一致: {result1 == result2}")
    
    stats = cache_manager.get_stats()
    print("\n最終キャッシュ統計:")
    print(f"ヒット数: {stats.hits}")
    print(f"ミス数: {stats.misses}")
    print(f"ヒット率: {stats.hit_rate:.2%}")
    print(f"エントリ数: {stats.entry_count}")
    print(f"メモリ使用量: {stats.memory_usage_mb:.2f} MB")
    
    print("\n✓ キャッシュパフォーマンステスト完了!")
    return 0

if __name__ == "__main__":
    exit_code = asyncio.run(test_cache_performance())
    sys.exit(exit_code)
