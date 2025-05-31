#!/usr/bin/env python3
"""
OptimizedCacheManager - メトリクス収集前準備スクリプト
目的：メトリクス収集のための依存関係インストールとパッチを適用する
"""
import os
import sys
import subprocess
import argparse
import shutil
from pathlib import Path

def print_section(title):
    """セクションタイトルを表示"""
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)

def install_dependencies():
    """メトリクス収集に必要な依存関係をインストール"""
    print_section("依存関係のインストール")
    
    requirements = [
        "prometheus-client>=0.15.0",
        "psutil>=5.9.0",
        "redis>=4.3.0"
    ]
    
    # requirements.txtに既存の依存関係がある場合は追加
    req_file = Path(PROJECT_ROOT) / "requirements.txt"
    if req_file.exists():
        with open(req_file, "r") as f:
            existing_reqs = f.read()
        
        # 既存の依存関係をチェック
        missing_reqs = []
        for req in requirements:
            package_name = req.split(">=")[0]
            if package_name not in existing_reqs:
                missing_reqs.append(req)
        
        # 不足している依存関係を追加
        if missing_reqs:
            print(f"requirements.txtに以下の依存関係を追加: {', '.join(missing_reqs)}")
            with open(req_file, "a") as f:
                f.write("\n# OptimizedCacheManager モニタリング用依存関係\n")
                for req in missing_reqs:
                    f.write(f"{req}\n")
    else:
        print("requirements.txtが見つかりません。新規作成します。")
        with open(req_file, "w") as f:
            f.write("# OptimizedCacheManager モニタリング用依存関係\n")
            for req in requirements:
                f.write(f"{req}\n")
    
    # pipでインストール
    try:
        print("依存関係をインストール中...")
        subprocess.run([sys.executable, "-m", "pip", "install"] + requirements, check=True)
        print("依存関係のインストールが完了しました。")
    except subprocess.CalledProcessError as e:
        print(f"エラー: 依存関係のインストールに失敗しました。\n{e}")
        sys.exit(1)

