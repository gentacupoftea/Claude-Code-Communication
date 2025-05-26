#!/usr/bin/env python3
"""
Slack Bot Test Script - デバッグ用
"""

import asyncio
import sys
import os
sys.path.append('/Users/mourigenta/shopify-mcp-server/slack_integration')

from slack_bot_v2 import SlackClaudeBot, load_slack_config, AI_ROLES

async def test_bot():
    print("🧪 Slack Bot テスト開始...")
    
    # 設定読み込み
    bot_token, app_token = load_slack_config()
    
    if not bot_token or not app_token:
        print("❌ Slack設定が見つかりません")
        return
    
    print(f"✅ Token取得成功: {bot_token[:12]}...")
    
    # Bot初期化
    try:
        bot = SlackClaudeBot(bot_token, app_token)
        print("✅ Bot初期化成功")
        
        # Claude API テスト
        role = AI_ROLES['claude-dev']
        result = await bot.call_claude_api(role, "Hello, this is a test")
        
        print(f"🤖 Claude API テスト結果:")
        print(f"   成功: {result.get('success')}")
        print(f"   内容: {result.get('content', 'N/A')[:100]}...")
        print(f"   エラー: {result.get('error', 'N/A')}")
        
    except Exception as e:
        print(f"❌ エラー: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_bot())