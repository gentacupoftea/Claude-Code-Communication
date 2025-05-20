#!/usr/bin/env python
"""
Amazon API OAuth認証コールバックサーバー

ngrokを使用してローカルサーバーを公開し、OAuthコールバックを処理します。
"""

import os
import sys
import argparse
import logging
import asyncio
import json
from datetime import datetime
import subprocess
import webbrowser
from aiohttp import web

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('amazon_oauth_server')

# プロジェクトルートへのパスを設定
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(PROJECT_ROOT)

# 必要に応じて更新
try:
    from src.api.amazon.client import AmazonAPIClient
except ImportError:
    logger.error("AmazonAPIClientモジュールをインポートできませんでした。")
    sys.exit(1)

# グローバル変数
CONFIG = {
    'client_id': '',
    'redirect_uri': '',
    'state': '',
    'authorization_url': '',
    'port': 8000,
    'callback_path': '/amazon/callback',
    'token_info': None
}

def check_ngrok_installation():
    """ngrokのインストール状態を確認"""
    try:
        result = subprocess.run(['ngrok', 'version'], capture_output=True, text=True)
        if result.returncode == 0:
            logger.info(f"ngrokのバージョン: {result.stdout.strip()}")
            return True
        else:
            logger.error("ngrokがインストールされていないか、実行できません。")
            return False
    except Exception:
        logger.error("ngrokがインストールされていないか、実行できません。")
        return False

