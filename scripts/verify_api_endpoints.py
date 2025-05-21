#!/usr/bin/env python3
"""
Coneaプロジェクト APIエンドポイント検証スクリプト

デプロイされたAPIエンドポイントの機能を検証するスクリプトです。
"""

import os
import sys
import json
import time
import argparse
import requests
import datetime
from pathlib import Path

# プロジェクトルートディレクトリ
PROJECT_ROOT = Path(__file__).parent.parent.absolute()

# 結果格納ディレクトリ
RESULTS_DIR = PROJECT_ROOT / "verification_results"


def parse_args():
    """コマンドライン引数の解析"""
    parser = argparse.ArgumentParser(description="Verify Conea API endpoints")
    parser.add_argument("--env", default="staging", choices=["staging", "production"],
                        help="Target environment (staging or production)")
    parser.add_argument("--url", help="Base URL for API (default: from env file)")
    parser.add_argument("--username", help="Test username (default: from env file)")
    parser.add_argument("--password", help="Test password (default: from env file)")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose output")
    parser.add_argument("--output", help="Output file for verification results")
    return parser.parse_args()


def load_env_file(env_name):
    """環境変数ファイルを読み込む"""
    env_file = PROJECT_ROOT / f".env.{env_name}"
    if not env_file.exists():
        print(f"Warning: .env.{env_name} not found, falling back to .env")
        env_file = PROJECT_ROOT / ".env"
        if not env_file.exists():
            print("Error: No environment file found")
            sys.exit(1)
    
    env_vars = {}
    with open(env_file, "r") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            try:
                key, value = line.split("=", 1)
                env_vars[key.strip()] = value.strip()
            except ValueError:
                continue
    
    return env_vars


def setup_verification_environment(args):
    """検証環境のセットアップ"""
    env_name = args.env
    env_vars = load_env_file(env_name)
    
    # 検証用URL
    base_url = args.url
    if not base_url:
        domain_name = env_vars.get("DOMAIN_NAME")
        if domain_name:
            base_url = f"https://{domain_name}"
        else:
            service_name = env_vars.get("SERVICE_NAME", f"conea-{env_name}")
            region = env_vars.get("REGION", "asia-northeast1")
            base_url = f"https://{service_name}.{region}.run.app"
    
    # 認証情報
    username = args.username or env_vars.get("TEST_USERNAME", "test-user")
    password = args.password or env_vars.get("TEST_PASSWORD", "test-password")
    
    return {
        "base_url": base_url,
        "username": username,
        "password": password,
        "env_name": env_name
    }


def create_results_directory():
    """結果格納ディレクトリの作成"""
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    results_dir = RESULTS_DIR / f"api_verification_{timestamp}"
    results_dir.mkdir(parents=True, exist_ok=True)
    return results_dir


def test_health_endpoint(base_url, verbose=False):
    """ヘルスエンドポイントのテスト"""
    endpoint = f"{base_url}/health"
    
    try:
        start_time = time.time()
        response = requests.get(endpoint, timeout=10)
        response_time = time.time() - start_time
        
        if verbose:
            print(f"Response from {endpoint}:")
            print(f"Status: {response.status_code}")
            print(f"Response time: {response_time:.3f}s")
            print(f"Response body: {response.text}")
        
        return {
            "endpoint": "health",
            "url": endpoint,
            "status": response.status_code,
            "response_time": response_time,
            "success": response.status_code == 200,
            "content": response.json() if response.status_code == 200 else None
        }
    except Exception as e:
        if verbose:
            print(f"Error testing {endpoint}: {e}")
        
        return {
            "endpoint": "health",
            "url": endpoint,
            "status": 0,
            "response_time": 0,
            "success": False,
            "error": str(e)
        }


def test_info_endpoint(base_url, verbose=False):
    """サーバー情報エンドポイントのテスト"""
    endpoint = f"{base_url}/health/info"
    
    try:
        start_time = time.time()
        response = requests.get(endpoint, timeout=10)
        response_time = time.time() - start_time
        
        if verbose:
            print(f"Response from {endpoint}:")
            print(f"Status: {response.status_code}")
            print(f"Response time: {response_time:.3f}s")
            print(f"Response body: {response.text}")
        
        return {
            "endpoint": "server_info",
            "url": endpoint,
            "status": response.status_code,
            "response_time": response_time,
            "success": response.status_code == 200,
            "content": response.json() if response.status_code == 200 else None
        }
    except Exception as e:
        if verbose:
            print(f"Error testing {endpoint}: {e}")
        
        return {
            "endpoint": "server_info",
            "url": endpoint,
            "status": 0,
            "response_time": 0,
            "success": False,
            "error": str(e)
        }


