"""
Conversation Manager - 会話管理と自動要約サービス
トークン使用率を監視し、必要に応じてLLMインスタンスを切り替え
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import json
import tiktoken

logger = logging.getLogger(__name__)


@dataclass
class Message:
    """会話メッセージ"""
    role: str  # user, assistant, system
    content: str
    timestamp: datetime
    tokens: int = 0
    metadata: Optional[Dict] = None


@dataclass
class Conversation:
    """会話セッション"""
    id: str
    user_id: str
    messages: List[Message]
    created_at: datetime
    updated_at: datetime
    total_tokens: int = 0
    max_tokens: int = 128000  # GPT-4の場合
    llm_instance_id: str = None
    summary: Optional[str] = None
    metadata: Dict = None


class ConversationManager:
    """
    会話管理と自動要約・LLM切り替えを行うサービス
    """
    
    def __init__(self, config: Dict, memory_sync_service=None):
        self.config = config
        self.memory_sync = memory_sync_service
        
        # 自動要約設定
        self.auto_summarize = config.get('autoSummarize', {})
        self.summary_threshold = self.auto_summarize.get('threshold', 0.8)
        self.summary_model = self.auto_summarize.get('summaryModel', 'gpt-3.5-turbo')
        self.summary_max_tokens = self.auto_summarize.get('summaryMaxTokens', 1000)
        
        # アクティブな会話
        self.conversations = {}
        
        # トークンカウンター
        self.tokenizer = None
        self._init_tokenizer()
        
        # LLMプール（複数のインスタンスを管理）
        self.llm_pool = {}
        self.next_instance_id = 0
    
    def _init_tokenizer(self):
        """トークナイザーの初期化"""
        try:
            self.tokenizer = tiktoken.encoding_for_model("gpt-4")
        except Exception as e:
            logger.warning(f"Failed to initialize tokenizer: {e}")
            self.tokenizer = tiktoken.get_encoding("cl100k_base")
    
    def count_tokens(self, text: str) -> int:
        """テキストのトークン数をカウント"""
        if not self.tokenizer:
            # 簡易的な推定（1文字≒0.25トークン）
            return len(text) // 4
        
        return len(self.tokenizer.encode(text))
    
    async def create_conversation(self, user_id: str, metadata: Optional[Dict] = None) -> Conversation:
        """新しい会話を作成"""
        conversation_id = f"conv_{user_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        conversation = Conversation(
            id=conversation_id,
            user_id=user_id,
            messages=[],
            created_at=datetime.now(),
            updated_at=datetime.now(),
            llm_instance_id=await self._get_or_create_llm_instance(),
            metadata=metadata or {}
        )
        
        self.conversations[conversation_id] = conversation
        logger.info(f"📝 Created new conversation: {conversation_id}")
        
        return conversation
    
    async def add_message(self, conversation_id: str, role: str, content: str, metadata: Optional[Dict] = None) -> Message:
        """会話にメッセージを追加"""
        conversation = self.conversations.get(conversation_id)
        if not conversation:
            raise ValueError(f"Conversation {conversation_id} not found")
        
        # トークン数を計算
        tokens = self.count_tokens(content)
        
        message = Message(
            role=role,
            content=content,
            timestamp=datetime.now(),
            tokens=tokens,
            metadata=metadata
        )
        
        conversation.messages.append(message)
        conversation.total_tokens += tokens
        conversation.updated_at = datetime.now()
        
        # トークン使用率をチェック
        usage_ratio = conversation.total_tokens / conversation.max_tokens
        logger.info(f"💬 Added message to {conversation_id}. Token usage: {usage_ratio:.1%}")
        
        # 閾値を超えたら自動処理
        if usage_ratio > self.summary_threshold:
            await self.check_and_rotate(conversation_id)
        
        return message
    
    async def check_and_rotate(self, conversation_id: str) -> Optional[str]:
        """
        会話のトークン使用率をチェックし、必要に応じてローテーション
        """
        conversation = self.conversations.get(conversation_id)
        if not conversation:
            return None
        
        usage_ratio = conversation.total_tokens / conversation.max_tokens
        
        if usage_ratio > self.summary_threshold:
            logger.warning(f"⚠️ Conversation {conversation_id} reaching token limit: {usage_ratio:.1%}")
            
            # 会話を要約
            summary = await self.summarize_conversation(conversation)
            
            # OpenMemoryに保存
            if self.memory_sync:
                await self.memory_sync.create_conversation_summary(
                    conversation_id,
                    [msg.__dict__ for msg in conversation.messages],
                    {
                        'summary': summary,
                        'total_tokens': conversation.total_tokens,
                        'message_count': len(conversation.messages)
                    }
                )
            
            # 新しいLLMインスタンスを作成
            new_instance_id = await self._rotate_llm_instance(conversation, summary)
            
            logger.info(f"✅ Rotated conversation {conversation_id} to new instance: {new_instance_id}")
            
            return new_instance_id
        
        return None
    
    async def summarize_conversation(self, conversation: Conversation) -> str:
        """会話を要約"""
        logger.info(f"📊 Summarizing conversation {conversation.id}...")
        
        # 会話履歴を整形
        conversation_text = self._format_conversation_for_summary(conversation)
        
        # 要約プロンプト
        prompt = f"""
