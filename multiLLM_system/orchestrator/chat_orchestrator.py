"""
チャットオーケストレーター
思考プロセスをストリーミングしながらLLMとの対話を管理する
"""

import asyncio
import json
import uuid
from typing import Dict, List, Any, AsyncGenerator, Optional
from datetime import datetime

from ..prompts.templates import (
    ORCHESTRATION_SYSTEM_PROMPT,
    get_task_prompt,
    get_worker_adjusted_prompt,
    get_status_message,
    create_full_system_prompt
)


class ThinkingStep:
    """思考プロセスの一歩を表現するクラス"""
    
    def __init__(self, step_type: str, content: str, metadata: Dict[str, Any] = None):
        self.id = str(uuid.uuid4())
        self.step_type = step_type  # "analysis", "tool", "thought", "action", "status", "token"
        self.content = content
        self.metadata = metadata or {}
        self.timestamp = datetime.now()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "type": self.step_type,
            "content": self.content,
            "metadata": self.metadata,
            "timestamp": self.timestamp.isoformat()
        }


class ChatOrchestrator:
    """
    チャットオーケストレーター
    
    LLMとの対話を管理し、思考プロセスをストリーミング形式で提供する
    """
    
    def __init__(self, llm_factory=None):
        """
        Args:
            llm_factory: LLMプロバイダーファクトリー（将来の実装用）
        """
        self.llm_factory = llm_factory
        self.conversation_history = []
        self.thinking_steps = []
    
    def _detect_task_type(self, messages: List[Dict[str, str]]) -> str:
        """
        メッセージ内容からタスクタイプを推定
        
        Args:
            messages: 会話メッセージリスト
            
        Returns:
            str: 推定されたタスクタイプ
        """
        if not messages:
            return "general_assistance"
        
        last_message = messages[-1].get("content", "").lower()
        
        # キーワードベースの簡単な分類
        if any(keyword in last_message for keyword in ["分析", "データ", "統計", "グラフ", "売上"]):
            return "data_analysis"
        elif any(keyword in last_message for keyword in ["コード", "プログラム", "実装", "関数"]):
            return "code_generation"
        else:
            return "general_assistance"
    
    def _create_thinking_step(self, step_type: str, content: str, **metadata) -> ThinkingStep:
        """思考ステップを作成してリストに追加"""
        step = ThinkingStep(step_type, content, metadata)
        self.thinking_steps.append(step)
        return step
    
    async def handle_chat(
        self, 
        messages: List[Dict[str, str]], 
        model: str = "claude-3-opus-dummy",
        worker_type: str = "claude"
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        チャット処理のメインハンドラー
        
        Args:
            messages: 会話メッセージリスト
            model: 使用するモデル名
            worker_type: ワーカータイプ
            
        Yields:
            Dict[str, Any]: 思考プロセスのステップまたはレスポンストークン
        """
        # 思考開始
        step = self._create_thinking_step("status", get_status_message("thinking_start"))
        yield step.to_dict()
        
        # リクエスト分析
        step = self._create_thinking_step("status", get_status_message("analyzing_request"))
        yield step.to_dict()
        
        # タスクタイプの検出
        task_type = self._detect_task_type(messages)
        step = self._create_thinking_step(
            "analysis", 
            f"タスクタイプを'{task_type}'として分析しました",
            {"task_type": task_type}
        )
        yield step.to_dict()
        
        # ツール選定
        step = self._create_thinking_step("status", get_status_message("selecting_tools"))
        yield step.to_dict()
        
        step = self._create_thinking_step(
            "tool",
            f"モデル '{model}' (ワーカータイプ: {worker_type}) を選定しました",
            {"model": model, "worker_type": worker_type}
        )
        yield step.to_dict()
        
        # プロンプト構築
        system_prompt_content = create_full_system_prompt(task_type, worker_type)
        system_prompt = {"role": "system", "content": system_prompt_content}
        full_messages = [system_prompt] + messages
        
        step = self._create_thinking_step(
            "thought",
            "適切なシステムプロンプトを構築し、コンテキストを準備しました",
            {"prompt_length": len(system_prompt_content)}
        )
        yield step.to_dict()
        
        # 応答生成開始
        step = self._create_thinking_step("status", get_status_message("generating_response"))
        yield step.to_dict()
        
        # LLM呼び出し（実際の実装では、llm_factoryを使用）
        if self.llm_factory:
            try:
                provider = self.llm_factory.get_provider(worker_type)
                async for token in provider.generate_stream(full_messages, model):
                    step = self._create_thinking_step(
                        "token", 
                        token,
                        {"model": model, "worker_type": worker_type}
                    )
                    yield step.to_dict()
            except Exception as e:
                step = self._create_thinking_step(
                    "status",
                    get_status_message("error"),
                    {"error": str(e)}
                )
                yield step.to_dict()
                return
        else:
            # デモ用のモック応答
            demo_response = self._generate_demo_response(messages, task_type)
            for token in demo_response.split():
                await asyncio.sleep(0.05)  # ストリーミングをシミュレート
                step = self._create_thinking_step(
                    "token",
                    token + " ",
                    {"model": model, "worker_type": worker_type}
                )
                yield step.to_dict()
        
        # 完了
        step = self._create_thinking_step("status", get_status_message("complete"))
        yield step.to_dict()
        
        # 会話履歴に追加
        self.conversation_history.extend(messages)
    
    def _generate_demo_response(self, messages: List[Dict[str, str]], task_type: str) -> str:
        """
        デモ用のモック応答を生成
        
        Args:
            messages: 会話メッセージ
            task_type: タスクタイプ
            
        Returns:
            str: デモ応答
        """
        if not messages:
            return "こんにちは！何かお手伝いできることはありますか？"
        
        last_message = messages[-1].get("content", "")
        
        if task_type == "data_analysis":
            return f"[ANALYSIS: '{last_message}'というリクエストを分析しました] [TOOL: データ分析手法を選定] [THOUGHT: 統計的アプローチが適切と判断] [ACTION: 分析を実行] データ分析の結果、興味深いパターンが見つかりました。詳細な分析レポートを作成いたします。"
        
        elif task_type == "code_generation":
            return f"[ANALYSIS: コード生成リクエスト '{last_message}' を確認] [TOOL: 適切なプログラミング言語とライブラリを選定] [THOUGHT: 効率的で読みやすい実装アプローチを検討] [ACTION: コードを生成] 以下のコードを生成しました。動作確認済みで、ベストプラクティスに従っています。"
        
        else:
            return f"[ANALYSIS: '{last_message}'について理解しました] [THOUGHT: 最適な回答方法を検討] [ACTION: 有用な回答を提供] ご質問にお答えします。お役に立てるよう詳しく説明いたします。"
    
    def get_conversation_summary(self) -> Dict[str, Any]:
        """
        会話の要約情報を取得
        
        Returns:
            Dict[str, Any]: 会話の統計情報
        """
        return {
            "message_count": len(self.conversation_history),
            "thinking_steps": len(self.thinking_steps),
            "step_types": {
                step_type: sum(1 for step in self.thinking_steps if step.step_type == step_type)
                for step_type in ["analysis", "tool", "thought", "action", "status", "token"]
            },
            "last_activity": self.thinking_steps[-1].timestamp.isoformat() if self.thinking_steps else None
        }
    
    def clear_history(self):
        """会話履歴と思考ステップをクリア"""
        self.conversation_history.clear()
        self.thinking_steps.clear()


# ユーティリティ関数
async def create_orchestrated_chat_stream(
    messages: List[Dict[str, str]], 
    model: str = "claude-3-opus-dummy",
    worker_type: str = "claude",
    llm_factory=None
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    オーケストレートされたチャットストリームを作成
    
    Args:
        messages: 会話メッセージリスト
        model: 使用するモデル名
        worker_type: ワーカータイプ
        llm_factory: LLMファクトリー
        
    Yields:
        Dict[str, Any]: ストリーミングレスポンス
    """
    orchestrator = ChatOrchestrator(llm_factory)
    async for step in orchestrator.handle_chat(messages, model, worker_type):
        yield step