def generate_test_data():
    """モニタリングテスト用のサンプルデータを生成"""
    print_section("テストデータの生成")
    
    test_data_path = Path(SCRIPTS_DIR) / "test_data.py"
    
    test_data_content = """
#!/usr/bin/env python3
\"\"\"
OptimizedCacheManager - モニタリングテスト用のサンプルデータ生成
\"\"\"
import time
import random
import json
import threading
from datetime import datetime

# 疑似的なキャッシュマネージャークラス（テスト用）
class MockOptimizedCacheManager:
    def __init__(self):
        self.VERSION = "1.0.0"
        self.redis_enabled = True
        self.compression_enabled = True
        self.memory_limit = 256 * 1024 * 1024  # 256MB
        self._hits = 0
        self._misses = 0
        self._memory_usage = 0
        self._last_update = time.time()
        self._update_thread = threading.Thread(target=self._update_stats)
        self._update_thread.daemon = True
        self._update_thread.start()
    
    def _update_stats(self):
        """定期的にランダムな統計情報を更新"""
        while True:
            # キャッシュヒット/ミスの更新
            hit_rate = random.uniform(0.6, 0.95)  # 60-95%のヒット率
            new_ops = random.randint(10, 100)
            new_hits = int(new_ops * hit_rate)
            
            # メモリ使用量の変化（±5％）
            memory_change = random.uniform(-0.05, 0.05)
            target_memory_pct = min(0.85, max(0.1, self._memory_usage / self.memory_limit + memory_change))
            
            self._hits += new_hits
            self._misses += (new_ops - new_hits)
            self._memory_usage = target_memory_pct * self.memory_limit
            
            time.sleep(5)  # 5秒ごとに更新
    
    def get_hit_rate(self):
        """キャッシュヒット率を取得"""
        total = self._hits + self._misses
        if total == 0:
            return 0.0
        return self._hits / total
    
    def get_memory_usage(self):
        """メモリ使用量を取得"""
        return self._memory_usage
    
    def get_performance_stats(self):
        """パフォーマンス統計情報を取得"""
        return {
            'avg_cached_time_ms': random.uniform(10, 50),
            'avg_uncached_time_ms': random.uniform(200, 800),
            'requests_per_minute': random.randint(100, 1000)
        }
    
    # Redis関連のモック
    @property
    def redis_client(self):
        class MockRedis:
            def __init__(self):
                self._memory_used = random.randint(100, 500) * 1024 * 1024  # 100-500MB
                self._max_memory = 1024 * 1024 * 1024  # 1GB
                self._clients = random.randint(5, 20)
            
            def info(self, section=None):
                if section == 'memory':
                    return {
                        'used_memory': self._memory_used,
                        'maxmemory': self._max_memory
                    }
                elif section == 'clients':
                    return {
                        'connected_clients': self._clients
                    }
                return {}
        
        return MockRedis()

def run_test(duration=60):
    \"\"\"
    テストデータを指定された時間生成してモニタリング
    
    Args:
        duration: テスト実行時間（秒）
    \"\"\"
    try:
        # Prometheus関連モジュールのインポート
        from prometheus_client import start_http_server, Gauge, Counter
        
        # モックキャッシュマネージャーの作成
        mock_cache = MockOptimizedCacheManager()
        
        # Prometheusメトリクス
        hit_rate = Gauge('cache_hit_rate', 'キャッシュヒット率（%）')
        memory_usage = Gauge('cache_memory_usage', 'メモリキャッシュ使用量（MB）')
        memory_limit = Gauge('cache_memory_limit', 'メモリキャッシュ上限（MB）')
        redis_memory_used = Gauge('redis_memory_used', 'Redis使用メモリ（MB）')
        redis_memory_limit = Gauge('redis_memory_limit', 'Redis最大メモリ（MB）')
        redis_connections = Gauge('redis_connections', 'Redis接続数')
        operations = Counter('cache_operations_total', 'キャッシュ操作数', ['operation'])
        errors = Counter('cache_error_count', 'キャッシュエラー数')
        cache_time = Gauge('cache_response_time', 'キャッシュ使用時のレスポンス時間（ms）')
        uncached_time = Gauge('uncached_response_time', 'キャッシュなしのレスポンス時間（ms）')
        
        # 初期値を設定
        memory_limit.set(mock_cache.memory_limit / (1024 * 1024))
        
        # HTTPサーバー開始
        start_http_server(8000)
        print(f"Prometheusメトリクスサーバーを開始しました - http://localhost:8000/metrics")
        
        start_time = time.time()
        last_op_time = start_time
        
        print(f"テストデータを{duration}秒間生成します。Ctrl+Cで終了できます。")
        
        while time.time() - start_time < duration:
            # 5秒ごとにメトリクスを更新
            if time.time() - last_op_time >= 5:
                # ヒット率の更新
                hit_rate.set(mock_cache.get_hit_rate() * 100)
                
                # メモリ使用量の更新
                memory_usage.set(mock_cache.get_memory_usage() / (1024 * 1024))
                
                # Redis情報の更新
                redis_info = mock_cache.redis_client.info('memory')
                redis_memory_used.set(redis_info.get('used_memory', 0) / (1024 * 1024))
                redis_memory_limit.set(redis_info.get('maxmemory', 0) / (1024 * 1024))
                
                clients_info = mock_cache.redis_client.info('clients')
                redis_connections.set(clients_info.get('connected_clients', 0))
                
                # パフォーマンス統計
                stats = mock_cache.get_performance_stats()
                cache_time.set(stats.get('avg_cached_time_ms', 0))
                uncached_time.set(stats.get('avg_uncached_time_ms', 0))
                
                # キャッシュ操作をシミュレート
                get_ops = random.randint(50, 200)
                set_ops = random.randint(10, 50)
                inv_ops = random.randint(1, 10)
                
                operations.labels(operation='get').inc(get_ops)
                operations.labels(operation='set').inc(set_ops)
                operations.labels(operation='invalidate').inc(inv_ops)
                
                # 時々エラーを発生させる
                if random.random() < 0.1:  # 10%の確率
                    errors.inc(random.randint(1, 3))
                
                last_op_time = time.time()
                
                # 進捗表示
                elapsed = int(time.time() - start_time)
                remaining = max(0, duration - elapsed)
                print(f"\\r残り時間: {remaining}秒 | ヒット率: {mock_cache.get_hit_rate()*100:.1f}% | "
                      f"メモリ: {mock_cache.get_memory_usage()/(1024*1024):.1f}MB", end="")
            
            time.sleep(1)
        
        print("\\nテストデータの生成が完了しました。")
    
    except KeyboardInterrupt:
        print("\\nテストデータの生成を中止しました。")
    except ImportError as e:
        print(f"エラー: 必要なモジュールがインストールされていません。\\n{e}")
        print("最初に依存関係をインストールしてください。")
    except Exception as e:
        print(f"エラー: テスト実行中に問題が発生しました。\\n{e}")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='OptimizedCacheManagerモニタリングテスト')
    parser.add_argument('--duration', type=int, default=300,
                        help='テスト実行時間（秒）、デフォルト: 300秒（5分）')
    
    args = parser.parse_args()
    run_test(duration=args.duration)
"""
    
    with open(test_data_path, "w") as f:
        f.write(test_data_content.strip())
    
    # 実行権限を付与
    os.chmod(test_data_path, 0o755)
    
    print(f"テストデータ生成スクリプトを作成しました: {test_data_path}")
    print("以下のコマンドで実行できます:")
    print(f"python3 {test_data_path} --duration 300")