def start_ngrok(port):
    """ngrokを起動してローカルサーバーを公開"""
    try:
        # 既存のngrokプロセスを終了
        try:
            subprocess.run(['killall', 'ngrok'], capture_output=True)
        except Exception:
            pass
        
        # ngrokを起動
        ngrok_process = subprocess.Popen(
            ['ngrok', 'http', str(port)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        # ngrokのURLを取得
        time.sleep(2)  # ngrokが起動するまで少し待つ
        
        try:
            result = subprocess.run(
                ['curl', '-s', 'http://localhost:4040/api/tunnels'],
                capture_output=True,
                text=True
            )
            
            ngrok_data = json.loads(result.stdout)
            public_url = None
            
            for tunnel in ngrok_data.get('tunnels', []):
                if tunnel.get('proto') == 'https':
                    public_url = tunnel.get('public_url')
                    break
            
            if not public_url:
                logger.error("ngrokのパブリックURLを取得できませんでした。")
                return None
            
            logger.info(f"ngrokのパブリックURL: {public_url}")
            return public_url
            
        except Exception as e:
            logger.error(f"ngrokのURLを取得中にエラーが発生しました: {e}")
            return None
        
    except Exception as e:
        logger.error(f"ngrokの起動中にエラーが発生しました: {e}")
        return None

async def generate_auth_urls(redirect_uri):
    """Amazon API認証URLを生成"""
    from scripts.generate_amazon_auth_urls import load_env_variables, generate_auth_urls
    
    # 環境変数の読み込み
    env_vars = load_env_variables()
    
    # リダイレクトURI設定
    CONFIG['client_id'] = env_vars['AMAZON_APP_CLIENT_ID']
    CONFIG['redirect_uri'] = redirect_uri
    
    # 認証URLの生成
    auth_urls = generate_auth_urls(redirect_uri)
    CONFIG['state'] = auth_urls['state']
    CONFIG['authorization_url'] = auth_urls['authorization_url']
    
    return auth_urls

async def exchange_authorization_code(auth_code):
    """認可コードをトークンに交換"""
    from scripts.process_amazon_oauth_callback import exchange_authorization_code, update_env_file
    
    # 認可コードの交換
    token_info = await exchange_authorization_code(auth_code, CONFIG['redirect_uri'])
    
    if token_info:
        # .envファイルの更新
        update_env_file(token_info, CONFIG['redirect_uri'])
        CONFIG['token_info'] = token_info
        return True
    
    return False

# Webアプリケーションルート
async def index_handler(request):
    """トップページハンドラ"""
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Amazon API OAuth認証</title>
        <style>
            body {{ font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }}
            .button {{ display: inline-block; background-color: #FF9900; color: white; padding: 10px 20px; 
                     text-decoration: none; border-radius: 4px; margin-top: 10px; }}
            .info {{ background-color: #f0f0f0; padding: 15px; border-radius: 4px; margin: 15px 0; }}
            pre {{ background-color: #f5f5f5; padding: 10px; overflow-x: auto; }}
            .success {{ color: green; }}
            .error {{ color: red; }}
        </style>
    </head>
    <body>
        <h1>Amazon API OAuth認証</h1>
        
        <div class="info">
            <h2>設定情報</h2>
            <p><strong>リダイレクトURI:</strong> {CONFIG['redirect_uri']}</p>
            <p><strong>コールバックパス:</strong> {CONFIG['callback_path']}</p>
            <p><strong>クライアントID:</strong> {CONFIG['client_id'][:10]}...</p>
            <p><strong>状態パラメータ:</strong> {CONFIG['state']}</p>
        </div>
        
        <h2>認証手順</h2>
        <p>次のリンクをクリックして認証を開始します：</p>
        <a href="{CONFIG['authorization_url']}" class="button" target="_blank">Amazon認証を開始</a>
        
        <div class="info">
            <h3>注意事項</h3>
            <p>認証後、自動的にこのページにリダイレクトされます。</p>
            <p>Amazon Seller Centralで<strong>リダイレクトURI</strong>が正しく設定されていることを確認してください。</p>
        </div>
        
        {f'''
        <div class="success">
            <h2>✅ 認証成功</h2>
            <p>リフレッシュトークンが.envファイルに保存されました。</p>
            <p>今後はこのトークンを使って自動的に認証されます。</p>
            <pre>
アクセストークン: {CONFIG['token_info']['access_token'][:10]}...
リフレッシュトークン: {CONFIG['token_info']['refresh_token'][:10]}...
有効期限: {CONFIG['token_info']['expires_at']}
            </pre>
        </div>
        ''' if CONFIG['token_info'] else ''}
    </body>
    </html>
    """
    
    return web.Response(text=html, content_type='text/html')

async def callback_handler(request):
    """OAuthコールバックハンドラ"""
    # URLパラメータの取得
    params = request.query
    
    # 認可コードと状態パラメータの確認
    auth_code = params.get('code')
    state = params.get('state')
    
    if not auth_code:
        error = params.get('error', 'unknown_error')
        error_description = params.get('error_description', 'No description provided')
        logger.error(f"認証エラー: {error} - {error_description}")
        
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Amazon API OAuth認証エラー</title>
            <style>
                body {{ font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }}
                .error {{ color: red; background-color: #fee; padding: 15px; border-radius: 4px; }}
            </style>
            <meta http-equiv="refresh" content="5;url=/" />
        </head>
        <body>
            <h1>Amazon API OAuth認証エラー</h1>
            <div class="error">
                <h2>エラーが発生しました</h2>
                <p><strong>エラーコード:</strong> {error}</p>
                <p><strong>エラー詳細:</strong> {error_description}</p>
            </div>
            <p>5秒後にトップページにリダイレクトします...</p>
        </body>
        </html>
        """
        return web.Response(text=html, content_type='text/html')
    
    if state != CONFIG['state']:
        logger.error(f"状態パラメータが一致しません: {state} != {CONFIG['state']}")
        
        html = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Amazon API OAuth認証エラー</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
                .error { color: red; background-color: #fee; padding: 15px; border-radius: 4px; }
            </style>
            <meta http-equiv="refresh" content="5;url=/" />
        </head>
        <body>
            <h1>Amazon API OAuth認証エラー</h1>
            <div class="error">
                <h2>状態パラメータが一致しません</h2>
                <p>セキュリティ上の理由から、認証プロセスが中断されました。</p>
            </div>
            <p>5秒後にトップページにリダイレクトします...</p>
        </body>
        </html>
        """
        return web.Response(text=html, content_type='text/html')
    
    # 認可コードをトークンに交換
    success = await exchange_authorization_code(auth_code)
    
    if not success:
        html = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Amazon API OAuth認証エラー</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
                .error { color: red; background-color: #fee; padding: 15px; border-radius: 4px; }
            </style>
            <meta http-equiv="refresh" content="5;url=/" />
        </head>
        <body>
            <h1>Amazon API OAuth認証エラー</h1>
            <div class="error">
                <h2>トークン交換に失敗しました</h2>
                <p>認可コードをアクセストークンに交換できませんでした。ログを確認してください。</p>
            </div>
            <p>5秒後にトップページにリダイレクトします...</p>
        </body>
        </html>
        """
        return web.Response(text=html, content_type='text/html')
    
    # 成功したら5秒後にトップページにリダイレクト
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Amazon API OAuth認証成功</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            .success { color: green; background-color: #efe; padding: 15px; border-radius: 4px; }
        </style>
        <meta http-equiv="refresh" content="5;url=/" />
    </head>
    <body>
        <h1>Amazon API OAuth認証成功</h1>
        <div class="success">
            <h2>認証が完了しました</h2>
            <p>アクセストークンとリフレッシュトークンを取得しました。</p>
            <p>.envファイルが更新されました。</p>
        </div>
        <p>5秒後にトップページにリダイレクトします...</p>
    </body>
    </html>
    """
    return web.Response(text=html, content_type='text/html')

async def start_server():
    """Webサーバーを起動"""
    app = web.Application()
    app.router.add_get('/', index_handler)
    app.router.add_get(CONFIG['callback_path'], callback_handler)
    
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, 'localhost', CONFIG['port'])
    
    logger.info(f"Webサーバーを起動します: http://localhost:{CONFIG['port']}")
    await site.start()
    
    return runner

def main():
    parser = argparse.ArgumentParser(description='Amazon API OAuth認証サーバー')
    parser.add_argument('--port', type=int, default=8000, 
                        help='ローカルサーバーのポート番号 (デフォルト: 8000)')
    parser.add_argument('--path', default='/amazon/callback',
                        help='コールバックパス (デフォルト: /amazon/callback)')
    
    args = parser.parse_args()
    
    # 設定の更新
    CONFIG['port'] = args.port
    CONFIG['callback_path'] = args.path
    
    # ngrokのインストール確認
    if not check_ngrok_installation():
        print("ngrokがインストールされていません。以下のコマンドでインストールしてください：")
        print("  brew install ngrok")
        print("または https://ngrok.com からダウンロードしてください。")
        sys.exit(1)
    
    try:
        # asyncioイベントループの取得
        loop = asyncio.get_event_loop()
        
        # ngrokの起動
        ngrok_url = start_ngrok(CONFIG['port'])
        if not ngrok_url:
            print("ngrokの起動に失敗しました。")
            sys.exit(1)
        
        # リダイレクトURIの設定
        CONFIG['redirect_uri'] = f"{ngrok_url}{CONFIG['callback_path']}"
        
        # 認証URLの生成
        auth_urls = loop.run_until_complete(generate_auth_urls(CONFIG['redirect_uri']))
        
        # Webサーバーの起動
        runner = loop.run_until_complete(start_server())
        
        # ブラウザでWebサーバーを開く
        webbrowser.open(f"http://localhost:{CONFIG['port']}")
        
        print(f"\n=== Amazon API OAuth認証サーバーが起動しました ===\n")
        print(f"ブラウザで次のURLにアクセスしてください: http://localhost:{CONFIG['port']}")
        print(f"ngrokパブリックURL: {ngrok_url}")
        print(f"リダイレクトURI: {CONFIG['redirect_uri']}")
        print("\nCtrl+Cで終了します...\n")
        
        # サーバーの実行
        loop.run_forever()
    
    except KeyboardInterrupt:
        print("\nサーバーを終了します...")
    finally:
        # ngrokプロセスの終了
        try:
            subprocess.run(['killall', 'ngrok'], capture_output=True)
        except Exception:
            pass
        
        # サーバーの終了
        if 'runner' in locals():
            loop.run_until_complete(runner.cleanup())
        
        # イベントループの終了
        loop.close()

if __name__ == "__main__":
    import time
    main()