"""
Conea Slack Bot - Claude AI Integration
参考プロンプトに基づく堅牢な実装
"""

import asyncio
import logging
import json
import re
import requests
import os
from typing import Dict, Any, List, Optional
from datetime import datetime
from dataclasses import dataclass
from slack_bolt.async_app import AsyncApp
from slack_bolt.adapter.socket_mode.async_handler import AsyncSocketModeHandler
from slack_sdk.web.async_client import AsyncWebClient
from slack_sdk.errors import SlackApiError

# ログ設定
import sys
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/tmp/slack_bot.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class AIRole:
    """AI ロール定義"""
    name: str
    model: str
    system_prompt: str
    max_tokens: int
    temperature: float = 0.7

# AI ロール設定
AI_ROLES: Dict[str, AIRole] = {
    'claude-dev': AIRole(
        name='Claude Developer',
        model='claude-3-sonnet-20240229',
        system_prompt='''あなたは優秀なソフトウェアエンジニアです。
- コードの品質とベストプラクティスを重視
- セキュリティとパフォーマンスを考慮
- 具体的なコード例を提供
- エラーハンドリングを含む完全な実装を提案''',
        max_tokens=2000
    ),
    'claude-design': AIRole(
        name='Claude Designer',
        model='claude-3-sonnet-20240229',
        system_prompt='''あなたは優秀なUI/UXデザイナーです。
- ユーザー体験を最優先
- アクセシビリティを考慮
- モダンなデザイントレンドを反映
- 実装可能な具体的なデザイン提案''',
        max_tokens=1500
    ),
    'claude-pm': AIRole(
        name='Claude PM',
        model='claude-3-sonnet-20240229',
        system_prompt='''あなたは優秀なプロダクトマネージャーです。
- ビジネス価値を重視
- 実現可能性とROIを評価
- 優先順位付けと段階的実装を提案
- ステークホルダー間の調整を考慮''',
        max_tokens=2500
    )
}

