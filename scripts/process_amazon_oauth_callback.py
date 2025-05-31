#!/usr/bin/env python
"""
Amazon API OAuth認証コールバック処理スクリプト

認可コードをアクセストークンとリフレッシュトークンに交換し、.envファイルを更新します。
"""

import os
import sys
import argparse
import logging
import asyncio
import re
from dotenv import load_dotenv

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('amazon_oauth')

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

async def exchange_authorization_code(auth_code, redirect_uri):
    """
    認可コードをアクセストークンとリフレッシュトークンに交換する
    
    Args:
        auth_code: OAuthコールバックで受け取った認可コード
        redirect_uri: OAuthリダイレクトURI
    
    Returns:
        dict: トークン情報
    """
    # 環境変数の読み込み
    env_vars = load_env_variables()
    
    # リダイレクトURI設定
    env_vars['AMAZON_REDIRECT_URI'] = redirect_uri
    env_vars['AMAZON_AUTH_METHOD'] = 'refresh_token'
    
    try:
        # AmazonAPIClientのインスタンス化
        client = AmazonAPIClient(env_vars)
        
        # 認可コードの交換
        success = await client.exchange_authorization_code(auth_code)
        
        if not success:
            logger.error("認可コードの交換に失敗しました。")
            return None
        
        # 結果の準備
        token_info = {
            "access_token": client.auth_token,
            "refresh_token": client.refresh_token,
            "expires_at": client.token_expiry.isoformat() if client.token_expiry else None
        }
        
        return token_info
        
    except Exception as e:
        logger.exception(f"認可コードの交換中にエラーが発生しました: {e}")
        return None

def update_env_file(token_info, redirect_uri):
    """
    .envファイルを更新して、リフレッシュトークンと認証方式を設定
    
    Args:
        token_info: トークン情報
        redirect_uri: OAuthリダイレクトURI
    
    Returns:
        bool: 更新が成功したかどうか
    """
    env_path = os.path.join(PROJECT_ROOT, '.env')
    
    try:
        # 現在の.envファイルの内容を読み込む
        with open(env_path, 'r') as f:
            env_content = f.read()
        
        # 既存のAMAZON_AUTH_METHODとAMAZON_REDIRECT_URIがあれば更新、なければ追加
        if 'AMAZON_AUTH_METHOD=' in env_content:
            env_content = re.sub(r'AMAZON_AUTH_METHOD=.*', f'AMAZON_AUTH_METHOD=refresh_token', env_content)
        else:
            env_content += f'\nAMAZON_AUTH_METHOD=refresh_token'
        
        if 'AMAZON_REDIRECT_URI=' in env_content:
            env_content = re.sub(r'AMAZON_REDIRECT_URI=.*', f'AMAZON_REDIRECT_URI={redirect_uri}', env_content)
        elif '# AMAZON_REDIRECT_URI=' in env_content:
            env_content = re.sub(r'# AMAZON_REDIRECT_URI=.*', f'AMAZON_REDIRECT_URI={redirect_uri}', env_content)
        else:
            env_content += f'\nAMAZON_REDIRECT_URI={redirect_uri}'
        
        # リフレッシュトークンの設定
        if 'AMAZON_REFRESH_TOKEN=' in env_content:
            env_content = re.sub(r'AMAZON_REFRESH_TOKEN=.*', f'AMAZON_REFRESH_TOKEN={token_info["refresh_token"]}', env_content)
        elif '# AMAZON_REFRESH_TOKEN=' in env_content:
            env_content = re.sub(r'# AMAZON_REFRESH_TOKEN=.*', f'AMAZON_REFRESH_TOKEN={token_info["refresh_token"]}', env_content)
        else:
            env_content += f'\nAMAZON_REFRESH_TOKEN={token_info["refresh_token"]}'
        
        # 更新した内容を.envファイルに書き込む
        with open(env_path, 'w') as f:
            f.write(env_content)
        
        logger.info(f".envファイルを更新しました: {env_path}")
        return True
    
    except Exception as e:
        logger.exception(f".envファイルの更新中にエラーが発生しました: {e}")
        return False

async def main():
    parser = argparse.ArgumentParser(description='Amazon API OAuth認証コールバック処理ツール')
    parser.add_argument('--code', required=True, 
                        help='OAuthコールバックで受け取った認可コード')
    parser.add_argument('--redirect-uri', required=True, 
                        help='OAuthリダイレクトURI (認可リクエスト時と同じ値)')
    parser.add_argument('--state', 
                        help='状態パラメータ (検証用、オプション)')
    
    args = parser.parse_args()
    
    # 認可コードの交換
    logger.info("認可コードをトークンに交換します...")
    token_info = await exchange_authorization_code(args.code, args.redirect_uri)
    
    if not token_info:
        logger.error("トークン交換に失敗しました。")
        sys.exit(1)
    
    # .envファイルの更新
    if update_env_file(token_info, args.redirect_uri):
        # 結果の表示
        print("\n=== Amazon API OAuth認証が完了しました ===\n")
        print(f"アクセストークン: {token_info['access_token'][:10]}...（一部のみ表示）")
        print(f"リフレッシュトークン: {token_info['refresh_token'][:10]}...（一部のみ表示）")
        print(f"有効期限: {token_info['expires_at']}")
        print("\n.envファイルが更新されました。今後はリフレッシュトークンを使用して認証されます。\n")
    else:
        print("\n=== トークンの取得は成功しましたが、.envファイルの更新に失敗しました ===\n")
        print(f"手動で.envファイルを更新してください:")
        print(f"AMAZON_AUTH_METHOD=refresh_token")
        print(f"AMAZON_REDIRECT_URI={args.redirect_uri}")
        print(f"AMAZON_REFRESH_TOKEN={token_info['refresh_token']}")

if __name__ == "__main__":
    asyncio.run(main())