def add_metrics_integration():
    """OptimizedCacheManagerにメトリクス収集機能を追加"""
    print_section("メトリクス統合機能の追加")
    
    optimized_cache_path = Path(PROJECT_ROOT) / "src" / "api" / "shopify" / "optimized_cache_manager.py"
    
    if not optimized_cache_path.exists():
        print(f"警告: {optimized_cache_path} が見つかりません。メトリクス統合はスキップします。")
        return
    
    # バックアップ作成
    backup_path = optimized_cache_path.with_suffix(".py.bak")
    print(f"既存ファイルのバックアップを作成: {backup_path}")
    shutil.copy2(optimized_cache_path, backup_path)
    
    # ファイル内容を読み込み
    with open(optimized_cache_path, "r") as f:
        content = f.read()
    
    # メトリクス機能が既に統合されているか確認
    if "performance_stats" in content and "CacheMetricsExporter" in content:
        print("メトリクス機能が既に統合されています。スキップします。")
        return
    
    # インポート文の追加
    import_section = """import time
import threading
from typing import Dict, Any, Optional, List, Tuple, Union, Set
"""
    
    metrics_import = """# モニタリング用インポート
from prometheus_client import Gauge, Counter, Info
import psutil
"""
    
    # インポート文を追加
    if import_section in content:
        content = content.replace(import_section, import_section + metrics_import)
    else:
        # 最初のimport行の後に追加
        import_lines = [line for line in content.split("\n") if line.startswith("import ")]
        if import_lines:
            last_import = import_lines[-1]
            content = content.replace(last_import, last_import + "\n" + metrics_import)
        else:
            # importがない場合は先頭に追加
            content = metrics_import + "\n" + content
    
    # OptimizedCacheManagerクラス定義を探す
    class_def = "class OptimizedCacheManager:"
    if class_def in content:
        # __init__メソッドにメトリクス初期化コードを追加
        init_str = "    def __init__(self"
        metrics_init = """
        # パフォーマンス統計情報の追跡
        self._performance_stats = {
            'hits': 0,
            'misses': 0,
            'total_cached_time': 0,
            'total_uncached_time': 0,
            'cached_requests': 0,
            'uncached_requests': 0
        }
        
        # メトリクス設定
        if hasattr(self, 'enable_metrics') and self.enable_metrics:
            self._setup_metrics()
        """
        
        if init_str in content:
            # __init__の最後に追加
            init_end = "        self._refresh_cache_lock = threading.RLock()"
            if init_end in content:
                content = content.replace(init_end, init_end + metrics_init)
            else:
                # 特定の行が見つからない場合はコンストラクタの最後に追加
                # このケースはファイル構造が変わっている場合
                parts = content.split(init_str)
                if len(parts) > 1:
                    init_part = parts[1]
                    method_end = init_part.find("\n    def ")
                    if method_end > 0:
                        init_body = init_part[:method_end]
                        content = content.replace(init_str + init_body, 
                                                  init_str + init_body + metrics_init)
        
        # メトリクスセットアップメソッドを追加
        setup_metrics_method = """
    def _setup_metrics(self):
        """メトリクス収集の設定"""
        # Gaugeメトリクス
        self._metric_hit_rate = Gauge('cache_hit_rate', 'キャッシュヒット率（%）')
        self._metric_memory_usage = Gauge('cache_memory_usage', 'メモリキャッシュ使用量（MB）')
        self._metric_memory_limit = Gauge('cache_memory_limit', 'メモリキャッシュ上限（MB）')
        self._metric_cache_time = Gauge('cache_response_time', 'キャッシュ使用時のレスポンス時間（ms）')
        self._metric_uncached_time = Gauge('uncached_response_time', 'キャッシュなしのレスポンス時間（ms）')
        
        # Redisメトリクス
        if self.redis_enabled:
            self._metric_redis_memory_used = Gauge('redis_memory_used', 'Redis使用メモリ（MB）')
            self._metric_redis_memory_limit = Gauge('redis_memory_limit', 'Redis最大メモリ（MB）')
            self._metric_redis_connections = Gauge('redis_connections', 'Redis接続数')
        
        # 操作カウンター
        self._metric_operations = Counter('cache_operations_total', 'キャッシュ操作数', ['operation'])
        self._metric_error_count = Counter('cache_error_count', 'キャッシュエラー数')
        
        # キャッシュ情報
        self._metric_cache_info = Info('cache_info', 'キャッシュ設定情報')
        self._metric_cache_info.info({
            'version': self.VERSION if hasattr(self, 'VERSION') else 'unknown',
            'redis_enabled': str(self.redis_enabled),
            'compression_enabled': str(self.compression_enabled)
        })
        
        # メモリ上限を設定
        self._metric_memory_limit.set(self.memory_limit / (1024 * 1024))
        
        # 定期的なメトリクス更新スレッド
        self._metrics_thread = threading.Thread(target=self._update_metrics_loop, daemon=True)
        self._metrics_thread.start()
    
    def _update_metrics_loop(self):
        """定期的にメトリクスを更新するループ"""
        while True:
            try:
                # ヒット率の更新
                hit_rate = self.get_hit_rate() * 100  # パーセント表示
                self._metric_hit_rate.set(hit_rate)
                
                # メモリ使用量の更新
                memory_usage = self.get_memory_usage() / (1024 * 1024)  # MBに変換
                self._metric_memory_usage.set(memory_usage)
                
                # レスポンス時間の更新
                stats = self.get_performance_stats()
                if stats:
                    self._metric_cache_time.set(stats.get('avg_cached_time_ms', 0))
                    self._metric_uncached_time.set(stats.get('avg_uncached_time_ms', 0))
                
                # Redis情報の更新
                if self.redis_enabled and hasattr(self, 'redis_client') and self.redis_client:
                    try:
                        redis_info = self.redis_client.info('memory')
                        self._metric_redis_memory_used.set(redis_info.get('used_memory', 0) / (1024 * 1024))
                        self._metric_redis_memory_limit.set(redis_info.get('maxmemory', 0) / (1024 * 1024))
                        
                        clients_info = self.redis_client.info('clients')
                        self._metric_redis_connections.set(clients_info.get('connected_clients', 0))
                    except Exception as e:
                        self._metric_error_count.inc()
                        print(f"Redis情報の取得中にエラーが発生: {e}")
            except Exception as e:
                print(f"メトリクス更新中にエラーが発生: {e}")
            
            # 15秒間隔で更新
            time.sleep(15)
    
    def get_hit_rate(self) -> float:
        """キャッシュヒット率を取得
        
        Returns:
            float: 0.0〜1.0のヒット率
        """
        hits = self._performance_stats.get('hits', 0)
        misses = self._performance_stats.get('misses', 0)
        total = hits + misses
        
        if total == 0:
            return 0.0
        
        return hits / total
    
    def get_memory_usage(self) -> int:
        """キャッシュの現在のメモリ使用量を取得
        
        Returns:
            int: バイト単位のメモリ使用量
        """
        # 概算メモリ使用量を計算
        total_size = 0
        
        # メモリキャッシュのサイズを計算
        if hasattr(self, '_cache'):
            for key, value in self._cache.items():
                # キーのサイズ
                key_size = len(key) if isinstance(key, str) else 50  # 非文字列キーの場合は概算
                
                # 値のサイズ（サイズ属性がある場合はそれを使用）
                if hasattr(value, 'size'):
                    value_size = value.size
                else:
                    # CacheValueインスタンスの場合
                    if hasattr(value, 'data'):
                        if isinstance(value.data, str):
                            value_size = len(value.data) * 2  # Unicode文字列の概算
                        elif isinstance(value.data, (bytes, bytearray)):
                            value_size = len(value.data)
                        elif isinstance(value.data, (dict, list)):
                            # dictとlistのサイズ概算
                            value_size = len(str(value.data)) * 2
                        else:
                            value_size = 100  # その他のオブジェクトは固定サイズと仮定
                    else:
                        value_size = 100
                
                total_size += key_size + value_size
        
        # プロセスのメモリ使用量も参考に
        process = psutil.Process()
        process_memory = process.memory_info().rss  # Resident Set Size
        
        # 注：実際のメモリ使用量はプロセス全体のものなので、
        # キャッシュだけの使用量は正確には計測できないことに注意
        
        return total_size
    
    def get_performance_stats(self) -> Dict[str, float]:
        """キャッシュパフォーマンス統計情報を取得
        
        Returns:
            Dict[str, float]: パフォーマンス統計情報
        """
        stats = {}
        
        # キャッシュありの平均レスポンス時間
        cached_requests = self._performance_stats.get('cached_requests', 0)
        if cached_requests > 0:
            avg_cached_time = self._performance_stats.get('total_cached_time', 0) / cached_requests
            stats['avg_cached_time_ms'] = avg_cached_time * 1000  # 秒からミリ秒に変換
        
        # キャッシュなしの平均レスポンス時間
        uncached_requests = self._performance_stats.get('uncached_requests', 0)
        if uncached_requests > 0:
            avg_uncached_time = self._performance_stats.get('total_uncached_time', 0) / uncached_requests
            stats['avg_uncached_time_ms'] = avg_uncached_time * 1000  # 秒からミリ秒に変換
        
        # 1分あたりのリクエスト数
        total_requests = cached_requests + uncached_requests
        stats['requests_per_minute'] = total_requests  # 累積値、正確なRPMではない
        
        return stats
    """
        
        # get/setメソッドを修正してメトリクスを記録
        get_method = "    def get(self, key: str, default=None):"
        get_method_modification = """
        start_time = time.time()
        
        # キャッシュから値を取得
        result = self._get_from_memory(key)
        
        # メモリキャッシュにヒット
        if result is not None:
            # パフォーマンス統計を更新
            self._performance_stats['hits'] = self._performance_stats.get('hits', 0) + 1
            self._performance_stats['total_cached_time'] = self._performance_stats.get('total_cached_time', 0) + (time.time() - start_time)
            self._performance_stats['cached_requests'] = self._performance_stats.get('cached_requests', 0) + 1
            
            # メトリクスを記録（設定されている場合）
            if hasattr(self, '_metric_operations'):
                self._metric_operations.labels(operation='get').inc()
            
            return result
        
        # Redisキャッシュから取得を試みる
        if self.redis_enabled:
            try:
                result = self._get_from_redis(key)
                if result is not None:
                    # メモリキャッシュに保存
                    self._set_in_memory(key, result)
                    
                    # パフォーマンス統計を更新
                    self._performance_stats['hits'] = self._performance_stats.get('hits', 0) + 1
                    self._performance_stats['total_cached_time'] = self._performance_stats.get('total_cached_time', 0) + (time.time() - start_time)
                    self._performance_stats['cached_requests'] = self._performance_stats.get('cached_requests', 0) + 1
                    
                    # メトリクスを記録（設定されている場合）
                    if hasattr(self, '_metric_operations'):
                        self._metric_operations.labels(operation='get').inc()
                    
                    return result
            except Exception as e:
                # Redisエラーを記録
                if hasattr(self, '_metric_error_count'):
                    self._metric_error_count.inc()
                print(f"Redisからの取得中にエラーが発生: {e}")
        
        # キャッシュミスを記録
        self._performance_stats['misses'] = self._performance_stats.get('misses', 0) + 1
        self._performance_stats['total_uncached_time'] = self._performance_stats.get('total_uncached_time', 0) + (time.time() - start_time)
        self._performance_stats['uncached_requests'] = self._performance_stats.get('uncached_requests', 0) + 1
        
        return default
"""
        set_method = "    def set(self, key: str, value, ttl: float = None):"
        set_method_modification = """
        # サイズベースのTTL調整（既存機能）
        data_size = len(str(value)) if not isinstance(value, (bytes, bytearray)) else len(value)
        ttl = self._calculate_adaptive_ttl(key, 'default', ttl or self.default_ttl, data_size)
        
        # メモリキャッシュに保存
        self._set_in_memory(key, value, ttl)
        
        # Redisに保存
        if self.redis_enabled:
            try:
                self._set_in_redis(key, value, ttl)
            except Exception as e:
                # Redisエラーを記録
                if hasattr(self, '_metric_error_count'):
                    self._metric_error_count.inc()
                print(f"Redisへの保存中にエラーが発生: {e}")
        
        # メトリクスを記録（設定されている場合）
        if hasattr(self, '_metric_operations'):
            self._metric_operations.labels(operation='set').inc()
"""
        
        invalidate_method = "    def invalidate(self, key_pattern: str = None):"
        invalidate_method_modification = """
        if key_pattern is None:
            # すべてのキャッシュを無効化
            self._cache.clear()
            
            if self.redis_enabled:
                try:
                    self.redis_client.flushall()
                except Exception as e:
                    # Redisエラーを記録
                    if hasattr(self, '_metric_error_count'):
                        self._metric_error_count.inc()
                    print(f"Redisキャッシュの全消去中にエラーが発生: {e}")
        else:
            # パターンに一致するキーを無効化
            to_remove = []
            for k in self._cache.keys():
                if key_pattern in k:
                    to_remove.append(k)
            
            for k in to_remove:
                del self._cache[k]
            
            if self.redis_enabled:
                try:
                    for k in to_remove:
                        self.redis_client.delete(k)
                except Exception as e:
                    # Redisエラーを記録
                    if hasattr(self, '_metric_error_count'):
                        self._metric_error_count.inc()
                    print(f"Redisキャッシュの削除中にエラーが発生: {e}")
        
        # メトリクスを記録（設定されている場合）
        if hasattr(self, '_metric_operations'):
            self._metric_operations.labels(operation='invalidate').inc()
"""
        
        # メソッドを置換
        if get_method in content:
            # 既存のgetメソッドを見つけて置換
            get_end = content.find("\n    def ", content.find(get_method) + len(get_method))
            original_get = content[content.find(get_method):get_end]
            content = content.replace(original_get, get_method + get_method_modification)
        
        if set_method in content:
            # 既存のsetメソッドを見つけて置換
            set_end = content.find("\n    def ", content.find(set_method) + len(set_method))
            original_set = content[content.find(set_method):set_end]
            content = content.replace(original_set, set_method + set_method_modification)
        
        if invalidate_method in content:
            # 既存のinvalidateメソッドを見つけて置換
            invalidate_end = content.find("\n    def ", content.find(invalidate_method) + len(invalidate_method))
            original_invalidate = content[content.find(invalidate_method):invalidate_end]
            content = content.replace(original_invalidate, invalidate_method + invalidate_method_modification)
        
        # メトリクスメソッドを追加（クラスの最後）
        last_method_end = content.rfind("\n    def ")
        if last_method_end > 0:
            last_method_end = content.find("\n", content.find("\n", last_method_end + 5))
            if last_method_end > 0:
                content = content[:last_method_end] + setup_metrics_method + content[last_method_end:]
    
    # 更新内容を書き込み
    with open(optimized_cache_path, "w") as f:
        f.write(content)
    
    print(f"OptimizedCacheManagerにメトリクス統合機能を追加しました: {optimized_cache_path}")
    print(f"オリジナルファイルのバックアップ: {backup_path}")

