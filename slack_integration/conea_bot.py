"""
Conea Unified Slack Bot - @conea統一アプローチ
AIが自動的にタスクを判断して最適な応答を生成
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
        logging.FileHandler('/tmp/conea_bot.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class TaskClassification:
    """タスク分類結果"""
    primary_domain: str
    complexity: str  # 'low', 'medium', 'high'
    confidence: float
    keywords: List[str]
    requires_code: bool
    requires_design: bool
    requires_analysis: bool

@dataclass
class AIResponse:
    """AI応答データ"""
    content: str
    model_used: str
    tokens: int
    cost: float
    classification: TaskClassification
    processing_time: float

class TaskClassifier:
    """タスク分類器"""
    
    def __init__(self):
        self.domain_patterns = {
            'development': {
                'keywords': ['コード', '実装', 'プログラ', '開発', 'バグ', 'エラー', 'API', '関数', 'クラス', 'テスト', 
                           'code', 'implement', 'debug', 'function', 'class', 'test', 'refactor', 'typescript', 'react'],
                'weight': 1.0
            },
            'design': {
                'keywords': ['デザイン', 'UI', 'UX', 'レイアウト', '配色', 'フォント', 'ユーザビリティ', 'カラー',
                           'design', 'interface', 'layout', 'color', 'typography', 'wireframe', 'figma'],
                'weight': 1.0
            },
            'management': {
                'keywords': ['計画', 'スケジュール', '優先', '戦略', 'リソース', '予算', 'ROI', 'KPI', '管理',
                           'plan', 'schedule', 'priority', 'strategy', 'resource', 'budget', 'timeline', 'project'],
                'weight': 1.0
            },
            'analysis': {
                'keywords': ['分析', 'データ', '統計', 'レポート', 'グラフ', '傾向', '予測', '調査',
                           'analyze', 'data', 'statistics', 'report', 'trend', 'forecast', 'metrics'],
                'weight': 1.0
            }
        }
    
    def classify(self, message: str) -> TaskClassification:
        """メッセージを分類"""
        message_lower = message.lower()
        domain_scores = {}
        found_keywords = []
        
        # 各ドメインのスコア計算
        for domain, config in self.domain_patterns.items():
            score = 0
            for keyword in config['keywords']:
                if keyword.lower() in message_lower:
                    score += config['weight']
                    found_keywords.append(keyword)
            domain_scores[domain] = score
        
        # 最高スコアのドメインを選択
        if domain_scores:
            primary_domain = max(domain_scores, key=domain_scores.get)
            confidence = domain_scores[primary_domain] / max(1, sum(domain_scores.values()))
        else:
            primary_domain = 'general'
            confidence = 0.5
        
        # 複雑度評価
        complexity = self._assess_complexity(message)
        
        return TaskClassification(
            primary_domain=primary_domain,
            complexity=complexity,
            confidence=confidence,
            keywords=found_keywords,
            requires_code='コード' in message or 'code' in message_lower,
            requires_design='デザイン' in message or 'design' in message_lower,
            requires_analysis='分析' in message or 'analyz' in message_lower
        )
    
    def _assess_complexity(self, message: str) -> str:
        """複雑度を評価"""
        factors = {
            'length': len(message),
            'questions': len(re.findall(r'\?', message)),
            'technical_terms': len(re.findall(r'API|アーキテクチャ|最適化|統合|パフォーマンス', message, re.IGNORECASE)),
            'requirements': len(re.findall(r'要件|条件|制約|仕様', message))
        }
        
        score = 0
        score += 2 if factors['length'] > 200 else 1 if factors['length'] > 100 else 0
        score += 2 if factors['questions'] > 2 else 1 if factors['questions'] > 0 else 0
        score += 2 if factors['technical_terms'] > 3 else 1 if factors['technical_terms'] > 1 else 0
        score += 1 if factors['requirements'] > 0 else 0
        
        if score >= 5:
            return 'high'
        elif score >= 3:
            return 'medium'
        else:
            return 'low'

class AIRouter:
    """AI選択・ルーティング"""
    
    def __init__(self, backend_url: str):
        self.backend_url = backend_url
        self.classifier = TaskClassifier()
        
        # モデル選択マトリックス
        self.model_selection = {
            'development': {
                'low': 'claude-3-5-sonnet-20241022',
                'medium': 'claude-3-5-sonnet-20241022', 
                'high': 'claude-3-5-sonnet-20241022'
            },
            'design': {
                'low': 'claude-3-5-sonnet-20241022',
                'medium': 'claude-3-5-sonnet-20241022',
                'high': 'claude-3-5-sonnet-20241022'
            },
            'management': {
                'low': 'claude-3-5-sonnet-20241022',
                'medium': 'claude-3-5-sonnet-20241022',
                'high': 'claude-3-5-sonnet-20241022'
            },
            'analysis': {
                'low': 'claude-3-5-sonnet-20241022',
                'medium': 'claude-3-5-sonnet-20241022',
                'high': 'claude-3-5-sonnet-20241022'
            },
            'general': {
                'low': 'claude-3-5-sonnet-20241022',
                'medium': 'claude-3-5-sonnet-20241022',
                'high': 'claude-3-5-sonnet-20241022'
            }
        }
    
    async def route_request(self, message: str, context: Dict = None) -> AIResponse:
        """メッセージをルーティングして適切なAIで処理"""
        start_time = datetime.now()
        
        # Step 1: タスク分類
        classification = self.classifier.classify(message)
        logger.info(f"🎯 Task classified: {classification.primary_domain} (confidence: {classification.confidence:.2f})")
        
        # Step 2: モデル選択
        model = self._select_model(classification)
        logger.info(f"🤖 Selected model: {model}")
        
        # Step 3: 専門プロンプト構築
        enhanced_prompt = self._build_specialized_prompt(message, classification, context)
        
        # Step 4: AI実行
        try:
            response = await self._call_ai_api(model, enhanced_prompt, classification)
            
            processing_time = (datetime.now() - start_time).total_seconds()
            
            return AIResponse(
                content=response['content'],
                model_used=model,
                tokens=response.get('tokens', 0),
                cost=response.get('cost', 0.0),
                classification=classification,
                processing_time=processing_time
            )
            
        except Exception as e:
            logger.error(f"❌ AI処理エラー: {e}")
            return AIResponse(
                content=f"申し訳ございません。処理中にエラーが発生しました: {str(e)}",
                model_used=model,
                tokens=0,
                cost=0.0,
                classification=classification,
                processing_time=(datetime.now() - start_time).total_seconds()
            )
    
    def _select_model(self, classification: TaskClassification) -> str:
        """分類結果に基づいてモデルを選択"""
        return self.model_selection.get(
            classification.primary_domain, 
            self.model_selection['general']
        ).get(classification.complexity, 'claude-3-5-sonnet-20241022')
    
    def _build_specialized_prompt(self, message: str, classification: TaskClassification, context: Dict) -> str:
        """専門分野に特化したプロンプトを構築"""
        
        base_prompts = {
            'development': """あなたは優秀なソフトウェアエンジニアです。以下の特徴で回答してください：
