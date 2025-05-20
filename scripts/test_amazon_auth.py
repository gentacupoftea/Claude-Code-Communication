#!/usr/bin/env python
"""
Amazon API認証テストスクリプト

Amazon API認証のテストを行い、トークンの取得を確認します。
"""

import os
import sys
import json
import asyncio
import logging
from datetime import datetime
from dotenv import load_dotenv

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('amazon_auth_test')

# プロジェクトルートへのパスを設定
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(PROJECT_ROOT)

# 環境変数を読み込む
def load_env_variables():
    """環境変数を読み込む"""
    # .envファイルの読み込み
    env_path = os.path.join(PROJECT_ROOT, '.env')
    load_dotenv(env_path)
    
    # AWS認証情報
    AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID')
    AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY')
    
    # Amazon Marketplace API認証情報
    AMAZON_SELLER_ID = os.environ.get('AMAZON_SELLER_ID')
    AMAZON_MARKETPLACE_ID = os.environ.get('AMAZON_MARKETPLACE_ID')
    AMAZON_APP_CLIENT_ID = os.environ.get('AMAZON_APP_CLIENT_ID')
    AMAZON_APP_CLIENT_SECRET = os.environ.get('AMAZON_APP_CLIENT_SECRET')
    AMAZON_API_ENDPOINT = os.environ.get('AMAZON_API_ENDPOINT')
    
    # 必須環境変数のチェック
    missing_vars = []
    for var_name in ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AMAZON_SELLER_ID', 
                    'AMAZON_MARKETPLACE_ID', 'AMAZON_APP_CLIENT_ID', 'AMAZON_APP_CLIENT_SECRET']:
        if not locals()[var_name]:
            missing_vars.append(var_name)
    
    if missing_vars:
        logger.error(f"以下の環境変数が設定されていません: {', '.join(missing_vars)}")
        sys.exit(1)
    
    return {
        'AWS_ACCESS_KEY_ID': AWS_ACCESS_KEY_ID,
        'AWS_SECRET_ACCESS_KEY': AWS_SECRET_ACCESS_KEY,
        'AMAZON_SELLER_ID': AMAZON_SELLER_ID,
        'AMAZON_MARKETPLACE_ID': AMAZON_MARKETPLACE_ID,
        'AMAZON_APP_CLIENT_ID': AMAZON_APP_CLIENT_ID,
        'AMAZON_APP_CLIENT_SECRET': AMAZON_APP_CLIENT_SECRET,
        'AMAZON_API_ENDPOINT': AMAZON_API_ENDPOINT,
        'AMAZON_API_TEST_MODE': 'true'
    }

# AmazonAPIClientのインポート
try:
    from src.api.amazon.client import AmazonAPIClient
except ImportError:
    logger.error("AmazonAPIClientモジュールをインポートできませんでした。")
    sys.exit(1)

async def test_authentication():
    """認証テスト"""
    # 環境変数の読み込み
    env_vars = load_env_variables()
    
    # クライアントの初期化
    client = AmazonAPIClient(env_vars)
    
    print("\n=== Amazon API認証テスト ===\n")
    
    # 認証テスト
    print("1. 基本認証テスト (client_credentials)...")
    auth_success = await client.authenticate()
    
    if auth_success:
        print(f"✅ 認証成功！")
        print(f"   アクセストークン: {client.auth_token[:10]}... (一部のみ表示)")
        print(f"   有効期限: {client.token_expiry.isoformat() if client.token_expiry else 'なし'}")
    else:
        print(f"❌ 認証失敗")
        sys.exit(1)
    
    # 接続テスト
    print("\n2. API接続テスト...")
    connection_success = await client.check_connection()
    
    if connection_success:
        print(f"✅ 接続テスト成功！")
    else:
        print(f"❌ 接続テスト失敗")
    
    # レート制限情報
    rate_limit_info = client.get_rate_limit_info()
    print(f"\n3. レート制限情報:")
    print(f"   リクエスト残: {rate_limit_info.requests_remaining}/{rate_limit_info.requests_limit}")
    print(f"   使用率: {rate_limit_info.usage_percentage * 100:.1f}%")
    
    # 認証URL生成テスト
    print("\n4. OAuth認証URL生成テスト...")
    try:
        redirect_uri = "https://example.ngrok.io/amazon/callback"
        # リダイレクトURIを設定
        client.redirect_uri = redirect_uri
        auth_url = client.get_authorization_url()
        print(f"✅ 認証URL生成成功！")
        print(f"   リダイレクトURI: {redirect_uri}")
        print(f"   認証URL（参考）: {auth_url[:70]}...(省略)")
    except Exception as e:
        print(f"❌ 認証URL生成失敗: {e}")
    
    # クライアントを閉じる
    await client.close()

if __name__ == "__main__":
    print("Amazon API認証テストを開始します...")
    asyncio.run(test_authentication())
    print("\nテストが完了しました。")