def setup_monitoring_package():
    """モニタリングパッケージの構造を設定"""
    print_section("モニタリングパッケージのセットアップ")
    
    monitoring_dir = Path(PROJECT_ROOT) / "src" / "monitoring"
    monitoring_dir.mkdir(exist_ok=True, parents=True)
    
    # __init__.py
    with open(monitoring_dir / "__init__.py", "w") as f:
        f.write('"""キャッシュモニタリングパッケージ"""\n\n')
        f.write('from .prometheus_exporter import setup_monitoring\n\n')
        f.write('__all__ = ["setup_monitoring"]\n')
    
    # prometheus_exporter.py
    with open(monitoring_dir / "prometheus_exporter.py", "w") as f:
        f.write("""
\"\"\"
OptimizedCacheManager - Prometheusエクスポータ
\"\"\"
import threading
from typing import Any, Dict, Optional
import time
from prometheus_client import start_http_server

def setup_monitoring(app: Any, cache_manager: Any, port: int = 8000) -> None:
    \"\"\"
    アプリケーションとキャッシュマネージャーのモニタリングを設定
    
    Args:
        app: アプリケーションインスタンス
        cache_manager: OptimizedCacheManagerインスタンス
        port: メトリクス公開用のHTTPポート (デフォルト: 8000)
    \"\"\"
    # メトリクス収集機能が有効になっているか確認
    if not hasattr(cache_manager, "_setup_metrics"):
        print("警告: キャッシュマネージャーにメトリクス収集機能が実装されていません。")
        print("prepare_metrics_collection.pyを実行してパッチを適用してください。")
        return
    
    # メトリクス収集機能を有効化
    cache_manager.enable_metrics = True
    
    # メトリクス収集の初期化
    if hasattr(cache_manager, "_setup_metrics"):
        cache_manager._setup_metrics()
    
    # HTTPサーバーを起動
    try:
        start_http_server(port)
        print(f"Prometheusメトリクスサーバーを開始しました - http://localhost:{port}/metrics")
    except Exception as e:
        print(f"メトリクスサーバーの起動に失敗しました: {e}")

    # アプリケーション終了時のクリーンアップ
    if hasattr(app, "on_shutdown"):
        original_shutdown = getattr(app, "on_shutdown", None)
        
        def shutdown_handler():
            print("メトリクス収集を停止しています...")
            # 終了処理を実装（必要に応じて）
            
            # 元の終了ハンドラを呼び出し
            if original_shutdown:
                original_shutdown()
        
        setattr(app, "on_shutdown", shutdown_handler)

def get_metrics_dashboard_url() -> str:
    \"\"\"Grafanaダッシュボードの完全なURLを取得\"\"\"
    return "http://localhost:3000/d/cache-performance/conea-optimizedcachemanager"

def check_prometheus_connection() -> Dict[str, Any]:
    \"\"\"Prometheusへの接続状態をチェック\"\"\"
    import requests
    
    try:
        response = requests.get("http://localhost:9090/-/healthy", timeout=2)
        if response.status_code == 200:
            return {
                "status": "healthy",
                "message": "Prometheusサーバーに正常に接続できます"
            }
        else:
            return {
                "status": "unhealthy",
                "message": f"Prometheusサーバーの応答コード: {response.status_code}",
                "details": response.text
            }
    except requests.exceptions.RequestException as e:
        return {
            "status": "unreachable",
            "message": "Prometheusサーバーに接続できません",
            "details": str(e)
        }

def check_grafana_connection() -> Dict[str, Any]:
    \"\"\"Grafanaへの接続状態をチェック\"\"\"
    import requests
    
    try:
        response = requests.get("http://localhost:3000/api/health", timeout=2)
        if response.status_code == 200:
            return {
                "status": "healthy",
                "message": "Grafanaサーバーに正常に接続できます"
            }
        else:
            return {
                "status": "unhealthy",
                "message": f"Grafanaサーバーの応答コード: {response.status_code}",
                "details": response.text
            }
    except requests.exceptions.RequestException as e:
        return {
            "status": "unreachable",
            "message": "Grafanaサーバーに接続できません",
            "details": str(e)
        }
""")
    
    print(f"モニタリングパッケージをセットアップしました: {monitoring_dir}")

