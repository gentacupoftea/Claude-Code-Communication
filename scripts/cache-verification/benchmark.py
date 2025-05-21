#!/usr/bin/env python3
"""
OptimizedCacheManager - パフォーマンスベンチマークツール
目的：キャッシュのパフォーマンスを詳細にベンチマークし、結果をレポートする
"""
import argparse
import json
import os
import sys
import time
import random
import string
import concurrent.futures
from datetime import datetime
from pathlib import Path
import statistics
import matplotlib
matplotlib.use('Agg')  # GUIなしで実行するためのバックエンド設定
import matplotlib.pyplot as plt
import numpy as np

# スクリプトとプロジェクトのパス
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SCRIPTS_DIR = os.path.dirname(SCRIPT_DIR)
PROJECT_ROOT = os.path.dirname(SCRIPTS_DIR)
BENCHMARK_DIR = os.path.join(SCRIPT_DIR, "benchmarks")

# 出力ディレクトリの作成
os.makedirs(BENCHMARK_DIR, exist_ok=True)

# OptimizedCacheManagerへのインポートパス
try:
    sys.path.append(PROJECT_ROOT)
    from src.api.shopify.optimized_cache_manager import OptimizedCacheManager
except ImportError:
    print("エラー: OptimizedCacheManagerが見つかりません。")
    print(f"プロジェクトルート: {PROJECT_ROOT}")
    print("以下を確認してください:")
    print("- プロジェクトの構造が正しいか")
    print("- OptimizedCacheManagerファイルが存在するか")
    print("- Pythonパスが正しく設定されているか")
    sys.exit(1)

def print_section(title):
    """セクションタイトルを表示"""
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)

def generate_random_string(size):
    """ランダムな文字列を生成
    
    Args:
        size: 文字列の長さ
        
    Returns:
        str: ランダム文字列
    """
    return ''.join(random.choice(string.ascii_letters + string.digits) for _ in range(size))