def test_authentication(base_url, username, password, verbose=False):
    """認証エンドポイントのテスト"""
    endpoint = f"{base_url}/api/auth/login"
    
    try:
        start_time = time.time()
        response = requests.post(
            endpoint,
            json={"username": username, "password": password},
            timeout=10
        )
        response_time = time.time() - start_time
        
        if verbose:
            print(f"Response from {endpoint}:")
            print(f"Status: {response.status_code}")
            print(f"Response time: {response_time:.3f}s")
            print(f"Response body: {response.text}")
        
        # トークンの取得
        token = None
        if response.status_code == 200:
            try:
                token = response.json().get("token")
            except:
                pass
        
        return {
            "endpoint": "auth_login",
            "url": endpoint,
            "status": response.status_code,
            "response_time": response_time,
            "success": response.status_code == 200 and token is not None,
            "token": token
        }
    except Exception as e:
        if verbose:
            print(f"Error testing {endpoint}: {e}")
        
        return {
            "endpoint": "auth_login",
            "url": endpoint,
            "status": 0,
            "response_time": 0,
            "success": False,
            "error": str(e)
        }


def test_mcp_endpoint(base_url, token, verbose=False):
    """MCPエンドポイントのテスト"""
    endpoint = f"{base_url}/api/mcp/invoke"
    
    try:
        # トークンがない場合はスキップ
        if not token:
            return {
                "endpoint": "mcp_invoke",
                "url": endpoint,
                "status": 0,
                "response_time": 0,
                "success": False,
                "error": "No authentication token available"
            }
        
        start_time = time.time()
        response = requests.post(
            endpoint,
            json={
                "tool": "get_product_info",
                "parameters": {"product_id": "test-product-1"}
            },
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        response_time = time.time() - start_time
        
        if verbose:
            print(f"Response from {endpoint}:")
            print(f"Status: {response.status_code}")
            print(f"Response time: {response_time:.3f}s")
            print(f"Response body: {response.text}")
        
        return {
            "endpoint": "mcp_invoke",
            "url": endpoint,
            "status": response.status_code,
            "response_time": response_time,
            "success": response.status_code in [200, 202],
            "content": response.json() if response.status_code in [200, 202] else None
        }
    except Exception as e:
        if verbose:
            print(f"Error testing {endpoint}: {e}")
        
        return {
            "endpoint": "mcp_invoke",
            "url": endpoint,
            "status": 0,
            "response_time": 0,
            "success": False,
            "error": str(e)
        }


def test_graphql_endpoint(base_url, token, verbose=False):
    """GraphQLエンドポイントのテスト"""
    endpoint = f"{base_url}/graphql"
    
    try:
        # トークンがない場合はスキップ
        if not token:
            return {
                "endpoint": "graphql",
                "url": endpoint,
                "status": 0,
                "response_time": 0,
                "success": False,
                "error": "No authentication token available"
            }
        
        # 基本的なクエリ
        query = """
        {
          serverInfo {
            version
            name
            uptime
          }
        }
        """
        
        start_time = time.time()
        response = requests.post(
            endpoint,
            json={"query": query},
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        response_time = time.time() - start_time
        
        if verbose:
            print(f"Response from {endpoint}:")
            print(f"Status: {response.status_code}")
            print(f"Response time: {response_time:.3f}s")
            print(f"Response body: {response.text}")
        
        # GraphQLレスポンスの検証
        response_data = response.json() if response.status_code == 200 else {}
        graphql_success = (
            response.status_code == 200 and 
            "data" in response_data and 
            "serverInfo" in response_data["data"]
        )
        
        return {
            "endpoint": "graphql",
            "url": endpoint,
            "status": response.status_code,
            "response_time": response_time,
            "success": graphql_success,
            "content": response_data
        }
    except Exception as e:
        if verbose:
            print(f"Error testing {endpoint}: {e}")
        
        return {
            "endpoint": "graphql",
            "url": endpoint,
            "status": 0,
            "response_time": 0,
            "success": False,
            "error": str(e)
        }


def test_chart_endpoint(base_url, token, verbose=False):
    """チャート生成エンドポイントのテスト"""
    endpoint = f"{base_url}/api/charts/render"
    
    try:
        # トークンがない場合はスキップ
        if not token:
            return {
                "endpoint": "charts_render",
                "url": endpoint,
                "status": 0,
                "response_time": 0,
                "success": False,
                "error": "No authentication token available"
            }
        
        # 基本的な棒グラフのデータ
        chart_data = {
            "type": "bar",
            "data": {
                "labels": ["Jan", "Feb", "Mar", "Apr", "May"],
                "datasets": [{
                    "label": "Sample Data",
                    "data": [12, 19, 3, 5, 2],
                    "backgroundColor": "rgba(75, 192, 192, 0.2)"
                }]
            },
            "options": {
                "responsive": True,
                "title": {
                    "display": True,
                    "text": "Test Chart"
                }
            }
        }
        
        start_time = time.time()
        response = requests.post(
            endpoint,
            json=chart_data,
            headers={"Authorization": f"Bearer {token}"},
            timeout=15
        )
        response_time = time.time() - start_time
        
        if verbose:
            print(f"Response from {endpoint}:")
            print(f"Status: {response.status_code}")
            print(f"Response time: {response_time:.3f}s")
            print(f"Response type: {response.headers.get('Content-Type')}")
        
        # 画像が返されたかを確認
        chart_success = (
            response.status_code == 200 and 
            response.headers.get("Content-Type", "").startswith("image/")
        )
        
        return {
            "endpoint": "charts_render",
            "url": endpoint,
            "status": response.status_code,
            "response_time": response_time,
            "success": chart_success,
            "content_type": response.headers.get("Content-Type")
        }
    except Exception as e:
        if verbose:
            print(f"Error testing {endpoint}: {e}")
        
        return {
            "endpoint": "charts_render",
            "url": endpoint,
            "status": 0,
            "response_time": 0,
            "success": False,
            "error": str(e)
        }


def save_verification_results(results, results_dir, output_file=None):
    """検証結果の保存"""
    # 結果のJSON
    results_json = {
        "timestamp": datetime.datetime.now().isoformat(),
        "environment": results["env_name"],
        "base_url": results["base_url"],
        "endpoints": [
            results["health"],
            results["info"],
            results["auth"],
            results["mcp"],
            results["graphql"],
            results["chart"]
        ],
        "summary": {
            "total_endpoints": 6,
            "successful_endpoints": sum(1 for endpoint in [
                results["health"], results["info"], results["auth"],
                results["mcp"], results["graphql"], results["chart"]
            ] if endpoint["success"]),
            "failed_endpoints": sum(1 for endpoint in [
                results["health"], results["info"], results["auth"],
                results["mcp"], results["graphql"], results["chart"]
            ] if not endpoint["success"]),
            "average_response_time": sum(
                endpoint["response_time"] for endpoint in [
                    results["health"], results["info"], results["auth"],
                    results["mcp"], results["graphql"], results["chart"]
                ] if endpoint["success"]
            ) / max(1, sum(1 for endpoint in [
                results["health"], results["info"], results["auth"],
                results["mcp"], results["graphql"], results["chart"]
            ] if endpoint["success"]))
        }
    }
    
    # JSONファイルの保存
    json_file = results_dir / "api_verification_results.json"
    with open(json_file, "w") as f:
        json.dump(results_json, f, indent=2)
    
    # マークダウンレポートの生成
    md_file = results_dir / "api_verification_report.md"
    with open(md_file, "w") as f:
        f.write(f"# Conea API検証レポート\n\n")
        f.write(f"生成日時: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        f.write(f"環境: {results['env_name']}\n")
        f.write(f"ベースURL: {results['base_url']}\n\n")
        
        f.write(f"## サマリー\n\n")
        f.write(f"- 総エンドポイント数: {results_json['summary']['total_endpoints']}\n")
        f.write(f"- 成功: {results_json['summary']['successful_endpoints']}\n")
        f.write(f"- 失敗: {results_json['summary']['failed_endpoints']}\n")
        f.write(f"- 平均応答時間: {results_json['summary']['average_response_time']:.3f}秒\n\n")
        
        f.write(f"## エンドポイント検証結果\n\n")
        f.write(f"| エンドポイント | URL | ステータス | 応答時間 | 結果 |\n")
        f.write(f"|--------------|-----|----------|---------|------|\n")
        
        for endpoint in results_json["endpoints"]:
            status = endpoint.get("status", "N/A")
            response_time = f"{endpoint.get('response_time', 0):.3f}秒"
            result = "✅ 成功" if endpoint.get("success") else "❌ 失敗"
            
            f.write(f"| {endpoint['endpoint']} | {endpoint['url']} | {status} | {response_time} | {result} |\n")
        
        f.write(f"\n## 詳細結果\n\n")
        
        # ヘルスエンドポイント
        f.write(f"### ヘルスエンドポイント\n\n")
        if results["health"]["success"]:
            f.write(f"ステータス: {results['health']['status']}\n")
            f.write(f"応答時間: {results['health']['response_time']:.3f}秒\n")
            if results["health"].get("content"):
                f.write(f"応答内容:\n```json\n{json.dumps(results['health']['content'], indent=2)}\n```\n\n")
        else:
            f.write(f"エラー: {results['health'].get('error', '不明なエラー')}\n\n")
        
        # 情報エンドポイント
        f.write(f"### サーバー情報エンドポイント\n\n")
        if results["info"]["success"]:
            f.write(f"ステータス: {results['info']['status']}\n")
            f.write(f"応答時間: {results['info']['response_time']:.3f}秒\n")
            if results["info"].get("content"):
                f.write(f"応答内容:\n```json\n{json.dumps(results['info']['content'], indent=2)}\n```\n\n")
        else:
            f.write(f"エラー: {results['info'].get('error', '不明なエラー')}\n\n")
        
        # 認証エンドポイント
        f.write(f"### 認証エンドポイント\n\n")
        if results["auth"]["success"]:
            f.write(f"ステータス: {results['auth']['status']}\n")
            f.write(f"応答時間: {results['auth']['response_time']:.3f}秒\n")
            f.write(f"認証トークン: {results['auth']['token'][:10]}...(省略)\n\n")
        else:
            f.write(f"エラー: {results['auth'].get('error', '不明なエラー')}\n\n")
        
        # MCPエンドポイント
        f.write(f"### MCPエンドポイント\n\n")
        if results["mcp"]["success"]:
            f.write(f"ステータス: {results['mcp']['status']}\n")
            f.write(f"応答時間: {results['mcp']['response_time']:.3f}秒\n")
            if results["mcp"].get("content"):
                f.write(f"応答内容:\n```json\n{json.dumps(results['mcp']['content'], indent=2)}\n```\n\n")
        else:
            f.write(f"エラー: {results['mcp'].get('error', '不明なエラー')}\n\n")
        
        # GraphQLエンドポイント
        f.write(f"### GraphQLエンドポイント\n\n")
        if results["graphql"]["success"]:
            f.write(f"ステータス: {results['graphql']['status']}\n")
            f.write(f"応答時間: {results['graphql']['response_time']:.3f}秒\n")
            if results["graphql"].get("content"):
                f.write(f"応答内容:\n```json\n{json.dumps(results['graphql']['content'], indent=2)}\n```\n\n")
        else:
            f.write(f"エラー: {results['graphql'].get('error', '不明なエラー')}\n\n")
        
        # チャートエンドポイント
        f.write(f"### チャートレンダリングエンドポイント\n\n")
        if results["chart"]["success"]:
            f.write(f"ステータス: {results['chart']['status']}\n")
            f.write(f"応答時間: {results['chart']['response_time']:.3f}秒\n")
            f.write(f"コンテンツタイプ: {results['chart'].get('content_type', 'N/A')}\n\n")
        else:
            f.write(f"エラー: {results['chart'].get('error', '不明なエラー')}\n\n")
        
        f.write(f"## 結論\n\n")
        
        if results_json["summary"]["failed_endpoints"] == 0:
            f.write(f"✅ すべてのエンドポイントが正常に動作しています。\n")
        elif results_json["summary"]["successful_endpoints"] >= 4:
            f.write(f"⚠️ 一部のエンドポイントに問題がありますが、主要な機能は動作しています。\n")
        else:
            f.write(f"❌ 多くのエンドポイントに問題があります。デプロイの見直しが必要です。\n")
    
    # 出力ファイルが指定されている場合はコピー
    if output_file:
        import shutil
        shutil.copy(md_file, output_file)
    
    return {
        "json_file": json_file,
        "md_file": md_file
    }


def print_summary(results):
    """結果サマリーの表示"""
    health = "✅" if results["health"]["success"] else "❌"
    info = "✅" if results["info"]["success"] else "❌"
    auth = "✅" if results["auth"]["success"] else "❌"
    mcp = "✅" if results["mcp"]["success"] else "❌"
    graphql = "✅" if results["graphql"]["success"] else "❌"
    chart = "✅" if results["chart"]["success"] else "❌"
    
    # 成功したエンドポイントの数
    success_count = sum(1 for endpoint in [
        results["health"], results["info"], results["auth"],
        results["mcp"], results["graphql"], results["chart"]
    ] if endpoint["success"])
    
    print("\n" + "=" * 50)
    print(f"API検証結果サマリー - {results['env_name']}環境")
    print("=" * 50)
    print(f"ベースURL: {results['base_url']}")
    print("-" * 50)
    print(f"ヘルスエンドポイント: {health}")
    print(f"サーバー情報エンドポイント: {info}")
    print(f"認証エンドポイント: {auth}")
    print(f"MCPエンドポイント: {mcp}")
    print(f"GraphQLエンドポイント: {graphql}")
    print(f"チャートエンドポイント: {chart}")
    print("-" * 50)
    print(f"成功: {success_count}/6 エンドポイント")
    print("=" * 50)
    
    if success_count == 6:
        print("\n✅ すべてのエンドポイントが正常に動作しています。")
    elif success_count >= 4:
        print("\n⚠️ 一部のエンドポイントに問題がありますが、主要な機能は動作しています。")
    else:
        print("\n❌ 多くのエンドポイントに問題があります。デプロイの見直しが必要です。")


def main(args):
    """メイン処理"""
    # 環境設定のセットアップ
    env_config = setup_verification_environment(args)
    
    print(f"APIエンドポイント検証を開始します - {env_config['env_name']}環境")
    print(f"ベースURL: {env_config['base_url']}")
    
    # 結果格納ディレクトリの作成
    results_dir = create_results_directory()
    
    # エンドポイント検証実行
    results = {
        "base_url": env_config["base_url"],
        "env_name": env_config["env_name"]
    }
    
    # ヘルスエンドポイントのテスト
    print("\n1. ヘルスエンドポイントをテスト中...")
    results["health"] = test_health_endpoint(env_config["base_url"], args.verbose)
    print(f"結果: {'✅ 成功' if results['health']['success'] else '❌ 失敗'}")
    
    # サーバー情報エンドポイントのテスト
    print("\n2. サーバー情報エンドポイントをテスト中...")
    results["info"] = test_info_endpoint(env_config["base_url"], args.verbose)
    print(f"結果: {'✅ 成功' if results['info']['success'] else '❌ 失敗'}")
    
    # 認証エンドポイントのテスト
    print("\n3. 認証エンドポイントをテスト中...")
    results["auth"] = test_authentication(env_config["base_url"], env_config["username"], env_config["password"], args.verbose)
    print(f"結果: {'✅ 成功' if results['auth']['success'] else '❌ 失敗'}")
    
    # 認証トークンの取得
    token = results["auth"].get("token") if results["auth"]["success"] else None
    
    # MCPエンドポイントのテスト
    print("\n4. MCPエンドポイントをテスト中...")
    results["mcp"] = test_mcp_endpoint(env_config["base_url"], token, args.verbose)
    print(f"結果: {'✅ 成功' if results['mcp']['success'] else '❌ 失敗'}")
    
    # GraphQLエンドポイントのテスト
    print("\n5. GraphQLエンドポイントをテスト中...")
    results["graphql"] = test_graphql_endpoint(env_config["base_url"], token, args.verbose)
    print(f"結果: {'✅ 成功' if results['graphql']['success'] else '❌ 失敗'}")
    
    # チャートエンドポイントのテスト
    print("\n6. チャートレンダリングエンドポイントをテスト中...")
    results["chart"] = test_chart_endpoint(env_config["base_url"], token, args.verbose)
    print(f"結果: {'✅ 成功' if results['chart']['success'] else '❌ 失敗'}")
    
    # 結果の保存
    output_files = save_verification_results(results, results_dir, args.output)
    
    # サマリーの表示
    print_summary(results)
    
    # 結果ファイルの情報を表示
    print(f"\n詳細な結果は以下のファイルに保存されました:")
    print(f"JSONレポート: {output_files['json_file']}")
    print(f"マークダウンレポート: {output_files['md_file']}")
    
    # 成功したエンドポイントの数を取得
    success_count = sum(1 for endpoint in [
        results["health"], results["info"], results["auth"],
        results["mcp"], results["graphql"], results["chart"]
    ] if endpoint["success"])
    
    # 終了コードの設定
    if success_count == 6:
        return 0  # すべて成功
    elif success_count >= 4:
        return 0  # 主要な機能は動作している
    else:
        return 1  # 重大な問題あり


if __name__ == "__main__":
    args = parse_args()
    sys.exit(main(args))