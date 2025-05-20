#!/usr/bin/env python
"""
楽天API実テスト用モックサーバー起動確認スクリプト
テスト実行前にモックサーバーが正常に動作しているか確認し、必要に応じて再起動します
"""

import os
import sys
import time
import signal
import requests
import subprocess
import psutil
from pathlib import Path

# スクリプトの絶対パスを取得
SCRIPT_DIR = Path(__file__).parent.absolute()

# モックサーバー設定
MOCK_SERVER_HOST = "127.0.0.1"
MOCK_SERVER_PORT = 8080
MOCK_SERVER_URL = f"http://{MOCK_SERVER_HOST}:{MOCK_SERVER_PORT}"
MOCK_SERVER_SCRIPT = SCRIPT_DIR / "mock_rakuten_server.py"
MOCK_SERVER_HEALTH_ENDPOINT = f"{MOCK_SERVER_URL}/es/2.0/shop/get"
AUTH_TOKEN_ENDPOINT = f"{MOCK_SERVER_URL}/es/2.0/auth/token"
MAX_RETRIES = 3
WAIT_TIME = 2  # サーバー起動待機時間(秒)

def is_server_running(port=8080):
    """指定ポートでサーバーが実行中かをチェック"""
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            for conn in proc.connections(kind='inet'):
                if conn.laddr.port == port:
                    return proc.pid
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
    return None

def check_server_health():
    """サーバーのヘルスチェック"""
    try:
        # 認証エンドポイントと接続チェック
        auth_response = requests.post(
            AUTH_TOKEN_ENDPOINT,
            data={
                "grant_type": "client_credentials",
                "scope": "rakuten_ichiba",
                "client_id": "mock_service_secret",
                "client_secret": "mock_license_key"
            }
        )
        
        if auth_response.status_code == 200 and 'access_token' in auth_response.json():
            token = auth_response.json()['access_token']
            
            # 認証トークンを使ってヘルスチェック
            health_response = requests.get(
                MOCK_SERVER_HEALTH_ENDPOINT, 
                headers={"Authorization": f"Bearer {token}"}
            )
            
            return health_response.status_code == 200
    except Exception as e:
        print(f"サーバーヘルスチェックエラー: {e}")
    
    return False

def start_mock_server():
    """モックサーバーを起動"""
    print(f"モックサーバーを起動中... ({MOCK_SERVER_SCRIPT})")
    
    # すでに実行中のサーバーをチェック
    existing_pid = is_server_running(MOCK_SERVER_PORT)
    if existing_pid:
        print(f"既存のサーバープロセスを停止中 (PID: {existing_pid})...")
        try:
            os.kill(existing_pid, signal.SIGTERM)
            time.sleep(1)  # 終了を待機
        except Exception as e:
            print(f"既存プロセスの停止に失敗: {e}")
    
    # サーバーを起動
    server_process = subprocess.Popen(
        [sys.executable, str(MOCK_SERVER_SCRIPT), "--host", MOCK_SERVER_HOST, "--port", str(MOCK_SERVER_PORT), "--no-errors"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    # サーバーの起動を待機
    for _ in range(MAX_RETRIES):
        time.sleep(WAIT_TIME)
        if check_server_health():
            print(f"モックサーバーが起動しました (PID: {server_process.pid})")
            return server_process.pid
    
    # サーバーの起動に失敗
    server_process.terminate()
    stdout, stderr = server_process.communicate()
    print(f"モックサーバーの起動に失敗しました。出力:\n{stdout}\nエラー:\n{stderr}")
    return None

def main():
    """メイン実行関数"""
    print("楽天API実テスト用モックサーバー起動確認を開始します")
    
    # サーバーが実行中かチェック
    existing_pid = is_server_running(MOCK_SERVER_PORT)
    if existing_pid:
        print(f"モックサーバーがポート {MOCK_SERVER_PORT} で実行中です (PID: {existing_pid})")
        
        # ヘルスチェック
        if check_server_health():
            print("サーバーは正常に動作しています")
            return True
        else:
            print("サーバーが応答していません。再起動します...")
            os.kill(existing_pid, signal.SIGTERM)
            time.sleep(1)  # 終了を待機
    
    # サーバーを起動
    server_pid = start_mock_server()
    if server_pid:
        print(f"モックサーバーの起動に成功しました (PID: {server_pid})")
        
        # 環境変数の設定
        os.environ["RAKUTEN_BASE_URL"] = MOCK_SERVER_URL
        os.environ["RAKUTEN_SERVICE_SECRET"] = "mock_service_secret"
        os.environ["RAKUTEN_LICENSE_KEY"] = "mock_license_key"
        os.environ["RAKUTEN_SHOP_ID"] = "mock_shop_id"
        os.environ["RAKUTEN_TEST_MODE"] = "true"
        
        return True
    else:
        print("モックサーバーの起動に失敗しました")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)