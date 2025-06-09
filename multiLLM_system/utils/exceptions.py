"""
MultiLLM System Custom Exceptions
Sprint 2 AI-2号機の成果物 - カスタム例外クラス定義

本番運用に必要な構造化されたエラーハンドリングシステムを提供します。
"""

from typing import Dict, Any, Optional
from datetime import datetime
import uuid


class MultiLLMBaseException(Exception):
    """
    MultiLLMシステムのベース例外クラス
    
    すべてのカスタム例外はこのクラスを継承し、
    統一されたエラー情報の構造化とロギングを提供します。
    """
    
    def __init__(
        self,
        message: str,
        error_code: str,
        details: Optional[Dict[str, Any]] = None,
        inner_exception: Optional[Exception] = None
    ):
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.details = details or {}
        self.inner_exception = inner_exception
        self.timestamp = datetime.utcnow()
        self.error_id = str(uuid.uuid4())
    
    def to_dict(self) -> Dict[str, Any]:
        """例外を辞書形式に変換（API レスポンス用）"""
        return {
            "error_id": self.error_id,
            "error_code": self.error_code,
            "message": self.message,
            "details": self.details,
            "timestamp": self.timestamp.isoformat() + "Z",
            "type": self.__class__.__name__,
            "inner_exception": str(self.inner_exception) if self.inner_exception else None
        }
    
    def to_log_dict(self) -> Dict[str, Any]:
        """例外をログ用辞書形式に変換（構造化ログ用）"""
        log_dict = self.to_dict()
        log_dict.update({
            "level": "ERROR",
            "logger": "multiLLM.exceptions",
            "exception_class": self.__class__.__name__
        })
        return log_dict


class WorkerException(MultiLLMBaseException):
    """ワーカー関連の例外"""
    pass


class ConfigurationException(MultiLLMBaseException):
    """設定関連の例外"""
    pass


class APIException(MultiLLMBaseException):
    """API関連の例外"""
    pass


# === Ollama/Local LLM関連例外 ===

class OllamaServerError(WorkerException):
    """
    Ollamaサーバーに関連するエラー
    """
    def __init__(
        self, 
        message: str = "Ollamaサーバーにアクセスできません",
        server_url: Optional[str] = None,
        status_code: Optional[int] = None
    ):
        details = {}
        if server_url:
            details["server_url"] = server_url
        if status_code:
            details["status_code"] = status_code
            
        super().__init__(
            message=message,
            error_code="OLLAMA_SERVER_ERROR",
            details=details
        )


class OllamaConnectionError(OllamaServerError):
    """Ollamaサーバーへの接続エラー"""
    def __init__(self, server_url: str):
        super().__init__(
            message=f"Ollamaサーバー ({server_url}) に接続できません。サーバーが起動しているか確認してください。",
            server_url=server_url,
            error_code="OLLAMA_CONNECTION_ERROR"
        )


class OllamaTimeoutError(OllamaServerError):
    """Ollamaサーバーのタイムアウトエラー"""
    def __init__(self, timeout_seconds: int):
        super().__init__(
            message=f"Ollamaサーバーからの応答がタイムアウトしました ({timeout_seconds}秒)",
            error_code="OLLAMA_TIMEOUT_ERROR",
            details={"timeout_seconds": timeout_seconds}
        )


# === API Key関連例外 ===

class APIKeyError(ConfigurationException):
    """
    APIキー関連のエラー
    """
    def __init__(
        self, 
        provider: str,
        message: Optional[str] = None
    ):
        if not message:
            message = f"{provider}のAPIキーが設定されていないか無効です"
        
        super().__init__(
            message=message,
            error_code="API_KEY_ERROR",
            details={"provider": provider}
        )


class APIKeyMissingError(APIKeyError):
    """APIキーが設定されていない"""
    def __init__(self, provider: str, env_var: str):
        super().__init__(
            provider=provider,
            message=f"{provider}のAPIキーが設定されていません。環境変数 {env_var} を設定してください。"
        )
        self.details.update({"env_var": env_var})
        self.error_code = "API_KEY_MISSING"


class APIKeyInvalidError(APIKeyError):
    """APIキーが無効"""
    def __init__(self, provider: str):
        super().__init__(
            provider=provider,
            message=f"{provider}のAPIキーが無効です。正しいAPIキーを設定してください。"
        )
        self.error_code = "API_KEY_INVALID"


# === モデル関連例外 ===

class ModelNotFoundError(WorkerException):
    """
    指定されたモデルが見つからない
    """
    def __init__(
        self, 
        model_id: str, 
        worker_type: str,
        available_models: Optional[list] = None
    ):
        message = f"モデル '{model_id}' が {worker_type} ワーカーで見つかりません"
        details = {
            "model_id": model_id,
            "worker_type": worker_type
        }
        if available_models:
            details["available_models"] = available_models
            message += f"。利用可能なモデル: {', '.join(available_models)}"
        
        super().__init__(
            message=message,
            error_code="MODEL_NOT_FOUND",
            details=details
        )


class ModelLoadError(WorkerException):
    """モデルの読み込みエラー"""
    def __init__(self, model_id: str, worker_type: str, reason: str):
        super().__init__(
            message=f"モデル '{model_id}' の読み込みに失敗しました: {reason}",
            error_code="MODEL_LOAD_ERROR",
            details={
                "model_id": model_id,
                "worker_type": worker_type,
                "reason": reason
            }
        )


# === ワーカー関連例外 ===

