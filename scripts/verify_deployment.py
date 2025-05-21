#!/usr/bin/env python3
"""
Coneaデプロイ検証スクリプト

このスクリプトは、Coneaのデプロイメントが正常に完了したことを検証します。
以下の項目を確認します：
1. API エンドポイントの可用性
2. 認証機能
3. AI機能
4. チャート生成機能
5. データベース接続
"""

import os
import sys
import json
import time
import argparse
import logging
import requests
from typing import Dict, List, Optional, Any, Tuple
from pathlib import Path
from datetime import datetime

# ロギング設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(f"verification_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("deployment-verification")

# デフォルト値
DEFAULT_TIMEOUT = 10  # リクエストタイムアウト（秒）
DEFAULT_BASE_URL = "https://staging.conea.example.com"  # ステージング環境URL
VERIFICATION_RESULTS_DIR = "verification_results"


class VerificationError(Exception):
    """検証エラーを表す例外クラス"""
    pass


def parse_args() -> argparse.Namespace:
    """コマンドライン引数のパース"""
    parser = argparse.ArgumentParser(description="Conea デプロイメント検証ツール")
    parser.add_argument(
        "--environment", "-e",
        choices=["local", "staging", "production"],
        default="staging",
        help="検証対象の環境（デフォルト: staging）"
    )
    parser.add_argument(
        "--base-url", "-u",
        help=f"ベースURL（デフォルト: {DEFAULT_BASE_URL}）"
    )
    parser.add_argument(
        "--timeout", "-t",
        type=int,
        default=DEFAULT_TIMEOUT,
        help=f"リクエストタイムアウト秒数（デフォルト: {DEFAULT_TIMEOUT}）"
    )
    parser.add_argument(
        "--test-auth",
        action="store_true",
        help="認証機能のテスト実行"
    )
    parser.add_argument(
        "--test-ai",
        action="store_true",
        help="AI機能のテスト実行"
    )
    parser.add_argument(
        "--test-database",
        action="store_true",
        help="データベース接続のテスト実行"
    )
    parser.add_argument(
        "--test-charts",
        action="store_true",
        help="チャート生成機能のテスト実行"
    )
    parser.add_argument(
        "--test-all",
        action="store_true",
        help="すべてのテストを実行"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="詳細ログの出力"
    )
    
    args = parser.parse_args()
    
    # 環境ごとのデフォルトURLを設定
    if not args.base_url:
        if args.environment == "local":
            args.base_url = "http://localhost:3000"
        elif args.environment == "staging":
            args.base_url = DEFAULT_BASE_URL
        elif args.environment == "production":
            args.base_url = "https://api.conea.example.com"
    
    # 詳細ログの設定
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    
    # テストオプションが指定されていない場合はすべてのテストを実行
    if not (args.test_auth or args.test_ai or args.test_database or args.test_charts):
        args.test_all = True
    
    # test_allが指定されている場合は個別のテストフラグを設定
    if args.test_all:
        args.test_auth = True
        args.test_ai = True
        args.test_database = True
        args.test_charts = True
    
    return args


def make_request(
    method: str,
    endpoint: str,
    base_url: str,
    timeout: int,
    headers: Optional[Dict[str, str]] = None,
    data: Optional[Dict[str, Any]] = None,
    json_data: Optional[Dict[str, Any]] = None,
    expected_status: int = 200,
    description: str = ""
) -> requests.Response:
    """
    HTTPリクエストを実行して結果を検証
    
    Args:
        method: HTTPメソッド（GET, POST, PUT, DELETE）
        endpoint: エンドポイントパス
        base_url: ベースURL
        timeout: タイムアウト秒数
        headers: リクエストヘッダー
        data: フォームデータ
        json_data: JSONデータ
        expected_status: 期待するステータスコード
        description: リクエストの説明
        
    Returns:
        requests.Response: レスポンスオブジェクト
        
    Raises:
        VerificationError: 検証に失敗した場合
    """
    url = f"{base_url.rstrip('/')}/{endpoint.lstrip('/')}"
    
    if not headers:
        headers = {}
    
    logger.info(f"リクエスト実行: {description or endpoint}")
    logger.debug(f"URL: {url}")
    logger.debug(f"メソッド: {method}")
    logger.debug(f"ヘッダー: {headers}")
    
    if json_data:
        logger.debug(f"JSONデータ: {json.dumps(json_data, ensure_ascii=False)}")
    elif data:
        logger.debug(f"フォームデータ: {data}")
    
    try:
        start_time = time.time()
        response = requests.request(
            method=method,
            url=url,
            headers=headers,
            data=data,
            json=json_data,
            timeout=timeout
        )
        elapsed_time = (time.time() - start_time) * 1000  # ミリ秒に変換
        
        logger.debug(f"ステータスコード: {response.status_code}")
        logger.debug(f"レスポンス時間: {elapsed_time:.2f}ms")
        
        # レスポンスボディをログに出力（JSONの場合は整形）
        if response.headers.get('Content-Type', '').startswith('application/json'):
            try:
                json_content = response.json()
                logger.debug(f"レスポンスボディ: {json.dumps(json_content, indent=2, ensure_ascii=False)}")
            except:
                logger.debug(f"レスポンスボディ: {response.text[:500]}")
        else:
            logger.debug(f"レスポンスボディ: {response.text[:500]}")
        
        # ステータスコードの検証
        if response.status_code != expected_status:
            raise VerificationError(
                f"{description or endpoint}: "
                f"ステータスコード {response.status_code} "
                f"（期待値: {expected_status}）"
            )
        
        logger.info(f"リクエスト成功: {description or endpoint}")
        return response
    
    except requests.RequestException as e:
        logger.error(f"リクエストエラー: {e}")
        raise VerificationError(f"{description or endpoint}: リクエストエラー: {e}")


