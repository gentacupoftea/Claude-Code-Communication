"""
Conea Slack Bot Integration
MultiLLM自律システムとSlack統合ボット

@conea-dev - 開発タスク用
@conea-design - デザイン・UI/UX用  
@conea-pm - プロジェクト管理用
"""

import asyncio
import logging
import json
import re
from typing import Dict, Any, Optional, List
from datetime import datetime
from dataclasses import dataclass
from slack_bolt import App
from slack_bolt.adapter.socket_mode import SocketModeHandler
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError

# 実際のAI統合
import requests
import json
import os
from datetime import datetime

class AIOrchestrator:
    """実際のAI API統合クラス"""
    
    def __init__(self):
        # バックエンドAPIのエンドポイント
        self.backend_url = "http://localhost:8000"
        
        # AI設定を取得
        self.ai_config = self.load_ai_config()
        
    def load_ai_config(self):
        """バックエンドからAI設定を読み込み"""
        try:
            response = requests.get(f"{self.backend_url}/api/ai/config")
            if response.status_code == 200:
                return response.json()
            else:
                print(f"⚠️ AI設定の取得に失敗: {response.status_code}")
                return None
        except Exception as e:
            print(f"❌ AI設定取得エラー: {e}")
            return None
    
    async def process_command(self, command):
        """コマンドを実際のAIで処理"""
        try:
            command_config = {
                'conea-dev': {'provider': 'claude', 'context': 'code_development'},
                'conea-design': {'provider': 'claude', 'context': 'ui_design'},  
                'conea-pm': {'provider': 'claude', 'context': 'project_management'}
            }
            
            config = command_config.get(command.type, command_config['conea-dev'])
            provider = config['provider']
            context = config['context']
            
            # AI設定確認
            if not self.ai_config or not self.ai_config.get(provider, {}).get('enabled'):
                return f"❌ {provider.upper()} AIが設定されていません。Admin Dashboardで設定してください。"
            
            # AIプロンプト作成
            prompt = self.create_ai_prompt(command, context)
            
            # AI API呼び出し
            response = await self.call_ai_api(provider, prompt)
            
            if response.get('success'):
                return f"🤖 **{provider.upper()}による回答**\n\n{response['content']}\n\n_処理時間: {response.get('duration', 0):.2f}秒_"
            else:
                return f"❌ AI処理エラー: {response.get('error', '不明なエラー')}"
                
        except Exception as e:
            return f"❌ システムエラー: {str(e)}"
    
    def create_ai_prompt(self, command, context):
        """コンテキストに応じたプロンプト作成"""
        base_prompts = {
            'code_development': """あなたは優秀なソフトウェアエンジニアです。以下のタスクを実行してください：

タスク: {content}

以下の形式で回答してください：
- 具体的で実用的な解決策を提示
- 必要に応じてコード例を含める
- ベストプラクティスに従った提案
- 簡潔で分かりやすい説明

回答:""",
            
            'ui_design': """あなたは経験豊富なUI/UXデザイナーです。以下のタスクを実行してください：

タスク: {content}

以下の観点から回答してください：
- ユーザビリティとアクセシビリティ
- 現代的なデザイントレンド
- レスポンシブデザイン
- 実装しやすさ

回答:""",
            
            'project_management': """あなたは経験豊富なプロジェクトマネージャーです。以下のタスクを実行してください：

タスク: {content}

以下の観点から回答してください：
- リスク分析と対策
- 効率的な進行方法
- ステークホルダーへの報告
- 実行可能なアクションプラン

回答:"""
        }
        
        prompt_template = base_prompts.get(context, base_prompts['code_development'])
        return prompt_template.format(content=command.content)
    
    async def call_ai_api(self, provider, prompt):
        """AI APIを実際に呼び出し"""
        try:
            start_time = datetime.now()
            
            # バックエンドのAI APIエンドポイントを使用
            payload = {
                'provider': provider,
                'prompt': prompt,
                'max_tokens': 2000,
                'temperature': 0.7
            }
            
            # 実際のClaude API呼び出し（バックエンド経由）
            response = requests.post(
                f"{self.backend_url}/api/ai/chat",
                json=payload,
                timeout=30
            )
            
            duration = (datetime.now() - start_time).total_seconds()
            
            if response.status_code == 200:
                result = response.json()
                return {
                    'success': True,
                    'content': result.get('content', '回答を生成できませんでした'),
                    'duration': duration,
                    'tokens': result.get('tokens', 0),
                    'cost': result.get('cost', 0.0)
                }
            else:
                return {
                    'success': False,
                    'error': f"API呼び出しエラー: {response.status_code}",
                    'duration': duration
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': f"AI API呼び出し失敗: {str(e)}",
                'duration': 0
            }

