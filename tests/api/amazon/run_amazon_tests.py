#!/usr/bin/env python
"""
Amazon Marketplace API 実環境接続テスト

Coneaの複数ECプラットフォーム連携機能の基盤を検証します。
"""

import os
import sys
import json
import time
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List

# Add src directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

from src.api.amazon.client import AmazonAPIClient, AmazonAPIError

# ロギング設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(f'amazon_test_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log')
    ]
)
logger = logging.getLogger('amazon_tests')

# テスト結果
test_results = {
    "summary": {
        "start_time": datetime.now().isoformat(),
        "end_time": None,
        "total_tests": 0,
        "passed": 0,
        "failed": 0,
        "success_rate": 0
    },
    "tests": []
}

def register_test_result(test_name: str, passed: bool, duration: float, details: Dict[str, Any] = None):
    """テスト結果を登録"""
    test_results["tests"].append({
        "name": test_name,
        "passed": passed,
        "duration": duration,
        "timestamp": datetime.now().isoformat(),
        "details": details or {}
    })
    
    test_results["summary"]["total_tests"] += 1
    if passed:
        test_results["summary"]["passed"] += 1
    else:
        test_results["summary"]["failed"] += 1
    
    test_results["summary"]["success_rate"] = (
        test_results["summary"]["passed"] / test_results["summary"]["total_tests"]
        if test_results["summary"]["total_tests"] > 0 else 0
    )

async def test_connection(client: AmazonAPIClient):
    """基本接続テスト"""
    test_name = "基本接続テスト"
    start_time = time.time()
    details = {}
    
    try:
        logger.info(f"実行中: {test_name}")
        
        # 認証テスト
        auth_result = await client.authenticate()
        details["authentication"] = auth_result
        
        if not auth_result:
            logger.error("認証失敗")
            register_test_result(test_name, False, time.time() - start_time, details)
            return
        
        logger.info("認証成功")
        
        # 接続テスト
        connection_result = await client.check_connection()
        details["connection"] = connection_result
        
        if not connection_result:
            logger.error("接続テスト失敗")
            register_test_result(test_name, False, time.time() - start_time, details)
            return
        
        logger.info("接続テスト成功")
        
        # レート制限情報
        rate_limit_info = client.get_rate_limit_info()
        details["rate_limit"] = {
            "requests_remaining": rate_limit_info.requests_remaining,
            "requests_limit": rate_limit_info.requests_limit,
            "usage_percentage": rate_limit_info.usage_percentage
        }
        
        logger.info(f"レート制限情報: 残り {rate_limit_info.requests_remaining}/{rate_limit_info.requests_limit}")
        
        register_test_result(test_name, True, time.time() - start_time, details)
    
    except Exception as e:
        logger.exception(f"テスト中にエラーが発生: {e}")
        details["error"] = str(e)
        register_test_result(test_name, False, time.time() - start_time, details)

async def test_products(client: AmazonAPIClient):
    """製品データテスト"""
    test_name = "製品データテスト"
    start_time = time.time()
    details = {"products": []}
    
    try:
        logger.info(f"実行中: {test_name}")
        
        # 商品リスト取得テスト
        logger.info("商品リスト取得テスト")
        
        products = await client.get_products(limit=5, filters={"query": "wireless headphones"})
        details["product_list"] = {
            "count": len(products),
            "sample": products[0] if products else None
        }
        
        if not products:
            logger.error("商品リスト取得失敗")
            register_test_result(test_name, False, time.time() - start_time, details)
            return
        
        logger.info(f"{len(products)} 商品を取得")
        
        # 商品詳細取得テスト
        if products:
            product_id = products[0]["id"]
            logger.info(f"商品詳細取得テスト: {product_id}")
            
            product_details = await client.get_product(product_id)
            details["product_details"] = {
                "id": product_details.get("id"),
                "title": product_details.get("title"),
                "image_count": len(product_details.get("images", []))
            }
            
            logger.info(f"商品詳細を取得: {product_details.get('title')}")
            details["products"].append(product_details)
        
        # 在庫情報取得テスト
        logger.info("在庫情報取得テスト")
        try:
            inventory = await client.get_inventory(product_id)
            details["inventory"] = {
                "product_id": inventory.get("product_id"),
                "sku": inventory.get("sku"),
                "quantity": inventory.get("quantity")
            }
            logger.info(f"在庫情報を取得: 商品ID {inventory.get('product_id')}, 在庫数 {inventory.get('quantity')}")
        except Exception as e:
            logger.warning(f"在庫情報取得中にエラー: {e} (テスト継続)")
            details["inventory_error"] = str(e)
        
        register_test_result(test_name, True, time.time() - start_time, details)
    
    except Exception as e:
        logger.exception(f"テスト中にエラーが発生: {e}")
        details["error"] = str(e)
        register_test_result(test_name, False, time.time() - start_time, details)

