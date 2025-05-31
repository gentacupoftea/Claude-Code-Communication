#!/usr/bin/env python3
"""
OptimizedCacheManager - REST API インターフェース
目的：キャッシュ操作のためのRESTful APIを提供する
"""
import json
import os
import sys
import time
from typing import Dict, Any, Optional, List, Union
from datetime import datetime
import argparse
import logging
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# プロジェクトルートへのパス設定
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(os.path.dirname(SCRIPT_DIR))
sys.path.append(PROJECT_ROOT)

# OptimizedCacheManagerのインポート
try:
    from src.api.shopify.optimized_cache_manager import OptimizedCacheManager
except ImportError:
    print("エラー: OptimizedCacheManagerが見つかりません。")
    print(f"プロジェクトルート: {PROJECT_ROOT}")
    sys.exit(1)

# ロギング設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(os.path.join(PROJECT_ROOT, 'cache_api.log'))
    ]
)
logger = logging.getLogger('cache_api')

# グローバルキャッシュマネージャーインスタンス
cache_manager = None

class CacheAPIHandler(BaseHTTPRequestHandler):
    """キャッシュ操作を処理するHTTPリクエストハンドラー"""
    
    def _set_headers(self, status_code=200, content_type='application/json'):
        """レスポンスヘッダーを設定
        
        Args:
            status_code: HTTPステータスコード
            content_type: コンテンツタイプ
        """
        self.send_response(status_code)
        self.send_header('Content-Type', content_type)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def _send_json_response(self, data, status_code=200):
        """JSONレスポンスを送信
        
        Args:
            data: JSONに変換するデータ
            status_code: HTTPステータスコード
        """
        self._set_headers(status_code)
        self.wfile.write(json.dumps(data).encode('utf-8'))
    
    def _parse_json_body(self):
        """リクエストボディからJSONデータを解析
        
        Returns:
            dict: 解析されたJSONデータ
            None: JSONの解析に失敗した場合
        """
        content_length = int(self.headers['Content-Length'])
        body = self.rfile.read(content_length)
        
        try:
            return json.loads(body.decode('utf-8'))
        except json.JSONDecodeError as e:
            logger.error(f"JSONの解析に失敗: {e}")
            return None
    
    def _parse_query_params(self):
        """URLクエリパラメータを解析
        
        Returns:
            dict: クエリパラメータ
        """
        parsed_url = urlparse(self.path)
        return parse_qs(parsed_url.query)
    
    def _get_path_parts(self):
        """URLパスを分解
        
        Returns:
            list: パスの部分
        """
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        parts = [p for p in path.split('/') if p]
        return parts
    
    def do_OPTIONS(self):
        """OPTIONSリクエストを処理（CORS対応）"""
        self._set_headers()
    
    def do_GET(self):
        """GETリクエストを処理"""
        path_parts = self._get_path_parts()
        
        # キャッシュマネージャーの初期化確認
        global cache_manager
        if cache_manager is None:
            self._send_json_response({"error": "キャッシュマネージャーが初期化されていません"}, 500)
            return
        
        try:
            # /api/cache/keys
            if len(path_parts) >= 3 and path_parts[0] == 'api' and path_parts[1] == 'cache' and path_parts[2] == 'keys':
                # キーのパターン検索を実装（未実装の場合はエラー）
                if hasattr(cache_manager, 'get_keys'):
                    pattern = None
                    query_params = self._parse_query_params()
                    if 'pattern' in query_params:
                        pattern = query_params['pattern'][0]
                    
                    keys = cache_manager.get_keys(pattern)
                    self._send_json_response({"keys": keys})
                else:
                    self._send_json_response({"error": "キー検索機能は実装されていません"}, 501)
                return
            
            # /api/cache/key/{key}
            elif len(path_parts) >= 4 and path_parts[0] == 'api' and path_parts[1] == 'cache' and path_parts[2] == 'key':
                key = '/'.join(path_parts[3:])
                value = cache_manager.get(key)
                
                if value is not None:
                    self._send_json_response({"key": key, "value": value, "found": True})
                else:
                    self._send_json_response({"key": key, "found": False}, 404)
                return
            
            # /api/cache/stats
            elif len(path_parts) >= 3 and path_parts[0] == 'api' and path_parts[1] == 'cache' and path_parts[2] == 'stats':
                stats = {"version": getattr(cache_manager, 'VERSION', 'unknown')}
                
                # ヒット率
                if hasattr(cache_manager, 'get_hit_rate'):
                    stats["hit_rate"] = cache_manager.get_hit_rate()
                
                # メモリ使用量
                if hasattr(cache_manager, 'get_memory_usage'):
                    memory_usage = cache_manager.get_memory_usage()
                    stats["memory_usage_bytes"] = memory_usage
                    stats["memory_usage_mb"] = memory_usage / (1024 * 1024)
                
                # メモリ上限
                if hasattr(cache_manager, 'memory_limit'):
                    memory_limit = cache_manager.memory_limit
                    stats["memory_limit_bytes"] = memory_limit
                    stats["memory_limit_mb"] = memory_limit / (1024 * 1024)
                    stats["memory_usage_percent"] = (memory_usage / memory_limit) * 100 if memory_limit > 0 else 0
                
                # パフォーマンス統計
                if hasattr(cache_manager, 'get_performance_stats'):
                    performance_stats = cache_manager.get_performance_stats()
                    if performance_stats:
                        stats.update(performance_stats)
                
                # Redis情報
                redis_enabled = getattr(cache_manager, 'redis_enabled', False)
                stats["redis_enabled"] = redis_enabled
                
                if redis_enabled and hasattr(cache_manager, 'redis_client') and cache_manager.redis_client:
                    try:
                        redis_info = cache_manager.redis_client.info()
                        stats["redis"] = {
                            "used_memory": redis_info.get('used_memory', 0),
                            "used_memory_peak": redis_info.get('used_memory_peak', 0),
                            "used_memory_human": redis_info.get('used_memory_human', '0'),
                            "mem_fragmentation_ratio": redis_info.get('mem_fragmentation_ratio', 0),
                            "connected_clients": redis_info.get('connected_clients', 0),
                            "keyspace_hits": redis_info.get('keyspace_hits', 0),
                            "keyspace_misses": redis_info.get('keyspace_misses', 0),
                            "total_commands_processed": redis_info.get('total_commands_processed', 0)
                        }
                    except Exception as e:
                        logger.error(f"Redis情報の取得に失敗: {e}")
                        stats["redis_error"] = str(e)
                
                self._send_json_response(stats)
                return
            
            # /api/healthcheck
            elif len(path_parts) >= 2 and path_parts[0] == 'api' and path_parts[1] == 'healthcheck':
                self._send_json_response({"status": "healthy", "timestamp": datetime.now().isoformat()})
                return
            
            # その他のパスは404
            self._send_json_response({"error": "Not Found"}, 404)
        
        except Exception as e:
            logger.exception(f"GETリクエスト処理中にエラーが発生: {e}")
            self._send_json_response({"error": str(e)}, 500)
    
    def do_POST(self):
        """POSTリクエストを処理"""
        path_parts = self._get_path_parts()
        
        # キャッシュマネージャーの初期化確認
        global cache_manager
        if cache_manager is None:
            self._send_json_response({"error": "キャッシュマネージャーが初期化されていません"}, 500)
            return
        
        try:
            # /api/cache/key/{key}
            if len(path_parts) >= 4 and path_parts[0] == 'api' and path_parts[1] == 'cache' and path_parts[2] == 'key':
                key = '/'.join(path_parts[3:])
                data = self._parse_json_body()
                
                if data is None:
                    self._send_json_response({"error": "無効なJSONデータ"}, 400)
                    return
                
                if 'value' not in data:
                    self._send_json_response({"error": "valueフィールドが必要です"}, 400)
                    return
                
                ttl = data.get('ttl', None)
                
                # キャッシュに保存
                cache_manager.set(key, data['value'], ttl)
                
                self._send_json_response({"key": key, "stored": True})
                return
            
            # その他のパスは404
            self._send_json_response({"error": "Not Found"}, 404)
        
        except Exception as e:
            logger.exception(f"POSTリクエスト処理中にエラーが発生: {e}")
            self._send_json_response({"error": str(e)}, 500)
    
    def do_DELETE(self):
        """DELETEリクエストを処理"""
        path_parts = self._get_path_parts()
        
        # キャッシュマネージャーの初期化確認
        global cache_manager
        if cache_manager is None:
            self._send_json_response({"error": "キャッシュマネージャーが初期化されていません"}, 500)
            return
        
        try:
            # /api/cache/key/{key}
            if len(path_parts) >= 4 and path_parts[0] == 'api' and path_parts[1] == 'cache' and path_parts[2] == 'key':
                key = '/'.join(path_parts[3:])
                
                # キーを無効化
                cache_manager.invalidate(key)
                
                self._send_json_response({"key": key, "invalidated": True})
                return
            
            # /api/cache/invalidate-all
            elif len(path_parts) >= 3 and path_parts[0] == 'api' and path_parts[1] == 'cache' and path_parts[2] == 'invalidate-all':
                # すべてのキャッシュを無効化
                cache_manager.invalidate()
                
                self._send_json_response({"invalidated": True})
                return
            
            # その他のパスは404
            self._send_json_response({"error": "Not Found"}, 404)
        
        except Exception as e:
            logger.exception(f"DELETEリクエスト処理中にエラーが発生: {e}")
            self._send_json_response({"error": str(e)}, 500)