def verify_health_endpoint(base_url: str, timeout: int) -> None:
    """
    ヘルスチェックエンドポイントの検証
    
    Args:
        base_url: ベースURL
        timeout: タイムアウト秒数
        
    Raises:
        VerificationError: 検証に失敗した場合
    """
    logger.info("ヘルスチェックエンドポイントの検証")
    
    response = make_request(
        method="GET",
        endpoint="/health",
        base_url=base_url,
        timeout=timeout,
        description="ヘルスチェック"
    )
    
    # レスポンスの検証
    try:
        data = response.json()
        if data.get("status") != "ok":
            raise VerificationError(f"ヘルスチェック: ステータスが 'ok' ではありません: {data.get('status')}")
    except json.JSONDecodeError:
        if "ok" not in response.text.lower():
            raise VerificationError(f"ヘルスチェック: レスポンスに 'ok' が含まれていません: {response.text}")


def verify_version_endpoint(base_url: str, timeout: int) -> str:
    """
    バージョンエンドポイントの検証
    
    Args:
        base_url: ベースURL
        timeout: タイムアウト秒数
        
    Returns:
        str: バージョン文字列
        
    Raises:
        VerificationError: 検証に失敗した場合
    """
    logger.info("バージョンエンドポイントの検証")
    
    response = make_request(
        method="GET",
        endpoint="/api/version",
        base_url=base_url,
        timeout=timeout,
        description="バージョン情報"
    )
    
    # レスポンスの検証
    try:
        data = response.json()
        version = data.get("version")
        if not version:
            raise VerificationError("バージョン情報: バージョンが含まれていません")
        
        logger.info(f"デプロイされたバージョン: {version}")
        return version
    except json.JSONDecodeError:
        raise VerificationError(f"バージョン情報: JSONのパースに失敗しました: {response.text}")


def verify_authentication(base_url: str, timeout: int) -> Tuple[str, Dict[str, str]]:
    """
    認証機能の検証
    
    Args:
        base_url: ベースURL
        timeout: タイムアウト秒数
        
    Returns:
        Tuple[str, Dict[str, str]]: ユーザーIDとリクエストヘッダー（認証トークン付き）
        
    Raises:
        VerificationError: 検証に失敗した場合
    """
    logger.info("認証機能の検証")
    
    # テスト用のユーザー情報
    test_user = {
        "email": f"test-{int(time.time())}@example.com",
        "password": "Test@Password123"
    }
    
    # ユーザー登録
    try:
        register_response = make_request(
            method="POST",
            endpoint="/api/auth/register",
            base_url=base_url,
            timeout=timeout,
            json_data=test_user,
            expected_status=201,
            description="ユーザー登録"
        )
        
        user_id = register_response.json().get("id")
        if not user_id:
            raise VerificationError("ユーザー登録: ユーザーIDが返されていません")
        
        logger.info(f"テストユーザーを作成しました: ID {user_id}")
    except VerificationError as e:
        logger.warning(f"ユーザー登録に失敗しました。既存のユーザーでログインを試みます: {e}")
        # 既存のテストユーザーがある場合のため
        user_id = "test-user"
    
    # ログイン
    login_response = make_request(
        method="POST",
        endpoint="/api/auth/login",
        base_url=base_url,
        timeout=timeout,
        json_data={
            "email": test_user["email"],
            "password": test_user["password"]
        },
        description="ユーザーログイン"
    )
    
    # トークンの抽出
    token = login_response.json().get("token")
    if not token:
        raise VerificationError("ユーザーログイン: 認証トークンが返されていません")
    
    # 認証ヘッダー
    auth_headers = {
        "Authorization": f"Bearer {token}"
    }
    
    # プロフィール取得で認証テスト
    make_request(
        method="GET",
        endpoint="/api/user/profile",
        base_url=base_url,
        timeout=timeout,
        headers=auth_headers,
        description="ユーザープロフィール取得"
    )
    
    logger.info("認証機能の検証が完了しました")
    return user_id, auth_headers


