#!/usr/bin/env python3
"""
OptimizedCacheManager - 負荷テストツール
目的：実際の使用条件に近い負荷のシミュレーションと、性能限界の検証
"""
import argparse
import json
import multiprocessing
import os
import random
import string
import sys
import threading
import time
import urllib.request
import urllib.error
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
import matplotlib
matplotlib.use('Agg')  # GUIなしで実行するためのバックエンド設定
import matplotlib.pyplot as plt
import numpy as np

# スクリプトとプロジェクトのパス
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SCRIPTS_DIR = os.path.dirname(SCRIPT_DIR)
PROJECT_ROOT = os.path.dirname(SCRIPTS_DIR)
LOAD_TEST_DIR = os.path.join(SCRIPT_DIR, "load_tests")

# 出力ディレクトリの作成
os.makedirs(LOAD_TEST_DIR, exist_ok=True)

# OptimizedCacheManagerのクライアントインポート
try:
    sys.path.append(PROJECT_ROOT)
    from src.api.cache_client import CacheClient
except ImportError:
    print("エラー: CacheClientが見つかりません。")
    print(f"プロジェクトルート: {PROJECT_ROOT}")
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

def generate_random_data(size_min, size_max):
    """指定範囲のサイズをもつランダムなデータを生成
    
    Args:
        size_min: 最小サイズ（バイト）
        size_max: 最大サイズ（バイト）
        
    Returns:
        dict: ランダムデータ
    """
    # サイズを指定範囲内でランダムに決定
    size = random.randint(size_min, size_max)
    
    # データの種類をランダムに選択
    data_type = random.choice(['string', 'dict', 'list', 'mixed'])
    
    if data_type == 'string':
        return generate_random_string(size)
    elif data_type == 'dict':
        # 辞書データの生成
        items = {}
        bytes_used = 0
        while bytes_used < size:
            key = generate_random_string(random.randint(5, 15))
            value = generate_random_string(random.randint(10, 100))
            items[key] = value
            bytes_used += len(key) + len(value)
        return items
    elif data_type == 'list':
        # リストデータの生成
        items = []
        bytes_used = 0
        while bytes_used < size:
            item = generate_random_string(random.randint(10, 100))
            items.append(item)
            bytes_used += len(item)
        return items
    else:  # mixed
        # 複合データの生成
        result = {
            'id': random.randint(1, 10000),
            'name': generate_random_string(random.randint(10, 20)),
            'attributes': {},
            'tags': []
        }
        
        # 属性の追加
        attr_count = random.randint(5, 20)
        for _ in range(attr_count):
            key = generate_random_string(random.randint(5, 15))
            value = generate_random_string(random.randint(10, 50))
            result['attributes'][key] = value
        
        # タグの追加
        tag_count = random.randint(3, 10)
        for _ in range(tag_count):
            result['tags'].append(generate_random_string(random.randint(5, 15)))
        
        return result

