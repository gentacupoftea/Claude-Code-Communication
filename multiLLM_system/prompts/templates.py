"""
プロンプトテンプレート管理モジュール
オーケストレーションで使用するシステムプロンプトと思考プロセステンプレートを定義
"""

# 基本的なオーケストレーションシステムプロンプト
ORCHESTRATION_SYSTEM_PROMPT = """あなたは優秀なAIアシスタントです。ユーザーのリクエストに対して、思考プロセスを段階的に説明し、最終的な回答を生成してください。

思考プロセスでは以下のような形式で段階的に説明してください：
- [ANALYSIS: ...] - リクエストの分析
- [TOOL: ...] - 使用するツールや手法の選定
- [THOUGHT: ...] - 思考プロセスの説明
- [ACTION: ...] - 実行するアクション

最終的に、ユーザーに対する明確で有用な回答を提供してください。"""

# 特定タスク向けのプロンプトテンプレート
TASK_SPECIFIC_PROMPTS = {
    "data_analysis": """データ分析タスクとして以下を実行してください：
[ANALYSIS: データの種類と構造を分析]
[TOOL: 適切な分析手法の選定]
[THOUGHT: 分析アプローチの説明]
[ACTION: 分析の実行と結果の解釈]

データに基づいた客観的で実用的な洞察を提供してください。""",
    
    "code_generation": """コード生成タスクとして以下を実行してください：
[ANALYSIS: 要件とプログラミング言語の確認]
[TOOL: 適切な技術スタックとライブラリの選定]
[THOUGHT: 実装アプローチの説明]
[ACTION: コードの生成と説明]

動作する、読みやすく、保守可能なコードを生成してください。""",
    
    "general_assistance": """一般的なアシスタントタスクとして以下を実行してください：
[ANALYSIS: ユーザーの意図と背景の理解]
[THOUGHT: 最適な回答アプローチの検討]
[ACTION: 有用な情報と提案の提供]

ユーザーのニーズに合った実用的で分かりやすい回答を提供してください。"""
}

# ストリーミング用の状態メッセージテンプレート
STREAMING_STATUS_MESSAGES = {
    "thinking_start": "🤔 思考を開始しています...",
    "analyzing_request": "📊 リクエストを分析中...",
    "selecting_tools": "🔧 適切なツールを選定中...",
    "generating_response": "✍️ 応答を生成中...",
    "finalizing": "✅ 回答を仕上げ中...",
    "complete": "💡 思考プロセスが完了しました",
    "error": "❌ エラーが発生しました"
}

# ワーカータイプ別の特性を活かすプロンプト調整
WORKER_SPECIFIC_ADJUSTMENTS = {
    "claude": {
        "prefix": "あなたはClaude AIです。高度な推論と分析能力を活用して、",
        "style": "analytical and thorough"
    },
    "openai": {
        "prefix": "あなたはGPT-4です。創造性と汎用性を活かして、",
        "style": "creative and versatile"
    },
    "local_llm": {
        "prefix": "あなたはローカルLLMです。プライバシーを重視した環境で、",
        "style": "privacy-focused and efficient"
    }
}

def get_task_prompt(task_type: str = "general_assistance") -> str:
    """
    タスクタイプに応じたプロンプトテンプレートを取得
    
    Args:
        task_type: タスクの種類 ("data_analysis", "code_generation", "general_assistance")
        
    Returns:
        str: 対応するプロンプトテンプレート
    """
    return TASK_SPECIFIC_PROMPTS.get(task_type, TASK_SPECIFIC_PROMPTS["general_assistance"])

def get_worker_adjusted_prompt(base_prompt: str, worker_type: str) -> str:
    """
    ワーカータイプに応じてプロンプトを調整
    
    Args:
        base_prompt: 基本のプロンプト
        worker_type: ワーカーの種類 ("claude", "openai", "local_llm")
        
    Returns:
        str: 調整されたプロンプト
    """
    adjustment = WORKER_SPECIFIC_ADJUSTMENTS.get(worker_type)
    if adjustment:
        return f"{adjustment['prefix']}{base_prompt}"
    return base_prompt

def get_status_message(status_key: str) -> str:
    """
    ストリーミング用の状態メッセージを取得
    
    Args:
        status_key: 状態のキー
        
    Returns:
        str: 対応する状態メッセージ
    """
    return STREAMING_STATUS_MESSAGES.get(status_key, "処理中...")

def create_full_system_prompt(task_type: str = "general_assistance", worker_type: str = None) -> str:
    """
    完全なシステムプロンプトを生成
    
    Args:
        task_type: タスクの種類
        worker_type: ワーカーの種類（オプション）
        
    Returns:
        str: 完全なシステムプロンプト
    """
    base_prompt = ORCHESTRATION_SYSTEM_PROMPT
    task_prompt = get_task_prompt(task_type)
    
    full_prompt = f"{base_prompt}\n\n{task_prompt}"
    
    if worker_type:
        full_prompt = get_worker_adjusted_prompt(full_prompt, worker_type)
    
    return full_prompt