def verify_ai_features(base_url: str, timeout: int, auth_headers: Dict[str, str]) -> None:
    """
    AI機能の検証
    
    Args:
        base_url: ベースURL
        timeout: タイムアウト秒数
        auth_headers: 認証ヘッダー
        
    Raises:
        VerificationError: 検証に失敗した場合
    """
    logger.info("AI機能の検証")
    
    # AIモデル一覧の取得
    models_response = make_request(
        method="GET",
        endpoint="/api/ai/models",
        base_url=base_url,
        timeout=timeout,
        headers=auth_headers,
        description="AIモデル一覧取得"
    )
    
    # 利用可能なモデルがあるか確認
    models = models_response.json().get("models", [])
    if not models:
        raise VerificationError("AIモデル一覧: モデルが返されていません")
    
    logger.info(f"利用可能なAIモデル: {', '.join(model.get('id', 'unknown') for model in models)}")
    
    # テキスト生成のテスト
    generate_response = make_request(
        method="POST",
        endpoint="/api/ai/generate",
        base_url=base_url,
        timeout=timeout * 3,  # テキスト生成は長めのタイムアウト
        headers=auth_headers,
        json_data={
            "prompt": "こんにちは、今日の東京の天気を教えてください。",
            "model": models[0].get("id"),
            "max_tokens": 100
        },
        description="AIテキスト生成"
    )
    
    # レスポンスの検証
    generate_result = generate_response.json()
    if not generate_result.get("text"):
        raise VerificationError("AIテキスト生成: テキストが返されていません")
    
    logger.info("AI機能の検証が完了しました")


def verify_chart_generation(base_url: str, timeout: int, auth_headers: Dict[str, str]) -> None:
    """
    チャート生成機能の検証
    
    Args:
        base_url: ベースURL
        timeout: タイムアウト秒数
        auth_headers: 認証ヘッダー
        
    Raises:
        VerificationError: 検証に失敗した場合
    """
    logger.info("チャート生成機能の検証")
    
    # サンプルチャートデータ
    chart_data = {
        "type": "bar",
        "data": {
            "labels": ["Red", "Blue", "Yellow", "Green", "Purple", "Orange"],
            "datasets": [{
                "label": "Sample Data",
                "data": [12, 19, 3, 5, 2, 3],
                "backgroundColor": [
                    "rgba(255, 99, 132, 0.2)",
                    "rgba(54, 162, 235, 0.2)",
                    "rgba(255, 206, 86, 0.2)",
                    "rgba(75, 192, 192, 0.2)",
                    "rgba(153, 102, 255, 0.2)",
                    "rgba(255, 159, 64, 0.2)"
                ]
            }]
        }
    }
    
    # チャート生成リクエスト
    chart_response = make_request(
        method="POST",
        endpoint="/api/charts/generate",
        base_url=base_url,
        timeout=timeout,
        headers=auth_headers,
        json_data=chart_data,
        description="チャート生成"
    )
    
    # レスポンスの検証
    chart_result = chart_response.json()
    if not chart_result.get("url") and not chart_result.get("imageData"):
        raise VerificationError("チャート生成: URLまたは画像データが返されていません")
    
    logger.info("チャート生成機能の検証が完了しました")


def verify_database(base_url: str, timeout: int, auth_headers: Dict[str, str]) -> None:
    """
    データベース接続の検証
    
    Args:
        base_url: ベースURL
        timeout: タイムアウト秒数
        auth_headers: 認証ヘッダー
        
    Raises:
        VerificationError: 検証に失敗した場合
    """
    logger.info("データベース接続の検証")
    
    # システム状態API（データベース接続情報を含む）
    system_response = make_request(
        method="GET",
        endpoint="/api/admin/system",
        base_url=base_url,
        timeout=timeout,
        headers=auth_headers,
        description="システム状態取得"
    )
    
    # レスポンスの検証
    system_info = system_response.json()
    database_status = system_info.get("database", {}).get("status")
    if database_status != "connected":
        raise VerificationError(f"データベース接続: 接続状態が 'connected' ではありません: {database_status}")
    
    logger.info("データベース接続の検証が完了しました")