class ConfigManager:
    """設定管理クラス"""
    pass

logger = logging.getLogger(__name__)


@dataclass
class SlackCommand:
    """Slack コマンド構造"""
    type: str
    content: str
    original_text: str
    channel: str
    user: str
    timestamp: str


@dataclass
class SlackResponse:
    """Slack 応答構造"""
    text: str
    blocks: Optional[List[Dict]] = None
    thread_ts: Optional[str] = None
    cost: float = 0.0
    tokens: int = 0
    agent_used: str = ""
    duration: float = 0.0


class ConeaSlackBot:
    """
    Conea Slack Bot メインクラス
    MultiLLM自律システムとSlackを統合
    """
    
    def __init__(self, token: str, app_token: str):
        # デバッグレベルのログを有効化
        import logging
        logging.getLogger("slack_bolt").setLevel(logging.DEBUG)
        logging.getLogger("slack_sdk").setLevel(logging.DEBUG)
        
        self.app = App(token=token)
        self.client = WebClient(token=token)
        self.socket_handler = SocketModeHandler(self.app, app_token)
        
        print(f"🔧 Slack App initialized with token: {token[:12]}...")
        print(f"🔧 Socket handler created with app token: {app_token[:12]}...")
        
        # MultiLLM システム統合（実際のAI）
        self.orchestrator = AIOrchestrator()
        self.config_manager = ConfigManager()
        
        # イベントハンドラーを設定
        self.setup_event_handlers()
        print("🔧 Event handlers configured")
        
        # コマンド定義
        self.commands = {
            'conea-dev': {
                'agent': 'openai',
                'fallback': 'claude',
                'capabilities': ['コード生成', 'バグ修正', 'リファクタリング', 'テスト作成'],
                'examples': [
                    'バグ修正: ログイン処理のエラーハンドリング強化',
                    '新機能実装: ユーザー登録フロー最適化',
                    'コードレビュー: PR #123の品質チェック'
                ]
            },
            'conea-design': {
                'agent': 'claude',
                'fallback': 'gemini',
                'capabilities': ['UI設計', 'プロトタイプ', 'アクセシビリティ'],
                'examples': [
                    'ダッシュボードのUIプロトタイプ作成',
                    'モバイル対応のレスポンシブ改善'
                ]
            },
            'conea-pm': {
                'agent': 'claude',
                'fallback': 'openai',
                'capabilities': ['進捗管理', 'リスク分析', 'レポート生成'],
                'examples': [
                    'Phase 3の進捗状況レポート作成',
                    'リスク分析: 納期遅延要因の特定'
                ]
            }
        }
        
        # イベントハンドラー登録
        self.setup_event_handlers()
        
        # 統計追跡
        self.usage_stats = {
            'total_requests': 0,
            'successful_responses': 0,
            'failed_responses': 0,
            'total_cost': 0.0,
            'total_tokens': 0
        }
    
    async def initialize(self):
        """ボット初期化"""
        try:
            # テストモード：MultiLLM システム初期化をスキップ
            logger.info("🤖 Conea Slack Bot initialized successfully (Test Mode)")
            
            # 起動通知を一時的に無効化（テスト用）
            # await self.send_startup_notification()
            logger.info("起動通知はスキップされました")
            
        except Exception as e:
            logger.error(f"Bot initialization failed: {e}")
            raise
    
    def setup_event_handlers(self):
        """イベントハンドラー設定"""
        print("🔧 Setting up event handlers...")
        
        # 実際のAI処理ハンドラー
        @self.app.event("app_mention")
        def handle_mention_event(event, say, ack):
            print(f"🔔 MENTION RECEIVED! Event: {event}")
            ack()
            
            # 非同期処理を開始
            import asyncio
            asyncio.create_task(self.handle_mention(event, say))
        
        @self.app.event("message")
        def handle_message_event(event, say, ack):
            print(f"📨 MESSAGE RECEIVED! Event: {event}")
            ack()
            
            # ボットメッセージを除外
            if event.get('bot_id') or event.get('subtype') == 'bot_message':
                print("🤖 Bot message ignored")
                return
            
            # @conea-xxx パターンをチェック
            text = event.get("text", "")
            if '@conea-' in text:
                print(f"🎯 Conea mention detected in message: {text}")
                # メンションとして処理
                import asyncio
                asyncio.create_task(self.handle_mention(event, say))
        
        print("✅ Event handlers setup complete")
    
    async def handle_mention(self, event: Dict, say) -> None:
        """@mention 処理"""
        start_time = datetime.now()
        
        try:
            # コマンド解析
            command = self.parse_command(event["text"])
            command.channel = event["channel"]
            command.user = event["user"]
            command.timestamp = event["ts"]
            
            # 処理中表示
            await self.show_thinking_indicator(command)
            
            # プロジェクト文脈取得
            project_context = await self.get_project_context(command)
            
            # MultiLLM実行
            response = await self.execute_llm_task(command, project_context)
            
            # 応答送信
            await self.send_response(command, response, say)
            
            # 統計更新
            duration = (datetime.now() - start_time).total_seconds()
            await self.update_usage_stats(command, response, duration)
            
        except Exception as e:
            logger.error(f"Error handling mention: {e}")
            await self.send_error_response(command, str(e), say)
    
    def parse_command(self, text: str) -> SlackCommand:
        """Slack コマンド解析"""
        # @conea-xxx パターンを検索
        mention_pattern = r'@conea-(\w+)'
        mentions = re.findall(mention_pattern, text)
        
        # メンション除去してコンテンツ抽出
        content = re.sub(r'<@U\w+>', '', text)  # ユーザーメンション除去
        content = re.sub(mention_pattern, '', content).strip()
        
        command_type = mentions[0] if mentions else 'dev'  # デフォルトは dev
        
        return SlackCommand(
            type=f'conea-{command_type}',
            content=content,
            original_text=text,
            channel="",  # 後で設定
            user="",     # 後で設定
            timestamp="" # 後で設定
        )
    
    async def get_project_context(self, command: SlackCommand) -> Dict[str, Any]:
        """プロジェクト文脈取得"""
        try:
            # チャンネル情報取得
            channel_info = await self.client.conversations_info(channel=command.channel)
            
            # ユーザー情報取得
            user_info = await self.client.users_info(user=command.user)
            
            # 最近のメッセージ履歴取得
            history = await self.client.conversations_history(
                channel=command.channel,
                limit=10
            )
            
            return {
                'channel_name': channel_info['channel']['name'],
                'user_name': user_info['user']['real_name'],
                'recent_messages': [msg['text'] for msg in history['messages'][:5]],
                'timestamp': command.timestamp,
                'command_type': command.type
            }
            
        except SlackApiError as e:
            logger.warning(f"Could not get project context: {e}")
            return {
                'channel_name': 'unknown',
                'user_name': 'unknown',
                'recent_messages': [],
                'timestamp': command.timestamp,
                'command_type': command.type
            }
    
    async def execute_llm_task(self, command: SlackCommand, context: Dict) -> SlackResponse:
        """MultiLLM タスク実行"""
        start_time = datetime.now()
        
        try:
            command_config = self.commands.get(command.type, self.commands['conea-dev'])
            
            # タスク作成
            task_request = {
                'type': self.map_command_to_task_type(command.type),
                'description': command.content,
                'context': context,
                'priority': 'medium',
                'user': command.user,
                'channel': command.channel
            }
            
            # テストモード：ダミー応答を生成
            task_result = await self.orchestrator.process_command(command)
            
            # 結果をSlack形式に変換
            duration = (datetime.now() - start_time).total_seconds()
            
            return SlackResponse(
                text=task_result if isinstance(task_result, str) else task_result.get('response', '応答を生成できませんでした'),
                blocks=None,  # テストモードではブロックを無効化
                thread_ts=command.timestamp,
                cost=0.0,  # テストモードでは0
                tokens=0,  # テストモードでは0
                agent_used=command_config['agent'],
                duration=duration
            )
            
        except Exception as e:
            logger.error(f"LLM task execution failed: {e}")
            return SlackResponse(
                text=f"エラーが発生しました: {str(e)}",
                agent_used="error",
                duration=(datetime.now() - start_time).total_seconds()
            )
    
    def map_command_to_task_type(self, command_type: str) -> str:
        """コマンドタイプをタスクタイプにマッピング"""
        mapping = {
            'conea-dev': 'code_generation',
            'conea-design': 'strategic_analysis',
            'conea-pm': 'project_coordination'
        }
        return mapping.get(command_type, 'code_generation')
    
    def create_response_blocks(self, task_result: Dict, command: SlackCommand) -> List[Dict]:
        """Slack Blocks UI作成"""
        blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*🤖 {command.type} による応答*\n{task_result.get('response', '')}"
                }
            }
        ]
        
        # メタ情報追加
        if task_result.get('cost') or task_result.get('tokens'):
            blocks.append({
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"💰 コスト: ${task_result.get('cost', 0):.4f} | 🔢 トークン: {task_result.get('tokens', 0)} | ⏱️ 処理時間: {task_result.get('duration', 0):.2f}s"
                    }
                ]
            })
        
        return blocks
    
    async def show_thinking_indicator(self, command: SlackCommand):
        """思考中インジケーター表示"""
        try:
            await self.client.chat_postMessage(
                channel=command.channel,
                text="🤔 考え中...",
                thread_ts=command.timestamp
            )
        except SlackApiError as e:
            logger.warning(f"Could not show thinking indicator: {e}")
    
    async def send_response(self, command: SlackCommand, response: SlackResponse, say):
        """応答送信"""
        try:
            await say(
                text=response.text,
                blocks=response.blocks,
                thread_ts=response.thread_ts
            )
        except SlackApiError as e:
            logger.error(f"Failed to send response: {e}")
    
    async def send_error_response(self, command: SlackCommand, error: str, say):
        """エラー応答送信"""
        try:
            await say(
                text=f"❌ エラーが発生しました: {error}",
                thread_ts=command.timestamp
            )
        except SlackApiError as e:
            logger.error(f"Failed to send error response: {e}")
    
    async def update_usage_stats(self, command: SlackCommand, response: SlackResponse, duration: float):
        """使用統計更新"""
        self.usage_stats['total_requests'] += 1
        if response.agent_used != "error":
            self.usage_stats['successful_responses'] += 1
        else:
            self.usage_stats['failed_responses'] += 1
        
        self.usage_stats['total_cost'] += response.cost
        self.usage_stats['total_tokens'] += response.tokens
        
        # データベース保存 (将来実装)
        await self.save_usage_data(command, response, duration)
    
    async def save_usage_data(self, command: SlackCommand, response: SlackResponse, duration: float):
        """使用データ保存 (プレースホルダー)"""
        # 将来実装: データベースに保存
        logger.info(f"Usage: {command.type} - {response.cost:.4f}$ - {duration:.2f}s")
    
    async def send_startup_notification(self):
        """起動通知"""
        # 設定された通知チャンネルに送信
        notification_channel = "#conea-dev"  # 設定可能にする
        
        try:
            await self.client.chat_postMessage(
                channel=notification_channel,
                text="🚀 Conea Slack Bot が起動しました！",
                blocks=[
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": "*🤖 Conea MultiLLM Bot 起動完了*\n\n利用可能なコマンド:\n• `@conea-dev` - 開発タスク\n• `@conea-design` - デザイン・UI/UX\n• `@conea-pm` - プロジェクト管理"
                        }
                    }
                ]
            )
        except SlackApiError as e:
            logger.warning(f"Could not send startup notification: {e}")
    
    async def handle_slash_command(self, command: Dict, respond):
        """スラッシュコマンド処理"""
        command_text = command.get('text', '').strip()
        
        if command_text == 'help':
            await self.send_help_response(respond)
        elif command_text == 'status':
            await self.send_status_response(respond)
        elif command_text == 'stats':
            await self.send_stats_response(respond)
        else:
            await respond("不明なコマンドです。`/conea help` でヘルプを確認してください。")
    
    async def send_help_response(self, respond):
        """ヘルプ応答"""
        help_text = """
*🤖 Conea Bot ヘルプ*

*メンションコマンド:*
• `@conea-dev [タスク]` - 開発関連タスク
• `@conea-design [タスク]` - デザイン・UI/UX関連
• `@conea-pm [タスク]` - プロジェクト管理関連

*スラッシュコマンド:*
• `/conea help` - このヘルプ
• `/conea status` - Bot状態確認
• `/conea stats` - 使用統計

*例:*
`@conea-dev ログイン機能のバグを修正して`
`@conea-design ダッシュボードのレスポンシブ対応`
`@conea-pm 今週の進捗レポートを作成`
        """
        
        await respond(help_text)
    
    async def send_status_response(self, respond):
        """状態応答"""
        status = "🟡 テストモード"
        
        await respond(f"""
*🤖 Conea Bot 状態*

ステータス: {status}
稼働時間: {self.get_uptime()}
処理済みリクエスト: {self.usage_stats['total_requests']}
成功率: {self.get_success_rate():.1f}%
        """)
    
    async def send_stats_response(self, respond):
        """統計応答"""
        stats = self.usage_stats
        
        await respond(f"""
*📊 Conea Bot 使用統計*

総リクエスト: {stats['total_requests']}
成功: {stats['successful_responses']}
失敗: {stats['failed_responses']}
総コスト: ${stats['total_cost']:.4f}
総トークン: {stats['total_tokens']:,}
        """)
    
    def get_uptime(self) -> str:
        """稼働時間取得"""
        # 実装: 起動時間からの経過時間
        return "起動中"
    
    def get_success_rate(self) -> float:
        """成功率計算"""
        total = self.usage_stats['total_requests']
        if total == 0:
            return 100.0
        return (self.usage_stats['successful_responses'] / total) * 100
    
    async def handle_direct_message(self, event: Dict, say):
        """ダイレクトメッセージ処理"""
        # 将来実装: DM対応
        await say("DMでの対話は現在開発中です。チャンネルで @conea-dev などのメンションをお使いください。")
    
    async def start(self):
        """ボット開始"""
        logger.info("🚀 Starting Conea Slack Bot...")
        await self.initialize()
        self.socket_handler.start()