def run_server(port=8000):
    """APIサーバーを実行
    
    Args:
        port: 使用するポート番号
    """
    global cache_manager
    
    # キャッシュマネージャーを初期化
    try:
        cache_manager = OptimizedCacheManager()
        version = getattr(cache_manager, 'VERSION', 'unknown')
        logger.info(f"OptimizedCacheManager初期化完了: バージョン {version}")
        
        # RedisとCPUが利用可能かをログ
        redis_enabled = getattr(cache_manager, 'redis_enabled', False)
        compression_enabled = getattr(cache_manager, 'compression_enabled', False)
        logger.info(f"Redis有効: {redis_enabled}")
        logger.info(f"圧縮有効: {compression_enabled}")
        
        # サーバーを起動
        server_address = ('', port)
        httpd = HTTPServer(server_address, CacheAPIHandler)
        logger.info(f"キャッシュAPIサーバーが起動しました。ポート: {port}")
        logger.info(f"API URLs:")
        logger.info(f"  GET    /api/healthcheck                - ヘルスチェック")
        logger.info(f"  GET    /api/cache/stats                - キャッシュ統計")
        logger.info(f"  GET    /api/cache/keys?pattern=<パターン> - キー一覧")
        logger.info(f"  GET    /api/cache/key/<キー>            - キャッシュから値を取得")
        logger.info(f"  POST   /api/cache/key/<キー>            - キャッシュに値を設定")
        logger.info(f"  DELETE /api/cache/key/<キー>            - キャッシュから値を削除")
        logger.info(f"  DELETE /api/cache/invalidate-all       - すべてのキャッシュを削除")
        logger.info(f"例:")
        logger.info(f"  curl http://localhost:{port}/api/healthcheck")
        logger.info(f"  curl http://localhost:{port}/api/cache/stats")
        logger.info(f"  curl -X POST -H \"Content-Type: application/json\" -d '{{\"value\":\"test\", \"ttl\":60}}' http://localhost:{port}/api/cache/key/test")
        logger.info(f"  curl http://localhost:{port}/api/cache/key/test")
        httpd.serve_forever()
    except Exception as e:
        logger.exception(f"サーバー起動中にエラーが発生: {e}")
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="OptimizedCacheManager API Server")
    parser.add_argument("--port", type=int, default=8000, help="使用するポート番号（デフォルト: 8000）")
    parser.add_argument("--debug", action="store_true", help="デバッグモードを有効化")
    
    args = parser.parse_args()
    
    # デバッグモードの設定
    if args.debug:
        logger.setLevel(logging.DEBUG)
        logger.debug("デバッグモードが有効になりました")
    
    # サーバーの実行
    run_server(args.port)

if __name__ == "__main__":
    main()