def generate_random_json(size, nesting=3):
    """ランダムなJSON構造体を生成
    
    Args:
        size: おおよそのサイズ（バイト）
        nesting: ネストのレベル（デフォルト:3）
        
    Returns:
        dict: ランダムなJSON構造体
    """
    if nesting <= 0:
        # ベースケース：基本的な値を返す
        choices = [
            generate_random_string(min(size, 100)),
            random.randint(0, 1000000),
            random.random() * 1000,
            random.choice([True, False]),
            None
        ]
        return random.choice(choices[:3])  # 主に文字列、整数、浮動小数点数を選択
    
    # 配列か辞書をランダムに選択
    if random.random() < 0.5:
        # 配列を生成
        num_items = max(1, min(size // 100, 20))  # サイズに基づいて項目数を制限
        result = []
        for _ in range(num_items):
            item_size = size // num_items
            result.append(generate_random_json(item_size, nesting - 1))
        return result
    else:
        # 辞書を生成
        num_items = max(1, min(size // 100, 20))  # サイズに基づいて項目数を制限
        result = {}
        for _ in range(num_items):
            key = generate_random_string(min(10, size // 10))
            item_size = size // num_items
            result[key] = generate_random_json(item_size, nesting - 1)
        return result

class CacheBenchmarker:
    """OptimizedCacheManagerのベンチマークを実行するクラス"""
    
    def __init__(self, config=None):
        """初期化
        
        Args:
            config: ベンチマーク設定
        """
        self.config = config or {}
        self.cache_manager = None
        self.results = {}
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # 実行設定
        self.run_id = self.config.get('run_id', self.timestamp)
        self.iterations = self.config.get('iterations', 1000)
        self.warmup_iterations = self.config.get('warmup_iterations', 100)
        self.max_concurrency = self.config.get('max_concurrency', 16)
        self.max_size = self.config.get('max_size', 1024 * 1024)  # 1MB
        self.ttl = self.config.get('ttl', 60)  # 60秒
        self.compare_with = self.config.get('compare_with', None)
        
        # 結果オブジェクト
        self.results = {
            "run_id": self.run_id,
            "timestamp": self.timestamp,
            "config": {
                "iterations": self.iterations,
                "warmup_iterations": self.warmup_iterations,
                "max_concurrency": self.max_concurrency,
                "max_size": self.max_size,
                "ttl": self.ttl
            },
            "benchmarks": {},
            "summary": {}
        }
    
    def setup(self):
        """テスト環境のセットアップ"""
        print_section("ベンチマーク環境のセットアップ")
        
        try:
            # OptimizedCacheManagerのインスタンスを作成
            self.cache_manager = OptimizedCacheManager()
            print(f"OptimizedCacheManagerをインスタンス化: バージョン {getattr(self.cache_manager, 'VERSION', 'unknown')}")
            
            # Redis有効かどうかを確認
            redis_enabled = getattr(self.cache_manager, 'redis_enabled', False)
            print(f"Redis有効: {redis_enabled}")
            
            # 環境情報を結果に保存
            self.results["environment"] = {
                "version": getattr(self.cache_manager, 'VERSION', 'unknown'),
                "redis_enabled": redis_enabled,
                "compression_enabled": getattr(self.cache_manager, 'compression_enabled', False),
                "memory_limit_mb": getattr(self.cache_manager, 'memory_limit', 0) / (1024 * 1024),
                "python_version": sys.version,
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            
            return True
        except Exception as e:
            print(f"セットアップ中にエラーが発生しました: {e}")
            return False
    
    def run_benchmarks(self):
        """すべてのベンチマークを実行"""
        if not self.setup():
            print("セットアップに失敗しました。ベンチマークを中止します。")
            return False
        
        # ウォームアップ
        print_section("ウォームアップ")
        self.warmup()
        
        # 操作時間ベンチマーク
        print_section("操作時間ベンチマーク")
        self.benchmark_operation_times()
        
        # スケーラビリティベンチマーク
        print_section("スケーラビリティベンチマーク")
        self.benchmark_scalability()
        
        # データサイズベンチマーク
        print_section("データサイズベンチマーク")
        self.benchmark_data_sizes()
        
        # TTLパフォーマンスベンチマーク
        print_section("TTLパフォーマンスベンチマーク")
        self.benchmark_ttl_impact()
        
        # データ型ベンチマーク
        print_section("データ型ベンチマーク")
        self.benchmark_data_types()
        
        # 結果の集計
        self.generate_summary()
        
        # 結果の保存
        self.save_results()
        
        # 比較（指定がある場合）
        if self.compare_with:
            self.compare_with_previous(self.compare_with)
        
        # グラフの生成
        self.generate_graphs()
        
        return True
    
    def warmup(self):
        """キャッシュのウォームアップ"""
        print(f"ウォームアップ中... ({self.warmup_iterations}回の操作)")
        
        for i in range(self.warmup_iterations):
            key = f"warmup:key:{i}"
            value = f"warmup:value:{i}"
            
            # 基本操作を実行
            self.cache_manager.set(key, value, self.ttl)
            self.cache_manager.get(key)
            
            if i % (self.warmup_iterations // 10) == 0 and i > 0:
                print(f"  {i} / {self.warmup_iterations} 完了")
        
        print("ウォームアップ完了")
    
    def benchmark_operation_times(self):
        """基本操作時間のベンチマーク"""
        print("基本操作時間のベンチマーク中...")
        
        # 測定対象の操作
        operations = ["set", "get_hit", "get_miss", "invalidate"]
        results = {op: [] for op in operations}
        
        # テストデータの準備
        test_keys = [f"bench:op:key:{i}" for i in range(self.iterations)]
        test_values = [f"bench:op:value:{i}" for i in range(self.iterations)]
        
        # 各操作の実行時間を測定
        for i in range(self.iterations):
            # SET操作
            start_time = time.time()
            self.cache_manager.set(test_keys[i], test_values[i], self.ttl)
            results["set"].append((time.time() - start_time) * 1000)  # ミリ秒に変換
            
            # GET操作（ヒット）
            start_time = time.time()
            self.cache_manager.get(test_keys[i])
            results["get_hit"].append((time.time() - start_time) * 1000)
            
            # GET操作（ミス）
            start_time = time.time()
            self.cache_manager.get(f"missing:{test_keys[i]}")
            results["get_miss"].append((time.time() - start_time) * 1000)
            
            # INVALIDATE操作
            start_time = time.time()
            self.cache_manager.invalidate(test_keys[i])
            results["invalidate"].append((time.time() - start_time) * 1000)
            
            # 進捗表示
            if i % (self.iterations // 10) == 0 and i > 0:
                print(f"  {i} / {self.iterations} 完了")
        
        # 結果を処理
        operation_times = {}
        for op in operations:
            # 外れ値除去（上下5%をカット）
            sorted_times = sorted(results[op])
            cut_count = int(len(sorted_times) * 0.05)
            trimmed = sorted_times[cut_count:-cut_count] if cut_count > 0 else sorted_times
            
            operation_times[op] = {
                "min_ms": min(trimmed),
                "max_ms": max(trimmed),
                "avg_ms": statistics.mean(trimmed),
                "median_ms": statistics.median(trimmed),
                "p95_ms": sorted_times[int(len(sorted_times) * 0.95)],
                "p99_ms": sorted_times[int(len(sorted_times) * 0.99)],
                "std_dev": statistics.stdev(trimmed)
            }
            
            # 結果表示
            print(f"  {op}:")
            print(f"    最小: {operation_times[op]['min_ms']:.3f}ms")
            print(f"    最大: {operation_times[op]['max_ms']:.3f}ms")
            print(f"    平均: {operation_times[op]['avg_ms']:.3f}ms")
            print(f"    中央値: {operation_times[op]['median_ms']:.3f}ms")
            print(f"    P95: {operation_times[op]['p95_ms']:.3f}ms")
            print(f"    P99: {operation_times[op]['p99_ms']:.3f}ms")
        
        # 結果を保存
        self.results["benchmarks"]["operation_times"] = operation_times
    
    def benchmark_scalability(self):
        """並列実行のスケーラビリティをベンチマーク"""
        print("スケーラビリティのベンチマーク中...")
        
        # テストする並列レベル
        concurrency_levels = [1, 2, 4, 8, 16]
        concurrency_levels = [c for c in concurrency_levels if c <= self.max_concurrency]
        
        # 結果保存用
        scalability_results = {}
        
        for concurrency in concurrency_levels:
            print(f"  並列度 {concurrency} をテスト中...")
            
            # 並列SET操作
            start_time = time.time()
            with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
                futures = []
                for i in range(self.iterations):
                    key = f"bench:scale:key:{concurrency}:{i}"
                    value = f"bench:scale:value:{concurrency}:{i}"
                    futures.append(executor.submit(self.cache_manager.set, key, value, self.ttl))
                
                # すべての操作が完了するのを待機
                concurrent.futures.wait(futures)
            
            set_time = time.time() - start_time
            
            # 並列GET操作
            start_time = time.time()
            with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
                futures = []
                for i in range(self.iterations):
                    key = f"bench:scale:key:{concurrency}:{i}"
                    futures.append(executor.submit(self.cache_manager.get, key))
                
                # すべての操作が完了するのを待機
                concurrent.futures.wait(futures)
            
            get_time = time.time() - start_time
            
            # 秒間操作数の計算
            set_ops_per_second = self.iterations / set_time
            get_ops_per_second = self.iterations / get_time
            
            # 結果の保存
            scalability_results[concurrency] = {
                "set_time_seconds": set_time,
                "get_time_seconds": get_time,
                "set_ops_per_second": set_ops_per_second,
                "get_ops_per_second": get_ops_per_second,
            }
            
            print(f"    SET: {set_ops_per_second:.2f} 操作/秒")
            print(f"    GET: {get_ops_per_second:.2f} 操作/秒")
        
        # スケーラビリティ係数の計算
        # 理想的には、並列度を2倍にするとスループットも2倍になるはず
        if 1 in scalability_results:
            base_set_throughput = scalability_results[1]["set_ops_per_second"]
            base_get_throughput = scalability_results[1]["get_ops_per_second"]
            
            for concurrency in scalability_results:
                if concurrency > 1:
                    ideal_speedup = concurrency  # 理想的なスピードアップ
                    actual_set_speedup = scalability_results[concurrency]["set_ops_per_second"] / base_set_throughput
                    actual_get_speedup = scalability_results[concurrency]["get_ops_per_second"] / base_get_throughput
                    
                    scalability_results[concurrency]["set_scaling_efficiency"] = (actual_set_speedup / ideal_speedup) * 100
                    scalability_results[concurrency]["get_scaling_efficiency"] = (actual_get_speedup / ideal_speedup) * 100
                    
                    print(f"  並列度 {concurrency} のスケーリング効率:")
                    print(f"    SET: {scalability_results[concurrency]['set_scaling_efficiency']:.2f}%")
                    print(f"    GET: {scalability_results[concurrency]['get_scaling_efficiency']:.2f}%")
        
        # 結果を保存
        self.results["benchmarks"]["scalability"] = scalability_results
    
    def benchmark_data_sizes(self):
        """データサイズの影響をベンチマーク"""
        print("データサイズの影響をベンチマーク中...")
        
        # テストするデータサイズ (バイト)
        sizes = [100, 1000, 10000, 100000, 1000000]
        sizes = [s for s in sizes if s <= self.max_size]
        
        # 結果保存用
        size_results = {}
        
        for size in sizes:
            print(f"  {size} バイトのデータをテスト中...")
            
            # データの準備
            data = generate_random_string(size)
            
            # 計測用の繰り返し回数（大きなデータの場合は少なくする）
            iterations = max(10, min(self.iterations, 10000 // (size // 100 + 1)))
            
            # SET操作の時間計測
            set_times = []
            for i in range(iterations):
                key = f"bench:size:key:{size}:{i}"
                
                start_time = time.time()
                self.cache_manager.set(key, data, self.ttl)
                set_times.append((time.time() - start_time) * 1000)
            
            # GET操作の時間計測
            get_times = []
            for i in range(iterations):
                key = f"bench:size:key:{size}:{i}"
                
                start_time = time.time()
                self.cache_manager.get(key)
                get_times.append((time.time() - start_time) * 1000)
            
            # 結果の計算
            avg_set_time = statistics.mean(set_times)
            avg_get_time = statistics.mean(get_times)
            
            # TTL情報（可能であれば）
            adaptive_ttl = None
            if hasattr(self.cache_manager, '_calculate_adaptive_ttl'):
                try:
                    adaptive_ttl = self.cache_manager._calculate_adaptive_ttl(
                        f"bench:size:key:{size}:0", "default", self.ttl, size
                    )
                except:
                    pass
            
            # 結果の保存
            size_results[size] = {
                "avg_set_time_ms": avg_set_time,
                "avg_get_time_ms": avg_get_time,
                "adaptive_ttl": adaptive_ttl,
                "bytes_per_ms_set": size / avg_set_time,
                "bytes_per_ms_get": size / avg_get_time
            }
            
            print(f"    SET: {avg_set_time:.3f}ms ({size_results[size]['bytes_per_ms_set']:.2f} バイト/ms)")
            print(f"    GET: {avg_get_time:.3f}ms ({size_results[size]['bytes_per_ms_get']:.2f} バイト/ms)")
            if adaptive_ttl:
                print(f"    適応的TTL: {adaptive_ttl:.2f}秒")
        
        # 結果を保存
        self.results["benchmarks"]["data_sizes"] = size_results
    
    def benchmark_ttl_impact(self):
        """TTL設定の影響をベンチマーク"""
        print("TTL設定の影響をベンチマーク中...")
        
        # テストするTTL値（秒）
        ttl_values = [1, 10, 60, 300, 3600]
        
        # 結果保存用
        ttl_results = {}
        
        for ttl in ttl_values:
            print(f"  TTL {ttl}秒をテスト中...")
            
            # SET操作（TTLを指定）
            key = f"bench:ttl:key:{ttl}"
            value = f"bench:ttl:value:{ttl}"
            
            start_time = time.time()
            self.cache_manager.set(key, value, ttl)
            set_time = (time.time() - start_time) * 1000
            
            # GETの成功率を時間経過で計測
            check_times = []
            hit_status = []
            
            if ttl <= 5:
                # 短いTTLの場合、細かく確認
                check_intervals = [0, ttl * 0.25, ttl * 0.5, ttl * 0.75, ttl * 0.9, ttl + 0.5, ttl + 1]
            else:
                # 長いTTLの場合、サンプルポイントを制限
                check_intervals = [0, min(1, ttl * 0.1), ttl * 0.5, ttl * 0.9]
            
            for interval in check_intervals:
                if interval > 0:
                    time.sleep(interval - sum(check_times))
                
                check_start = time.time()
                result = self.cache_manager.get(key)
                check_time = time.time() - check_start
                
                total_elapsed = sum(check_times) + check_time
                check_times.append(check_time)
                hit_status.append(result == value)
                
                status = "ヒット" if result == value else "ミス"
                print(f"    経過時間 {total_elapsed:.2f}秒: {status}")
            
            # TTL有効期限後に再確認（短いTTLの場合のみ）
            if ttl <= 60:
                sleep_time = max(0, ttl + 1 - sum(check_times))
                if sleep_time > 0:
                    time.sleep(sleep_time)
                
                check_start = time.time()
                result = self.cache_manager.get(key)
                check_time = time.time() - check_start
                
                total_elapsed = sum(check_times) + check_time
                check_times.append(check_time)
                hit_status.append(result == value)
                
                status = "ヒット" if result == value else "ミス"
                print(f"    経過時間 {total_elapsed:.2f}秒: {status}")
            
            # 結果の保存
            ttl_results[ttl] = {
                "set_time_ms": set_time,
                "check_intervals": list(check_intervals) + ([ttl + 1] if ttl <= 60 else []),
                "hit_status": hit_status,
                "actual_expiry": None  # 実際のTTL（推定）
            }
            
            # 実際のTTLを推定（最後のヒットと最初のミスの間）
            if False in hit_status:
                first_miss_idx = hit_status.index(False)
                if first_miss_idx > 0:
                    last_hit_time = sum(check_times[:first_miss_idx])
                    first_miss_time = sum(check_times[:first_miss_idx+1])
                    ttl_results[ttl]["actual_expiry"] = (last_hit_time + first_miss_time) / 2
                    
                    variation = ((ttl_results[ttl]["actual_expiry"] / ttl) - 1) * 100
                    print(f"    推定有効期限: {ttl_results[ttl]['actual_expiry']:.2f}秒 (設定値との差: {variation:+.2f}%)")
        
        # 結果を保存
        self.results["benchmarks"]["ttl_impact"] = ttl_results
    
    def benchmark_data_types(self):
        """異なるデータ型のベンチマーク"""
        print("データ型の影響をベンチマーク中...")
        
        # テストするデータ型とサンプル
        data_types = {
            "string": "これはテスト文字列です。" * 10,
            "number": 12345,
            "boolean": True,
            "list": [i for i in range(100)],
            "dict": {f"key{i}": f"value{i}" for i in range(50)},
            "nested": {"level1": {"level2": {"level3": [1, 2, 3, 4, 5]}}},
            "complex": generate_random_json(10000, nesting=4)
        }
        
        # 結果保存用
        type_results = {}
        
        for data_type, sample in data_types.items():
            print(f"  データ型 '{data_type}' をテスト中...")
            
            # サンプルデータのサイズ（JSONシリアライズ後）
            try:
                json_data = json.dumps(sample)
                data_size = len(json_data)
            except:
                data_size = sys.getsizeof(sample)
            
            # 測定用の繰り返し回数
            iterations = min(self.iterations, 1000)
            
            # SET操作の時間計測
            set_times = []
            for i in range(iterations):
                key = f"bench:type:{data_type}:{i}"
                
                start_time = time.time()
                self.cache_manager.set(key, sample, self.ttl)
                set_times.append((time.time() - start_time) * 1000)
            
            # GET操作の時間計測
            get_times = []
            for i in range(iterations):
                key = f"bench:type:{data_type}:{i}"
                
                start_time = time.time()
                self.cache_manager.get(key)
                get_times.append((time.time() - start_time) * 1000)
            
            # 結果の計算
            avg_set_time = statistics.mean(set_times)
            avg_get_time = statistics.mean(get_times)
            
            # 結果の保存
            type_results[data_type] = {
                "data_size_bytes": data_size,
                "avg_set_time_ms": avg_set_time,
                "avg_get_time_ms": avg_get_time,
                "bytes_per_ms_set": data_size / avg_set_time,
                "bytes_per_ms_get": data_size / avg_get_time
            }
            
            print(f"    サイズ: {data_size} バイト")
            print(f"    SET: {avg_set_time:.3f}ms")
            print(f"    GET: {avg_get_time:.3f}ms")
        
        # 結果を保存
        self.results["benchmarks"]["data_types"] = type_results
    
    def generate_summary(self):
        """ベンチマーク結果の概要を生成"""
        print_section("結果概要の生成")
        
        summary = {}
        
        # 操作時間の概要
        if "operation_times" in self.results["benchmarks"]:
            op_times = self.results["benchmarks"]["operation_times"]
            summary["operation_times"] = {
                "set_avg_ms": op_times["set"]["avg_ms"],
                "get_hit_avg_ms": op_times["get_hit"]["avg_ms"],
                "get_miss_avg_ms": op_times["get_miss"]["avg_ms"],
                "invalidate_avg_ms": op_times["invalidate"]["avg_ms"],
                "set_p95_ms": op_times["set"]["p95_ms"],
                "get_hit_p95_ms": op_times["get_hit"]["p95_ms"]
            }
        
        # スケーラビリティの概要
        if "scalability" in self.results["benchmarks"]:
            scalability = self.results["benchmarks"]["scalability"]
            
            # 最大並列度でのスループット
            max_concurrency = max(map(int, scalability.keys()))
            summary["scalability"] = {
                "max_set_throughput": scalability[max_concurrency]["set_ops_per_second"],
                "max_get_throughput": scalability[max_concurrency]["get_ops_per_second"]
            }
            
            # スケーリング効率（最大並列度の場合）
            if "set_scaling_efficiency" in scalability[max_concurrency]:
                summary["scalability"]["set_scaling_efficiency"] = scalability[max_concurrency]["set_scaling_efficiency"]
                summary["scalability"]["get_scaling_efficiency"] = scalability[max_concurrency]["get_scaling_efficiency"]
        
        # データサイズの影響の概要
        if "data_sizes" in self.results["benchmarks"]:
            size_results = self.results["benchmarks"]["data_sizes"]
            
            # 各サイズでのパフォーマンスを集計
            sizes = sorted(map(int, size_results.keys()))
            small_size = sizes[0]
            large_size = sizes[-1]
            
            summary["data_sizes"] = {
                "small_data_set_ms": size_results[small_size]["avg_set_time_ms"],
                "large_data_set_ms": size_results[large_size]["avg_set_time_ms"],
                "small_to_large_ratio": size_results[large_size]["avg_set_time_ms"] / size_results[small_size]["avg_set_time_ms"]
            }
        
        # TTL動作の概要
        if "ttl_impact" in self.results["benchmarks"]:
            ttl_results = self.results["benchmarks"]["ttl_impact"]
            
            # TTL精度
            ttl_accuracy = {}
            for ttl, data in ttl_results.items():
                if data["actual_expiry"] is not None:
                    accuracy = (data["actual_expiry"] / ttl) * 100
                    ttl_accuracy[ttl] = accuracy
            
            if ttl_accuracy:
                avg_accuracy = sum(ttl_accuracy.values()) / len(ttl_accuracy)
                summary["ttl_impact"] = {
                    "average_accuracy_percent": avg_accuracy
                }
        
        # データ型の影響の概要
        if "data_types" in self.results["benchmarks"]:
            type_results = self.results["benchmarks"]["data_types"]
            
            # 各型の平均処理時間
            summary["data_types"] = {
                "string_set_ms": type_results["string"]["avg_set_time_ms"],
                "complex_set_ms": type_results["complex"]["avg_set_time_ms"],
                "string_get_ms": type_results["string"]["avg_get_time_ms"],
                "complex_get_ms": type_results["complex"]["avg_get_time_ms"]
            }
        
        # 総合評価スコア (0-100)
        score_components = []
        
        # 操作速度スコア (速いほど高スコア)
        if "operation_times" in summary:
            op_times = summary["operation_times"]
            # 基準: set < 1ms, get_hit < 0.5ms がベストスコア
            set_score = min(100, 100 / (1 + op_times["set_avg_ms"]))
            get_score = min(100, 100 / (1 + op_times["get_hit_avg_ms"] * 2))
            score_components.append((set_score + get_score) / 2)
        
        # スケーラビリティスコア
        if "scalability" in summary and "set_scaling_efficiency" in summary["scalability"]:
            # 基準: 線形スケーリングが100%
            scaling_score = (summary["scalability"]["set_scaling_efficiency"] + 
                           summary["scalability"]["get_scaling_efficiency"]) / 2
            score_components.append(scaling_score)
        
        # データサイズハンドリングスコア
        if "data_sizes" in summary:
            # 基準: 大きなデータが小さなデータの10倍以内の時間
            size_ratio = summary["data_sizes"]["small_to_large_ratio"]
            size_score = min(100, 100 * (10 / max(size_ratio, 1)))
            score_components.append(size_score)
        
        # TTL精度スコア
        if "ttl_impact" in summary:
            # 基準: 100%精度が最高
            accuracy = summary["ttl_impact"]["average_accuracy_percent"]
            ttl_score = 100 - min(100, abs(accuracy - 100))
            score_components.append(ttl_score)
        
        # 総合スコアの計算
        if score_components:
            summary["overall_score"] = sum(score_components) / len(score_components)
            
            # 定性的評価
            if summary["overall_score"] >= 90:
                summary["rating"] = "優秀"
            elif summary["overall_score"] >= 75:
                summary["rating"] = "良好"
            elif summary["overall_score"] >= 60:
                summary["rating"] = "普通"
            else:
                summary["rating"] = "要改善"
            
            print(f"総合パフォーマンススコア: {summary['overall_score']:.2f}/100 ({summary['rating']})")
        
        # 結果への保存
        self.results["summary"] = summary
    
    def save_results(self):
        """ベンチマーク結果をファイルに保存"""
        print_section("結果の保存")
        
        # JSON形式で保存
        filename = f"benchmark_results_{self.timestamp}.json"
        filepath = os.path.join(BENCHMARK_DIR, filename)
        
        with open(filepath, "w") as f:
            json.dump(self.results, f, indent=2)
        
        print(f"ベンチマーク結果をJSONで保存しました: {filepath}")
        
        # Markdown形式でも保存
        md_filename = f"benchmark_results_{self.timestamp}.md"
        md_filepath = os.path.join(BENCHMARK_DIR, md_filename)
        
        with open(md_filepath, "w") as f:
            f.write(self.generate_markdown_report())
        
        print(f"ベンチマーク結果をMarkdownで保存しました: {md_filepath}")
        
        return filepath, md_filepath
    
    def generate_markdown_report(self):
        """Markdownレポートを生成"""
        md = []
        md.append("# OptimizedCacheManager ベンチマークレポート")
        md.append("")
        md.append(f"実行日時: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        md.append("")
        
        # 環境情報
        if "environment" in self.results:
            env = self.results["environment"]
            md.append("## 環境情報")
            md.append("")
            md.append(f"- バージョン: {env.get('version', 'unknown')}")
            md.append(f"- Redis有効: {env.get('redis_enabled', False)}")
            md.append(f"- 圧縮有効: {env.get('compression_enabled', False)}")
            md.append(f"- メモリ上限: {env.get('memory_limit_mb', 0):.2f} MB")
            md.append(f"- Python: {env.get('python_version', 'unknown')}")
            md.append("")
        
        # 設定情報
        md.append("## ベンチマーク設定")
        md.append("")
        md.append(f"- 反復回数: {self.results['config']['iterations']}")
        md.append(f"- ウォームアップ反復: {self.results['config']['warmup_iterations']}")
        md.append(f"- 最大並列度: {self.results['config']['max_concurrency']}")
        md.append(f"- 最大データサイズ: {self.results['config']['max_size']} バイト")
        md.append(f"- TTL: {self.results['config']['ttl']} 秒")
        md.append("")
        
        # 結果サマリー
        if "summary" in self.results and "overall_score" in self.results["summary"]:
            summary = self.results["summary"]
            md.append("## 結果サマリー")
            md.append("")
            md.append(f"**総合スコア: {summary['overall_score']:.2f}/100 ({summary['rating']})**")
            md.append("")
            
            if "operation_times" in summary:
                op_times = summary["operation_times"]
                md.append("### 基本操作パフォーマンス")
                md.append("")
                md.append("| 操作 | 平均時間 (ms) | P95 (ms) |")
                md.append("|------|--------------|----------|")
                md.append(f"| SET | {op_times['set_avg_ms']:.3f} | {op_times['set_p95_ms']:.3f} |")
                md.append(f"| GET (ヒット) | {op_times['get_hit_avg_ms']:.3f} | {op_times['get_hit_p95_ms']:.3f} |")
                md.append(f"| GET (ミス) | {op_times['get_miss_avg_ms']:.3f} | - |")
                md.append(f"| INVALIDATE | {op_times['invalidate_avg_ms']:.3f} | - |")
                md.append("")
            
            if "scalability" in summary:
                scalability = summary["scalability"]
                md.append("### スケーラビリティ")
                md.append("")
                md.append(f"- 最大SET処理能力: {scalability['max_set_throughput']:.2f} 操作/秒")
                md.append(f"- 最大GET処理能力: {scalability['max_get_throughput']:.2f} 操作/秒")
                if "set_scaling_efficiency" in scalability:
                    md.append(f"- SETスケーリング効率: {scalability['set_scaling_efficiency']:.2f}%")
                    md.append(f"- GETスケーリング効率: {scalability['get_scaling_efficiency']:.2f}%")
                md.append("")
            
            if "data_sizes" in summary:
                data_sizes = summary["data_sizes"]
                md.append("### データサイズの影響")
                md.append("")
                md.append(f"- 小データSET時間: {data_sizes['small_data_set_ms']:.3f} ms")
                md.append(f"- 大データSET時間: {data_sizes['large_data_set_ms']:.3f} ms")
                md.append(f"- 大/小比率: {data_sizes['small_to_large_ratio']:.2f}x")
                md.append("")
            
            if "ttl_impact" in summary:
                ttl_impact = summary["ttl_impact"]
                md.append("### TTL精度")
                md.append("")
                md.append(f"- 平均精度: {ttl_impact['average_accuracy_percent']:.2f}%")
                md.append("")
        
        # 詳細結果 - 操作時間
        if "operation_times" in self.results["benchmarks"]:
            op_times = self.results["benchmarks"]["operation_times"]
            md.append("## 詳細: 操作時間")
            md.append("")
            
            for op, metrics in op_times.items():
                md.append(f"### {op}")
                md.append("")
                md.append(f"- 最小: {metrics['min_ms']:.3f} ms")
                md.append(f"- 最大: {metrics['max_ms']:.3f} ms")
                md.append(f"- 平均: {metrics['avg_ms']:.3f} ms")
                md.append(f"- 中央値: {metrics['median_ms']:.3f} ms")
                md.append(f"- P95: {metrics['p95_ms']:.3f} ms")
                md.append(f"- P99: {metrics['p99_ms']:.3f} ms")
                md.append(f"- 標準偏差: {metrics['std_dev']:.3f} ms")
                md.append("")
        
        # 詳細結果 - スケーラビリティ
        if "scalability" in self.results["benchmarks"]:
            scalability = self.results["benchmarks"]["scalability"]
            md.append("## 詳細: スケーラビリティ")
            md.append("")
            md.append("| 並列度 | SET (操作/秒) | GET (操作/秒) | SET効率 (%) | GET効率 (%) |")
            md.append("|--------|--------------|--------------|------------|------------|")
            
            for concurrency in sorted(map(int, scalability.keys())):
                data = scalability[concurrency]
                set_efficiency = data.get("set_scaling_efficiency", "-")
                get_efficiency = data.get("get_scaling_efficiency", "-")
                
                if set_efficiency != "-":
                    set_efficiency = f"{set_efficiency:.2f}"
                if get_efficiency != "-":
                    get_efficiency = f"{get_efficiency:.2f}"
                
                md.append(f"| {concurrency} | {data['set_ops_per_second']:.2f} | {data['get_ops_per_second']:.2f} | {set_efficiency} | {get_efficiency} |")
            
            md.append("")
        
        # 詳細結果 - データサイズ
        if "data_sizes" in self.results["benchmarks"]:
            size_results = self.results["benchmarks"]["data_sizes"]
            md.append("## 詳細: データサイズの影響")
            md.append("")
            md.append("| サイズ (バイト) | SET (ms) | GET (ms) | バイト/ms (SET) | バイト/ms (GET) | 適応的TTL (秒) |")
            md.append("|----------------|----------|----------|----------------|----------------|---------------|")
            
            for size in sorted(map(int, size_results.keys())):
                data = size_results[size]
                adaptive_ttl = data.get("adaptive_ttl", "-")
                
                if adaptive_ttl != "-":
                    adaptive_ttl = f"{adaptive_ttl:.2f}"
                
                md.append(f"| {size} | {data['avg_set_time_ms']:.3f} | {data['avg_get_time_ms']:.3f} | {data['bytes_per_ms_set']:.2f} | {data['bytes_per_ms_get']:.2f} | {adaptive_ttl} |")
            
            md.append("")
        
        # 詳細結果 - TTL影響
        if "ttl_impact" in self.results["benchmarks"]:
            ttl_results = self.results["benchmarks"]["ttl_impact"]
            md.append("## 詳細: TTL設定の影響")
            md.append("")
            md.append("| TTL (秒) | SET (ms) | 実際の有効期限 (秒) | 精度 (%) |")
            md.append("|----------|----------|-------------------|----------|")
            
            for ttl in sorted(map(int, ttl_results.keys())):
                data = ttl_results[ttl]
                actual_expiry = data.get("actual_expiry", "-")
                accuracy = "-"
                
                if actual_expiry != "-":
                    accuracy = f"{(actual_expiry / ttl) * 100:.2f}"
                    actual_expiry = f"{actual_expiry:.2f}"
                
                md.append(f"| {ttl} | {data['set_time_ms']:.3f} | {actual_expiry} | {accuracy} |")
            
            md.append("")
        
        # 詳細結果 - データ型
        if "data_types" in self.results["benchmarks"]:
            type_results = self.results["benchmarks"]["data_types"]
            md.append("## 詳細: データ型の影響")
            md.append("")
            md.append("| データ型 | サイズ (バイト) | SET (ms) | GET (ms) | バイト/ms (SET) | バイト/ms (GET) |")
            md.append("|----------|----------------|----------|----------|----------------|----------------|")
            
            for data_type in sorted(type_results.keys()):
                data = type_results[data_type]
                md.append(f"| {data_type} | {data['data_size_bytes']} | {data['avg_set_time_ms']:.3f} | {data['avg_get_time_ms']:.3f} | {data['bytes_per_ms_set']:.2f} | {data['bytes_per_ms_get']:.2f} |")
            
            md.append("")
        
        # グラフ参照
        md.append("## パフォーマンスグラフ")
        md.append("")
        md.append("以下のグラフが生成されました:")
        md.append("")
        md.append(f"- [操作時間](./benchmark_graphs_{self.timestamp}/operation_times.png)")
        md.append(f"- [スケーラビリティ](./benchmark_graphs_{self.timestamp}/scalability.png)")
        md.append(f"- [データサイズの影響](./benchmark_graphs_{self.timestamp}/data_sizes.png)")
        md.append(f"- [データ型の影響](./benchmark_graphs_{self.timestamp}/data_types.png)")
        md.append("")
        
        return "\n".join(md)
    
    def compare_with_previous(self, previous_file):
        """以前のベンチマーク結果と比較"""
        print_section("以前の結果との比較")
        
        try:
            with open(previous_file, "r") as f:
                previous_results = json.load(f)
            
            print(f"以前の結果をロードしました: {previous_file}")
            
            # 比較結果を格納
            comparison = {
                "current_run_id": self.results["run_id"],
                "previous_run_id": previous_results.get("run_id", "unknown"),
                "current_timestamp": self.results["timestamp"],
                "previous_timestamp": previous_results.get("timestamp", "unknown"),
                "comparisons": {}
            }
            
            # 操作時間の比較
            if ("benchmarks" in previous_results and "operation_times" in previous_results["benchmarks"] and
                "benchmarks" in self.results and "operation_times" in self.results["benchmarks"]):
                
                prev_op_times = previous_results["benchmarks"]["operation_times"]
                curr_op_times = self.results["benchmarks"]["operation_times"]
                
                op_comparison = {}
                for op in set(prev_op_times.keys()) & set(curr_op_times.keys()):
                    prev_avg = prev_op_times[op]["avg_ms"]
                    curr_avg = curr_op_times[op]["avg_ms"]
                    
                    change_pct = ((curr_avg - prev_avg) / prev_avg) * 100
                    
                    op_comparison[op] = {
                        "previous_avg_ms": prev_avg,
                        "current_avg_ms": curr_avg,
                        "change_percent": change_pct,
                        "improved": change_pct < 0  # 時間が短くなった = 改善
                    }
                    
                    status = "改善" if change_pct < 0 else "悪化"
                    print(f"  {op}: {prev_avg:.3f}ms → {curr_avg:.3f}ms ({change_pct:+.2f}%, {status})")
                
                comparison["comparisons"]["operation_times"] = op_comparison
            
            # スケーラビリティの比較
            if ("benchmarks" in previous_results and "scalability" in previous_results["benchmarks"] and
                "benchmarks" in self.results and "scalability" in self.results["benchmarks"]):
                
                prev_scalability = previous_results["benchmarks"]["scalability"]
                curr_scalability = self.results["benchmarks"]["scalability"]
                
                # 最大並列度でのスループット比較
                prev_max = max(map(int, prev_scalability.keys()))
                curr_max = max(map(int, curr_scalability.keys()))
                
                prev_set_throughput = prev_scalability[str(prev_max)]["set_ops_per_second"]
                curr_set_throughput = curr_scalability[str(curr_max)]["set_ops_per_second"]
                
                prev_get_throughput = prev_scalability[str(prev_max)]["get_ops_per_second"]
                curr_get_throughput = curr_scalability[str(curr_max)]["get_ops_per_second"]
                
                set_change_pct = ((curr_set_throughput - prev_set_throughput) / prev_set_throughput) * 100
                get_change_pct = ((curr_get_throughput - prev_get_throughput) / prev_get_throughput) * 100
                
                comparison["comparisons"]["scalability"] = {
                    "previous_max_concurrency": prev_max,
                    "current_max_concurrency": curr_max,
                    "previous_set_throughput": prev_set_throughput,
                    "current_set_throughput": curr_set_throughput,
                    "set_throughput_change_percent": set_change_pct,
                    "previous_get_throughput": prev_get_throughput,
                    "current_get_throughput": curr_get_throughput,
                    "get_throughput_change_percent": get_change_pct
                }
                
                print(f"  最大SET処理能力: {prev_set_throughput:.2f} → {curr_set_throughput:.2f} 操作/秒 ({set_change_pct:+.2f}%)")
                print(f"  最大GET処理能力: {prev_get_throughput:.2f} → {curr_get_throughput:.2f} 操作/秒 ({get_change_pct:+.2f}%)")
            
            # 総合スコアの比較
            if "summary" in previous_results and "summary" in self.results:
                prev_summary = previous_results["summary"]
                curr_summary = self.results["summary"]
                
                if "overall_score" in prev_summary and "overall_score" in curr_summary:
                    prev_score = prev_summary["overall_score"]
                    curr_score = curr_summary["overall_score"]
                    
                    score_change = curr_score - prev_score
                    
                    comparison["comparisons"]["overall"] = {
                        "previous_score": prev_score,
                        "current_score": curr_score,
                        "score_change": score_change,
                        "previous_rating": prev_summary.get("rating", "不明"),
                        "current_rating": curr_summary.get("rating", "不明")
                    }
                    
                    print(f"  総合スコア: {prev_score:.2f} → {curr_score:.2f} ({score_change:+.2f})")
                    print(f"  評価: {prev_summary.get('rating', '不明')} → {curr_summary.get('rating', '不明')}")
            
            # 比較結果をファイルに保存
            comparison_file = os.path.join(BENCHMARK_DIR, f"comparison_{self.timestamp}.json")
            with open(comparison_file, "w") as f:
                json.dump(comparison, f, indent=2)
            
            print(f"比較結果を保存しました: {comparison_file}")
            
            # 比較結果のMarkdownレポート
            md_comparison_file = os.path.join(BENCHMARK_DIR, f"comparison_{self.timestamp}.md")
            with open(md_comparison_file, "w") as f:
                md = []
                md.append("# OptimizedCacheManager ベンチマーク比較レポート")
                md.append("")
                md.append(f"生成日時: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
                md.append("")
                md.append(f"現在の実行: {self.results['run_id']} ({self.results['timestamp']})")
                md.append(f"以前の実行: {previous_results.get('run_id', 'unknown')} ({previous_results.get('timestamp', 'unknown')})")
                md.append("")
                
                # 総合比較
                if "overall" in comparison["comparisons"]:
                    overall = comparison["comparisons"]["overall"]
                    md.append("## 総合評価の比較")
                    md.append("")
                    md.append(f"- 以前のスコア: {overall['previous_score']:.2f}/100 ({overall['previous_rating']})")
                    md.append(f"- 現在のスコア: {overall['current_score']:.2f}/100 ({overall['current_rating']})")
                    md.append(f"- 変化: {overall['score_change']:+.2f}")
                    md.append("")
                
                # 操作時間の比較
                if "operation_times" in comparison["comparisons"]:
                    op_times = comparison["comparisons"]["operation_times"]
                    md.append("## 操作時間の比較")
                    md.append("")
                    md.append("| 操作 | 以前 (ms) | 現在 (ms) | 変化 (%) | 状態 |")
                    md.append("|------|-----------|-----------|----------|------|")
                    
                    for op, data in op_times.items():
                        status = "✅ 改善" if data["improved"] else "❌ 悪化"
                        md.append(f"| {op} | {data['previous_avg_ms']:.3f} | {data['current_avg_ms']:.3f} | {data['change_percent']:+.2f} | {status} |")
                    
                    md.append("")
                
                # スケーラビリティの比較
                if "scalability" in comparison["comparisons"]:
                    scalability = comparison["comparisons"]["scalability"]
                    md.append("## スケーラビリティの比較")
                    md.append("")
                    md.append("| 指標 | 以前 | 現在 | 変化 (%) |")
                    md.append("|------|------|------|----------|")
                    md.append(f"| 最大SET処理能力 (操作/秒) | {scalability['previous_set_throughput']:.2f} | {scalability['current_set_throughput']:.2f} | {scalability['set_throughput_change_percent']:+.2f} |")
                    md.append(f"| 最大GET処理能力 (操作/秒) | {scalability['previous_get_throughput']:.2f} | {scalability['current_get_throughput']:.2f} | {scalability['get_throughput_change_percent']:+.2f} |")
                    md.append("")
                
                f.write("\n".join(md))
            
            print(f"比較レポートを保存しました: {md_comparison_file}")
            
            return comparison
        
        except Exception as e:
            print(f"以前の結果との比較中にエラーが発生しました: {e}")
            return None
    
    def generate_graphs(self):
        """結果に基づいてグラフを生成"""
        print_section("グラフの生成")
        
        # グラフ保存ディレクトリ
        graphs_dir = os.path.join(BENCHMARK_DIR, f"benchmark_graphs_{self.timestamp}")
        os.makedirs(graphs_dir, exist_ok=True)
        
        # 操作時間グラフ
        if "operation_times" in self.results["benchmarks"]:
            print("操作時間グラフを生成中...")
            plt.figure(figsize=(10, 6))
            
            op_times = self.results["benchmarks"]["operation_times"]
            operations = list(op_times.keys())
            avg_times = [op_times[op]["avg_ms"] for op in operations]
            p95_times = [op_times[op]["p95_ms"] for op in operations]
            
            x = np.arange(len(operations))
            width = 0.35
            
            plt.bar(x - width/2, avg_times, width, label='平均')
            plt.bar(x + width/2, p95_times, width, label='P95')
            
            plt.xlabel('操作')
            plt.ylabel('時間 (ms)')
            plt.title('操作別実行時間')
            plt.xticks(x, [op.replace('_', ' ').upper() for op in operations])
            plt.legend()
            plt.grid(axis='y', linestyle='--', alpha=0.7)
            
            # Y軸のスケールが大きい場合はログスケールを検討
            max_time = max(max(avg_times), max(p95_times))
            if max_time > 100:
                plt.yscale('log')
            
            # 値のラベルを追加
            for i, v in enumerate(avg_times):
                plt.text(i - width/2, v + max_time*0.02, f'{v:.2f}', ha='center', va='bottom', fontsize=8)
            
            for i, v in enumerate(p95_times):
                plt.text(i + width/2, v + max_time*0.02, f'{v:.2f}', ha='center', va='bottom', fontsize=8)
            
            plt.tight_layout()
            plt.savefig(os.path.join(graphs_dir, "operation_times.png"))
            plt.close()
        
        # スケーラビリティグラフ
        if "scalability" in self.results["benchmarks"]:
            print("スケーラビリティグラフを生成中...")
            plt.figure(figsize=(10, 6))
            
            scalability = self.results["benchmarks"]["scalability"]
            concurrency_levels = sorted(map(int, scalability.keys()))
            
            set_throughput = [scalability[str(c)]["set_ops_per_second"] for c in concurrency_levels]
            get_throughput = [scalability[str(c)]["get_ops_per_second"] for c in concurrency_levels]
            
            # 理想的なスケーリングライン
            ideal = [set_throughput[0] * c / concurrency_levels[0] for c in concurrency_levels]
            
            plt.plot(concurrency_levels, set_throughput, 'o-', label='SET 実測値')
            plt.plot(concurrency_levels, get_throughput, 's-', label='GET 実測値')
            plt.plot(concurrency_levels, ideal, '--', label='理想的なスケーリング')
            
            plt.xlabel('並列度')
            plt.ylabel('処理能力 (操作/秒)')
            plt.title('並列度に対する処理能力のスケーリング')
            plt.legend()
            plt.grid(True, linestyle='--', alpha=0.7)
            
            # X軸を整数値に
            plt.xticks(concurrency_levels)
            
            plt.tight_layout()
            plt.savefig(os.path.join(graphs_dir, "scalability.png"))
            plt.close()
            
            # 効率グラフ（並列度に対する効率）
            if "set_scaling_efficiency" in scalability[str(concurrency_levels[-1])]:
                plt.figure(figsize=(10, 6))
                
                set_efficiency = [scalability[str(c)].get("set_scaling_efficiency", 100 if c == 1 else 0) 
                                 for c in concurrency_levels if c > 1]
                get_efficiency = [scalability[str(c)].get("get_scaling_efficiency", 100 if c == 1 else 0) 
                                 for c in concurrency_levels if c > 1]
                
                conc_levels = [c for c in concurrency_levels if c > 1]
                
                plt.plot(conc_levels, set_efficiency, 'o-', label='SET 効率')
                plt.plot(conc_levels, get_efficiency, 's-', label='GET 効率')
                plt.axhline(y=100, color='r', linestyle='--', label='理想効率 (100%)')
                
                plt.xlabel('並列度')
                plt.ylabel('スケーリング効率 (%)')
                plt.title('並列度に対するスケーリング効率')
                plt.legend()
                plt.grid(True, linestyle='--', alpha=0.7)
                
                # X軸を整数値に
                plt.xticks(conc_levels)
                # Y軸は0-100%
                plt.ylim(0, 110)
                
                plt.tight_layout()
                plt.savefig(os.path.join(graphs_dir, "scaling_efficiency.png"))
                plt.close()
        
        # データサイズグラフ
        if "data_sizes" in self.results["benchmarks"]:
            print("データサイズグラフを生成中...")
            plt.figure(figsize=(10, 6))
            
            size_results = self.results["benchmarks"]["data_sizes"]
            sizes = sorted(map(int, size_results.keys()))
            
            set_times = [size_results[str(s)]["avg_set_time_ms"] for s in sizes]
            get_times = [size_results[str(s)]["avg_get_time_ms"] for s in sizes]
            
            plt.plot(sizes, set_times, 'o-', label='SET 時間')
            plt.plot(sizes, get_times, 's-', label='GET 時間')
            
            plt.xscale('log')
            plt.xlabel('データサイズ (バイト)')
            plt.ylabel('時間 (ms)')
            plt.title('データサイズに対する操作時間')
            plt.legend()
            plt.grid(True, linestyle='--', alpha=0.7)
            
            plt.tight_layout()
            plt.savefig(os.path.join(graphs_dir, "data_sizes.png"))
            plt.close()
            
            # スループットグラフ（バイト/ミリ秒）
            plt.figure(figsize=(10, 6))
            
            set_throughput = [size_results[str(s)]["bytes_per_ms_set"] for s in sizes]
            get_throughput = [size_results[str(s)]["bytes_per_ms_get"] for s in sizes]
            
            plt.plot(sizes, set_throughput, 'o-', label='SET スループット')
            plt.plot(sizes, get_throughput, 's-', label='GET スループット')
            
            plt.xscale('log')
            plt.yscale('log')
            plt.xlabel('データサイズ (バイト)')
            plt.ylabel('スループット (バイト/ms)')
            plt.title('データサイズに対するスループット')
            plt.legend()
            plt.grid(True, linestyle='--', alpha=0.7)
            
            plt.tight_layout()
            plt.savefig(os.path.join(graphs_dir, "data_throughput.png"))
            plt.close()
        
        # データ型グラフ
        if "data_types" in self.results["benchmarks"]:
            print("データ型グラフを生成中...")
            plt.figure(figsize=(12, 6))
            
            type_results = self.results["benchmarks"]["data_types"]
            types = list(type_results.keys())
            
            set_times = [type_results[t]["avg_set_time_ms"] for t in types]
            get_times = [type_results[t]["avg_get_time_ms"] for t in types]
            
            x = np.arange(len(types))
            width = 0.35
            
            plt.bar(x - width/2, set_times, width, label='SET 時間')
            plt.bar(x + width/2, get_times, width, label='GET 時間')
            
            plt.xlabel('データ型')
            plt.ylabel('時間 (ms)')
            plt.title('データ型別操作時間')
            plt.xticks(x, types, rotation=45, ha='right')
            plt.legend()
            plt.grid(axis='y', linestyle='--', alpha=0.7)
            
            plt.tight_layout()
            plt.savefig(os.path.join(graphs_dir, "data_types.png"))
            plt.close()
            
            # サイズ対時間グラフ
            plt.figure(figsize=(10, 6))
            
            sizes = [type_results[t]["data_size_bytes"] for t in types]
            
            plt.scatter(sizes, set_times, label='SET 時間', marker='o')
            plt.scatter(sizes, get_times, label='GET 時間', marker='s')
            
            # 各ポイントにラベルを付ける
            for i, txt in enumerate(types):
                plt.annotate(txt, (sizes[i], set_times[i]), fontsize=8, 
                            textcoords="offset points", xytext=(0,5), ha='center')
            
            plt.xscale('log')
            plt.xlabel('データサイズ (バイト)')
            plt.ylabel('時間 (ms)')
            plt.title('データ型別：サイズと操作時間の関係')
            plt.legend()
            plt.grid(True, linestyle='--', alpha=0.7)
            
            plt.tight_layout()
            plt.savefig(os.path.join(graphs_dir, "type_vs_size.png"))
            plt.close()
        
        print(f"グラフを保存しました: {graphs_dir}")
        return graphs_dir

def main():
    parser = argparse.ArgumentParser(description="OptimizedCacheManagerのパフォーマンスベンチマーク")
    parser.add_argument("--iterations", type=int, default=1000, help="各テストの反復回数 (デフォルト: 1000)")
    parser.add_argument("--warmup", type=int, default=100, help="ウォームアップの反復回数 (デフォルト: 100)")
    parser.add_argument("--concurrency", type=int, default=16, help="テストする最大並列度 (デフォルト: 16)")
    parser.add_argument("--max-size", type=int, default=1024*1024, help="テストする最大データサイズ（バイト） (デフォルト: 1MB)")
    parser.add_argument("--ttl", type=int, default=60, help="テストで使用するTTL（秒） (デフォルト: 60)")
    parser.add_argument("--run-id", type=str, help="このベンチマーク実行のID")
    parser.add_argument("--compare-with", type=str, help="比較する以前のベンチマーク結果のJSONファイルパス")
    
    args = parser.parse_args()
    
    # 設定
    config = {
        "run_id": args.run_id,
        "iterations": args.iterations,
        "warmup_iterations": args.warmup,
        "max_concurrency": args.concurrency,
        "max_size": args.max_size,
        "ttl": args.ttl,
        "compare_with": args.compare_with
    }
    
    # ベンチマーク実行
    benchmarker = CacheBenchmarker(config)
    success = benchmarker.run_benchmarks()
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()