def load_slack_config_from_backend():
    """バックエンドAPIからSlack設定を読み取り"""
    import requests
    
    try:
        response = requests.get('http://localhost:8000/api/slack/config')
        if response.status_code == 200:
            config = response.json()
            return config.get('botToken'), config.get('appToken'), config.get('signingSecret')
        else:
            print(f"⚠️  バックエンドから設定を取得できませんでした: {response.status_code}")
            return None, None, None
    except requests.exceptions.RequestException as e:
        print(f"❌ バックエンド接続エラー: {e}")
        return None, None, None


if __name__ == "__main__":
    import os
    import asyncio
    from dotenv import load_dotenv
    
    load_dotenv()
    
    print("🚀 Conea Slack Bot起動中...")
    
    # 1. バックエンドAPIから設定取得を試行
    slack_token, slack_app_token, signing_secret = load_slack_config_from_backend()
    
    # 2. バックエンドから取得できない場合は環境変数を使用
    if not slack_token or not slack_app_token:
        print("📝 環境変数から設定を読み込み中...")
        slack_token = os.getenv('SLACK_BOT_TOKEN')
        slack_app_token = os.getenv('SLACK_APP_TOKEN')
        signing_secret = os.getenv('SLACK_SIGNING_SECRET')
    else:
        print("✅ バックエンドから設定を取得しました")
    
    if not slack_token or not slack_app_token:
        print("❌ Slack設定が見つかりません")
        print("Admin Dashboard (http://localhost:4000/slack) で設定するか、")
        print("環境変数 SLACK_BOT_TOKEN, SLACK_APP_TOKEN を設定してください")
        exit(1)
    
    # ログ設定
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    print(f"🔗 Bot Token: {slack_token[:12]}...")
    print(f"🔗 App Token: {slack_app_token[:12]}...")
    print("🤖 Slack Botを起動しています...")
    
    # ボット起動
    try:
        bot = ConeaSlackBot(slack_token, slack_app_token)
        asyncio.run(bot.start())
    except Exception as e:
        print(f"❌ Bot起動エラー: {e}")
        exit(1)