以下の会話を要約してください。重要なポイント、決定事項、アクションアイテムを含めてください。

会話:
{conversation_text}

要約（{self.summary_max_tokens}トークン以内）:
"""
        
        # LLMで要約生成（実際の実装では適切なLLMクライアントを使用）
        summary = await self._generate_summary(prompt)
        
        # 会話に要約を保存
        conversation.summary = summary
        
        return summary
    
    def _format_conversation_for_summary(self, conversation: Conversation, max_messages: int = 50) -> str:
        """要約用に会話を整形"""
        # 最新のメッセージを優先
        messages = conversation.messages[-max_messages:]
        
        formatted = []
        for msg in messages:
            timestamp = msg.timestamp.strftime("%H:%M:%S")
            formatted.append(f"[{timestamp}] {msg.role}: {msg.content[:200]}...")
        
        return "\n".join(formatted)
    
    async def _generate_summary(self, prompt: str) -> str:
        """要約を生成（実際のLLM呼び出し）"""
        # デモ実装
        summary = f"""
会話の要約:
- ユーザーからの主な質問と要求事項
- 提供された解決策とアドバイス
- 次のステップとアクションアイテム
- 重要な決定事項と合意内容
"""
        return summary.strip()
    
    async def _get_or_create_llm_instance(self) -> str:
        """LLMインスタンスを取得または作成"""
        instance_id = f"llm_instance_{self.next_instance_id}"
        self.next_instance_id += 1
        
        # 実際の実装ではLLMクライアントのインスタンスを管理
        self.llm_pool[instance_id] = {
            'created_at': datetime.now(),
            'status': 'active',
            'token_count': 0
        }
        
        return instance_id
    
    async def _rotate_llm_instance(self, conversation: Conversation, summary: str) -> str:
        """新しいLLMインスタンスに切り替え"""
        # 古い会話をクリーンアップ
        old_messages = conversation.messages.copy()
        conversation.messages.clear()
        conversation.total_tokens = 0
        
        # サマリーをシステムメッセージとして追加
        summary_message = Message(
            role="system",
            content=f"Previous conversation summary:\n{summary}",
            timestamp=datetime.now(),
            tokens=self.count_tokens(summary)
        )
        conversation.messages.append(summary_message)
        conversation.total_tokens = summary_message.tokens
        
        # 新しいインスタンスを作成
        new_instance_id = await self._get_or_create_llm_instance()
        conversation.llm_instance_id = new_instance_id
        
        # 古いインスタンスをクリーンアップ
        # （実際の実装では適切にリソースを解放）
        
        return new_instance_id
    
    def get_conversation_history(self, conversation_id: str, limit: Optional[int] = None) -> List[Dict]:
        """会話履歴を取得"""
        conversation = self.conversations.get(conversation_id)
        if not conversation:
            return []
        
        messages = conversation.messages
        if limit:
            messages = messages[-limit:]
        
        return [
            {
                'role': msg.role,
                'content': msg.content,
                'timestamp': msg.timestamp.isoformat(),
                'tokens': msg.tokens
            }
            for msg in messages
        ]
    
    def get_conversation_context(self, conversation_id: str) -> str:
        """LLMに渡すコンテキストを生成"""
        conversation = self.conversations.get(conversation_id)
        if not conversation:
            return ""
        
        # サマリーがある場合はそれを含める
        context_parts = []
        
        if conversation.summary:
            context_parts.append(f"[Previous Summary]\n{conversation.summary}\n")
        
        # 最近のメッセージを含める（トークン制限を考慮）
        recent_messages = []
        token_count = 0
        max_context_tokens = 4000  # コンテキスト用の最大トークン数
        
        for msg in reversed(conversation.messages):
            if token_count + msg.tokens > max_context_tokens:
                break
            recent_messages.insert(0, msg)
            token_count += msg.tokens
        
        # メッセージを整形
        for msg in recent_messages:
            context_parts.append(f"{msg.role}: {msg.content}")
        
        return "\n".join(context_parts)
    
    def get_stats(self) -> Dict[str, Any]:
        """統計情報を取得"""
        active_conversations = [c for c in self.conversations.values() 
                              if (datetime.now() - c.updated_at).total_seconds() < 3600]
        
        return {
            'total_conversations': len(self.conversations),
            'active_conversations': len(active_conversations),
            'total_messages': sum(len(c.messages) for c in self.conversations.values()),
            'average_tokens_per_conversation': sum(c.total_tokens for c in self.conversations.values()) / max(len(self.conversations), 1),
            'llm_instances': len(self.llm_pool)
        }
    
    async def cleanup_old_conversations(self, max_age_hours: int = 24):
        """古い会話をクリーンアップ"""
        now = datetime.now()
        to_remove = []
        
        for conv_id, conversation in self.conversations.items():
            age = (now - conversation.updated_at).total_seconds() / 3600
            if age > max_age_hours:
                to_remove.append(conv_id)
        
        for conv_id in to_remove:
            # メモリに保存してから削除
            if self.memory_sync:
                conversation = self.conversations[conv_id]
                await self.memory_sync.create_conversation_summary(
                    conv_id,
                    [msg.__dict__ for msg in conversation.messages],
                    {'reason': 'cleanup', 'age_hours': max_age_hours}
                )
            
            del self.conversations[conv_id]
            logger.info(f"🗑️ Cleaned up old conversation: {conv_id}")
        
        return len(to_remove)


# 使用例
async def main():
    config = {
        'autoSummarize': {
            'enabled': True,
            'threshold': 0.8,
            'summaryModel': 'gpt-3.5-turbo',
            'summaryMaxTokens': 1000
        }
    }
    
    manager = ConversationManager(config)
    
    # 会話を作成
    conversation = await manager.create_conversation("user123")
    
    # メッセージを追加
    await manager.add_message(conversation.id, "user", "こんにちは、Pythonについて教えてください")
    await manager.add_message(conversation.id, "assistant", "こんにちは！Pythonについて何を知りたいですか？")
    
    # 会話履歴を取得
    history = manager.get_conversation_history(conversation.id)
    print(f"Conversation history: {json.dumps(history, indent=2, ensure_ascii=False)}")
    
    # 統計情報
    stats = manager.get_stats()
    print(f"Stats: {json.dumps(stats, indent=2)}")


if __name__ == "__main__":
    asyncio.run(main())