class LoadTestWorker:
    """負荷テストの実行を担当するワーカークラス"""
    
    def __init__(self, worker_id, api_url, test_config):
        """初期化
        
        Args:
            worker_id: ワーカーID
            api_url: キャッシュAPIのURL
            test_config: テスト設定
        """
        self.worker_id = worker_id
        self.api_url = api_url
        self.config = test_config
        self.client = CacheClient(api_url)
        
        # テスト結果を保存するディクショナリ
        self.results = {
            "worker_id": worker_id,
            "operations": 0,
            "successes": 0,
            "failures": 0,
            "start_time": None,
            "end_time": None,
            "duration": 0,
            "set_times": [],
            "get_times": [],
            "invalidate_times": [],
            "errors": []
        }
    
    def _generate_key(self):
        """テスト用のキーを生成"""
        prefix = self.config.get('key_prefix', 'loadtest')
        # キー衝突を防ぐためにワーカーIDとタイムスタンプを含める
        return f"{prefix}:worker{self.worker_id}:{int(time.time() * 1000)}:{random.randint(1, 1000000)}"
    
    def _record_time(self, operation, time_ms):
        """操作時間を記録"""
        if operation == 'set':
            self.results["set_times"].append(time_ms)
        elif operation == 'get':
            self.results["get_times"].append(time_ms)
        elif operation == 'invalidate':
            self.results["invalidate_times"].append(time_ms)
    
    def _record_error(self, operation, error):
        """エラーを記録"""
        self.results["errors"].append({
            "operation": operation,
            "error": str(error),
            "timestamp": datetime.now().isoformat()
        })
        self.results["failures"] += 1
    
    def run_test(self):
        """負荷テストを実行"""
        self.results["start_time"] = datetime.now().isoformat()
        
        test_duration = self.config.get('duration', 60)  # デフォルト60秒
        operations_per_second = self.config.get('operations_per_second', 10)
        operation_interval = 1.0 / operations_per_second if operations_per_second > 0 else 0
        
        data_size_min = self.config.get('data_size_min', 100)
        data_size_max = self.config.get('data_size_max', 10000)
        ttl = self.config.get('ttl', 60)
        
        # 操作の確率
        op_weights = self.config.get('operation_weights', {'set': 0.3, 'get': 0.6, 'invalidate': 0.1})
        
        # キャッシュに保存したキーを追跡
        cached_keys = []
        max_cached_keys = 1000  # メモリ使用量を制限
        
        start_time = time.time()
        end_time = start_time + test_duration
        
        # 操作カウンター
        self.results["operations"] = 0
        self.results["successes"] = 0
        
        try:
            while time.time() < end_time:
                operation_start = time.time()
                
                # ランダムな操作の選択
                operation = random.choices(
                    ['set', 'get', 'invalidate'],
                    weights=[op_weights.get('set', 0.3), op_weights.get('get', 0.6), op_weights.get('invalidate', 0.1)]
                )[0]
                
                try:
                    if operation == 'set':
                        # SET操作
                        key = self._generate_key()
                        value = generate_random_data(data_size_min, data_size_max)
                        
                        start = time.time()
                        success = self.client.set(key, value, ttl)
                        elapsed = (time.time() - start) * 1000  # ミリ秒に変換
                        
                        if success:
                            cached_keys.append(key)
                            self.results["successes"] += 1
                            self._record_time('set', elapsed)
                            
                            # キャッシュキーリストのサイズを制限
                            if len(cached_keys) > max_cached_keys:
                                cached_keys = cached_keys[-max_cached_keys:]
                    
                    elif operation == 'get':
                        # GET操作
                        if cached_keys:
                            # 既存のキーからランダムに選択
                            key = random.choice(cached_keys)
                            
                            start = time.time()
                            value = self.client.get(key)
                            elapsed = (time.time() - start) * 1000  # ミリ秒に変換
                            
                            if value is not None:
                                self.results["successes"] += 1
                                self._record_time('get', elapsed)
                        else:
                            # キャッシュキーがない場合はSET操作を実行
                            key = self._generate_key()
                            value = generate_random_data(data_size_min, data_size_max)
                            
                            start = time.time()
                            success = self.client.set(key, value, ttl)
                            elapsed = (time.time() - start) * 1000  # ミリ秒に変換
                            
                            if success:
                                cached_keys.append(key)
                                self.results["successes"] += 1
                                self._record_time('set', elapsed)
                    
                    elif operation == 'invalidate':
                        # INVALIDATE操作
                        if cached_keys:
                            # 既存のキーからランダムに選択して削除
                            key = random.choice(cached_keys)
                            
                            start = time.time()
                            success = self.client.invalidate(key)
                            elapsed = (time.time() - start) * 1000  # ミリ秒に変換
                            
                            if success:
                                if key in cached_keys:
                                    cached_keys.remove(key)
                                self.results["successes"] += 1
                                self._record_time('invalidate', elapsed)
                
                except Exception as e:
                    self._record_error(operation, e)
                
                self.results["operations"] += 1
                
                # 次の操作までスリープ（一定のレートを維持するため）
                time_taken = time.time() - operation_start
                sleep_time = max(0, operation_interval - time_taken)
                if sleep_time > 0:
                    time.sleep(sleep_time)
        
        except KeyboardInterrupt:
            print(f"ワーカー {self.worker_id}: テストが中断されました")
        
        # 結果を計算
        self.results["end_time"] = datetime.now().isoformat()
        end_timestamp = time.time()
        self.results["duration"] = end_timestamp - start_time
        
        return self.results

