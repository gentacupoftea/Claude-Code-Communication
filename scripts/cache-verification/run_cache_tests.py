#!/usr/bin/env python3
"""
OptimizedCacheManager - 自動テストスクリプト
目的：キャッシュの機能と性能をテストし、結果レポートを生成する
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
import matplotlib
matplotlib.use('Agg')  # GUIなしで実行するためのバックエンド設定
import matplotlib.pyplot as plt
import numpy as np

# スクリプトとプロジェクトのパス
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SCRIPTS_DIR = os.path.dirname(SCRIPT_DIR)
PROJECT_ROOT = os.path.dirname(SCRIPTS_DIR)
TEST_OUTPUT_DIR = os.path.join(SCRIPT_DIR, "test_results")

# 出力ディレクトリの作成
os.makedirs(TEST_OUTPUT_DIR, exist_ok=True)

# テスト時のデフォルト設定
DEFAULT_ITERATIONS = 1000
DEFAULT_VALUE_SIZE = 1024  # 1KB
DEFAULT_CONCURRENCY = 4
DEFAULT_KEY_PATTERN = "test:key:{}"
DEFAULT_TTL = 60  # 60秒

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

def generate_random_data(size):
    """ランダムなテストデータを生成
    
    Args:
        size: データサイズ（バイト単位）
        
    Returns:
        bytes: ランダムデータ
    """
    return ''.join(random.choice(string.ascii_letters + string.digits) for _ in range(size)).encode()

def generate_random_string(size):
    """ランダムな文字列を生成
    
    Args:
        size: 文字列の長さ
        
    Returns:
        str: ランダム文字列
    """
    return ''.join(random.choice(string.ascii_letters + string.digits) for _ in range(size))

class CacheTestRunner:
    """OptimizedCacheManagerのテストを実行するクラス"""
    
    def __init__(self, config=None):
        """初期化
        
        Args:
            config: テスト設定。指定がなければデフォルト設定を使用
        """
        self.config = config or {}
        self.cache_manager = None
        self.test_results = {}
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # デフォルト設定
        self.iterations = self.config.get('iterations', DEFAULT_ITERATIONS)
        self.value_size = self.config.get('value_size', DEFAULT_VALUE_SIZE)
        self.concurrency = self.config.get('concurrency', DEFAULT_CONCURRENCY)
        self.key_pattern = self.config.get('key_pattern', DEFAULT_KEY_PATTERN)
        self.ttl = self.config.get('ttl', DEFAULT_TTL)
        
        # タイミング測定用の変数
        self.set_times = []
        self.get_times = []
        self.get_hit_times = []
        self.get_miss_times = []
        self.invalidate_times = []
        
        # 統計情報
        self.hits = 0
        self.misses = 0
        
        # 追加データ
        self.size_vs_ttl_data = []
        self.size_vs_time_data = []
    
    def setup(self):
        """テスト環境のセットアップ"""
        print_section("テスト環境のセットアップ")
        
        try:
            # OptimizedCacheManagerのインスタンスを作成
            self.cache_manager = OptimizedCacheManager()
            print(f"OptimizedCacheManagerをインスタンス化: バージョン {getattr(self.cache_manager, 'VERSION', 'unknown')}")
            
            # Redis有効かどうかを確認
            redis_enabled = getattr(self.cache_manager, 'redis_enabled', False)
            print(f"Redis有効: {redis_enabled}")
            
            # 圧縮有効かどうかを確認
            compression_enabled = getattr(self.cache_manager, 'compression_enabled', False)
            print(f"圧縮有効: {compression_enabled}")
            
            # メモリ上限を確認
            memory_limit = getattr(self.cache_manager, 'memory_limit', 0)
            print(f"メモリ上限: {memory_limit / (1024 * 1024):.2f} MB")
            
            return True
        except Exception as e:
            print(f"セットアップ中にエラーが発生しました: {e}")
            return False
    
    def run_tests(self):
        """すべてのテストを実行"""
        if not self.setup():
            print("セットアップに失敗しました。テストを中止します。")
            return False
        
        # 基本テスト
        self.test_basic_operations()
        
        # パフォーマンステスト
        self.test_performance()
        
        # サイズベースのテスト
        self.test_size_based_behavior()
        
        # 並列テスト
        self.test_concurrent_operations()
        
        # TTL動作テスト
        self.test_ttl_behavior()
        
        # 無効化テスト
        self.test_invalidation()
        
        # 結果をまとめる
        self.generate_report()
        
        return True
    
    def test_basic_operations(self):
        """基本的なキャッシュ操作のテスト"""
        print_section("基本操作テスト")
        
        test_key = "test:basic:1"
        test_value = "test_value"
        
        # 初期状態でキーが存在しないことを確認
        initial_value = self.cache_manager.get(test_key)
        print(f"初期値の取得: {initial_value}")
        
        # 値の設定
        print(f"値の設定: {test_key} = {test_value}")
        self.cache_manager.set(test_key, test_value)
        
        # 値の取得
        retrieved_value = self.cache_manager.get(test_key)
        print(f"値の取得: {retrieved_value}")
        
        # 値の検証
        if retrieved_value == test_value:
            print("✓ 基本的なget/set操作が成功しました")
            self.test_results["basic_operations"] = True
        else:
            print(f"✗ get/set操作に失敗しました。期待値: {test_value}, 実際の値: {retrieved_value}")
            self.test_results["basic_operations"] = False
        
        # 値の無効化
        print(f"値の無効化: {test_key}")
        self.cache_manager.invalidate(test_key)
        
        # 無効化の確認
        after_invalidate = self.cache_manager.get(test_key)
        if after_invalidate is None:
            print("✓ 無効化操作が成功しました")
            self.test_results["invalidation"] = True
        else:
            print(f"✗ 無効化に失敗しました。値が依然として存在します: {after_invalidate}")
            self.test_results["invalidation"] = False
    
    def test_performance(self):
        """キャッシュパフォーマンスのテスト"""
        print_section("パフォーマンステスト")
        
        print(f"テスト設定: {self.iterations}回の操作、{self.value_size}バイトの値")
        
        # テストデータの準備
        test_keys = [self.key_pattern.format(i) for i in range(self.iterations)]
        test_values = [generate_random_string(self.value_size) for _ in range(self.iterations)]
        
        # --- SET操作のテスト ---
        print("SETパフォーマンステスト実行中...")
        self.set_times = []
        
        for i in range(self.iterations):
            start_time = time.time()
            self.cache_manager.set(test_keys[i], test_values[i], self.ttl)
            end_time = time.time()
            self.set_times.append((end_time - start_time) * 1000)  # ミリ秒に変換
        
        # --- GET操作のテスト（キャッシュヒット） ---
        print("GETパフォーマンステスト実行中（キャッシュヒット）...")
        self.get_times = []
        self.get_hit_times = []
        
        for i in range(self.iterations):
            start_time = time.time()
            value = self.cache_manager.get(test_keys[i])
            end_time = time.time()
            elapsed = (end_time - start_time) * 1000
            self.get_times.append(elapsed)
            
            if value == test_values[i]:
                self.hits += 1
                self.get_hit_times.append(elapsed)
            else:
                self.misses += 1
                print(f"警告: キー {test_keys[i]} でキャッシュミス")
        
        # --- GET操作のテスト（キャッシュミス） ---
        print("GETパフォーマンステスト実行中（キャッシュミス）...")
        self.get_miss_times = []
        
        for i in range(self.iterations):
            miss_key = f"missing:{test_keys[i]}"
            start_time = time.time()
            self.cache_manager.get(miss_key)
            end_time = time.time()
            self.get_miss_times.append((end_time - start_time) * 1000)
        
        # --- INVALIDATE操作のテスト ---
        print("INVALIDATEパフォーマンステスト実行中...")
        self.invalidate_times = []
        
        for i in range(self.iterations):
            start_time = time.time()
            self.cache_manager.invalidate(test_keys[i])
            end_time = time.time()
            self.invalidate_times.append((end_time - start_time) * 1000)
        
        # 結果を表示
        set_avg = sum(self.set_times) / len(self.set_times)
        get_avg = sum(self.get_times) / len(self.get_times)
        get_hit_avg = sum(self.get_hit_times) / len(self.get_hit_times) if self.get_hit_times else 0
        get_miss_avg = sum(self.get_miss_times) / len(self.get_miss_times)
        invalidate_avg = sum(self.invalidate_times) / len(self.invalidate_times)
        
        print(f"SET操作の平均時間: {set_avg:.3f}ms")
        print(f"GET操作の平均時間 (全体): {get_avg:.3f}ms")
        print(f"GET操作の平均時間 (ヒット): {get_hit_avg:.3f}ms")
        print(f"GET操作の平均時間 (ミス): {get_miss_avg:.3f}ms")
        print(f"INVALIDATE操作の平均時間: {invalidate_avg:.3f}ms")
        print(f"ヒット率: {(self.hits / self.iterations) * 100:.2f}%")
        
        # 結果を保存
        self.test_results["performance"] = {
            "set_avg_ms": set_avg,
            "get_avg_ms": get_avg,
            "get_hit_avg_ms": get_hit_avg,
            "get_miss_avg_ms": get_miss_avg,
            "invalidate_avg_ms": invalidate_avg,
            "hit_rate": (self.hits / self.iterations) * 100
        }
    
    def test_size_based_behavior(self):
        """データサイズごとの動作テスト"""
        print_section("サイズベースの動作テスト")
        
        # テストするサイズ（バイト）
        sizes = [100, 1000, 10000, 100000, 1000000]
        
        # 各サイズでのパフォーマンスを計測
        size_times = {}
        size_ttls = {}
        
        for size in sizes:
            print(f"{size}バイトのデータテスト中...")
            
            # テストデータの準備
            test_key = f"test:size:{size}"
            test_value = generate_random_string(size)
            
            # SET操作の時間計測
            start_time = time.time()
            self.cache_manager.set(test_key, test_value, self.ttl)
            set_time = (time.time() - start_time) * 1000
            
            # GET操作の時間計測
            start_time = time.time()
            self.cache_manager.get(test_key)
            get_time = (time.time() - start_time) * 1000
            
            # サイズごとの処理時間を記録
            size_times[size] = {
                "set_time_ms": set_time,
                "get_time_ms": get_time
            }
            
            # サイズに基づくTTL設定を確認（可能であれば）
            if hasattr(self.cache_manager, '_calculate_adaptive_ttl'):
                try:
                    adaptive_ttl = self.cache_manager._calculate_adaptive_ttl(test_key, "default", self.ttl, size)
                    size_ttls[size] = adaptive_ttl
                    print(f"  サイズ{size}バイトの適応的TTL: {adaptive_ttl:.2f}秒")
                    
                    # データ収集
                    self.size_vs_ttl_data.append((size, adaptive_ttl))
                except Exception as e:
                    print(f"  TTL計算中にエラー: {e}")
            
            # データ収集
            self.size_vs_time_data.append((size, set_time))
            
            print(f"  SET操作時間: {set_time:.3f}ms")
            print(f"  GET操作時間: {get_time:.3f}ms")
        
        # 結果を保存
        self.test_results["size_based"] = {
            "size_times": size_times,
            "size_ttls": size_ttls
        }
    
    def test_concurrent_operations(self):
        """並列操作のテスト"""
        print_section("並列操作テスト")
        
        print(f"並列度: {self.concurrency}、操作数: {self.iterations}")
        
        # テストデータの準備
        test_keys = [f"test:concurrent:{i}" for i in range(self.iterations)]
        test_values = [generate_random_string(self.value_size) for _ in range(self.iterations)]
        
        # 並列SET操作
        print("並列SET操作テスト実行中...")
        set_start_time = time.time()
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=self.concurrency) as executor:
            futures = []
            for i in range(self.iterations):
                futures.append(executor.submit(self.cache_manager.set, test_keys[i], test_values[i], self.ttl))
            
            # すべての操作が完了するのを待機
            concurrent.futures.wait(futures)
        
        set_total_time = (time.time() - set_start_time) * 1000
        
        # 並列GET操作
        print("並列GET操作テスト実行中...")
        get_results = {}
        get_start_time = time.time()
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=self.concurrency) as executor:
            futures = {executor.submit(self.cache_manager.get, key): i for i, key in enumerate(test_keys)}
            
            for future in concurrent.futures.as_completed(futures):
                idx = futures[future]
                try:
                    get_results[test_keys[idx]] = future.result()
                except Exception as e:
                    print(f"GET操作中にエラー発生: {e}")
        
        get_total_time = (time.time() - get_start_time) * 1000
        
        # 並列INVALIDATE操作
        print("並列INVALIDATE操作テスト実行中...")
        invalidate_start_time = time.time()
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=self.concurrency) as executor:
            futures = []
            for key in test_keys:
                futures.append(executor.submit(self.cache_manager.invalidate, key))
            
            # すべての操作が完了するのを待機
            concurrent.futures.wait(futures)
        
        invalidate_total_time = (time.time() - invalidate_start_time) * 1000
        
        # ヒット率の計算
        hits = sum(1 for i in range(self.iterations) if get_results.get(test_keys[i]) == test_values[i])
        hit_rate = (hits / self.iterations) * 100
        
        # 結果を表示
        print(f"並列SET操作の合計時間: {set_total_time:.3f}ms")
        print(f"並列GET操作の合計時間: {get_total_time:.3f}ms")
        print(f"並列INVALIDATE操作の合計時間: {invalidate_total_time:.3f}ms")
        print(f"ヒット率: {hit_rate:.2f}%")
        
        # 結果を保存
        self.test_results["concurrent"] = {
            "set_total_ms": set_total_time,
            "get_total_ms": get_total_time,
            "invalidate_total_ms": invalidate_total_time,
            "hit_rate": hit_rate,
            "operations_per_second": {
                "set": (self.iterations / (set_total_time / 1000)),
                "get": (self.iterations / (get_total_time / 1000)),
                "invalidate": (self.iterations / (invalidate_total_time / 1000))
            }
        }
    
    def test_ttl_behavior(self):
        """TTL動作のテスト"""
        print_section("TTL動作テスト")
        
        # 短いTTLでテスト
        short_ttl = 2  # 2秒
        test_key = "test:ttl:short"
        test_value = "short_ttl_value"
        
        print(f"{short_ttl}秒のTTLでテスト中...")
        
        # 値の設定
        self.cache_manager.set(test_key, test_value, short_ttl)
        
        # すぐに値を取得
        immediate_value = self.cache_manager.get(test_key)
        print(f"即時取得: {'ヒット' if immediate_value == test_value else 'ミス'}")
        
        # TTLの半分の時間を待機
        half_wait = short_ttl / 2
        print(f"{half_wait}秒待機中...")
        time.sleep(half_wait)
        
        # 再度値を取得
        mid_value = self.cache_manager.get(test_key)
        print(f"中間取得: {'ヒット' if mid_value == test_value else 'ミス'}")
        
        # TTL+1秒待機
        print(f"さらに{short_ttl - half_wait + 1}秒待機中...")
        time.sleep(short_ttl - half_wait + 1)
        
        # TTL後に値を取得
        expired_value = self.cache_manager.get(test_key)
        print(f"TTL後の取得: {'ヒット' if expired_value == test_value else 'ミス'}")
        
        # 結果を保存
        ttl_success = immediate_value == test_value and mid_value == test_value and expired_value is None
        
        self.test_results["ttl_behavior"] = {
            "immediate_hit": immediate_value == test_value,
            "mid_hit": mid_value == test_value,
            "expired_miss": expired_value is None,
            "success": ttl_success
        }
        
        if ttl_success:
            print("✓ TTL動作テストが成功しました")
        else:
            print("✗ TTL動作テストが失敗しました")
    
    def test_invalidation(self):
        """無効化パターンのテスト"""
        print_section("無効化パターンテスト")
        
        # テストデータを準備
        patterns = {
            "user:123:profile": "profile_data",
            "user:123:settings": "settings_data",
            "user:123:history": "history_data",
            "user:456:profile": "another_profile",
            "product:789:details": "product_details"
        }
        
        # すべてのキーを設定
        for key, value in patterns.items():
            self.cache_manager.set(key, value)
        
        # すべてのキーが設定されたことを確認
        all_set = True
        for key, expected in patterns.items():
            value = self.cache_manager.get(key)
            if value != expected:
                all_set = False
                print(f"警告: キー {key} の設定に失敗")
        
        if all_set:
            print("✓ すべてのテストキーが正常に設定されました")
        
        # パターンベースの無効化テスト
        invalidation_pattern = "user:123"
        print(f"パターン '{invalidation_pattern}' でキーを無効化します")
        self.cache_manager.invalidate(invalidation_pattern)
        
        # 無効化の結果を確認
        invalidation_success = True
        for key, expected in patterns.items():
            value = self.cache_manager.get(key)
            
            if invalidation_pattern in key:
                # パターンに一致するキーは無効化されているべき
                if value is not None:
                    invalidation_success = False
                    print(f"✗ キー {key} が無効化されていません")
            else:
                # パターンに一致しないキーは残っているべき
                if value != expected:
                    invalidation_success = False
                    print(f"✗ キー {key} が不正に無効化されています")
        
        # すべての無効化をテスト
        print("すべてのキーを無効化します")
        self.cache_manager.invalidate()
        
        # すべてのキーが無効化されたことを確認
        all_invalidated = True
        for key in patterns:
            if self.cache_manager.get(key) is not None:
                all_invalidated = False
                print(f"✗ キー {key} が無効化されていません")
        
        if invalidation_success and all_invalidated:
            print("✓ 無効化パターンテストが成功しました")
        else:
            print("✗ 無効化パターンテストが失敗しました")
        
        # 結果を保存
        self.test_results["invalidation_pattern"] = {
            "pattern_invalidation": invalidation_success,
            "complete_invalidation": all_invalidated,
            "success": invalidation_success and all_invalidated
        }
    
    def generate_report(self):
        """テスト結果からレポートを生成"""
        print_section("テストレポート生成")
        
        # 結果の概要
        summary = {
            "timestamp": self.timestamp,
            "config": {
                "iterations": self.iterations,
                "value_size": self.value_size,
                "concurrency": self.concurrency,
                "ttl": self.ttl
            },
            "results": self.test_results,
            "summary": {
                "success": all([
                    self.test_results.get("basic_operations", False),
                    self.test_results.get("invalidation", False),
                    self.test_results.get("ttl_behavior", {}).get("success", False),
                    self.test_results.get("invalidation_pattern", {}).get("success", False)
                ]),
                "performance": {
                    "set_avg_ms": self.test_results.get("performance", {}).get("set_avg_ms", 0),
                    "get_hit_avg_ms": self.test_results.get("performance", {}).get("get_hit_avg_ms", 0),
                    "hit_rate": self.test_results.get("performance", {}).get("hit_rate", 0)
                }
            }
        }
        
        # JSONとしてレポートを保存
        report_file = os.path.join(TEST_OUTPUT_DIR, f"cache_test_report_{self.timestamp}.json")
        with open(report_file, "w") as f:
            json.dump(summary, f, indent=2)
        
        print(f"テストレポートをJSONで保存しました: {report_file}")
        
        # Markdownレポートの生成
        md_report = self.generate_markdown_report(summary)
        md_file = os.path.join(TEST_OUTPUT_DIR, f"cache_test_report_{self.timestamp}.md")
        with open(md_file, "w") as f:
            f.write(md_report)
        
        print(f"テストレポートをMarkdownで保存しました: {md_file}")
        
        # グラフの生成
        self.generate_graphs()
        
        print(f"テストレポートが完成しました。すべての結果は {TEST_OUTPUT_DIR} にあります。")
        
        return summary
    
    def generate_markdown_report(self, summary):
        """MarkdownレポートをJSONから生成
        
        Args:
            summary: レポート要約データ
            
        Returns:
            str: Markdownフォーマットのレポート
        """
        success = summary["summary"]["success"]
        timestamp = summary["timestamp"]
        
        md = []
        md.append("# OptimizedCacheManager テスト結果")
        md.append("")
        md.append(f"実行日時: {datetime.strptime(timestamp, '%Y%m%d_%H%M%S').strftime('%Y-%m-%d %H:%M:%S')}")
        md.append(f"総合結果: {'成功 ✓' if success else '失敗 ✗'}")
        md.append("")
        
        # 設定情報
        md.append("## テスト設定")
        md.append("")
        md.append(f"- 繰り返し回数: {summary['config']['iterations']}")
        md.append(f"- 値のサイズ: {summary['config']['value_size']} バイト")
        md.append(f"- 並列度: {summary['config']['concurrency']}")
        md.append(f"- TTL: {summary['config']['ttl']} 秒")
        md.append("")
        
        # 基本操作テスト
        md.append("## 基本操作テスト")
        md.append("")
        md.append(f"- 基本的なget/set: {'成功 ✓' if summary['results'].get('basic_operations', False) else '失敗 ✗'}")
        md.append(f"- 基本的な無効化: {'成功 ✓' if summary['results'].get('invalidation', False) else '失敗 ✗'}")
        md.append("")
        
        # パフォーマンステスト
        if "performance" in summary["results"]:
            perf = summary["results"]["performance"]
            md.append("## パフォーマンス結果")
            md.append("")
            md.append(f"- SET操作の平均時間: {perf['set_avg_ms']:.3f} ms")
            md.append(f"- GET操作の平均時間 (全体): {perf['get_avg_ms']:.3f} ms")
            md.append(f"- GET操作の平均時間 (ヒット): {perf['get_hit_avg_ms']:.3f} ms")
            md.append(f"- GET操作の平均時間 (ミス): {perf['get_miss_avg_ms']:.3f} ms")
            md.append(f"- INVALIDATE操作の平均時間: {perf['invalidate_avg_ms']:.3f} ms")
            md.append(f"- ヒット率: {perf['hit_rate']:.2f}%")
            md.append("")
        
        # 並列処理テスト
        if "concurrent" in summary["results"]:
            conc = summary["results"]["concurrent"]
            md.append("## 並列処理結果")
            md.append("")
            md.append(f"- 並列SET操作の合計時間: {conc['set_total_ms']:.3f} ms")
            md.append(f"- 並列GET操作の合計時間: {conc['get_total_ms']:.3f} ms")
            md.append(f"- 並列INVALIDATE操作の合計時間: {conc['invalidate_total_ms']:.3f} ms")
            md.append(f"- ヒット率: {conc['hit_rate']:.2f}%")
            md.append("")
            md.append("### 秒間操作数")
            md.append("")
            md.append(f"- SET: {conc['operations_per_second']['set']:.2f} ops/sec")
            md.append(f"- GET: {conc['operations_per_second']['get']:.2f} ops/sec")
            md.append(f"- INVALIDATE: {conc['operations_per_second']['invalidate']:.2f} ops/sec")
            md.append("")
        
        # TTL動作テスト
        if "ttl_behavior" in summary["results"]:
            ttl = summary["results"]["ttl_behavior"]
            md.append("## TTL動作テスト")
            md.append("")
            md.append(f"- 即時アクセス: {'ヒット ✓' if ttl['immediate_hit'] else 'ミス ✗'}")
            md.append(f"- TTL半分経過後: {'ヒット ✓' if ttl['mid_hit'] else 'ミス ✗'}")
            md.append(f"- TTL経過後: {'ミス（期待通り） ✓' if ttl['expired_miss'] else 'ヒット（異常） ✗'}")
            md.append(f"- 総合結果: {'成功 ✓' if ttl['success'] else '失敗 ✗'}")
            md.append("")
        
        # 無効化パターンテスト
        if "invalidation_pattern" in summary["results"]:
            inv = summary["results"]["invalidation_pattern"]
            md.append("## 無効化パターンテスト")
            md.append("")
            md.append(f"- パターンベース無効化: {'成功 ✓' if inv['pattern_invalidation'] else '失敗 ✗'}")
            md.append(f"- 完全無効化: {'成功 ✓' if inv['complete_invalidation'] else '失敗 ✗'}")
            md.append(f"- 総合結果: {'成功 ✓' if inv['success'] else '失敗 ✗'}")
            md.append("")
        
        # グラフへの参照
        md.append("## 性能グラフ")
        md.append("")
        md.append("以下のグラフが生成されました:")
        md.append("")
        md.append(f"- [操作時間分布](./operation_times_{self.timestamp}.png)")
        md.append(f"- [サイズ別性能](./size_performance_{self.timestamp}.png)")
        md.append(f"- [並列処理性能](./concurrent_performance_{self.timestamp}.png)")
        md.append("")
        
        # まとめ
        md.append("## まとめ")
        md.append("")
        
        if success:
            md.append("すべてのテストは正常に完了し、OptimizedCacheManagerは期待通りに動作しています。")
        else:
            md.append("一部のテストが失敗しました。詳細なログを確認し、問題を修正してください。")
        
        md.append("")
        md.append(f"平均SET時間: {summary['summary']['performance']['set_avg_ms']:.3f} ms")
        md.append(f"平均GET時間 (ヒット): {summary['summary']['performance']['get_hit_avg_ms']:.3f} ms")
        md.append(f"ヒット率: {summary['summary']['performance']['hit_rate']:.2f}%")
        
        return "\n".join(md)
    
    def generate_graphs(self):
        """テスト結果からグラフを生成"""
        self.generate_operation_times_graph()
        self.generate_size_performance_graph()
        self.generate_concurrent_performance_graph()
    
    def generate_operation_times_graph(self):
        """操作時間分布のグラフを生成"""
        plt.figure(figsize=(12, 8))
        
        # 箱ひげ図データの準備
        data = [
            self.set_times, 
            self.get_hit_times, 
            self.get_miss_times, 
            self.invalidate_times
        ]
        
        # 箱ひげ図の描画
        box = plt.boxplot(data, patch_artist=True, labels=['SET', 'GET (Hit)', 'GET (Miss)', 'INVALIDATE'])
        
        # 箱の色を設定
        colors = ['lightblue', 'lightgreen', 'salmon', 'lightyellow']
        for patch, color in zip(box['boxes'], colors):
            patch.set_facecolor(color)
        
        plt.title('操作別実行時間分布')
        plt.ylabel('実行時間 (ms)')
        plt.grid(True, linestyle='--', alpha=0.7)
        
        # 保存
        output_file = os.path.join(TEST_OUTPUT_DIR, f"operation_times_{self.timestamp}.png")
        plt.savefig(output_file)
        plt.close()
    
    def generate_size_performance_graph(self):
        """サイズ別性能のグラフを生成"""
        plt.figure(figsize=(12, 8))
        
        # サイズとTTLの関係グラフ
        if self.size_vs_ttl_data:
            plt.subplot(2, 1, 1)
            sizes, ttls = zip(*self.size_vs_ttl_data)
            plt.plot(sizes, ttls, 'o-', color='blue')
            plt.xscale('log')
            plt.xlabel('データサイズ (バイト)')
            plt.ylabel('計算されたTTL (秒)')
            plt.title('データサイズとTTLの関係')
            plt.grid(True, linestyle='--', alpha=0.7)
        
        # サイズと実行時間の関係グラフ
        if self.size_vs_time_data:
            plt.subplot(2, 1, 2)
            sizes, times = zip(*self.size_vs_time_data)
            plt.plot(sizes, times, 'o-', color='green')
            plt.xscale('log')
            plt.xlabel('データサイズ (バイト)')
            plt.ylabel('SET操作時間 (ms)')
            plt.title('データサイズとSET操作時間の関係')
            plt.grid(True, linestyle='--', alpha=0.7)
        
        plt.tight_layout()
        
        # 保存
        output_file = os.path.join(TEST_OUTPUT_DIR, f"size_performance_{self.timestamp}.png")
        plt.savefig(output_file)
        plt.close()
    
    def generate_concurrent_performance_graph(self):
        """並列処理性能のグラフを生成"""
        if "concurrent" not in self.test_results:
            return
        
        plt.figure(figsize=(10, 6))
        
        # 秒間操作数の棒グラフ
        ops = self.test_results["concurrent"]["operations_per_second"]
        operations = ['SET', 'GET', 'INVALIDATE']
        values = [ops['set'], ops['get'], ops['invalidate']]
        colors = ['blue', 'green', 'red']
        
        plt.bar(operations, values, color=colors)
        plt.xlabel('操作タイプ')
        plt.ylabel('秒間操作数')
        plt.title('並列処理時の秒間操作数')
        plt.grid(True, axis='y', linestyle='--', alpha=0.7)
        
        # 値を表示
        for i, v in enumerate(values):
            plt.text(i, v + 0.5, f"{v:.1f}", ha='center')
        
        # 保存
        output_file = os.path.join(TEST_OUTPUT_DIR, f"concurrent_performance_{self.timestamp}.png")
        plt.savefig(output_file)
        plt.close()

def main():
    parser = argparse.ArgumentParser(description="OptimizedCacheManagerの自動テスト")
    parser.add_argument("--iterations", type=int, default=DEFAULT_ITERATIONS, help=f"各テストの繰り返し回数 (デフォルト: {DEFAULT_ITERATIONS})")
    parser.add_argument("--value-size", type=int, default=DEFAULT_VALUE_SIZE, help=f"テスト値のサイズ（バイト）(デフォルト: {DEFAULT_VALUE_SIZE})")
    parser.add_argument("--concurrency", type=int, default=DEFAULT_CONCURRENCY, help=f"並列テストの並列度 (デフォルト: {DEFAULT_CONCURRENCY})")
    parser.add_argument("--ttl", type=int, default=DEFAULT_TTL, help=f"テストで使用するTTL（秒）(デフォルト: {DEFAULT_TTL})")
    parser.add_argument("--output-dir", type=str, default=TEST_OUTPUT_DIR, help=f"結果出力ディレクトリ (デフォルト: {TEST_OUTPUT_DIR})")
    
    args = parser.parse_args()
    
    # 出力ディレクトリを設定
    global TEST_OUTPUT_DIR
    TEST_OUTPUT_DIR = args.output_dir
    os.makedirs(TEST_OUTPUT_DIR, exist_ok=True)
    
    # テスト設定
    config = {
        "iterations": args.iterations,
        "value_size": args.value_size,
        "concurrency": args.concurrency,
        "ttl": args.ttl
    }
    
    # テスト実行
    test_runner = CacheTestRunner(config)
    success = test_runner.run_tests()
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()