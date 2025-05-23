#!/usr/bin/env python3
"""
Conea Slack Bot 実行スクリプト
"""

import os
import sys
import asyncio
import logging
from dotenv import load_dotenv

# 環境変数の読み込み
load_dotenv()

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# パスの設定
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from slack_integration.slack_bot import ConeaSlackBot
from slack_bolt.adapter.socket_mode import SocketModeHandler


async def main():
    """メイン実行関数"""
    # 環境変数の確認
    slack_bot_token = os.getenv("SLACK_BOT_TOKEN")
    slack_app_token = os.getenv("SLACK_APP_TOKEN")
    
    if not slack_bot_token or not slack_app_token:
        logger.error("❌ SLACK_BOT_TOKEN と SLACK_APP_TOKEN を環境変数に設定してください")
        sys.exit(1)
    
    # MultiLLM API キーの確認
    api_keys = {
        "OpenAI": os.getenv("OPENAI_API_KEY"),
        "Anthropic": os.getenv("ANTHROPIC_API_KEY"),
        "Google AI": os.getenv("GOOGLE_AI_API_KEY")
    }
    
    missing_keys = [k for k, v in api_keys.items() if not v]
    if missing_keys:
        logger.warning(f"⚠️ 以下のAPIキーが設定されていません: {', '.join(missing_keys)}")
        logger.warning("一部の機能が制限される可能性があります")
    
    try:
        # Slack Bot の初期化
        logger.info("🚀 Conea Slack Bot を起動しています...")
        bot = ConeaSlackBot(
            token=slack_bot_token,
            app_token=slack_app_token
        )
        
        # ボットの初期化
        await bot.initialize()
        
        # Socket Mode ハンドラーの開始
        logger.info("🔌 Socket Mode で接続中...")
        handler = SocketModeHandler(bot.app, slack_app_token)
        
        # シグナルハンドラーの設定
        import signal
        
        def signal_handler(sig, frame):
            logger.info("\n👋 Conea Slack Bot を停止しています...")
            handler.close()
            sys.exit(0)
        
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
        # ボットの実行
        logger.info("✅ Conea Slack Bot が正常に起動しました!")
        logger.info("📱 Slackでボットを使用できます:")
        logger.info("   - @conea-dev: 開発タスク")
        logger.info("   - @conea-design: デザインタスク")
        logger.info("   - @conea-pm: プロジェクト管理")
        logger.info("   - /conea: スラッシュコマンド")
        logger.info("\nCtrl+C で停止します")
        
        # Socket Mode の開始（ブロッキング）
        handler.start()
        
    except Exception as e:
        logger.error(f"❌ ボットの起動に失敗しました: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    # デバッグモード
    if os.getenv("DEBUG", "").lower() == "true":
        logging.getLogger().setLevel(logging.DEBUG)
        logger.debug("🐛 デバッグモードが有効です")
    
    # 非同期実行
    asyncio.run(main())