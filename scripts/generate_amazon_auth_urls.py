#!/usr/bin/env python
"""
Amazon API認証URLジェネレータ

OAuth認証フローに必要なURLを生成し、認証フローを開始するためのスクリプト。
"""

import os
import sys
import argparse
import uuid
import urllib.parse
from datetime import datetime
import json
import logging
from dotenv import load_dotenv

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('amazon_auth')

# プロジェクトルートへのパスを設定
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(PROJECT_ROOT)

# 必要に応じて更新
try:
    from src.api.amazon.client import AmazonAPIClient
except ImportError:
    logger.error("AmazonAPIClientモジュールをインポートできませんでした。")
    sys.exit(1)

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

def generate_auth_urls(redirect_uri, scopes=None):
    """
    Amazon APIの認証URLを生成する
    
    Args:
        redirect_uri: OAuthリダイレクトURI
        scopes: 必要なスコープのリスト
    
    Returns:
        dict: 各種認証URL
    """
    # デフォルトスコープ
    if not scopes:
        scopes = [
            # 基本スコープ
            "sellingpartnerapi::notifications",
            "sellingpartnerapi::catalog:read", 
            "sellingpartnerapi::orders:read", 
            "sellingpartnerapi::inventory:read",
            
            # 財務・レポート関連スコープ
            "sellingpartnerapi::finances:read",
            "sellingpartnerapi::reports:read",
            
            # 分析スコープ
            "sellingpartnerapi::analytics:read",
            
            # ベンダー関連スコープ
            "sellingpartnerapi::vendor:read",
            "sellingpartnerapi::vendor_orders:read",
            
            # Amazon Business関連スコープ
            "sellingpartnerapi::business_reports:read",
            "sellingpartnerapi::business_pricing:read",
            "sellingpartnerapi::business_purchase_orders:read"
        ]
    
    # 環境変数の読み込み
    env_vars = load_env_variables()
    
    # リダイレクトURI設定
    env_vars['AMAZON_REDIRECT_URI'] = redirect_uri
    env_vars['AMAZON_AUTH_METHOD'] = 'refresh_token'
    
    # 安全な状態パラメータの生成
    state = str(uuid.uuid4())
    
    try:
        # AmazonAPIClientのインスタンス化
        client = AmazonAPIClient(env_vars)
        
        # OAuth認可URLの生成
        params = {
            "client_id": env_vars['AMAZON_APP_CLIENT_ID'],
            "response_type": "code",
            "redirect_uri": redirect_uri,
            "scope": " ".join(scopes),
            "state": state
        }
        
        query_string = urllib.parse.urlencode(params)
        authorization_url = f"https://sellercentral.amazon.com/apps/authorize?{query_string}"
        
        # リダイレクトURL画面用URL
        redirect_configuration_url = "https://sellercentral.amazon.com/apps/manage"
        
        # 結果の準備
        auth_urls = {
            "authorization_url": authorization_url,
            "redirect_configuration_url": redirect_configuration_url,
            "redirect_uri": redirect_uri,
            "state": state,
            "scopes": scopes,
            "generated_at": datetime.now().isoformat()
        }
        
        return auth_urls
        
    except Exception as e:
        logger.exception(f"認証URL生成中にエラーが発生しました: {e}")
        sys.exit(1)

def save_urls_to_file(auth_urls, output_file):
    """生成されたURLをJSONファイルに保存"""
    try:
        with open(output_file, 'w') as f:
            json.dump(auth_urls, f, indent=2, ensure_ascii=False)
        logger.info(f"認証URLを {output_file} に保存しました")
    except Exception as e:
        logger.error(f"ファイル保存中にエラーが発生しました: {e}")

def main():
    parser = argparse.ArgumentParser(description='Amazon API認証URL生成ツール')
    parser.add_argument('--redirect-uri', required=True, 
                        help='OAuthリダイレクトURI (例: https://example.ngrok.io/amazon/callback)')
    parser.add_argument('--output', default='amazon_auth_urls.json',
                        help='出力JSONファイルのパス (デフォルト: amazon_auth_urls.json)')
    parser.add_argument('--scopes', nargs='+',
                        help='スペース区切りのスコープリスト (オプション)')
    
    args = parser.parse_args()
    
    # URLの生成
    auth_urls = generate_auth_urls(args.redirect_uri, args.scopes)
    
    # 結果の表示
    print("\n=== Amazon API認証URL ===\n")
    print(f"1. 認可URL (このURLにアクセスしてOAuth認証を開始してください):")
    print(f"   {auth_urls['authorization_url']}\n")
    
    print(f"2. リダイレクトURIの設定:")
    print(f"   設定URL: {auth_urls['redirect_configuration_url']}")
    print(f"   リダイレクトURI: {auth_urls['redirect_uri']}")
    print(f"   説明: Amazon Seller Centralでアプリケーション設定を開き、上記のリダイレクトURIを登録してください。\n")
    
    print(f"3. 状態パラメータ (検証用):")
    print(f"   {auth_urls['state']}\n")
    
    print(f"4. リクエストされたスコープ:")
    for scope in auth_urls['scopes']:
        print(f"   - {scope}")
    print("")
    
    # ファイルへの保存
    save_urls_to_file(auth_urls, args.output)

if __name__ == "__main__":
    main()