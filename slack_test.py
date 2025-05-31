#!/usr/bin/env python3
"""
Slack API接続テスト
"""

import requests
import json

# 保存された設定を読み込み
def test_slack_connection():
    # バックエンドから設定取得
    try:
        response = requests.get('http://localhost:8000/api/slack/config')
        if response.status_code != 200:
            print("❌ バックエンドから設定を取得できません")
            return
        
        config = response.json()
        bot_token = config.get('botToken')
        
        if not bot_token:
            print("❌ Bot Tokenが設定されていません")
            return
        
        print(f"🔗 Bot Token: {bot_token[:12]}...")
        
        # auth.test API呼び出し
        headers = {
            'Authorization': f'Bearer {bot_token}',
            'Content-Type': 'application/json'
        }
        
        auth_response = requests.post(
            'https://slack.com/api/auth.test',
            headers=headers
        )
        
        if auth_response.status_code == 200:
            data = auth_response.json()
            if data.get('ok'):
                print("✅ Slack API認証成功")
                print(f"   Bot ID: {data.get('user_id')}")
                print(f"   Bot名: {data.get('user')}")
                print(f"   チーム: {data.get('team')}")
                
                # チャンネル一覧取得テスト
                channels_response = requests.post(
                    'https://slack.com/api/conversations.list',
                    headers=headers,
                    json={'types': 'public_channel'}
                )
                
                if channels_response.status_code == 200:
                    ch_data = channels_response.json()
                    if ch_data.get('ok'):
                        channels = ch_data.get('channels', [])
                        print(f"✅ チャンネル取得成功: {len(channels)}個")
                        for ch in channels[:3]:
                            print(f"   - #{ch.get('name')} ({ch.get('id')})")
                    else:
                        print(f"❌ チャンネル取得失敗: {ch_data.get('error')}")
                else:
                    print(f"❌ チャンネルAPI呼び出し失敗: {channels_response.status_code}")
                    
            else:
                print(f"❌ Slack認証失敗: {data.get('error')}")
        else:
            print(f"❌ API呼び出し失敗: {auth_response.status_code}")
            
    except Exception as e:
        print(f"❌ テスト実行エラー: {e}")

if __name__ == "__main__":
    test_slack_connection()