class LoadTester:
    """OptimizedCacheManagerの負荷テストを実行するクラス"""
    
    def __init__(self, config=None):
        """初期化
        
        Args:
            config: テスト設定
        """
        self.config = config or {}
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.results = {}
        
        # デフォルト設定
        self.api_url = self.config.get('api_url', 'http://localhost:8000')
        self.workers = self.config.get('workers', 4)
        self.test_id = self.config.get('test_id', self.timestamp)
        
        # 結果オブジェクト
        self.results = {
            "test_id": self.test_id,
            "timestamp": self.timestamp,
            "config": self.config,
            "worker_results": [],
            "summary": {}
        }
    
    def run_test(self):
        """負荷テストを実行"""
        print_section("負荷テスト開始")
        print(f"API URL: {self.api_url}")
        print(f"ワーカー数: {self.workers}")
        print(f"テスト期間: {self.config.get('duration', 60)}秒")
        print(f"操作/秒/ワーカー: {self.config.get('operations_per_second', 10)}")
        
        # ワーカープロセスのリスト
        worker_processes = []
        
        # 前処理：APIサーバーが利用可能かチェック
        try:
            client = CacheClient(self.api_url)
            health = client.healthcheck()
            if health.get("status") == "healthy":
                print(f"APIサーバーは正常に動作しています: {health}")
            else:
                print(f"警告: APIサーバーの状態が不明です: {health}")
        except Exception as e:
            print(f"エラー: APIサーバーへの接続に失敗しました: {e}")
            return False
        
        # テスト前の統計情報の取得
        try:
            before_stats = client.get_stats()
            print("テスト前の統計情報:")
            print(f"  ヒット率: {before_stats.get('hit_rate', 0) * 100:.2f}%")
            print(f"  メモリ使用量: {before_stats.get('memory_usage_mb', 0):.2f} MB ({before_stats.get('memory_usage_percent', 0):.2f}%)")
            
            self.results["before_stats"] = before_stats
        except Exception as e:
            print(f"警告: テスト前の統計情報の取得に失敗しました: {e}")
        
        print("\nテスト実行中...")
        start_time = time.time()
        
        # マルチプロセスで並列実行
        with ThreadPoolExecutor(max_workers=self.workers) as executor:
            futures = []
            
            for i in range(self.workers):
                worker = LoadTestWorker(i, self.api_url, self.config)
                futures.append(executor.submit(worker.run_test))
            
            # 進捗表示
            test_duration = self.config.get('duration', 60)
            while time.time() - start_time < test_duration:
                elapsed = int(time.time() - start_time)
                remaining = max(0, test_duration - elapsed)
                print(f"\r経過時間: {elapsed}秒 / 残り時間: {remaining}秒", end="")
                time.sleep(1)
            
            print("\n\nすべてのワーカーの完了を待機中...")
            
            # 結果の収集
            for future in futures:
                try:
                    worker_result = future.result()
                    self.results["worker_results"].append(worker_result)
                except Exception as e:
                    print(f"ワーカーの実行中にエラーが発生: {e}")
        
        # テスト後の統計情報の取得
        try:
            after_stats = client.get_stats()
            print("\nテスト後の統計情報:")
            print(f"  ヒット率: {after_stats.get('hit_rate', 0) * 100:.2f}%")
            print(f"  メモリ使用量: {after_stats.get('memory_usage_mb', 0):.2f} MB ({after_stats.get('memory_usage_percent', 0):.2f}%)")
            
            self.results["after_stats"] = after_stats
        except Exception as e:
            print(f"警告: テスト後の統計情報の取得に失敗しました: {e}")
        
        # 結果の集計と分析
        self.analyze_results()
        
        # 結果を保存
        self.save_results()
        
        # グラフの生成
        self.generate_graphs()
        
        return True
    
    def analyze_results(self):
        """テスト結果を分析"""
        print_section("結果分析")
        
        summary = {
            "total_workers": len(self.results["worker_results"]),
            "total_duration": 0,
            "total_operations": 0,
            "total_successes": 0,
            "total_failures": 0,
            "success_rate": 0,
            "operations_per_second": 0,
            "avg_set_time_ms": 0,
            "avg_get_time_ms": 0,
            "avg_invalidate_time_ms": 0,
            "p95_set_time_ms": 0,
            "p95_get_time_ms": 0,
            "p95_invalidate_time_ms": 0
        }
        
        # 各ワーカーの結果を集計
        all_set_times = []
        all_get_times = []
        all_invalidate_times = []
        all_errors = []
        
        for worker_result in self.results["worker_results"]:
            summary["total_operations"] += worker_result.get("operations", 0)
            summary["total_successes"] += worker_result.get("successes", 0)
            summary["total_failures"] += worker_result.get("failures", 0)
            summary["total_duration"] += worker_result.get("duration", 0)
            
            all_set_times.extend(worker_result.get("set_times", []))
            all_get_times.extend(worker_result.get("get_times", []))
            all_invalidate_times.extend(worker_result.get("invalidate_times", []))
            all_errors.extend(worker_result.get("errors", []))
        
        # 平均値を計算
        if summary["total_workers"] > 0:
            summary["total_duration"] /= summary["total_workers"]
        
        if summary["total_operations"] > 0:
            summary["success_rate"] = (summary["total_successes"] / summary["total_operations"]) * 100
        
        if summary["total_duration"] > 0:
            summary["operations_per_second"] = summary["total_operations"] / summary["total_duration"]
        
        # 操作時間の統計
        if all_set_times:
            summary["avg_set_time_ms"] = sum(all_set_times) / len(all_set_times)
            summary["p95_set_time_ms"] = np.percentile(all_set_times, 95)
        
        if all_get_times:
            summary["avg_get_time_ms"] = sum(all_get_times) / len(all_get_times)
            summary["p95_get_time_ms"] = np.percentile(all_get_times, 95)
        
        if all_invalidate_times:
            summary["avg_invalidate_time_ms"] = sum(all_invalidate_times) / len(all_invalidate_times)
            summary["p95_invalidate_time_ms"] = np.percentile(all_invalidate_times, 95)
        
        # エラー率
        summary["error_rate"] = (summary["total_failures"] / max(1, summary["total_operations"])) * 100
        
        # ストレージとメモリの変化（統計情報がある場合）
        if "before_stats" in self.results and "after_stats" in self.results:
            before = self.results["before_stats"]
            after = self.results["after_stats"]
            
            # メモリ使用量の変化
            if "memory_usage_mb" in before and "memory_usage_mb" in after:
                before_memory = before["memory_usage_mb"]
                after_memory = after["memory_usage_mb"]
                memory_change = after_memory - before_memory
                memory_change_pct = (memory_change / max(0.1, before_memory)) * 100
                
                summary["memory_usage_before_mb"] = before_memory
                summary["memory_usage_after_mb"] = after_memory
                summary["memory_usage_change_mb"] = memory_change
                summary["memory_usage_change_percent"] = memory_change_pct
            
            # ヒット率の変化
            if "hit_rate" in before and "hit_rate" in after:
                before_hit_rate = before["hit_rate"] * 100
                after_hit_rate = after["hit_rate"] * 100
                hit_rate_change = after_hit_rate - before_hit_rate
                
                summary["hit_rate_before"] = before_hit_rate
                summary["hit_rate_after"] = after_hit_rate
                summary["hit_rate_change"] = hit_rate_change
        
        # エラーサマリー
        error_summary = {}
        for error in all_errors:
            error_message = error.get("error", "")
            if error_message in error_summary:
                error_summary[error_message] += 1
            else:
                error_summary[error_message] = 1
        
        summary["error_summary"] = error_summary
        
        # 結果を表示
        print(f"総操作数: {summary['total_operations']}")
        print(f"成功数: {summary['total_successes']}")
        print(f"失敗数: {summary['total_failures']}")
        print(f"成功率: {summary['success_rate']:.2f}%")
        print(f"1秒あたりの操作数: {summary['operations_per_second']:.2f}")
        print(f"平均SET時間: {summary['avg_set_time_ms']:.3f} ms")
        print(f"平均GET時間: {summary['avg_get_time_ms']:.3f} ms")
        print(f"平均INVALIDATE時間: {summary['avg_invalidate_time_ms']:.3f} ms")
        print(f"P95 SET時間: {summary['p95_set_time_ms']:.3f} ms")
        print(f"P95 GET時間: {summary['p95_get_time_ms']:.3f} ms")
        print(f"P95 INVALIDATE時間: {summary['p95_invalidate_time_ms']:.3f} ms")
        
        if "memory_usage_change_mb" in summary:
            print(f"メモリ使用量の変化: {summary['memory_usage_change_mb']:.2f} MB ({summary['memory_usage_change_percent']:+.2f}%)")
        
        if "hit_rate_change" in summary:
            print(f"ヒット率の変化: {summary['hit_rate_change']:+.2f}%")
        
        if error_summary:
            print("\n主なエラー:")
            for error, count in sorted(error_summary.items(), key=lambda x: x[1], reverse=True)[:5]:
                print(f"  {error}: {count}回")
        
        # スループットの評価
        if summary["operations_per_second"] >= 1000:
            print("\n⭐ 優れたスループット: 毎秒1000操作以上")
        elif summary["operations_per_second"] >= 500:
            print("\n👍 良好なスループット: 毎秒500操作以上")
        elif summary["operations_per_second"] >= 100:
            print("\n✓ 普通のスループット: 毎秒100操作以上")
        else:
            print("\n⚠ 注意: スループットが低い（毎秒100操作未満）")
        
        # レイテンシの評価
        if summary["avg_get_time_ms"] <= 1.0:
            print("⭐ 優れたGETレイテンシ: 1ms以下")
        elif summary["avg_get_time_ms"] <= 5.0:
            print("👍 良好なGETレイテンシ: 5ms以下")
        elif summary["avg_get_time_ms"] <= 20.0:
            print("✓ 普通のGETレイテンシ: 20ms以下")
        else:
            print("⚠ 注意: GETレイテンシが高い（20ms超）")
        
        # エラー率の評価
        if summary["error_rate"] <= 0.1:
            print("⭐ 優れた安定性: エラー率0.1%以下")
        elif summary["error_rate"] <= 1.0:
            print("👍 良好な安定性: エラー率1%以下")
        elif summary["error_rate"] <= 5.0:
            print("✓ 普通の安定性: エラー率5%以下")
        else:
            print("⚠ 注意: エラー率が高い（5%超）")
        
        # ヒット率の評価
        if "hit_rate_after" in summary and summary["hit_rate_after"] >= 80:
            print("⭐ 優れたヒット率: 80%以上")
        elif "hit_rate_after" in summary and summary["hit_rate_after"] >= 60:
            print("👍 良好なヒット率: 60%以上")
        elif "hit_rate_after" in summary and summary["hit_rate_after"] >= 40:
            print("✓ 普通のヒット率: 40%以上")
        elif "hit_rate_after" in summary:
            print("⚠ 注意: ヒット率が低い（40%未満）")
        
        # 総合評価
        score_components = []
        
        # スループットスコア（0-100）
        throughput_score = min(100, summary["operations_per_second"] / 10)
        score_components.append(throughput_score)
        
        # レイテンシスコア（0-100）
        if summary["avg_get_time_ms"] > 0:
            latency_score = min(100, 100 / summary["avg_get_time_ms"])
        else:
            latency_score = 100
        score_components.append(latency_score)
        
        # 安定性スコア（0-100）
        stability_score = 100 - min(100, summary["error_rate"] * 10)
        score_components.append(stability_score)
        
        # ヒット率スコア（0-100）
        if "hit_rate_after" in summary:
            hit_rate_score = summary["hit_rate_after"]
            score_components.append(hit_rate_score)
        
        # 総合スコアの計算
        if score_components:
            overall_score = sum(score_components) / len(score_components)
            summary["overall_score"] = overall_score
            
            # 定性的評価
            if overall_score >= 90:
                summary["rating"] = "優秀"
            elif overall_score >= 75:
                summary["rating"] = "良好"
            elif overall_score >= 60:
                summary["rating"] = "普通"
            else:
                summary["rating"] = "要改善"
            
            print(f"\n総合スコア: {overall_score:.2f}/100 ({summary['rating']})")
        
        # サマリーを結果に保存
        self.results["summary"] = summary
    
    def save_results(self):
        """テスト結果をファイルに保存"""
        print_section("結果の保存")
        
        # JSON形式で保存
        filename = f"loadtest_results_{self.timestamp}.json"
        filepath = os.path.join(LOAD_TEST_DIR, filename)
        
        with open(filepath, "w") as f:
            json.dump(self.results, f, indent=2)
        
        print(f"テスト結果をJSONで保存しました: {filepath}")
        
        # Markdown形式でも保存
        md_filename = f"loadtest_results_{self.timestamp}.md"
        md_filepath = os.path.join(LOAD_TEST_DIR, md_filename)
        
        with open(md_filepath, "w") as f:
            f.write(self.generate_markdown_report())
        
        print(f"テスト結果をMarkdownで保存しました: {md_filepath}")
        
        return filepath, md_filepath
    
    def generate_markdown_report(self):
        """Markdownレポートを生成"""
        summary = self.results["summary"]
        
        md = []
        md.append("# OptimizedCacheManager 負荷テストレポート")
        md.append("")
        md.append(f"実行日時: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        md.append(f"テストID: {self.results['test_id']}")
        md.append("")
        
        # テスト設定
        md.append("## テスト設定")
        md.append("")
        md.append(f"- API URL: {self.config.get('api_url', 'http://localhost:8000')}")
        md.append(f"- ワーカー数: {self.config.get('workers', 4)}")
        md.append(f"- テスト期間: {self.config.get('duration', 60)}秒")
        md.append(f"- 操作/秒/ワーカー: {self.config.get('operations_per_second', 10)}")
        md.append(f"- データサイズ範囲: {self.config.get('data_size_min', 100)} - {self.config.get('data_size_max', 10000)}バイト")
        md.append(f"- TTL: {self.config.get('ttl', 60)}秒")
        
        # 操作ウェイト
        op_weights = self.config.get('operation_weights', {'set': 0.3, 'get': 0.6, 'invalidate': 0.1})
        md.append(f"- 操作分布: SET {op_weights.get('set', 0.3) * 100}%, GET {op_weights.get('get', 0.6) * 100}%, INVALIDATE {op_weights.get('invalidate', 0.1) * 100}%")
        md.append("")
        
        # 結果サマリー
        md.append("## 結果サマリー")
        md.append("")
        if "overall_score" in summary:
            md.append(f"**総合スコア: {summary['overall_score']:.2f}/100 ({summary['rating']})**")
            md.append("")
        
        # 操作統計
        md.append("### 操作統計")
        md.append("")
        md.append(f"- 総操作数: {summary['total_operations']}")
        md.append(f"- 成功操作数: {summary['total_successes']}")
        md.append(f"- 失敗操作数: {summary['total_failures']}")
        md.append(f"- 成功率: {summary['success_rate']:.2f}%")
        md.append(f"- 1秒あたりの操作数: {summary['operations_per_second']:.2f}")
        md.append("")
        
        # レイテンシ統計
        md.append("### レイテンシ統計")
        md.append("")
        md.append("| 操作 | 平均 (ms) | P95 (ms) |")
        md.append("|------|-----------|----------|")
        md.append(f"| SET | {summary['avg_set_time_ms']:.3f} | {summary['p95_set_time_ms']:.3f} |")
        md.append(f"| GET | {summary['avg_get_time_ms']:.3f} | {summary['p95_get_time_ms']:.3f} |")
        md.append(f"| INVALIDATE | {summary['avg_invalidate_time_ms']:.3f} | {summary['p95_invalidate_time_ms']:.3f} |")
        md.append("")
        
        # メモリとヒット率の変化
        if "memory_usage_change_mb" in summary or "hit_rate_change" in summary:
            md.append("### キャッシュの状態変化")
            md.append("")
            
            if "memory_usage_change_mb" in summary:
                md.append(f"- メモリ使用量: {summary['memory_usage_before_mb']:.2f} MB → {summary['memory_usage_after_mb']:.2f} MB ({summary['memory_usage_change_percent']:+.2f}%)")
            
            if "hit_rate_change" in summary:
                md.append(f"- ヒット率: {summary['hit_rate_before']:.2f}% → {summary['hit_rate_after']:.2f}% ({summary['hit_rate_change']:+.2f}%)")
            
            md.append("")
        
        # エラー統計
        if "error_summary" in summary and summary["error_summary"]:
            md.append("### エラー統計")
            md.append("")
            md.append(f"- エラー率: {summary['error_rate']:.2f}%")
            md.append("- 主なエラー:")
            
            for error, count in sorted(summary["error_summary"].items(), key=lambda x: x[1], reverse=True)[:5]:
                md.append(f"  - {error}: {count}回")
            
            md.append("")
        
        # パフォーマンス評価
        md.append("### パフォーマンス評価")
        md.append("")
        
        # スループット評価
        if summary["operations_per_second"] >= 1000:
            md.append("- ⭐ **優れたスループット**: 毎秒1000操作以上")
        elif summary["operations_per_second"] >= 500:
            md.append("- 👍 **良好なスループット**: 毎秒500操作以上")
        elif summary["operations_per_second"] >= 100:
            md.append("- ✓ **普通のスループット**: 毎秒100操作以上")
        else:
            md.append("- ⚠ **注意**: スループットが低い（毎秒100操作未満）")
        
        # レイテンシ評価
        if summary["avg_get_time_ms"] <= 1.0:
            md.append("- ⭐ **優れたGETレイテンシ**: 1ms以下")
        elif summary["avg_get_time_ms"] <= 5.0:
            md.append("- 👍 **良好なGETレイテンシ**: 5ms以下")
        elif summary["avg_get_time_ms"] <= 20.0:
            md.append("- ✓ **普通のGETレイテンシ**: 20ms以下")
        else:
            md.append("- ⚠ **注意**: GETレイテンシが高い（20ms超）")
        
        # エラー率評価
        if summary["error_rate"] <= 0.1:
            md.append("- ⭐ **優れた安定性**: エラー率0.1%以下")
        elif summary["error_rate"] <= 1.0:
            md.append("- 👍 **良好な安定性**: エラー率1%以下")
        elif summary["error_rate"] <= 5.0:
            md.append("- ✓ **普通の安定性**: エラー率5%以下")
        else:
            md.append("- ⚠ **注意**: エラー率が高い（5%超）")
        
        # ヒット率評価
        if "hit_rate_after" in summary:
            if summary["hit_rate_after"] >= 80:
                md.append("- ⭐ **優れたヒット率**: 80%以上")
            elif summary["hit_rate_after"] >= 60:
                md.append("- 👍 **良好なヒット率**: 60%以上")
            elif summary["hit_rate_after"] >= 40:
                md.append("- ✓ **普通のヒット率**: 40%以上")
            else:
                md.append("- ⚠ **注意**: ヒット率が低い（40%未満）")
        
        md.append("")
        
        # グラフ参照
        md.append("## パフォーマンスグラフ")
        md.append("")
        md.append("以下のグラフが生成されました:")
        md.append("")
        md.append(f"- [操作レート](./loadtest_graphs_{self.timestamp}/operation_rate.png)")
        md.append(f"- [レイテンシ分布](./loadtest_graphs_{self.timestamp}/latency_distribution.png)")
        md.append(f"- [累積操作数](./loadtest_graphs_{self.timestamp}/cumulative_operations.png)")
        md.append(f"- [状態変化](./loadtest_graphs_{self.timestamp}/cache_state_change.png)")
        md.append("")
        
        return "\n".join(md)
    
    def generate_graphs(self):
        """結果に基づいてグラフを生成"""
        print_section("グラフの生成")
        
        # グラフ保存ディレクトリ
        graphs_dir = os.path.join(LOAD_TEST_DIR, f"loadtest_graphs_{self.timestamp}")
        os.makedirs(graphs_dir, exist_ok=True)
        
        # 1. 操作レートのグラフ
        self._generate_operation_rate_graph(graphs_dir)
        
        # 2. レイテンシ分布のグラフ
        self._generate_latency_distribution_graph(graphs_dir)
        
        # 3. 累積操作数のグラフ
        self._generate_cumulative_operations_graph(graphs_dir)
        
        # 4. キャッシュ状態変化のグラフ
        self._generate_cache_state_change_graph(graphs_dir)
        
        print(f"グラフを保存しました: {graphs_dir}")
        return graphs_dir
    
    def _generate_operation_rate_graph(self, graphs_dir):
        """操作レートのグラフを生成"""
        summary = self.results["summary"]
        worker_results = self.results["worker_results"]
        
        if not worker_results:
            return
        
        plt.figure(figsize=(10, 6))
        
        # ワーカーごとの操作レート
        worker_ids = []
        ops_per_sec = []
        
        for result in worker_results:
            worker_id = result.get("worker_id", "unknown")
            operations = result.get("operations", 0)
            duration = result.get("duration", 1)  # 0除算防止
            
            rate = operations / duration
            
            worker_ids.append(f"Worker {worker_id}")
            ops_per_sec.append(rate)
        
        # 全体の操作レート
        worker_ids.append("全体")
        ops_per_sec.append(summary.get("operations_per_second", 0))
        
        # グラフの描画
        plt.bar(worker_ids, ops_per_sec, color='skyblue')
        plt.axhline(y=summary.get("operations_per_second", 0), color='r', linestyle='--', label='平均')
        
        plt.xlabel('ワーカー')
        plt.ylabel('操作/秒')
        plt.title('ワーカーごとの操作レート')
        plt.legend()
        plt.grid(axis='y', linestyle='--', alpha=0.7)
        
        # Y軸の最大値を調整
        plt.ylim(0, max(ops_per_sec) * 1.1)
        
        # 値のラベルを追加
        for i, v in enumerate(ops_per_sec):
            plt.text(i, v + max(ops_per_sec) * 0.02, f'{v:.1f}', ha='center')
        
        plt.tight_layout()
        plt.savefig(os.path.join(graphs_dir, "operation_rate.png"))
        plt.close()
    
    def _generate_latency_distribution_graph(self, graphs_dir):
        """レイテンシ分布のグラフを生成"""
        worker_results = self.results["worker_results"]
        
        if not worker_results:
            return
        
        # すべてのワーカーから操作時間を収集
        all_set_times = []
        all_get_times = []
        all_invalidate_times = []
        
        for result in worker_results:
            all_set_times.extend(result.get("set_times", []))
            all_get_times.extend(result.get("get_times", []))
            all_invalidate_times.extend(result.get("invalidate_times", []))
        
        plt.figure(figsize=(10, 6))
        
        # ヒストグラムの描画
        if all_set_times:
            plt.hist(all_set_times, bins=30, alpha=0.5, label='SET', color='blue')
        
        if all_get_times:
            plt.hist(all_get_times, bins=30, alpha=0.5, label='GET', color='green')
        
        if all_invalidate_times:
            plt.hist(all_invalidate_times, bins=30, alpha=0.5, label='INVALIDATE', color='red')
        
        plt.xlabel('レイテンシ (ms)')
        plt.ylabel('頻度')
        plt.title('操作別レイテンシ分布')
        plt.legend()
        plt.grid(linestyle='--', alpha=0.7)
        
        # X軸の範囲を調整（外れ値を除外）
        max_times = []
        if all_set_times:
            max_times.append(np.percentile(all_set_times, 99))
        if all_get_times:
            max_times.append(np.percentile(all_get_times, 99))
        if all_invalidate_times:
            max_times.append(np.percentile(all_invalidate_times, 99))
        
        if max_times:
            plt.xlim(0, max(max_times) * 1.1)
        
        plt.tight_layout()
        plt.savefig(os.path.join(graphs_dir, "latency_distribution.png"))
        plt.close()
    
    def _generate_cumulative_operations_graph(self, graphs_dir):
        """累積操作数のグラフを生成"""
        summary = self.results["summary"]
        
        plt.figure(figsize=(10, 6))
        
        # 操作総数
        total_ops = summary.get("total_operations", 0)
        success_ops = summary.get("total_successes", 0)
        failure_ops = summary.get("total_failures", 0)
        
        # 操作タイプの内訳を推定（正確な数字がなければ推定）
        operation_weights = self.config.get('operation_weights', {'set': 0.3, 'get': 0.6, 'invalidate': 0.1})
        set_ops = int(total_ops * operation_weights.get('set', 0.3))
        get_ops = int(total_ops * operation_weights.get('get', 0.6))
        invalidate_ops = total_ops - set_ops - get_ops
        
        # 左側のグラフ：操作タイプの内訳
        plt.subplot(1, 2, 1)
        labels = ['SET', 'GET', 'INVALIDATE']
        sizes = [set_ops, get_ops, invalidate_ops]
        colors = ['#66b3ff', '#99ff99', '#ffcc99']
        
        plt.pie(sizes, labels=labels, colors=colors, autopct='%1.1f%%', startangle=90)
        plt.axis('equal')
        plt.title('操作タイプの分布')
        
        # 右側のグラフ：成功・失敗の内訳
        plt.subplot(1, 2, 2)
        labels = ['成功', '失敗']
        sizes = [success_ops, failure_ops]
        colors = ['#66b3ff', '#ff9999']
        
        plt.pie(sizes, labels=labels, colors=colors, autopct='%1.1f%%', startangle=90)
        plt.axis('equal')
        plt.title('操作結果の分布')
        
        plt.suptitle('累積操作統計')
        plt.tight_layout()
        plt.savefig(os.path.join(graphs_dir, "cumulative_operations.png"))
        plt.close()
    
    def _generate_cache_state_change_graph(self, graphs_dir):
        """キャッシュ状態変化のグラフを生成"""
        summary = self.results["summary"]
        
        # 'before_stats'と'after_stats'がない場合はスキップ
        if "memory_usage_before_mb" not in summary or "hit_rate_before" not in summary:
            return
        
        plt.figure(figsize=(12, 5))
        
        # メモリ使用量の変化
        plt.subplot(1, 2, 1)
        memory_before = summary.get("memory_usage_before_mb", 0)
        memory_after = summary.get("memory_usage_after_mb", 0)
        
        plt.bar(['テスト前', 'テスト後'], [memory_before, memory_after], color=['lightblue', 'blue'])
        plt.ylabel('メモリ使用量 (MB)')
        plt.title('メモリ使用量の変化')
        plt.grid(axis='y', linestyle='--', alpha=0.7)
        
        # 値のラベルを追加
        plt.text(0, memory_before, f'{memory_before:.2f}', ha='center', va='bottom')
        plt.text(1, memory_after, f'{memory_after:.2f}', ha='center', va='bottom')
        
        # メモリ変化率を表示
        memory_change_pct = summary.get("memory_usage_change_percent", 0)
        plt.figtext(0.3, 0.01, f'変化率: {memory_change_pct:+.2f}%', ha='center')
        
        # ヒット率の変化
        plt.subplot(1, 2, 2)
        hit_rate_before = summary.get("hit_rate_before", 0)
        hit_rate_after = summary.get("hit_rate_after", 0)
        
        plt.bar(['テスト前', 'テスト後'], [hit_rate_before, hit_rate_after], color=['lightgreen', 'green'])
        plt.ylabel('ヒット率 (%)')
        plt.title('ヒット率の変化')
        plt.grid(axis='y', linestyle='--', alpha=0.7)
        
        # Y軸を0-100に設定
        plt.ylim(0, 100)
        
        # 値のラベルを追加
        plt.text(0, hit_rate_before, f'{hit_rate_before:.2f}', ha='center', va='bottom')
        plt.text(1, hit_rate_after, f'{hit_rate_after:.2f}', ha='center', va='bottom')
        
        # ヒット率変化を表示
        hit_rate_change = summary.get("hit_rate_change", 0)
        plt.figtext(0.7, 0.01, f'変化率: {hit_rate_change:+.2f}%', ha='center')
        
        plt.tight_layout()
        plt.savefig(os.path.join(graphs_dir, "cache_state_change.png"))
        plt.close()

def main():
    parser = argparse.ArgumentParser(description="OptimizedCacheManagerの負荷テスト")
    parser.add_argument("--url", type=str, default="http://localhost:8000", help="キャッシュAPIのURL (デフォルト: http://localhost:8000)")
    parser.add_argument("--workers", type=int, default=4, help="並列ワーカーの数 (デフォルト: 4)")
    parser.add_argument("--duration", type=int, default=60, help="テスト期間（秒） (デフォルト: 60)")
    parser.add_argument("--ops-per-sec", type=int, default=10, help="1秒あたりの操作数/ワーカー (デフォルト: 10)")
    parser.add_argument("--min-size", type=int, default=100, help="最小データサイズ（バイト） (デフォルト: 100)")
    parser.add_argument("--max-size", type=int, default=10000, help="最大データサイズ（バイト） (デフォルト: 10000)")
    parser.add_argument("--ttl", type=int, default=60, help="TTL（秒） (デフォルト: 60)")
    parser.add_argument("--set-weight", type=float, default=0.3, help="SET操作の比率 (デフォルト: 0.3)")
    parser.add_argument("--get-weight", type=float, default=0.6, help="GET操作の比率 (デフォルト: 0.6)")
    parser.add_argument("--invalidate-weight", type=float, default=0.1, help="INVALIDATE操作の比率 (デフォルト: 0.1)")
    parser.add_argument("--test-id", type=str, help="テストの一意識別子")
    
    args = parser.parse_args()
    
    # 操作ウェイトの正規化
    total_weight = args.set_weight + args.get_weight + args.invalidate_weight
    set_weight = args.set_weight / total_weight
    get_weight = args.get_weight / total_weight
    invalidate_weight = args.invalidate_weight / total_weight
    
    # テスト設定
    config = {
        "api_url": args.url,
        "workers": args.workers,
        "duration": args.duration,
        "operations_per_second": args.ops_per_sec,
        "data_size_min": args.min_size,
        "data_size_max": args.max_size,
        "ttl": args.ttl,
        "operation_weights": {
            "set": set_weight,
            "get": get_weight,
            "invalidate": invalidate_weight
        },
        "test_id": args.test_id
    }
    
    # 負荷テスト実行
    tester = LoadTester(config)
    success = tester.run_test()
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()