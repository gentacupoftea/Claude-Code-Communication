"""
データ同期エンジンのメインエントリーポイント
"""

import asyncio
import logging
import os
import sys
import signal
from datetime import datetime

from flask import Flask
import hypercorn.asyncio
from hypercorn.config import Config

from .api import app, sync_engine, scheduler
from .config import SyncConfig

# ロガー設定
logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('sync_engine.log')
    ]
)

# シャットダウンフラグ
shutdown_event = asyncio.Event()


# グレースフルシャットダウンハンドラー
def handle_shutdown(signal_num, frame):
    """シグナルハンドラー"""
    logger.info(f"シグナル {signal_num} を受信しました。シャットダウンを開始します...")
    shutdown_event.set()


# シグナルハンドラー登録
signal.signal(signal.SIGTERM, handle_shutdown)
signal.signal(signal.SIGINT, handle_shutdown)


async def shutdown():
    """グレースフルシャットダウン処理"""
    logger.info("同期エンジンをシャットダウンしています...")
    
    # スケジューラーが実行中なら停止
    if scheduler.is_running:
        await scheduler.stop()
    
    # 同期エンジンを停止
    await sync_engine.stop()
    
    logger.info("同期エンジンをシャットダウンしました")


async def startup():
    """起動時の処理"""
    logger.info("同期エンジンを起動しています...")
    
    # 同期エンジンの初期化
    success = await sync_engine.initialize()
    if not success:
        logger.error("同期エンジンの初期化に失敗しました")
        return False
    
    # 自動起動設定の場合はスケジューラーを開始
    auto_start = os.environ.get('AUTO_START_SCHEDULER', 'True').lower() == 'true'
    if auto_start:
        logger.info("スケジューラーを自動起動します")
        success = await scheduler.start()
        if not success:
            logger.error("スケジューラーの起動に失敗しました")
            return False
    
    logger.info("同期エンジンの起動が完了しました")
    return True


async def serve_api():
    """APIサーバーの実行"""
    port = int(os.environ.get('PORT', 8080))
    
    # Hypercorn設定
    config = Config()
    config.bind = [f"0.0.0.0:{port}"]
    config.keep_alive_timeout = 120
    config.accesslog = "-"  # 標準出力にアクセスログを出力
    
    # 開発モードの場合はデバッグオプションを有効化
    if os.environ.get('DEBUG', 'False').lower() == 'true':
        config.debug = True
        config.use_reloader = True
    
    logger.info(f"APIサーバーをポート {port} で起動しています...")
    
    # APIサーバーを開始
    server = hypercorn.asyncio.serve(app, config)
    
    # シャットダウンイベント監視タスク
    async def wait_for_shutdown():
        await shutdown_event.wait()
        logger.info("APIサーバーをシャットダウンしています...")
        return
    
    # サーバーとシャットダウン監視を同時に実行
    await asyncio.gather(server, wait_for_shutdown())
    
    # シャットダウン処理
    await shutdown()


def main():
    """メインエントリーポイント"""
    try:
        logger.info("データ同期エンジンを開始します")
        logger.info(f"開始時刻: {datetime.now().isoformat()}")
        
        # 環境変数情報をログに記録
        logger.info(f"GCP_PROJECT_ID: {os.environ.get('GCP_PROJECT_ID', 'conea-project-dev')}")
        logger.info(f"PORT: {os.environ.get('PORT', '8080')}")
        logger.info(f"AUTO_START_SCHEDULER: {os.environ.get('AUTO_START_SCHEDULER', 'True')}")
        
        # 非同期イベントループでAPIサーバーを実行
        asyncio.run(serve_api())
        
    except Exception as e:
        logger.error(f"データ同期エンジンの実行中にエラーが発生: {e}", exc_info=True)
        sys.exit(1)
    
    logger.info("データ同期エンジンを終了します")
    sys.exit(0)


if __name__ == "__main__":
    main()