class SlackClaudeBot:
    """Slack Claude Bot メインクラス"""
    
    def __init__(self, bot_token: str, app_token: str):
        self.app = AsyncApp(token=bot_token)
        self.client = AsyncWebClient(token=bot_token)
        self.socket_handler = AsyncSocketModeHandler(self.app, app_token)
        self.backend_url = "http://localhost:8000"
        
        # 統計追跡
        self.usage_stats = {
            'total_requests': 0,
            'successful_responses': 0,
            'failed_responses': 0,
            'total_cost': 0.0,
            'total_tokens': 0
        }
        
        self.setup_event_handlers()
        logger.info("🤖 Slack Claude Bot initialized")
    
    def setup_event_handlers(self):
        """イベントハンドラー設定"""
        
        @self.app.event("app_mention")
        async def handle_app_mention(event, say):
            """標準的な@メンション処理"""
            logger.info(f"🔔 App mention received: {event}")
            await self.handle_mention(event, say)
        
        @self.app.message("")
        async def handle_message(message, say):
            """メッセージ処理（カスタムメンション検出）"""
            if message.get('subtype') or message.get('bot_id'):
                return
            
            text = message.get('text', '')
            bot_mentions = self.extract_bot_mentions(text)
            
            if bot_mentions:
                logger.info(f"🎯 Bot mentions detected: {bot_mentions}")
                await self.handle_bot_mentions(message, bot_mentions, say)
    
    def extract_bot_mentions(self, text: str) -> List[str]:
        """カスタムBOT名を抽出"""
        pattern = r'@(claude-dev|claude-design|claude-pm)\b'
        matches = re.findall(pattern, text, re.IGNORECASE)
        return [match.lower() for match in matches]
    
    async def handle_mention(self, event: Dict, say):
        """標準メンション処理"""
        try:
            # デフォルトでclaude-devとして処理
            await self.process_ai_request('claude-dev', event, say)
        except Exception as e:
            logger.error(f"Error handling mention: {e}")
            await say(f"❌ エラーが発生しました: {str(e)}")
    
    async def handle_bot_mentions(self, message: Dict, bot_names: List[str], say):
        """カスタムメンション処理"""
        channel = message['channel']
        thread_ts = message.get('thread_ts', message['ts'])
        
        try:
            # 処理中インジケーター
            processing_msg = await say(
                text=f"{', '.join([f'@{name}' for name in bot_names])} が考えています... 🤔",
                thread_ts=thread_ts
            )
            
            # 各BOTの応答を生成
            for bot_name in bot_names:
                await self.process_ai_request(bot_name, message, say)
            
            # 処理中メッセージを削除
            try:
                await self.client.chat_delete(
                    channel=channel,
                    ts=processing_msg['ts']
                )
            except SlackApiError:
                pass  # 削除に失敗しても続行
                
        except Exception as e:
            logger.error(f"Error handling bot mentions: {e}")
            await say(
                text="申し訳ございません。エラーが発生しました。",
                thread_ts=thread_ts
            )
    
    async def process_ai_request(self, bot_name: str, message: Dict, say):
        """AI リクエスト処理"""
        role = AI_ROLES.get(bot_name)
        if not role:
            logger.error(f"Unknown bot name: {bot_name}")
            return
        
        start_time = datetime.now()
        thread_ts = message.get('thread_ts', message['ts'])
        
        try:
            # ユーザーメッセージからメンション除去
            user_message = message.get('text', '')
            user_message = re.sub(r'<@U\w+>', '', user_message)  # ユーザーメンション除去
            user_message = re.sub(rf'@{bot_name}', '', user_message, flags=re.IGNORECASE)
            user_message = user_message.strip()
            
            if not user_message:
                user_message = "こんにちは！何かお手伝いできることはありますか？"
            
            # Claude API呼び出し
            response = await self.call_claude_api(role, user_message)
            
            if response.get('success'):
                # Slack応答送信
                await self.send_ai_response(role, response, say, thread_ts)
                
                # 統計更新
                self.usage_stats['successful_responses'] += 1
                self.usage_stats['total_cost'] += response.get('cost', 0)
                self.usage_stats['total_tokens'] += response.get('tokens', 0)
            else:
                await say(
                    text=f"❌ {role.name}: {response.get('error', '処理に失敗しました')}",
                    thread_ts=thread_ts
                )
                self.usage_stats['failed_responses'] += 1
            
            self.usage_stats['total_requests'] += 1
            
        except Exception as e:
            logger.error(f"Error processing AI request for {bot_name}: {e}")
            await say(
                text=f"❌ {role.name}: システムエラーが発生しました",
                thread_ts=thread_ts
            )
            self.usage_stats['failed_responses'] += 1
    
    async def call_claude_api(self, role: AIRole, user_message: str) -> Dict:
        """Claude API呼び出し"""
        try:
            # バックエンドのAI APIを使用
            payload = {
                'provider': 'claude',
                'prompt': f"{role.system_prompt}\n\nユーザーからの質問: {user_message}",
                'max_tokens': role.max_tokens,
                'temperature': role.temperature
            }
            
            print(f"🔄 API呼び出し開始: {self.backend_url}/api/ai/chat")
            print(f"📝 Payload: {payload}")
            
            response = requests.post(
                f"{self.backend_url}/api/ai/chat",
                json=payload,
                timeout=30
            )
            
            print(f"📊 Response status: {response.status_code}")
            print(f"📄 Response text: {response.text[:200]}...")
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ API成功: {result}")
                return {
                    'success': True,
                    'content': result.get('content', '回答を生成できませんでした'),
                    'tokens': result.get('tokens', 0),
                    'cost': result.get('cost', 0.0)
                }
            else:
                error_msg = f"API呼び出しエラー: {response.status_code}"
                try:
                    error_data = response.json()
                    error_msg = error_data.get('error', error_msg)
                    print(f"❌ API エラー詳細: {error_data}")
                except:
                    pass
                
                return {
                    'success': False,
                    'error': error_msg
                }
                
        except requests.exceptions.Timeout:
            print("⏱️ API呼び出しタイムアウト")
            return {
                'success': False,
                'error': 'API呼び出しがタイムアウトしました'
            }
        except requests.exceptions.RequestException as e:
            print(f"🌐 ネットワークエラー: {e}")
            return {
                'success': False,
                'error': f'ネットワークエラー: {str(e)}'
            }
        except Exception as e:
            print(f"💥 予期しないエラー: {e}")
            import traceback
            traceback.print_exc()
            return {
                'success': False,
                'error': f'予期しないエラー: {str(e)}'
            }
    
    async def send_ai_response(self, role: AIRole, response: Dict, say, thread_ts: str):
        """AI応答をSlackに送信"""
        content = response['content']
        tokens = response.get('tokens', 0)
        cost = response.get('cost', 0.0)
        
        # Slack Blocks形式でリッチな応答を送信
        blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*{role.name}より:*"
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": content
                }
            }
        ]
        
        # メタデータ情報を追加
        if tokens > 0 or cost > 0:
            blocks.append({
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"Model: {role.model} | Tokens: {tokens} | Cost: ${cost:.4f}"
                    }
                ]
            })
        
        await say(
            text=f"*{role.name}より:*\n{content}",
            blocks=blocks,
            thread_ts=thread_ts
        )
    
    async def start(self):
        """ボット開始"""
        logger.info("🚀 Starting Slack Claude Bot...")
        await self.socket_handler.start_async()

def load_slack_config():
    """Slack設定読み込み"""
    # 1. バックエンドAPIから取得
    try:
        response = requests.get('http://localhost:8000/api/slack/config', timeout=5)
        if response.status_code == 200:
            config = response.json()
            bot_token = config.get('botToken')
            app_token = config.get('appToken')
            
            if bot_token and app_token:
                logger.info("✅ バックエンドから設定を取得しました")
                return bot_token, app_token
    except Exception as e:
        logger.warning(f"バックエンドからの設定取得に失敗: {e}")
    
    # 2. 環境変数から取得
    logger.info("📝 環境変数から設定を読み込み中...")
    from dotenv import load_dotenv
    load_dotenv()
    
    bot_token = os.getenv('SLACK_BOT_TOKEN')
    app_token = os.getenv('SLACK_APP_TOKEN')
    
    return bot_token, app_token

async def main():
    """メイン関数"""
    print("🚀 Conea Slack Bot起動中...")
    
    # 設定読み込み
    bot_token, app_token = load_slack_config()
    
    if not bot_token or not app_token:
        print("❌ Slack設定が見つかりません")
        print("Admin Dashboard (http://localhost:4000/slack) で設定するか、")
        print("環境変数 SLACK_BOT_TOKEN, SLACK_APP_TOKEN を設定してください")
        return
    
    print(f"🔗 Bot Token: {bot_token[:12]}...")
    print(f"🔗 App Token: {app_token[:12]}...")
    print("🤖 Slack Botを起動しています...")
    
    try:
        bot = SlackClaudeBot(bot_token, app_token)
        await bot.start()
    except Exception as e:
        logger.error(f"❌ Bot起動エラー: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(main())