def save_verification_results(results: Dict[str, Any]) -> str:
    """
    検証結果を保存
    
    Args:
        results: 検証結果データ
        
    Returns:
        str: 保存されたファイルパス
    """
    # 保存ディレクトリの作成
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    result_dir = Path(VERIFICATION_RESULTS_DIR) / f"verification_results_{timestamp}"
    result_dir.mkdir(parents=True, exist_ok=True)
    
    # 結果ファイルの保存
    result_file = result_dir / "results.json"
    with open(result_file, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    # サマリーファイルの保存
    summary_file = result_dir / "summary.txt"
    with open(summary_file, "w", encoding="utf-8") as f:
        f.write(f"Conea Deployment Verification Summary\n")
        f.write(f"===================================\n\n")
        f.write(f"Timestamp: {timestamp}\n")
        f.write(f"Environment: {results['environment']}\n")
        f.write(f"Base URL: {results['base_url']}\n")
        f.write(f"Deployed Version: {results['version']}\n\n")
        
        f.write("Verification Results:\n")
        for category, status in results["verification_status"].items():
            status_str = "✓ PASS" if status else "✗ FAIL"
            f.write(f"- {category}: {status_str}\n")
        
        f.write("\nErrors:\n")
        if results["errors"]:
            for error in results["errors"]:
                f.write(f"- {error}\n")
        else:
            f.write("No errors occurred.\n")
    
    logger.info(f"検証結果を保存しました: {result_dir}")
    return str(result_dir)


def main() -> int:
    """メイン処理"""
    args = parse_args()
    
    logger.info(f"Conea デプロイメント検証を開始します（環境: {args.environment}）")
    logger.info(f"ベースURL: {args.base_url}")
    
    results = {
        "timestamp": datetime.now().isoformat(),
        "environment": args.environment,
        "base_url": args.base_url,
        "version": "unknown",
        "verification_status": {},
        "errors": []
    }
    
    # 基本エンドポイントの検証
    try:
        verify_health_endpoint(args.base_url, args.timeout)
        results["verification_status"]["health"] = True
    except VerificationError as e:
        logger.error(f"ヘルスチェック検証エラー: {e}")
        results["verification_status"]["health"] = False
        results["errors"].append(f"Health check failed: {e}")
    
    try:
        version = verify_version_endpoint(args.base_url, args.timeout)
        results["version"] = version
        results["verification_status"]["version"] = True
    except VerificationError as e:
        logger.error(f"バージョン検証エラー: {e}")
        results["verification_status"]["version"] = False
        results["errors"].append(f"Version check failed: {e}")
    
    # 認証機能の検証
    auth_headers = {}
    if args.test_auth:
        try:
            user_id, auth_headers = verify_authentication(args.base_url, args.timeout)
            results["verification_status"]["authentication"] = True
            results["user_id"] = user_id
        except VerificationError as e:
            logger.error(f"認証機能検証エラー: {e}")
            results["verification_status"]["authentication"] = False
            results["errors"].append(f"Authentication failed: {e}")
    
    # AI機能の検証
    if args.test_ai:
        try:
            verify_ai_features(args.base_url, args.timeout, auth_headers)
            results["verification_status"]["ai_features"] = True
        except VerificationError as e:
            logger.error(f"AI機能検証エラー: {e}")
            results["verification_status"]["ai_features"] = False
            results["errors"].append(f"AI features failed: {e}")
    
    # チャート生成機能の検証
    if args.test_charts:
        try:
            verify_chart_generation(args.base_url, args.timeout, auth_headers)
            results["verification_status"]["chart_generation"] = True
        except VerificationError as e:
            logger.error(f"チャート生成機能検証エラー: {e}")
            results["verification_status"]["chart_generation"] = False
            results["errors"].append(f"Chart generation failed: {e}")
    
    # データベース接続の検証
    if args.test_database:
        try:
            verify_database(args.base_url, args.timeout, auth_headers)
            results["verification_status"]["database"] = True
        except VerificationError as e:
            logger.error(f"データベース接続検証エラー: {e}")
            results["verification_status"]["database"] = False
            results["errors"].append(f"Database connection failed: {e}")
    
    # 検証結果の集計
    total_tests = len(results["verification_status"])
    passed_tests = sum(1 for status in results["verification_status"].values() if status)
    
    logger.info(f"検証完了: {passed_tests}/{total_tests} テスト成功")
    
    # 結果の保存
    result_dir = save_verification_results(results)
    logger.info(f"詳細な検証結果: {result_dir}")
    
    # 全テスト成功の場合は0、失敗があれば1を返す
    return 0 if passed_tests == total_tests else 1


if __name__ == "__main__":
    sys.exit(main())