async def test_orders(client: AmazonAPIClient):
    """注文データテスト"""
    test_name = "注文データテスト"
    start_time = time.time()
    details = {"orders": []}
    
    try:
        logger.info(f"実行中: {test_name}")
        
        # 過去30日間の注文を取得
        created_after = (datetime.now() - timedelta(days=30)).isoformat()
        
        # 注文リスト取得テスト
        logger.info("注文リスト取得テスト")
        
        orders = await client.get_orders(
            limit=5,
            filters={"created_after": created_after}
        )
        
        details["order_list"] = {
            "count": len(orders),
            "sample": orders[0] if orders else None,
            "filter": {"created_after": created_after}
        }
        
        if not orders:
            logger.warning("注文が取得できませんでした。テスト期間を拡大するか、注文がある状態でテストしてください。")
            # 注文がなくてもテストは継続（失敗とはしない）
        else:
            logger.info(f"{len(orders)} 注文を取得")
            
            # 注文詳細取得テスト
            order_id = orders[0]["id"]
            logger.info(f"注文詳細取得テスト: {order_id}")
            
            order_details = await client.get_order(order_id)
            details["order_details"] = {
                "id": order_details.get("id"),
                "status": order_details.get("status"),
                "created_at": order_details.get("created_at"),
                "item_count": len(order_details.get("items", []))
            }
            
            logger.info(f"注文詳細を取得: 注文ID {order_details.get('id')}, ステータス {order_details.get('status')}")
            details["orders"].append(order_details)
        
        register_test_result(test_name, True, time.time() - start_time, details)
    
    except Exception as e:
        logger.exception(f"テスト中にエラーが発生: {e}")
        details["error"] = str(e)
        register_test_result(test_name, False, time.time() - start_time, details)

async def test_error_handling(client: AmazonAPIClient):
    """エラー処理テスト"""
    test_name = "エラー処理テスト"
    start_time = time.time()
    details = {}
    
    try:
        logger.info(f"実行中: {test_name}")
        
        # 無効なリクエストテスト
        logger.info("無効なリクエストテスト")
        try:
            await client.get_product("invalid-product-id")
            logger.error("無効なリクエストが成功しました。エラーハンドリングに問題があります。")
            details["invalid_request"] = "エラーが発生しませんでした"
            passed = False
        except AmazonAPIError as e:
            logger.info(f"予想通りエラーが発生: {e}")
            details["invalid_request"] = "正常にエラーが処理されました"
            details["error_code"] = getattr(e, "code", None)
            details["error_message"] = str(e)
            passed = True
        
        # レート制限テスト (このテストは実施しない - 実際にレート制限をトリガーするのは望ましくない)
        details["rate_limit_test"] = "実施しません (実際のレート制限をトリガーすることを避けるため)"
        
        register_test_result(test_name, passed, time.time() - start_time, details)
    
    except Exception as e:
        logger.exception(f"テスト中に予期しないエラーが発生: {e}")
        details["error"] = str(e)
        register_test_result(test_name, False, time.time() - start_time, details)