- 実用的なコード例を含める
- ベストプラクティスに従う
- セキュリティとパフォーマンスを考慮
- 保守性の高いソリューションを提案""",
            
            'design': """あなたは経験豊富なUI/UXデザイナーです。以下の観点で回答してください：
- ユーザー体験を最優先に考える
- アクセシビリティを重視
- 現代的なデザイントレンドを反映
- 実装可能性を考慮した提案""",
            
            'management': """あなたは優秀なプロジェクトマネージャーです。以下の視点で回答してください：
- ビジネス価値を重視
- 実現可能性とROIを評価
- リスク分析と対策を含める
- 段階的な実装計画を提案""",
            
            'analysis': """あなたはデータアナリストの専門家です。以下の観点で回答してください：
- データに基づいた客観的な分析
- 明確な結論と根拠を提示
- 視覚化の提案を含める
- 実行可能なアクションプランを提供""",
            
            'general': """あなたは知識豊富なアシスタントです。以下を心がけて回答してください：
- 分かりやすく具体的な説明
- 実用的なアドバイス
- 必要に応じて専門分野の観点を含める
- 建設的で有用な提案"""
        }
        
        base_prompt = base_prompts.get(classification.primary_domain, base_prompts['general'])
        
        # 複雑度に応じてプロンプトを調整
        if classification.complexity == 'high':
            base_prompt += "\n\n複雑なタスクのため、詳細な分析と段階的なアプローチを提供してください。"
        elif classification.complexity == 'low':
            base_prompt += "\n\n簡潔で分かりやすい回答を心がけてください。"
        
        return f"{base_prompt}\n\nユーザーからの質問: {message}"
    
    async def _call_ai_api(self, model: str, prompt: str, classification: TaskClassification) -> Dict:
        """AI APIを呼び出し"""
        payload = {
            'provider': 'claude',
            'prompt': prompt,
            'max_tokens': 3000 if classification.complexity == 'high' else 2000,
            'temperature': 0.3 if classification.primary_domain == 'development' else 0.7
        }
        
        logger.info(f"🔄 API呼び出し: {self.backend_url}/api/ai/chat")
        
        response = requests.post(
            f"{self.backend_url}/api/ai/chat",
            json=payload,
            timeout=60
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                return result
            else:
                raise Exception(result.get('error', 'Unknown API error'))
        else:
            raise Exception(f"API Error: {response.status_code}")

class ConeaBot:
    """統一Conea Slack Bot"""
    
    def __init__(self, bot_token: str, app_token: str):
        self.app = AsyncApp(token=bot_token)
        self.client = AsyncWebClient(token=bot_token)
        self.socket_handler = AsyncSocketModeHandler(self.app, app_token)
        self.ai_router = AIRouter("http://localhost:8000")
        
        # 統計追跡
        self.stats = {
            'total_requests': 0,
            'successful_responses': 0,
            'failed_responses': 0,
            'domains': {'development': 0, 'design': 0, 'management': 0, 'analysis': 0, 'general': 0}
        }
        
        self.setup_event_handlers()
        logger.info("🤖 Conea Unified Bot initialized")
    
    def setup_event_handlers(self):
        """イベントハンドラー設定"""
        
        @self.app.event("app_mention")
        async def handle_mention(event, say, client):
            """@conea メンション処理"""
            logger.info(f"🔔 Conea mention received: {event}")
            await self.process_mention(event, say, client)
        
        @self.app.message("")
        async def handle_message(message, say, client):
            """メッセージ処理（ダイレクトメンション検出）"""
            if message.get('subtype') or message.get('bot_id'):
                return
            
            text = message.get('text', '')
            
            # @conea パターンを検出
            if '@conea' in text.lower() or 'conea' in text.lower():
                logger.info(f"🎯 Conea keyword detected: {text}")
                await self.process_mention(message, say, client)
    
    async def process_mention(self, event: Dict, say, client):
        """メンション処理の中核ロジック"""
        self.stats['total_requests'] += 1
        
        channel = event['channel']
        thread_ts = event.get('thread_ts', event['ts'])
        user_id = event['user']
        
        # ユーザーメッセージからメンション除去
        raw_text = event.get('text', '')
        user_message = re.sub(r'<@U\w+>', '', raw_text)
        user_message = re.sub(r'@conea', '', user_message, flags=re.IGNORECASE)
        user_message = user_message.strip()
        
        if not user_message:
            user_message = "こんにちは！何かお手伝いできることはありますか？"
        
        # 処理中インジケーター
        thinking_msg = await say(
            text="考えています... 🤔",
            thread_ts=thread_ts
        )
        
        try:
            # コンテキスト収集
            context = await self.gather_context(channel, thread_ts, client)
            
            # AIルーターで処理
            response = await self.ai_router.route_request(user_message, context)
            
            # 統計更新
            self.stats['successful_responses'] += 1
            self.stats['domains'][response.classification.primary_domain] += 1
            
            # 応答を表示
            await client.chat_update(
                channel=channel,
                ts=thinking_msg['ts'],
                text=self.format_response(response),
                blocks=self.create_response_blocks(response)
            )
            
            logger.info(f"✅ Response sent successfully: {response.classification.primary_domain}")
            
        except Exception as e:
            logger.error(f"❌ Error processing mention: {e}")
            self.stats['failed_responses'] += 1
            
            await client.chat_update(
                channel=channel,
                ts=thinking_msg['ts'],
                text="申し訳ございません。処理中にエラーが発生しました。"
            )
    
    def format_response(self, response: AIResponse) -> str:
        """応答をフォーマット"""
        domain_icons = {
            'development': '👨‍💻',
            'design': '🎨', 
            'management': '📊',
            'analysis': '📈',
            'general': '🤖'
        }
        
        icon = domain_icons.get(response.classification.primary_domain, '🤖')
        domain_name = response.classification.primary_domain.title()
        
        header = f"{icon} *Conea {domain_name}*"
        
        return f"{header}\n\n{response.content}"
    
    def create_response_blocks(self, response: AIResponse) -> List[Dict]:
        """Slack Blocks UI作成"""
        domain_icons = {
            'development': '👨‍💻 Development',
            'design': '🎨 Design', 
            'management': '📊 Management',
            'analysis': '📈 Analysis',
            'general': '🤖 General'
        }
        
        domain_label = domain_icons.get(response.classification.primary_domain, '🤖 General')
        
        blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*{domain_label}*"
                }
            },
            {
                "type": "section", 
                "text": {
                    "type": "mrkdwn",
                    "text": response.content
                }
            }
        ]
        
        # メタデータ情報
        if response.tokens > 0 or response.cost > 0:
            blocks.append({
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"Model: {response.model_used} | Tokens: {response.tokens} | Cost: ${response.cost:.4f} | Time: {response.processing_time:.1f}s"
                    }
                ]
            })
        
        return blocks
    
    async def gather_context(self, channel: str, thread_ts: str, client) -> Dict:
        """コンテキスト情報を収集"""
        try:
            # スレッド履歴を取得
            result = await client.conversations_replies(
                channel=channel,
                ts=thread_ts,
                limit=5
            )
            
            messages = []
            for msg in result['messages'][-5:]:  # 最新5件
                if not msg.get('bot_id'):
                    messages.append(msg.get('text', ''))
            
            return {
                'recent_messages': messages,
                'channel': channel,
                'thread_ts': thread_ts
            }
            
        except Exception as e:
            logger.warning(f"Context gathering failed: {e}")
            return {}
    
    async def start(self):
        """ボット開始"""
        logger.info("🚀 Starting Conea Unified Bot...")
        await self.socket_handler.start_async()

def load_slack_config():
    """Slack設定読み込み"""
    # バックエンドAPIから取得
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
    
    # 環境変数から取得
    logger.info("📝 環境変数から設定を読み込み中...")
    from dotenv import load_dotenv
    load_dotenv()
    
    bot_token = os.getenv('SLACK_BOT_TOKEN')
    app_token = os.getenv('SLACK_APP_TOKEN')
    
    return bot_token, app_token

async def main():
    """メイン関数"""
    print("🚀 Conea Unified Bot起動中...")
    
    # 設定読み込み
    bot_token, app_token = load_slack_config()
    
    if not bot_token or not app_token:
        print("❌ Slack設定が見つかりません")
        print("Admin Dashboard (http://localhost:4000/slack) で設定するか、")
        print("環境変数 SLACK_BOT_TOKEN, SLACK_APP_TOKEN を設定してください")
        return
    
    print(f"🔗 Bot Token: {bot_token[:12]}...")
    print(f"🔗 App Token: {app_token[:12]}...")
    print("🤖 Conea Unified Botを起動しています...")
    
    try:
        bot = ConeaBot(bot_token, app_token)
        await bot.start()
    except Exception as e:
        logger.error(f"❌ Bot起動エラー: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(main())