class WorkerNotFoundError(WorkerException):
    """指定されたワーカーが見つからない"""
    def __init__(self, worker_type: str, available_workers: Optional[list] = None):
        message = f"ワーカー '{worker_type}' が見つかりません"
        details = {"worker_type": worker_type}
        if available_workers:
            details["available_workers"] = available_workers
            message += f"。利用可能なワーカー: {', '.join(available_workers)}"
        
        super().__init__(
            message=message,
            error_code="WORKER_NOT_FOUND",
            details=details
        )


class WorkerInitializationError(WorkerException):
    """ワーカーの初期化エラー"""
    def __init__(self, worker_type: str, reason: str):
        super().__init__(
            message=f"ワーカー '{worker_type}' の初期化に失敗しました: {reason}",
            error_code="WORKER_INITIALIZATION_ERROR",
            details={
                "worker_type": worker_type,
                "reason": reason
            }
        )


class WorkerUnavailableError(WorkerException):
    """ワーカーが利用不可"""
    def __init__(self, worker_type: str, reason: str):
        super().__init__(
            message=f"ワーカー '{worker_type}' は現在利用できません: {reason}",
            error_code="WORKER_UNAVAILABLE",
            details={
                "worker_type": worker_type,
                "reason": reason
            }
        )


# === Task/Generation関連例外 ===

class TaskExecutionError(WorkerException):
    """タスク実行エラー"""
    def __init__(self, task_id: str, worker_type: str, reason: str):
        super().__init__(
            message=f"タスク '{task_id}' の実行に失敗しました: {reason}",
            error_code="TASK_EXECUTION_ERROR",
            details={
                "task_id": task_id,
                "worker_type": worker_type,
                "reason": reason
            }
        )


class GenerationError(APIException):
    """生成処理のエラー"""
    def __init__(self, prompt: str, worker_type: str, model_id: str, reason: str):
        super().__init__(
            message=f"テキスト生成に失敗しました: {reason}",
            error_code="GENERATION_ERROR",
            details={
                "prompt_length": len(prompt),
                "worker_type": worker_type,
                "model_id": model_id,
                "reason": reason
            }
        )


class GenerationTimeoutError(GenerationError):
    """生成処理のタイムアウト"""
    def __init__(self, worker_type: str, model_id: str, timeout_seconds: int):
        super().__init__(
            prompt="",
            worker_type=worker_type,
            model_id=model_id,
            reason=f"生成処理がタイムアウトしました ({timeout_seconds}秒)"
        )
        self.error_code = "GENERATION_TIMEOUT_ERROR"
        self.details.update({"timeout_seconds": timeout_seconds})


# === 外部API関連例外 ===

class ExternalAPIError(APIException):
    """外部API呼び出しエラー"""
    def __init__(
        self, 
        api_name: str, 
        status_code: Optional[int] = None,
        response_body: Optional[str] = None,
        reason: Optional[str] = None
    ):
        message = f"{api_name} APIの呼び出しに失敗しました"
        if reason:
            message += f": {reason}"
        
        details = {"api_name": api_name}
        if status_code:
            details["status_code"] = status_code
        if response_body:
            details["response_body"] = response_body
        
        super().__init__(
            message=message,
            error_code="EXTERNAL_API_ERROR",
            details=details
        )


class RateLimitExceededError(ExternalAPIError):
    """API レート制限エラー"""
    def __init__(self, api_name: str, retry_after: Optional[int] = None):
        details = {"api_name": api_name}
        if retry_after:
            details["retry_after_seconds"] = retry_after
        
        message = f"{api_name} APIのレート制限に達しました"
        if retry_after:
            message += f"。{retry_after}秒後に再試行してください。"
        
        super().__init__(
            api_name=api_name,
            reason=message
        )
        self.error_code = "RATE_LIMIT_EXCEEDED"
        self.details.update(details)


# === バリデーション関連例外 ===

class ValidationError(APIException):
    """入力値検証エラー"""
    def __init__(self, field: str, value: Any, reason: str):
        super().__init__(
            message=f"バリデーションエラー: {field} = {value} ({reason})",
            error_code="VALIDATION_ERROR",
            details={
                "field": field,
                "value": str(value),
                "reason": reason
            }
        )


class MissingRequiredFieldError(ValidationError):
    """必須フィールドが不足"""
    def __init__(self, field: str):
        super().__init__(
            field=field,
            value="",
            reason="必須フィールドが設定されていません"
        )
        self.error_code = "MISSING_REQUIRED_FIELD"


# === レスポンス変換用ヘルパー ===

def exception_to_http_status(exception: MultiLLMBaseException) -> int:
    """例外からHTTPステータスコードを決定"""
    if isinstance(exception, (APIKeyError, MissingRequiredFieldError)):
        return 401  # Unauthorized
    elif isinstance(exception, ValidationError):
        return 400  # Bad Request
    elif isinstance(exception, (ModelNotFoundError, WorkerNotFoundError)):
        return 404  # Not Found
    elif isinstance(exception, RateLimitExceededError):
        return 429  # Too Many Requests
    elif isinstance(exception, (OllamaConnectionError, ExternalAPIError)):
        return 502  # Bad Gateway
    elif isinstance(exception, (OllamaTimeoutError, GenerationTimeoutError)):
        return 504  # Gateway Timeout
    elif isinstance(exception, (WorkerUnavailableError, OllamaServerError)):
        return 503  # Service Unavailable
    else:
        return 500  # Internal Server Error