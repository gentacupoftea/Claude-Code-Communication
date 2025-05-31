"""
Response Formatter - レスポンスを適切な形式に整形
"""

from typing import Dict, List, Optional, Any
from enum import Enum
from datetime import datetime
import json


class MessageType(Enum):
    """メッセージタイプ"""
    THINKING = "thinking"
    TOOL_USE = "tool_use"
    RESPONSE = "response"
    ERROR = "error"
    STREAM_START = "stream_start"
    STREAM_CHUNK = "stream_chunk"
    STREAM_END = "stream_end"


class ResponseFormatter:
    """レスポンスを適切な形式に整形"""
    
    @staticmethod
    def create_thinking_message(process: str) -> Dict:
        """思考中メッセージを作成"""
        return {
            "type": MessageType.THINKING.value,
            "content": process,
            "timestamp": datetime.now().isoformat()
        }
    
    @staticmethod
    def create_tool_message(tool_name: str, action: str, params: Optional[Dict] = None) -> Dict:
        """ツール使用メッセージを作成"""
        return {
            "type": MessageType.TOOL_USE.value,
            "tool": tool_name,
            "action": action,
            "params": params or {},
            "timestamp": datetime.now().isoformat()
        }
    
    @staticmethod
    def create_response_message(content: str, intermediate: bool = False, metadata: Optional[Dict] = None) -> Dict:
        """応答メッセージを作成"""
        return {
            "type": MessageType.RESPONSE.value,
            "content": content,
            "intermediate": intermediate,
            "metadata": metadata or {},
            "timestamp": datetime.now().isoformat()
        }
    
    @staticmethod
    def create_error_message(error: str, details: Optional[str] = None) -> Dict:
        """エラーメッセージを作成"""
        return {
            "type": MessageType.ERROR.value,
            "content": error,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
    
    @staticmethod
    def create_stream_start() -> Dict:
        """ストリーム開始メッセージ"""
        return {
            "type": MessageType.STREAM_START.value,
            "timestamp": datetime.now().isoformat()
        }
    
    @staticmethod
    def create_stream_chunk(chunk: str) -> Dict:
        """ストリームチャンク"""
        return {
            "type": MessageType.STREAM_CHUNK.value,
            "content": chunk,
            "timestamp": datetime.now().isoformat()
        }
    
    @staticmethod
    def create_stream_end() -> Dict:
        """ストリーム終了メッセージ"""
        return {
            "type": MessageType.STREAM_END.value,
            "timestamp": datetime.now().isoformat()
        }
    
    @staticmethod
    def format_memory_results(memories: List[Dict]) -> str:
        """メモリ検索結果をユーザーフレンドリーな形式に整形"""
        if not memories:
            return "申し訳ございません。お探しの情報は見つかりませんでした。"
        
        response = f"以下の情報が見つかりました：\n\n"
        
        for i, memory in enumerate(memories[:5], 1):  # 最大5件表示
            content = memory.get('content', '情報なし')
            timestamp = memory.get('timestamp', '')
            
            # タイムスタンプをフォーマット
            if timestamp:
                try:
                    dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                    formatted_time = dt.strftime('%Y年%m月%d日 %H:%M')
                except:
                    formatted_time = timestamp
            else:
                formatted_time = '日時不明'
            
            response += f"**{i}. {content}**\n"
            response += f"   *保存日時: {formatted_time}*\n\n"
        
        if len(memories) > 5:
            response += f"*他に{len(memories) - 5}件の関連情報があります。*"
        
        return response
    
    @staticmethod
    def format_error_response(error_type: str, error_details: str = None) -> str:
        """エラーをユーザーフレンドリーな形式に整形"""
        error_messages = {
            "connection": "接続エラーが発生しました。しばらく待ってから再度お試しください。",
            "timeout": "処理がタイムアウトしました。もう一度お試しください。",
            "authentication": "認証エラーが発生しました。設定を確認してください。",
            "not_found": "お探しの情報が見つかりませんでした。",
            "server": "サーバーエラーが発生しました。管理者にお問い合わせください。",
            "validation": "入力内容に問題があります。確認してもう一度お試しください。"
        }
        
        base_message = error_messages.get(error_type, "予期しないエラーが発生しました。")
        
        if error_details and error_type == "server":
            # 開発者向けの詳細は含めない
            return base_message
        
        return base_message


class MessageProcessor:
    """メッセージを適切に分割して処理"""
    
    def __init__(self):
        self.formatter = ResponseFormatter()
        self.intermediate_phrases = [
            "調査します",
            "確認します", 
            "検索中です",
            "少々お待ちください",
            "分析中です",
            "処理しています"
        ]
    
    async def process_memory_operation(self, message: str, callback) -> str:
        """メモリ操作の処理"""
        # 思考中メッセージ
        await callback(self.formatter.create_thinking_message("メモリを検索中..."))
        
        # 中間応答
        await callback(self.formatter.create_response_message(
            "メモリを検索します。少々お待ちください...",
            intermediate=True
        ))
        
        # ツール使用表示
        await callback(self.formatter.create_tool_message(
            "OpenMemory", 
            "search",
            {"query": self._extract_query(message)}
        ))
        
        return "memory_operation"
    
    async def process_code_task(self, message: str, callback) -> str:
        """コーディングタスクの処理"""
        await callback(self.formatter.create_thinking_message("コード生成の準備中..."))
        
        await callback(self.formatter.create_response_message(
            "コードを生成します。要件を分析中です...",
            intermediate=True
        ))
        
        return "code_implementation"
    
    async def process_analysis_task(self, message: str, callback) -> str:
        """分析タスクの処理"""
        await callback(self.formatter.create_thinking_message("データを分析中..."))
        
        await callback(self.formatter.create_response_message(
            "データ分析を開始します...",
            intermediate=True
        ))
        
        await callback(self.formatter.create_tool_message(
            "DataAnalyzer",
            "analyze"
        ))
        
        return "data_analysis"
    
    async def process_general_conversation(self, message: str, callback) -> str:
        """一般的な会話の処理"""
        await callback(self.formatter.create_thinking_message("回答を生成中..."))
        
        return "general"
    
    def _extract_query(self, message: str) -> str:
        """メッセージから検索クエリを抽出"""
        # 簡単な実装：特定のキーワードを除去
        keywords_to_remove = ['思い出して', '検索して', 'について', 'を']
        query = message
        for keyword in keywords_to_remove:
            query = query.replace(keyword, '')
        return query.strip()
    
    def should_show_intermediate(self, message: str) -> bool:
        """中間応答を表示すべきかどうかを判定"""
        # 複雑なタスクや時間のかかる処理の場合は中間応答を表示
        complex_indicators = [
            '実装', '作成', '生成', '分析', '検索',
            'プロジェクト', '設計', 'デバッグ'
        ]
        
        return any(indicator in message for indicator in complex_indicators)