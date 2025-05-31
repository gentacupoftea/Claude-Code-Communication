#!/usr/bin/env python3
"""
OptimizedCacheManager - クライアントライブラリ
目的：キャッシュAPIと通信するためのPythonクライアントライブラリを提供する
"""
import json
import os
import sys
import time
import argparse
import logging
import urllib.request
import urllib.error
import urllib.parse
from typing import Dict, Any, Optional, List, Union

# ロギング設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('cache_client')

class CacheClient:
    """OptimizedCacheManager APIと通信するクライアント"""
    
    def __init__(self, base_url="http://localhost:8000"):
        """初期化
        
        Args:
            base_url: キャッシュAPIのベースURL
        """
        self.base_url = base_url
        logger.debug(f"CacheClientを初期化しました: {base_url}")
    
    def _make_request(self, path, method="GET", data=None, headers=None):
        """APIリクエストを実行
        
        Args:
            path: APIエンドポイントのパス
            method: HTTPメソッド
            data: リクエストボディデータ（辞書）
            headers: リクエストヘッダー（辞書）
            
        Returns:
            dict: APIレスポンス
            
        Raises:
            urllib.error.HTTPError: HTTPエラーが発生した場合
            urllib.error.URLError: ネットワークエラーが発生した場合
            Exception: その他のエラーが発生した場合
        """
        url = f"{self.base_url}{path}"
        logger.debug(f"{method} {url}")
        
        # ヘッダーの設定
        request_headers = {"Content-Type": "application/json"}
        if headers:
            request_headers.update(headers)
        
        # リクエストの準備
        body = None
        if data is not None:
            body = json.dumps(data).encode('utf-8')
        
        try:
            request = urllib.request.Request(
                url, 
                data=body, 
                headers=request_headers, 
                method=method
            )
            
            with urllib.request.urlopen(request) as response:
                response_data = response.read().decode('utf-8')
                return json.loads(response_data)
        
        except urllib.error.HTTPError as e:
            # HTTPエラーの場合、エラーレスポンスを解析して返す
            try:
                error_data = json.loads(e.read().decode('utf-8'))
                logger.error(f"HTTPエラー: {e.code} - {error_data.get('error', str(e))}")
                return error_data
            except:
                logger.error(f"HTTPエラー: {e.code} - {e.reason}")
                raise
        
        except urllib.error.URLError as e:
            logger.error(f"URLエラー: {e.reason}")
            raise
        
        except Exception as e:
            logger.error(f"リクエスト実行中にエラーが発生: {e}")
            raise
    
    def healthcheck(self):
        """APIサーバーのヘルスチェック
        
        Returns:
            dict: ヘルスチェック結果
        """
        return self._make_request("/api/healthcheck")
    
    def get_stats(self):
        """キャッシュの統計情報を取得
        
        Returns:
            dict: 統計情報
        """
        return self._make_request("/api/cache/stats")
    
    def get_keys(self, pattern=None):
        """キーの一覧を取得
        
        Args:
            pattern: 検索パターン（オプション）
            
        Returns:
            list: キーのリスト
        """
        path = "/api/cache/keys"
        if pattern:
            path = f"{path}?pattern={urllib.parse.quote(pattern)}"
        
        response = self._make_request(path)
        return response.get("keys", [])
    
    def get(self, key):
        """キャッシュから値を取得
        
        Args:
            key: キー
            
        Returns:
            Any: キャッシュされた値
            None: キーが存在しない場合
        """
        encoded_key = urllib.parse.quote(key)
        response = self._make_request(f"/api/cache/key/{encoded_key}")
        
        if response.get("found", False):
            return response.get("value")
        
        return None
    
    def set(self, key, value, ttl=None):
        """キャッシュに値を設定
        
        Args:
            key: キー
            value: 値
            ttl: TTL（秒）
            
        Returns:
            bool: 成功したかどうか
        """
        encoded_key = urllib.parse.quote(key)
        data = {"value": value}
        
        if ttl is not None:
            data["ttl"] = ttl
        
        response = self._make_request(
            f"/api/cache/key/{encoded_key}",
            method="POST",
            data=data
        )
        
        return response.get("stored", False)
    
    def invalidate(self, key=None):
        """キャッシュから値を削除
        
        Args:
            key: 削除するキー（Noneの場合は全削除）
            
        Returns:
            bool: 成功したかどうか
        """
        if key is None:
            # すべてのキャッシュを削除
            response = self._make_request(
                "/api/cache/invalidate-all",
                method="DELETE"
            )
            return response.get("invalidated", False)
        else:
            # 指定したキーを削除
            encoded_key = urllib.parse.quote(key)
            response = self._make_request(
                f"/api/cache/key/{encoded_key}",
                method="DELETE"
            )
            return response.get("invalidated", False)
    
    def batch_get(self, keys):
        """複数のキーの値を一度に取得
        
        Args:
            keys: キーのリスト
            
        Returns:
            dict: キーと値のマッピング
        """
        result = {}
        
        for key in keys:
            value = self.get(key)
            if value is not None:
                result[key] = value
        
        return result
    
    def batch_set(self, items, ttl=None):
        """複数のキーと値を一度に設定
        
        Args:
            items: キーと値のマッピング辞書
            ttl: TTL（秒）
            
        Returns:
            dict: 各キーの結果
        """
        results = {}
        
        for key, value in items.items():
            success = self.set(key, value, ttl)
            results[key] = success
        
        return results