async def run_tests():
    """すべてのテストを実行"""
    logger.info("Amazon API テストを開始します")
    
    # 設定読み込み
    config = {
        'AWS_ACCESS_KEY_ID': os.environ.get('AWS_ACCESS_KEY_ID'),
        'AWS_SECRET_ACCESS_KEY': os.environ.get('AWS_SECRET_ACCESS_KEY'),
        'AMAZON_SELLER_ID': os.environ.get('AMAZON_SELLER_ID'),
        'AMAZON_MARKETPLACE_ID': os.environ.get('AMAZON_MARKETPLACE_ID'),
        'AMAZON_APP_CLIENT_ID': os.environ.get('AMAZON_APP_CLIENT_ID'),
        'AMAZON_APP_CLIENT_SECRET': os.environ.get('AMAZON_APP_CLIENT_SECRET'),
        'AMAZON_API_ENDPOINT': os.environ.get('AMAZON_API_ENDPOINT'),
        'AMAZON_API_TEST_MODE': os.environ.get('AMAZON_API_TEST_MODE')
    }
    
    # 必須パラメータチェック
    missing_params = [k for k, v in config.items() if v is None]
    if missing_params:
        logger.error(f"必須パラメータが設定されていません: {missing_params}")
        logger.error("環境変数を正しく設定してから再実行してください")
        sys.exit(1)
    
    # クライアントの初期化
    client = AmazonAPIClient(config)
    
    try:
        # テスト実行
        await test_connection(client)
        
        # 接続テストが失敗した場合は残りのテストをスキップ
        if not test_results["tests"][0]["passed"]:
            logger.error("接続テストが失敗したため、残りのテストをスキップします")
            return
        
        # リクエスト間の待機時間 (レート制限対策)
        await asyncio.sleep(1)
        
        await test_products(client)
        await asyncio.sleep(1)
        
        await test_orders(client)
        await asyncio.sleep(1)
        
        await test_error_handling(client)
    
    finally:
        # クライアントを閉じる
        await client.close()
        
        # 終了時間を記録
        test_results["summary"]["end_time"] = datetime.now().isoformat()
        
        # 結果を表示
        logger.info("テスト結果サマリー:")
        logger.info(f"合計テスト数: {test_results['summary']['total_tests']}")
        logger.info(f"成功: {test_results['summary']['passed']}")
        logger.info(f"失敗: {test_results['summary']['failed']}")
        logger.info(f"成功率: {test_results['summary']['success_rate'] * 100:.1f}%")
        
        # 結果をファイルに保存
        with open('amazon_api_test_report.json', 'w') as f:
            json.dump(test_results, f, indent=2)
        
        logger.info("テスト結果を amazon_api_test_report.json に保存しました")
        
        # テスト結果の要約をマークダウンで保存
        with open('TEST_RESULTS.md', 'w') as f:
            f.write("# Amazon API テスト結果\n\n")
            f.write(f"実行日時: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            
            f.write("## 概要\n\n")
            f.write(f"- 合計テスト数: {test_results['summary']['total_tests']}\n")
            f.write(f"- 成功: {test_results['summary']['passed']}\n")
            f.write(f"- 失敗: {test_results['summary']['failed']}\n")
            f.write(f"- 成功率: {test_results['summary']['success_rate'] * 100:.1f}%\n\n")
            
            f.write("## 詳細結果\n\n")
            for test in test_results['tests']:
                status = "✅ 成功" if test['passed'] else "❌ 失敗"
                f.write(f"### {test['name']} - {status}\n\n")
                f.write(f"- 所要時間: {test['duration']:.2f}秒\n")
                
                if not test['passed'] and 'error' in test['details']:
                    f.write(f"- エラー: {test['details']['error']}\n")
                
                f.write("\n")
            
            f.write("## 次のステップ\n\n")
            if test_results['summary']['success_rate'] >= 0.8:
                f.write("- テストは成功しました。フェーズ2 (コアAPI実装) に進むことができます。\n")
            else:
                f.write("- テストの成功率が低いため、発生した問題を解決してから再テストしてください。\n")
            
            f.write("\n")
            f.write("## フェーズ2に向けた提言\n\n")
            f.write("1. 認証処理の強化: トークンをローカルキャッシュし、必要な場合のみ更新\n")
            f.write("2. レート制限対策: 適応的バックオフの実装とリクエストのバッチ処理\n")
            f.write("3. エラーハンドリング: 特定のエラーに対する自動リトライ機構の実装\n")
            f.write("4. 在庫同期: AmazonとConeaプラットフォーム間の在庫同期メカニズムの実装\n")
            f.write("5. キャッシュ戦略: 頻繁に変更されないデータのキャッシュによるAPI呼び出し削減\n")
        
        logger.info("テスト結果の詳細を TEST_RESULTS.md に保存しました")

if __name__ == "__main__":
    asyncio.run(run_tests())