"""
Simple Conea Bot - デバッグ・テスト用
"""

import asyncio
import logging
import requests
import os
import re
from slack_bolt.async_app import AsyncApp
from slack_bolt.adapter.socket_mode.async_handler import AsyncSocketModeHandler
from slack_sdk.web.async_client import AsyncWebClient

# シンプルなログ設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SimpleConeaBot:
    def __init__(self, bot_token: str, app_token: str):
        self.app = AsyncApp(token=bot_token)
        self.client = AsyncWebClient(token=bot_token)
        self.socket_handler = AsyncSocketModeHandler(self.app, app_token)
        self.backend_url = "http://localhost:8000"
        
        self.setup_handlers()
        
    def setup_handlers(self):
        @self.app.event("app_mention")
        async def handle_mention(event, say):
            print(f"🔔 メンション受信: {event}")
            await self.process_simple_mention(event, say)
            
        @self.app.message("")
        async def handle_message(message, say):
            # ボットメッセージやサブタイプを除外
            if message.get('subtype') or message.get('bot_id'):
                return
            
            # app_mentionで処理される場合は除外（重複防止）
            if message.get('type') == 'message' and '<@' in message.get('text', ''):
                print("🚫 app_mentionで処理されるため、messageイベントをスキップ")
                return
                
            text = message.get('text', '').lower()
            # 直接的な@coneaメンションではなく、テキスト内のconeaキーワードのみ検出
            if 'conea' in text and '<@' not in message.get('text', ''):
                print(f"🎯 Coneaキーワード検出（非メンション）: {text}")
                await self.process_simple_mention(message, say)
    
    async def process_simple_mention(self, event, say):
        try:
            # スレッド情報を取得
            channel = event['channel']
            thread_ts = event.get('thread_ts', event['ts'])  # 元メッセージをスレッドのルートにする
            
            # ユーザーメッセージを取得
            raw_text = event.get('text', '')
            user_message = re.sub(r'<@U\w+>', '', raw_text)
            user_message = re.sub(r'@conea', '', user_message, flags=re.IGNORECASE)
            user_message = user_message.strip()
            
            if not user_message:
                user_message = "こんにちは！"
            
            print(f"💬 処理中のメッセージ: {user_message}")
            print(f"📍 チャンネル: {channel}, スレッド: {thread_ts}")
            
            # 簡単な分類
            domain = self.classify_simple(user_message)
            print(f"🎯 分類結果: {domain}")
            
            # 処理中表示（スレッド内）
            thinking = await say(
                text="考えています... 🤔",
                thread_ts=thread_ts
            )
            
            # OpenMemoryから関連コンテキストを取得
            memory_context = await self.get_memory_context(user_message)
            
            # AI API呼び出し（メモリコンテキスト付き）
            response = await self.call_ai_simple(user_message, domain, memory_context)
            
            # 応答更新（スレッド内）
            if response.get('success'):
                content = response['content']
                icon = {'development': '👨‍💻', 'design': '🎨', 'management': '📊', 'general': '🤖'}
                domain_icon = icon.get(domain, '🤖')
                
                # AIプロバイダー表示用アイコン
                ai_icons = {'claude': '🧠', 'openai': '⚡', 'gemini': '💎'}
                provider = self.select_ai_provider(domain)
                ai_icon = ai_icons.get(provider, '🤖')
                
                # メモリ使用情報を表示
                memory_info = ""
                if response.get('memory_context_used'):
                    memory_info = f"\n\n🧠 関連記憶 ({response.get('context_items', 0)}件) を参考にしました"
                
                final_text = f"{domain_icon} *Conea {domain.title()}* {ai_icon} *({provider.upper()})*\n\n{content}{memory_info}"
                
                await self.client.chat_update(
                    channel=channel,
                    ts=thinking['ts'], 
                    text=final_text
                )
                print("✅ スレッド内応答送信完了")
                
                # 会話をOpenMemoryに保存
                await self.save_conversation_to_memory(user_message, content, provider)
            else:
                await self.client.chat_update(
                    channel=channel,
                    ts=thinking['ts'],
                    text=f"❌ エラー: {response.get('error', '不明なエラー')}"
                )
                print(f"❌ エラー: {response.get('error')}")
                
        except Exception as e:
            print(f"💥 処理エラー: {e}")
            import traceback
            traceback.print_exc()
            
            try:
                # エラーメッセージもスレッド内に送信
                thread_ts = event.get('thread_ts', event['ts'])
                await say(
                    text=f"申し訳ございません。エラーが発生しました: {str(e)}",
                    thread_ts=thread_ts
                )
            except:
                pass
    
    def classify_simple(self, message: str) -> str:
        """改良された分類"""
        msg_lower = message.lower()
        
        # Development キーワード
        dev_keywords = [
            'コード', 'code', '実装', 'プログラ', 'バグ', '開発', 'react', 'typescript', 'javascript',
            'パフォーマンス', 'performance', '最適化', 'optimize', 'コンポーネント', 'component',
            'api', 'function', '関数', 'class', 'クラス', 'テスト', 'test', 'エラー', 'error',
            'フレームワーク', 'framework', 'ライブラリ', 'library', 'データベース', 'database'
        ]
        
        # Design キーワード  
        design_keywords = [
            'デザイン', 'design', 'ui', 'ux', '配色', 'カラー', 'color', 'レイアウト', 'layout',
            'フォント', 'font', 'typography', 'アイコン', 'icon', 'ボタン', 'button', 
            'インターフェース', 'interface', 'ユーザビリティ', 'usability', 'figma', 'sketch'
        ]
        
        # Management キーワード
        mgmt_keywords = [
            '管理', 'management', '計画', 'plan', '戦略', 'strategy', 'プロジェクト', 'project',
            'スケジュール', 'schedule', 'タスク', 'task', '優先度', 'priority', 'リーダー', 'leader',
            'チーム', 'team', '予算', 'budget', 'kpi', 'roi', '進捗', 'progress'
        ]
        
        # スコア計算
        dev_score = sum(1 for keyword in dev_keywords if keyword in msg_lower)
        design_score = sum(1 for keyword in design_keywords if keyword in msg_lower)
        mgmt_score = sum(1 for keyword in mgmt_keywords if keyword in msg_lower)
        
        print(f"🔍 分類スコア - Dev: {dev_score}, Design: {design_score}, Mgmt: {mgmt_score}")
        
        # 最高スコアのドメインを選択
        if dev_score > 0 and dev_score >= design_score and dev_score >= mgmt_score:
            return 'development'
        elif design_score > 0 and design_score > dev_score and design_score >= mgmt_score:
            return 'design'
        elif mgmt_score > 0 and mgmt_score > dev_score and mgmt_score > design_score:
            return 'management'
        else:
            return 'general'
    
    def select_ai_provider(self, domain: str) -> str:
        """ドメインに基づいてAIプロバイダーを選択"""
        provider_mapping = {
            'development': 'claude',    # コーディングはClaudeが得意
            'design': 'openai',        # デザインはGPT-4が得意
            'management': 'claude',     # 戦略的思考はClaudeが得意
            'analysis': 'gemini',      # データ分析はGeminiが得意
            'general': 'claude'        # 一般的な質問はClaude
        }
        return provider_mapping.get(domain, 'claude')
    
    async def get_memory_context(self, message: str) -> str:
        """OpenMemoryから関連コンテキストを取得"""
        try:
            memory_response = requests.post(
                f"{self.backend_url}/api/memory/search",
                json={
                    "user_id": "mourigenta",
                    "query": message,
                    "limit": 3
                },
                timeout=5
            )
            
            if memory_response.status_code == 200:
                data = memory_response.json()
                if data.get('memories'):
                    context_items = [f"関連記憶: {mem['content']}" for mem in data['memories'][:3]]
                    return "\n".join(context_items)
            return None
        except Exception as e:
            print(f"🧠 メモリコンテキスト取得エラー: {e}")
            return None
    
    async def save_conversation_to_memory(self, prompt: str, response: str, provider: str):
        """会話をOpenMemoryに保存"""
        try:
            memory_data = {
                "user_id": "mourigenta",
                "text": f"Q: {prompt}\nA: {response}",
                "source": f"slack-{provider}"
            }
            
            memory_response = requests.post(
                f"{self.backend_url}/api/memory/save",
                json=memory_data,
                timeout=5
            )
            
            if memory_response.status_code == 200:
                print("🧠 会話をメモリに保存しました")
            else:
                print(f"🧠 メモリ保存失敗: {memory_response.status_code}")
        except Exception as e:
            print(f"🧠 メモリ保存エラー: {e}")

    async def call_ai_simple(self, message: str, domain: str, memory_context: str = None) -> dict:
        """マルチAI対応の呼び出し"""
        try:
            # AIプロバイダーを選択
            provider = self.select_ai_provider(domain)
            print(f"🤖 選択されたAI: {provider}")
            
            # メモリコンテキストを考慮したメッセージ構築
            enhanced_message = message
            if memory_context:
                enhanced_message = f"以下の関連する記憶を参考にして回答してください：\n\n{memory_context}\n\n質問: {message}"
            
            prompts = {
                'development': f"あなたは優秀なソフトウェアエンジニアです。具体的で実用的なアドバイスをしてください。\n\n{enhanced_message}",
                'design': f"あなたは経験豊富なUI/UXデザイナーです。ユーザー体験を重視したアドバイスをしてください。\n\n{enhanced_message}",
                'management': f"あなたは優秀なプロジェクトマネージャーです。実現可能で戦略的なアドバイスをしてください。\n\n{enhanced_message}",
                'general': f"あなたは知識豊富なアシスタントです。分かりやすく有用なアドバイスをしてください。\n\n{enhanced_message}"
            }
            
            # プロバイダー別の温度設定
            temperature_settings = {
                'claude': 0.7,
                'openai': 0.8,  # デザインには創造性を重視
                'gemini': 0.3   # 分析には正確性を重視
            }
            
            payload = {
                'provider': provider,
                'prompt': prompts.get(domain, prompts['general']),
                'max_tokens': 2000,
                'temperature': temperature_settings.get(provider, 0.7)
            }
            
            print(f"🔄 API呼び出し中...")
            response = requests.post(
                f"{self.backend_url}/api/ai/chat",
                json=payload,
                timeout=30
            )
            
            print(f"📊 Response status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ API成功")
                return result
            else:
                print(f"❌ API失敗: {response.text}")
                return {'success': False, 'error': f'API Error: {response.status_code}'}
                
        except Exception as e:
            print(f"💥 API呼び出しエラー: {e}")
            return {'success': False, 'error': str(e)}
    
    async def start(self):
        print("🚀 Simple Conea Bot starting...")
        await self.socket_handler.start_async()

def load_slack_config():
    """Slack設定読み込み"""
    try:
        response = requests.get('http://localhost:8000/api/slack/config', timeout=5)
        if response.status_code == 200:
            config = response.json()
            bot_token = config.get('botToken')
            app_token = config.get('appToken')
            
            if bot_token and app_token:
                print("✅ バックエンドから設定を取得")
                return bot_token, app_token
    except Exception as e:
        print(f"バックエンド接続エラー: {e}")
    
    # 環境変数から取得
    from dotenv import load_dotenv
    load_dotenv()
    
    bot_token = os.getenv('SLACK_BOT_TOKEN')
    app_token = os.getenv('SLACK_APP_TOKEN')
    
    return bot_token, app_token

async def main():
    print("🤖 Simple Conea Bot 起動中...")
    
    bot_token, app_token = load_slack_config()
    
    if not bot_token or not app_token:
        print("❌ Slack設定が見つかりません")
        return
    
    print(f"🔗 Bot Token: {bot_token[:12]}...")
    print(f"🔗 App Token: {app_token[:12]}...")
    
    try:
        bot = SimpleConeaBot(bot_token, app_token)
        await bot.start()
    except Exception as e:
        print(f"❌ エラー: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())