def print_json(data):
    """JSONデータを整形して表示
    
    Args:
        data: 表示するデータ
    """
    print(json.dumps(data, indent=2, ensure_ascii=False))

def main():
    parser = argparse.ArgumentParser(description="OptimizedCacheManager Client")
    parser.add_argument("--url", default="http://localhost:8000", help="キャッシュAPIのURL")
    parser.add_argument("--debug", action="store_true", help="デバッグモードを有効化")
    
    # サブコマンド
    subparsers = parser.add_subparsers(dest="command", help="コマンド")
    
    # healthcheckコマンド
    subparsers.add_parser("healthcheck", help="APIサーバーのヘルスチェック")
    
    # statsコマンド
    subparsers.add_parser("stats", help="キャッシュの統計情報を取得")
    
    # keysコマンド
    keys_parser = subparsers.add_parser("keys", help="キーの一覧を取得")
    keys_parser.add_argument("--pattern", help="検索パターン")
    
    # getコマンド
    get_parser = subparsers.add_parser("get", help="キャッシュから値を取得")
    get_parser.add_argument("key", help="取得するキー")
    
    # setコマンド
    set_parser = subparsers.add_parser("set", help="キャッシュに値を設定")
    set_parser.add_argument("key", help="設定するキー")
    set_parser.add_argument("value", help="設定する値")
    set_parser.add_argument("--ttl", type=int, help="TTL（秒）")
    
    # invalidateコマンド
    invalidate_parser = subparsers.add_parser("invalidate", help="キャッシュから値を削除")
    invalidate_parser.add_argument("key", nargs="?", help="削除するキー（省略時は全削除）")
    
    # batch-getコマンド
    batch_get_parser = subparsers.add_parser("batch-get", help="複数のキーの値を一度に取得")
    batch_get_parser.add_argument("keys", nargs="+", help="取得するキーのリスト")
    
    # batch-setコマンド
    batch_set_parser = subparsers.add_parser("batch-set", help="複数のキーと値を一度に設定")
    batch_set_parser.add_argument("items", help="キーと値のJSONマッピング")
    batch_set_parser.add_argument("--ttl", type=int, help="TTL（秒）")
    
    args = parser.parse_args()
    
    # デバッグモードの設定
    if args.debug:
        logger.setLevel(logging.DEBUG)
        logger.debug("デバッグモードが有効になりました")
    
    # クライアントの初期化
    client = CacheClient(args.url)
    
    # コマンドに応じた処理
    try:
        if args.command == "healthcheck":
            # ヘルスチェック
            result = client.healthcheck()
            print_json(result)
        
        elif args.command == "stats":
            # 統計情報
            result = client.get_stats()
            print_json(result)
        
        elif args.command == "keys":
            # キーの一覧
            result = client.get_keys(args.pattern)
            print_json(result)
        
        elif args.command == "get":
            # 値の取得
            result = client.get(args.key)
            if result is not None:
                print_json(result)
            else:
                print(f"キー '{args.key}' は存在しません")
                sys.exit(1)
        
        elif args.command == "set":
            # 値の設定
            success = client.set(args.key, args.value, args.ttl)
            if success:
                print(f"キー '{args.key}' を設定しました")
            else:
                print(f"キー '{args.key}' の設定に失敗しました")
                sys.exit(1)
        
        elif args.command == "invalidate":
            # 値の削除
            if args.key:
                success = client.invalidate(args.key)
                if success:
                    print(f"キー '{args.key}' を削除しました")
                else:
                    print(f"キー '{args.key}' の削除に失敗しました")
                    sys.exit(1)
            else:
                success = client.invalidate()
                if success:
                    print("すべてのキャッシュを削除しました")
                else:
                    print("キャッシュの削除に失敗しました")
                    sys.exit(1)
        
        elif args.command == "batch-get":
            # 複数の値の取得
            result = client.batch_get(args.keys)
            print_json(result)
        
        elif args.command == "batch-set":
            # 複数の値の設定
            try:
                items = json.loads(args.items)
                if not isinstance(items, dict):
                    print("エラー: itemsはJSONオブジェクト（辞書）である必要があります")
                    sys.exit(1)
                
                results = client.batch_set(items, args.ttl)
                print_json(results)
            
            except json.JSONDecodeError:
                print("エラー: 無効なJSON形式です")
                sys.exit(1)
        
        else:
            # コマンドが指定されていない場合
            parser.print_help()
    
    except urllib.error.URLError as e:
        print(f"サーバーへの接続に失敗しました: {e.reason}")
        sys.exit(1)
    
    except Exception as e:
        print(f"エラーが発生しました: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()