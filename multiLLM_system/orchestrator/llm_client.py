"""
LLM Client - OpenAI GPT-4 Integration
OrchestratorでGPT-4を使用するためのクライアント
"""

import asyncio
import logging
import json
from typing import Dict, List, Any, Optional, AsyncGenerator
from dataclasses import dataclass
import aiohttp
import os
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class LLMMessage:
    """LLMメッセージ"""
    role: str  # "user", "assistant", "system"
    content: str
    timestamp: datetime = None


@dataclass
class TaskAnalysis:
    """タスク分析結果"""
    task_type: str
    priority: str
    complexity: str  # "simple", "complex"
    subtasks: List[str]
    assigned_workers: List[str]
    reasoning: str


class ClaudeClient:
    """OpenAI GPT-4 クライアント（Claude互換インターフェース）"""
    
    def __init__(self, api_key: str = None):
        # OpenAI APIキーを優先、なければデモモード
        self.api_key = api_key or os.getenv('OPENAI_API_KEY') or os.getenv('ANTHROPIC_API_KEY')
        self.base_url = "https://api.openai.com/v1/chat/completions"
        self.model = "gpt-4-turbo-preview"  # GPT-4 Turbo
        self.session = None
        self.demo_mode = False
        
        # デバッグ用: APIキーの存在確認
        if self.api_key:
            if 'sk-' in self.api_key and len(self.api_key) > 20:
                logger.info(f"🔑 OpenAI API Key found: {self.api_key[:7]}...{self.api_key[-4:]}")
            else:
                logger.warning("⚠️ Invalid API key format. Using enhanced demo mode.")
                self.demo_mode = True
        else:
            logger.warning("⚠️ No API key found. Using enhanced demo mode.")
            self.demo_mode = True
    
    async def initialize(self):
        """クライアント初期化"""
        if self.api_key and not self.demo_mode:
            self.session = aiohttp.ClientSession()
            logger.info("✅ LLM API client initialized")
            
            # API接続テスト
            try:
                test_response = await self._test_api_connection()
                if test_response:
                    logger.info("🟢 API connection test successful")
                else:
                    logger.error("🔴 API connection test failed")
                    self.demo_mode = True
            except Exception as e:
                logger.error(f"🔴 API test error: {e}")
                self.demo_mode = True
        else:
            logger.info("🔄 LLM client in enhanced demo mode")
            self.session = aiohttp.ClientSession()  # デモモードでもセッション作成
    
    async def _test_api_connection(self) -> bool:
        """API接続テスト"""
        if not self.session:
            return False
            
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": "gpt-3.5-turbo",  # テスト用に軽量モデル使用
            "messages": [{"role": "user", "content": "Hi"}],
            "max_tokens": 5
        }
        
        try:
            async with self.session.post(self.base_url, headers=headers, json=payload) as response:
                if response.status == 200:
                    return True
                else:
                    error_text = await response.text()
                    logger.error(f"API test failed: {response.status} - {error_text}")
                    return False
        except Exception as e:
            logger.error(f"API test exception: {e}")
            return False
    
    async def shutdown(self):
        """クライアント終了"""
        if self.session:
            await self.session.close()
    
    async def analyze_task(self, user_request: str, context: Dict = None) -> TaskAnalysis:
        """
        ユーザーリクエストを分析してタスク計画を立てる
        """
        system_prompt = """あなたは高度なAIタスクオーケストレーターです。ユーザーのリクエストを分析し、以下の観点で分類・計画してください：

1. **タスクタイプ分類**:
   - MEMORY_OPERATION: メモリ検索・保存・削除操作
   - CODE_IMPLEMENTATION: プログラミング・実装タスク
   - UI_DESIGN: UI/UXデザイン関連
   - DATA_ANALYSIS: データ分析・統計処理
   - DOCUMENTATION: ドキュメント作成・説明
   - PROJECT_MANAGEMENT: プロジェクト管理・進捗確認
   - GENERAL: 一般的な質問・対話

2. **優先度**: CRITICAL, HIGH, MEDIUM, LOW

3. **複雑度**: 
   - simple: 単一のワーカーで処理可能
   - complex: 複数のワーカーやステップが必要

4. **サブタスク分解**: 複雑なタスクの場合

5. **ワーカー割り当て**: 最適なワーカーを選択
   - mcp_worker: OpenMemory操作
   - backend_worker: バックエンド実装
   - frontend_worker: UI/フロントエンド
   - analytics_worker: データ分析
   - documentation_worker: ドキュメント
   - project_manager: プロジェクト管理

JSONフォーマットで回答してください。"""
        
        user_message = f"""
ユーザーリクエスト: {user_request}

コンテキスト: {json.dumps(context or {}, ensure_ascii=False)}

このリクエストを分析してタスク計画を立ててください。
"""
        
        if self.api_key and self.session:
            # 実際のClaude API呼び出し
            response = await self._call_claude_api(system_prompt, user_message)
            try:
                result = json.loads(response)
                return TaskAnalysis(
                    task_type=result.get('task_type', 'GENERAL'),
                    priority=result.get('priority', 'MEDIUM'),
                    complexity=result.get('complexity', 'simple'),
                    subtasks=result.get('subtasks', []),
                    assigned_workers=result.get('assigned_workers', ['backend_worker']),
                    reasoning=result.get('reasoning', '自動分析による分類')
                )
            except json.JSONDecodeError:
                logger.error("Failed to parse Claude API response as JSON")
                return self._fallback_analysis(user_request)
        else:
            # デモモード（Claude APIキーなし）
            return self._demo_task_analysis(user_request)
    
    async def _call_claude_api(self, system_prompt: str, user_message: str) -> str:
        """OpenAI API呼び出し（Claude互換インターフェース）"""
        if self.demo_mode:
            return await self._enhanced_demo_response(user_message, system_prompt)
            
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ]
        
        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": 2000,
            "temperature": 0.7
        }
        
        try:
            async with self.session.post(self.base_url, headers=headers, json=payload) as response:
                if response.status == 200:
                    data = await response.json()
                    return data['choices'][0]['message']['content']
                else:
                    error_text = await response.text()
                    logger.error(f"API error {response.status}: {error_text}")
                    return await self._enhanced_demo_response(user_message, system_prompt)
        except Exception as e:
            logger.error(f"API call failed: {e}")
            return await self._enhanced_demo_response(user_message, system_prompt)
    
    def _demo_task_analysis(self, user_request: str) -> TaskAnalysis:
        """デモ用のタスク分析（Claude APIキーなしの場合）"""
        request_lower = user_request.lower()
        
        # 簡単なキーワードベース分析（デモ用）
        if any(kw in request_lower for kw in ['思い出して', '記憶して', '保存して', 'メモリ']):
            return TaskAnalysis(
                task_type='MEMORY_OPERATION',
                priority='MEDIUM',
                complexity='simple',
                subtasks=[user_request],
                assigned_workers=['mcp_worker'],
                reasoning='メモリ操作キーワードを検出'
            )
        
        elif any(kw in request_lower for kw in ['コード', 'プログラム', 'api', 'バグ']):
            return TaskAnalysis(
                task_type='CODE_IMPLEMENTATION',
                priority='MEDIUM',
                complexity='simple',
                subtasks=[user_request],
                assigned_workers=['backend_worker'],
                reasoning='プログラミング関連キーワードを検出'
            )
        
        elif any(kw in request_lower for kw in ['ui', 'デザイン', 'react', 'フロント']):
            return TaskAnalysis(
                task_type='UI_DESIGN',
                priority='MEDIUM',
                complexity='simple',
                subtasks=[user_request],
                assigned_workers=['frontend_worker'],
                reasoning='UI/デザイン関連キーワードを検出'
            )
        
        elif any(kw in request_lower for kw in ['プロジェクト', '進捗', 'ガント', 'タスク管理']):
            return TaskAnalysis(
                task_type='PROJECT_MANAGEMENT',
                priority='HIGH',
                complexity='complex',
                subtasks=[
                    'プロジェクト情報の収集',
                    'タスク状況の分析',
                    'レポート生成'
                ],
                assigned_workers=['analytics_worker', 'documentation_worker'],
                reasoning='プロジェクト管理関連のキーワードを検出'
            )
        
        else:
            return TaskAnalysis(
                task_type='GENERAL',
                priority='MEDIUM',
                complexity='simple',
                subtasks=[user_request],
                assigned_workers=['backend_worker'],
                reasoning='一般的な質問として分類'
            )
    
    def _fallback_analysis(self, user_request: str) -> TaskAnalysis:
        """API呼び出し失敗時のフォールバック"""
        return self._demo_task_analysis(user_request)
    
    def _fallback_response(self, user_message: str) -> str:
        """API呼び出し失敗時のフォールバック応答"""
        # タスク分析用のJSONレスポンス
        return json.dumps({
            "task_type": "GENERAL",
            "priority": "MEDIUM",
            "complexity": "simple",
            "subtasks": [user_message],
            "assigned_workers": ["backend_worker"],
            "reasoning": "API呼び出し失敗によるフォールバック分析"
        }, ensure_ascii=False)
    
    async def generate_response(self, messages: List[LLMMessage], context: Dict = None, stream_callback=None) -> str:
        """
        一般的な会話応答を生成
        """
        user_message = messages[-1].content if messages else ""
        
        # システムプロンプト
        system_prompt = """あなたは親切で知識豊富なAIアシスタントです。ユーザーの質問に適切に回答してください。"""
        
        if self.demo_mode:
            # 強化されたデモモード
            response = await self._enhanced_demo_response(user_message, system_prompt)
            if stream_callback:
                # デモモードでもストリーミングをシミュレート
                for i in range(0, len(response), 20):
                    chunk = response[i:i+20]
                    await stream_callback(chunk)
                    await asyncio.sleep(0.05)  # 自然なタイピング速度
            return response
        
        try:
            if stream_callback:
                # ストリーミング対応のAPI呼び出し
                return await self._call_claude_api_stream(system_prompt, user_message, stream_callback)
            else:
                response = await self._call_claude_api(system_prompt, user_message)
                return response
        except Exception as e:
            # API失敗時は強化されたデモモードの応答を使用
            logger.error(f"API failed, using enhanced demo response: {e}")
            return await self._enhanced_demo_response(user_message, system_prompt)
    
    async def _call_claude_api_stream(self, system_prompt: str, user_message: str, stream_callback) -> str:
        """OpenAI APIストリーミング呼び出し（Claude互換）"""
        if self.demo_mode:
            # デモモードでのストリーミング
            response = await self._enhanced_demo_response(user_message, system_prompt)
            for i in range(0, len(response), 20):
                chunk = response[i:i+20]
                await stream_callback(chunk)
                await asyncio.sleep(0.05)
            return response
            
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ]
        
        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": 2000,
            "temperature": 0.7,
            "stream": True
        }
        
        full_response = ""
        
        try:
            async with self.session.post(self.base_url, headers=headers, json=payload) as response:
                if response.status == 200:
                    async for line in response.content:
                        if line:
                            line_str = line.decode('utf-8').strip()
                            if line_str.startswith('data: '):
                                data_str = line_str[6:]
                                if data_str == '[DONE]':
                                    break
                                try:
                                    data = json.loads(data_str)
                                    if 'choices' in data and len(data['choices']) > 0:
                                        delta = data['choices'][0].get('delta', {})
                                        if 'content' in delta:
                                            chunk = delta['content']
                                            full_response += chunk
                                            await stream_callback(chunk)
                                except json.JSONDecodeError:
                                    continue
                    return full_response
                else:
                    error_text = await response.text()
                    logger.error(f"API stream error {response.status}: {error_text}")
                    return await self._enhanced_demo_response(user_message, system_prompt)
        except Exception as e:
            logger.error(f"API stream call failed: {e}")
            return await self._enhanced_demo_response(user_message, system_prompt)
    
    def _demo_response(self, user_message: str) -> str:
        """デモ用の応答生成（より知的な応答）"""
        message_lower = user_message.lower()
        
        if "こんにちは" in user_message or "hello" in message_lower:
            return """こんにちは！MultiLLM Orchestratorシステムへようこそ。

私はClaude-4ベースのAIオーケストレーターです。以下のような機能を提供しています：

🧠 **知的タスク分析**: ユーザーのリクエストを理解し、最適なワーカーに振り分け
🔧 **専門Worker連携**: 各分野の専門AIワーカーと連携
💾 **メモリ統合**: OpenMemoryを使った長期記憶
📊 **プロジェクト管理**: タスクの進捗管理と分析

何かお手伝いできることがあれば、お気軽にお申し付けください！"""
        
        elif "ありがとう" in user_message or "thank" in message_lower:
            return "どういたしまして！他にも何かお手伝いできることがあれば、いつでもお声かけください。MultiLLM Orchestratorシステムがお役に立てて嬉しいです。"
        
        elif "何ができる" in user_message or "機能" in user_message or "help" in message_lower:
            return """MultiLLM Orchestratorシステムでは以下のことができます：

**💻 開発支援**:
- コード実装・レビュー・デバッグ
- UI/UXデザインの提案と実装
- API設計とバックエンド開発

**📊 データ・分析**:
- データ分析と可視化
- プロジェクト進捗の管理
- レポート生成

**💾 メモリ機能**:
- 重要な情報の記憶・検索
- プロジェクト情報の管理
- 過去の会話の振り返り

**📝 ドキュメント**:
- 技術ドキュメントの作成
- マニュアル・ガイドの生成
- 説明文の作成

具体的にやりたいことがあれば、自然な言葉で話しかけてください！"""
        
        elif "プロジェクト" in user_message:
            return f"「{user_message}」についてですね。プロジェクト関連のご質問やタスクは私の得意分野です。具体的にどのようなサポートが必要でしょうか？進捗管理、タスク分析、メンバー管理など、様々な角度からお手伝いできます。"
        
        elif "作成" in user_message or "作って" in user_message or "実装" in user_message:
            return f"「{user_message}」の作成についてサポートいたします。どのような技術スタックや要件をお考えでしょうか？詳細をお聞かせいただければ、最適な実装方針を提案いたします。"
        
        elif "分析" in user_message or "データ" in user_message:
            return f"「{user_message}」についてデータ分析の専門ワーカーがサポートいたします。どのようなデータをお持ちで、どのような分析をご希望でしょうか？可視化やレポート生成も含めて対応可能です。"
        
        elif "?" in user_message or "？" in user_message:
            return f"「{user_message}」というご質問ですね。詳しく調べてお答えいたします。この質問に関連して、追加で知りたいことや、特定の観点からの情報が必要でしたらお知らせください。"
        
        else:
            return f"「{user_message}」について承知いたしました。\n\nこのリクエストを分析して、最適な方法で対応させていただきます。もしより具体的な要件や背景情報があれば、お聞かせください。より詳細で有用な回答を提供できます。"
    
    async def _enhanced_demo_response(self, user_message: str, system_prompt: str = "") -> str:
        """強化されたデモ応答（AIっぽい動的な応答）"""
        import random
        import re
        
        message_lower = user_message.lower()
        
        # 時刻ベースの挨拶
        from datetime import datetime
        current_hour = datetime.now().hour
        
        if "こんにちは" in user_message or "hello" in message_lower:
            if current_hour < 12:
                greeting = "おはようございます"
            elif current_hour < 18:
                greeting = "こんにちは"
            else:
                greeting = "こんばんは"
            
            responses = [
                f"{greeting}！本日はどのようなことでお手伝いできますか？",
                f"{greeting}！MultiLLM Orchestratorシステムへようこそ。何かお困りのことはありますか？",
                f"{greeting}！お会いできて嬉しいです。今日はどんなプロジェクトに取り組まれていますか？"
            ]
            return random.choice(responses)
        
        # 質問への応答
        elif "?" in user_message or "？" in user_message:
            # 技術的な質問
            if any(word in message_lower for word in ['python', 'javascript', 'react', 'api', 'プログラム', 'コード']):
                return f"""ご質問の「{user_message}」について回答いたします。

技術的な観点から見ると、いくつかのアプローチが考えられます：

1. **基本的なアプローチ**: 標準的な実装方法を採用し、確実性を重視する
2. **モダンなアプローチ**: 最新のフレームワークやライブラリを活用する
3. **パフォーマンス重視**: 処理速度や効率性を最優先に考える

具体的な状況や要件に応じて、最適な方法をご提案できます。詳細な情報をお聞かせいただければ、より具体的なアドバイスが可能です。"""
            
            # 一般的な質問
            else:
                keywords = re.findall(r'[一-龥ぁ-んァ-ヶー]+|[a-zA-Z]+', user_message)
                main_topic = max(keywords, key=len) if keywords else "それ"
                
                return f"""「{main_topic}」についてのご質問ですね。

この件について、以下の観点から考えてみましょう：

• **現状分析**: まず現在の状況を正確に把握することが重要です
• **課題の特定**: 解決すべき具体的な問題点を明確にします
• **解決策の検討**: 複数の選択肢を比較検討します
• **実行計画**: 段階的な実施計画を立てます

より詳しい情報があれば、さらに具体的なアドバイスをご提供できます。"""
        
        # 作成・実装リクエスト
        elif any(word in message_lower for word in ['作成', '作って', '実装', 'create', 'implement']):
            return f"""「{user_message}」の実装について承りました。

以下のステップで進めることをご提案します：

**フェーズ1: 要件定義**
- 機能要件の明確化
- 非機能要件（パフォーマンス、セキュリティ等）の確認
- 制約条件の洗い出し

**フェーズ2: 設計**
- アーキテクチャ設計
- データモデル設計
- インターフェース設計

**フェーズ3: 実装**
- コア機能の実装
- テストの作成
- ドキュメントの整備

まずはどの部分から着手しましょうか？"""
        
        # メモリ操作
        elif any(word in message_lower for word in ['記憶', 'メモリ', '思い出', '保存']):
            if '思い出' in user_message or '検索' in user_message:
                return "メモリを検索しています... 該当する情報を探していますが、現在はデモモードのため実際のメモリアクセスはシミュレーションとなります。"
            else:
                return "情報をメモリに保存する準備ができました。デモモードのため、実際の保存はシミュレーションとなりますが、どのような情報を記録したいですか？"
        
        # その他の一般的な応答
        else:
            # メッセージの長さに応じた応答
            if len(user_message) < 10:
                return "もう少し詳しく教えていただけますか？より具体的な情報があれば、的確なサポートが可能です。"
            
            # キーワード抽出して応答
            keywords = re.findall(r'[一-龥ぁ-んァ-ヶー]+|[a-zA-Z]+', user_message)
            if keywords:
                main_topic = max(keywords, key=len)
                return f"""「{main_topic}」に関するリクエストを承りました。

現在、以下のような対応が可能です：

1. **情報収集と分析**: 関連情報を整理し、現状を把握します
2. **計画立案**: 目標達成のための具体的な計画を作成します
3. **実行支援**: 実際の作業をサポートし、進捗を管理します
4. **評価と改善**: 結果を評価し、改善点を提案します

どの段階からサポートが必要でしょうか？お気軽にお申し付けください。"""
            
            return self._demo_response(user_message)


# テスト用
async def test_claude_client():
    """Claude Client のテスト"""
    client = ClaudeClient()
    await client.initialize()
    
    # タスク分析テスト
    analysis = await client.analyze_task("Coneaプロジェクトについて思い出して")
    print("Task Analysis:", analysis)
    
    # 応答生成テスト
    messages = [LLMMessage(role="user", content="こんにちは")]
    response = await client.generate_response(messages)
    print("Response:", response)
    
    await client.shutdown()


if __name__ == "__main__":
    asyncio.run(test_claude_client())