def create_setup_script():
    """モニタリングセットアップスクリプトを作成"""
    print_section("セットアップスクリプトの作成")
    
    setup_script_path = Path(SCRIPTS_DIR) / "setup_monitoring.py"
    
    with open(setup_script_path, "w") as f:
        f.write("""#!/usr/bin/env python3
\"\"\"
OptimizedCacheManager - モニタリングセットアップスクリプト
\"\"\"
import os
import sys
import subprocess
import argparse
from pathlib import Path

def setup_monitoring(args):
    print("OptimizedCacheManagerモニタリングのセットアップを開始します...")
    
    # スクリプトのディレクトリとプロジェクトルートを取得
    script_dir = Path(__file__).parent.absolute()
    project_root = script_dir.parent.parent
    
    # 依存関係の準備
    print("\\n=== 依存関係の準備 ===")
    subprocess.run([sys.executable, script_dir / "prepare_metrics_collection.py"], check=True)
    
    # モニタリングダッシュボードのセットアップ
    print("\\n=== モニタリングダッシュボードのセットアップ ===")
    subprocess.run(["bash", script_dir / "setup_monitoring_dashboard.sh"], check=True)
    
    if args.test:
        # テストデータの生成
        print("\\n=== テストデータの生成 ===")
        test_duration = args.test_duration or 300
        subprocess.run([sys.executable, script_dir / "test_data.py", "--duration", str(test_duration)], check=True)
    
    # モニタリングの起動
    if args.start:
        print("\\n=== モニタリングサービスの起動 ===")
        subprocess.run(["bash", script_dir / "start_monitoring.sh"], check=True)
    
    print("\\nOptimizedCacheManagerモニタリングのセットアップが完了しました。")
    print("以下のコマンドでモニタリングを開始できます:")
    print(f"bash {script_dir}/start_monitoring.sh")
    
    if args.start:
        print("\\nモニタリングダッシュボードは以下のURLで確認できます:")
        print("Grafana: http://localhost:3000")
        print("- ユーザー名: admin")
        print("- パスワード: conea_cache_admin")
        
        print("\\nPrometheus: http://localhost:9090")
        print("Alertmanager: http://localhost:9093")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="OptimizedCacheManagerのモニタリングをセットアップ")
    parser.add_argument("--start", action="store_true", help="セットアップ後にモニタリングサービスを起動")
    parser.add_argument("--test", action="store_true", help="テストデータを生成")
    parser.add_argument("--test-duration", type=int, help="テスト実行時間（秒）、デフォルト: 300秒（5分）")
    
    args = parser.parse_args()
    setup_monitoring(args)
""")
    
    # 実行権限を付与
    os.chmod(setup_script_path, 0o755)
    
    print(f"モニタリングセットアップスクリプトを作成しました: {setup_script_path}")
    print("以下のコマンドで実行できます:")
    print(f"python3 {setup_script_path} --start --test")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="OptimizedCacheManagerのメトリクス収集準備")
    parser.add_argument("--no-deps", action="store_true", help="依存関係のインストールをスキップ")
    parser.add_argument("--no-patch", action="store_true", help="OptimizedCacheManagerへのパッチ適用をスキップ")
    
    args = parser.parse_args()
    
    # スクリプトのディレクトリとプロジェクトルートを取得
    SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
    SCRIPTS_DIR = os.path.dirname(SCRIPT_DIR)
    PROJECT_ROOT = os.path.dirname(SCRIPTS_DIR)
    
    print(f"スクリプトディレクトリ: {SCRIPT_DIR}")
    print(f"プロジェクトルート: {PROJECT_ROOT}")
    
    # 依存関係のインストール
    if not args.no_deps:
        install_dependencies()
    
    # テストデータ生成スクリプトの作成
    generate_test_data()
    
    # OptimizedCacheManagerにメトリクス統合機能を追加
    if not args.no_patch:
        add_metrics_integration()
    
    # モニタリングパッケージのセットアップ
    setup_monitoring_package()
    
    # セットアップスクリプトの作成
    create_setup_script()
    
    print("\nメトリクス収集の準備が完了しました。以下のコマンドでモニタリングをセットアップできます：")
    print(f"python3 {SCRIPTS_DIR}/setup_monitoring.py --start --test")