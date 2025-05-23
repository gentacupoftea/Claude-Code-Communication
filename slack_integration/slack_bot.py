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

# MultiLLM システム統合
import sys
sys.path.append('../')
from autonomous_system import AutonomousOrchestrator, ConfigManager, MultiLLMClient
from autonomous_debug import AutonomousDebugger, ErrorContext, ErrorType

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
        self.app = App(token=token)
        self.client = WebClient(token=token)
        self.socket_handler = SocketModeHandler(self.app, app_token)
        
        # MultiLLM システム統合
        self.orchestrator = None
        self.config_manager = ConfigManager()
        
        # タスクカテゴリとキーワード定義
        self.task_categories = {
            'development': {
                'keywords': ['バグ', 'bug', 'エラー', 'error', 'コード', 'code', '実装', 'implement', 
                           'リファクタ', 'refactor', 'テスト', 'test', 'デバッグ', 'debug', 
                           'API', 'データベース', 'DB', '関数', 'function', 'クラス', 'class'],
                'preferred_agent': 'openai',
                'fallback_agent': 'claude'
            },
            'design': {
                'keywords': ['UI', 'UX', 'デザイン', 'design', 'レイアウト', 'layout', 'スタイル', 'style',
                           'プロトタイプ', 'prototype', 'モックアップ', 'mockup', 'ワイヤーフレーム',
                           'カラー', 'color', 'フォント', 'font', 'アイコン', 'icon', 'レスポンシブ'],
                'preferred_agent': 'claude',
                'fallback_agent': 'gemini'
            },
            'management': {
                'keywords': ['進捗', 'progress', 'スケジュール', 'schedule', 'タスク', 'task',
                           'プロジェクト', 'project', 'レポート', 'report', 'リスク', 'risk',
                           '計画', 'plan', '管理', 'manage', 'チーム', 'team', '会議', 'meeting'],
                'preferred_agent': 'claude',
                'fallback_agent': 'openai'
            },
            'analysis': {
                'keywords': ['分析', 'analyze', 'analysis', '調査', 'research', '検討', 'consider',
                           '評価', 'evaluate', '比較', 'compare', 'データ', 'data', '統計', 'statistics'],
                'preferred_agent': 'claude',
                'fallback_agent': 'openai'
            },
            'documentation': {
                'keywords': ['ドキュメント', 'document', '説明', 'explain', 'README', 'マニュアル', 'manual',
                           'ガイド', 'guide', 'チュートリアル', 'tutorial', 'API仕様', 'specification'],
                'preferred_agent': 'openai',
                'fallback_agent': 'claude'
            }
        }
        
        # 自律デバッグシステム統合
        self.debug_system = None
        self._init_debug_system()
        
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
    
    def _init_debug_system(self):
        """自律デバッグシステムの初期化"""
        try:
            if hasattr(self, 'orchestrator') and self.orchestrator:
                llm_client = self.orchestrator.llm_client
            else:
                llm_client = MultiLLMClient()
            
            self.debug_system = AutonomousDebugger(
                llm_client=llm_client,
                config={
                    "auto_fix_enabled": True,
                    "approval_required_for_risk_level": 3,
                    "pattern_learning_enabled": True
                }
            )
            logger.info("🔧 自律デバッグシステムを初期化しました")
        except Exception as e:
            logger.warning(f"自律デバッグシステムの初期化に失敗: {e}")
            self.debug_system = None
    
    async def initialize(self):
        """ボット初期化"""
        try:
            # MultiLLM システム初期化
            self.orchestrator = AutonomousOrchestrator()
            await self.orchestrator.initialize()
            
            # デバッグシステムの再初期化（orchestratorが利用可能になったため）
            self._init_debug_system()
            
            logger.info("🤖 Conea Slack Bot initialized successfully")
            
            # 起動通知
            await self.send_startup_notification()
            
        except Exception as e:
            logger.error(f"Bot initialization failed: {e}")
            raise
    
    def setup_event_handlers(self):
        """イベントハンドラー設定"""
        
        @self.app.event("app_mention")
        async def handle_app_mention(event, say, ack):
            await ack()
            asyncio.create_task(self.handle_mention(event, say))
        
        @self.app.command("/conea")
        async def handle_slash_command(ack, respond, command):
            await ack()
            asyncio.create_task(self.handle_slash_command(command, respond))
        
        @self.app.event("message")
        async def handle_dm(event, say, ack):
            await ack()
            # DM処理 (オプション)
            if event.get("channel_type") == "im":
                asyncio.create_task(self.handle_direct_message(event, say))
    
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
        """Slack コマンド解析 - 内容から自動的にタスクタイプを判定"""
        # メンション除去してコンテンツ抽出
        content = re.sub(r'<@U\w+>', '', text)  # ユーザーメンション除去
        content = content.strip()
        
        # タスクカテゴリを自動判定
        command_type = self._detect_task_category(content)
        
        return SlackCommand(
            type=command_type,
            content=content,
            original_text=text,
            channel="",  # 後で設定
            user="",     # 後で設定
            timestamp="" # 後で設定
        )
    
    def _detect_task_category(self, text: str) -> str:
        """テキスト内容からタスクカテゴリを自動検出"""
        text_lower = text.lower()
        category_scores = {}
        
        # 各カテゴリのキーワードマッチングスコアを計算
        for category, config in self.task_categories.items():
            score = 0
            for keyword in config['keywords']:
                if keyword.lower() in text_lower:
                    # キーワードの長さに応じてスコアを重み付け
                    score += len(keyword)
            category_scores[category] = score
        
        # 最もスコアの高いカテゴリを選択
        if category_scores:
            best_category = max(category_scores, key=category_scores.get)
            # スコアが0の場合はデフォルトに
            if category_scores[best_category] > 0:
                logger.info(f"📊 タスクカテゴリ自動検出: {best_category} (スコア: {category_scores[best_category]})")
                return best_category
        
        # デフォルトは開発カテゴリ
        logger.info("📊 タスクカテゴリ: development (デフォルト)")
        return 'development'
    
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
            # カテゴリ設定を取得
            category_config = self.task_categories.get(command.type, self.task_categories['development'])
            
            # タスク作成
            task_request = {
                'type': self.map_command_to_task_type(command.type),
                'description': command.content,
                'context': context,
                'priority': 'medium',
                'user': command.user,
                'channel': command.channel,
                'preferred_agent': category_config['preferred_agent'],
                'fallback_agent': category_config['fallback_agent']
            }
            
            # Orchestrator 経由でタスク実行
            task_result = await self.orchestrator.create_task(
                task_type=task_request['type'],
                description=task_request['description'],
                context=task_request['context']
            )
            
            # 結果をSlack形式に変換
            duration = (datetime.now() - start_time).total_seconds()
            
            return SlackResponse(
                text=task_result.get('response', '応答を生成できませんでした'),
                blocks=self.create_response_blocks(task_result, command),
                thread_ts=command.timestamp,
                cost=task_result.get('cost', 0.0),
                tokens=task_result.get('tokens', 0),
                agent_used=task_result.get('agent', category_config['preferred_agent']),
                duration=duration
            )
            
        except Exception as e:
            logger.error(f"LLM task execution failed: {e}")
            
            # 自律デバッグシステムによるエラー解析
            if self.debug_system:
                error_context = await self.debug_system.analyze_error(e, context)
                solutions = await self.debug_system.generate_solutions(error_context)
                
                # 最も信頼度の高い解決策を試行
                if solutions and self.config_manager.get('auto_debug_enabled', True):
                    best_solution = solutions[0]
                    if best_solution.confidence > 0.8 and not best_solution.requires_approval:
                        debug_result = await self.debug_system.execute_solution(best_solution)
                        if debug_result['success']:
                            return SlackResponse(
                                text=f"🔧 自動修復完了: {best_solution.description}",
                                blocks=self.create_debug_blocks(error_context, best_solution, debug_result),
                                agent_used="debug_system",
                                duration=(datetime.now() - start_time).total_seconds()
                            )
            
            return SlackResponse(
                text=f"エラーが発生しました: {str(e)}",
                agent_used="error",
                duration=(datetime.now() - start_time).total_seconds()
            )
    
    def map_command_to_task_type(self, command_type: str) -> str:
        """カテゴリをタスクタイプにマッピング"""
        mapping = {
            'development': 'code_generation',
            'design': 'strategic_analysis',
            'management': 'project_coordination',
            'analysis': 'strategic_analysis',
            'documentation': 'code_generation'
        }
        return mapping.get(command_type, 'code_generation')
    
    def create_debug_blocks(self, error_context: ErrorContext, solution: Any, debug_result: Dict) -> List[Dict]:
        """デバッグ結果のSlack Blocks作成"""
        blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*🔧 自動デバッグ完了*\n\n*エラー:* {error_context.error_type.value}\n*解決策:* {solution.description}"
                }
            },
            {
                "type": "divider"
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*信頼度:* {solution.confidence:.0%}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*実行時間:* {(debug_result.get('end_time') - debug_result.get('start_time')).total_seconds():.1f}秒"
                    }
                ]
            }
        ]
        
        # 実行ステップの詳細
        if debug_result.get('steps_executed'):
            steps_text = "\n".join([f"• {step['step'].get('description', step['step'].get('action', 'Unknown'))}" 
                                   for step in debug_result['steps_executed']])
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*実行ステップ:*\n{steps_text}"
                }
            })
        
        return blocks
    
    def create_response_blocks(self, task_result: Dict, command: SlackCommand) -> List[Dict]:
        """Slack Blocks UI作成"""
        # カテゴリに応じたアイコンとラベル
        category_info = {
            'development': {'icon': '💻', 'label': '開発'},
            'design': {'icon': '🎨', 'label': 'デザイン'},
            'management': {'icon': '📊', 'label': '管理'},
            'analysis': {'icon': '🔍', 'label': '分析'},
            'documentation': {'icon': '📝', 'label': 'ドキュメント'}
        }
        
        info = category_info.get(command.type, {'icon': '🤖', 'label': command.type})
        
        blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*{info['icon']} {info['label']}タスク*\n{task_result.get('response', '')}"
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
        status = "🟢 オンライン" if self.orchestrator else "🔴 オフライン"
        
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
    
    def start(self):
        """ボット開始"""
        logger.info("🚀 Starting Conea Slack Bot...")
        asyncio.create_task(self.initialize())
        self.socket_handler.start()


if __name__ == "__main__":
    import os
    from dotenv import load_dotenv
    
    load_dotenv()
    
    # 環境変数から設定取得
    slack_token = os.getenv('SLACK_BOT_TOKEN')
    slack_app_token = os.getenv('SLACK_APP_TOKEN')
    
    if not slack_token or not slack_app_token:
        raise ValueError("SLACK_BOT_TOKEN and SLACK_APP_TOKEN are required")
    
    # ログ設定
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # ボット起動
    bot = ConeaSlackBot(slack_token, slack_app_token)
    bot.start()