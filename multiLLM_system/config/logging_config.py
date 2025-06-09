"""
構造化ロギング設定
JSONフォーマッターを含む詳細なロギング設定を提供
"""

import json
import logging
import logging.config
import uuid
from datetime import datetime
from typing import Dict, Any, Optional
from contextlib import contextmanager
import threading
from pathlib import Path


# スレッドローカルストレージ (リクエストIDなどの追跡用)
_local = threading.local()


class JSONFormatter(logging.Formatter):
    """
    ログをJSON形式で出力するカスタムフォーマッター
    """
    
    def __init__(
        self, 
        include_extra: bool = True,
        extra_fields: Optional[list] = None
    ):
        super().__init__()
        self.include_extra = include_extra
        self.extra_fields = extra_fields or []
    
    def format(self, record: logging.LogRecord) -> str:
        """ログレコードをJSON形式でフォーマット"""
        
        # 基本ログ情報
        log_entry = {
            "timestamp": datetime.utcfromtimestamp(record.created).isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        
        # リクエストID（もしあれば）
        request_id = getattr(_local, 'request_id', None)
        if request_id:
            log_entry["request_id"] = request_id
        
        # ユーザーID（もしあれば）
        user_id = getattr(_local, 'user_id', None)
        if user_id:
            log_entry["user_id"] = user_id
        
        # 例外情報
        if record.exc_info:
            log_entry["exception"] = {
                "type": record.exc_info[0].__name__ if record.exc_info[0] else None,
                "message": str(record.exc_info[1]) if record.exc_info[1] else None,
                "traceback": self.formatException(record.exc_info)
            }
        
        # 追加フィールド
        if self.include_extra:
            for key, value in record.__dict__.items():
                # 標準フィールドと内部フィールドを除外
                if key not in [
                    'name', 'msg', 'args', 'levelname', 'levelno', 'pathname',
                    'filename', 'module', 'lineno', 'funcName', 'created',
                    'msecs', 'relativeCreated', 'thread', 'threadName',
                    'processName', 'process', 'message', 'exc_info', 'exc_text',
                    'stack_info', 'taskName'
                ] and not key.startswith('_'):
                    try:
                        # JSON serializable かチェック
                        json.dumps(value)
                        log_entry[key] = value
                    except (TypeError, ValueError):
                        log_entry[key] = str(value)
        
        # 追加指定フィールド
        for field in self.extra_fields:
            if hasattr(record, field):
                log_entry[field] = getattr(record, field)
        
        return json.dumps(log_entry, ensure_ascii=False)


class StructuredLogger:
    """
    構造化ログ出力のためのヘルパークラス
    """
    
    def __init__(self, name: str):
        self.logger = logging.getLogger(name)
    
    def log_api_request(
        self, 
        method: str, 
        endpoint: str, 
        status_code: Optional[int] = None,
        duration_ms: Optional[float] = None,
        user_id: Optional[str] = None,
        **kwargs
    ):
        """API リクエストログ"""
        extra = {
            "event_type": "api_request",
            "http_method": method,
            "endpoint": endpoint,
            "user_id": user_id,
            **kwargs
        }
        if status_code:
            extra["status_code"] = status_code
        if duration_ms:
            extra["duration_ms"] = duration_ms
        
        self.logger.info(f"{method} {endpoint}", extra=extra)
    
    def log_worker_event(
        self, 
        worker_type: str, 
        event: str, 
        model_id: Optional[str] = None,
        task_id: Optional[str] = None,
        **kwargs
    ):
        """ワーカーイベントログ"""
        extra = {
            "event_type": "worker_event",
            "worker_type": worker_type,
            "event": event,
            **kwargs
        }
        if model_id:
            extra["model_id"] = model_id
        if task_id:
            extra["task_id"] = task_id
        
        self.logger.info(f"Worker {worker_type}: {event}", extra=extra)
    
    def log_generation_metrics(
        self,
        worker_type: str,
        model_id: str,
        prompt_tokens: int,
        completion_tokens: int,
        duration_ms: float,
        **kwargs
    ):
        """生成メトリクスログ"""
        extra = {
            "event_type": "generation_metrics",
            "worker_type": worker_type,
            "model_id": model_id,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
            "duration_ms": duration_ms,
            "tokens_per_second": completion_tokens / (duration_ms / 1000) if duration_ms > 0 else 0,
            **kwargs
        }
        
        self.logger.info(
            f"Generated {completion_tokens} tokens in {duration_ms:.1f}ms", 
            extra=extra
        )
    
    def log_error(
        self, 
        error: Exception, 
        context: Optional[Dict[str, Any]] = None,
        **kwargs
    ):
        """エラーログ"""
        extra = {
            "event_type": "error",
            "error_type": type(error).__name__,
            "error_message": str(error),
            **(context or {}),
            **kwargs
        }
        
        self.logger.error(f"Error: {error}", extra=extra, exc_info=True)


# ログ設定
def get_logging_config(
    log_level: str = "INFO",
    log_file: Optional[str] = None,
    max_file_size: int = 10 * 1024 * 1024,  # 10MB
    backup_count: int = 5,
    enable_json_format: bool = True
) -> Dict[str, Any]:
    """
    ロギング設定を生成
    
    Args:
        log_level: ログレベル (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_file: ログファイルパス (Noneの場合はファイル出力なし)
        max_file_size: ログファイルの最大サイズ (バイト)
        backup_count: ローテーションするファイル数
        enable_json_format: JSON形式での出力を有効にするか
    """
    
    config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "standard": {
                "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S"
            },
            "detailed": {
                "format": "%(asctime)s [%(levelname)s] %(name)s:%(lineno)d %(funcName)s() - %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S"
            }
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "level": log_level,
                "formatter": "standard",
                "stream": "ext://sys.stdout"
            }
        },
        "loggers": {
            # MultiLLM システム固有のロガー
            "multiLLM": {
                "level": log_level,
                "handlers": ["console"],
                "propagate": False
            },
            "multiLLM.api": {
                "level": log_level,
                "handlers": ["console"],
                "propagate": False
            },
            "multiLLM.workers": {
                "level": log_level,
                "handlers": ["console"],
                "propagate": False
            },
            "multiLLM.orchestrator": {
                "level": log_level,
                "handlers": ["console"],
                "propagate": False
            },
            # 外部ライブラリのログレベル調整
            "uvicorn": {
                "level": "INFO",
                "handlers": ["console"],
                "propagate": False
            },
            "fastapi": {
                "level": "INFO",
                "handlers": ["console"],
                "propagate": False
            }
        },
        "root": {
            "level": log_level,
            "handlers": ["console"]
        }
    }
    
    # JSON フォーマッターの追加
    if enable_json_format:
        config["formatters"]["json"] = {
            "()": JSONFormatter,
            "include_extra": True
        }
        # JSON フォーマット用ハンドラー
        config["handlers"]["console_json"] = {
            "class": "logging.StreamHandler",
            "level": log_level,
            "formatter": "json",
            "stream": "ext://sys.stdout"
        }
    
    # ファイルハンドラーの追加
    if log_file:
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        
        # 標準ファイルハンドラー
        config["handlers"]["file"] = {
            "class": "logging.handlers.RotatingFileHandler",
            "level": log_level,
            "formatter": "detailed",
            "filename": str(log_path),
            "maxBytes": max_file_size,
            "backupCount": backup_count,
            "encoding": "utf-8"
        }
        
        # JSON ファイルハンドラー (JSON形式が有効な場合)
        if enable_json_format:
            json_log_file = log_path.with_suffix('.json' + log_path.suffix)
            config["handlers"]["file_json"] = {
                "class": "logging.handlers.RotatingFileHandler",
                "level": log_level,
                "formatter": "json",
                "filename": str(json_log_file),
                "maxBytes": max_file_size,
                "backupCount": backup_count,
                "encoding": "utf-8"
            }
            
            # 全ロガーにJSON ファイルハンドラーを追加
            for logger_name in config["loggers"]:
                if "handlers" in config["loggers"][logger_name]:
                    config["loggers"][logger_name]["handlers"].append("file_json")
        
        # 全ロガーにファイルハンドラーを追加
        for logger_name in config["loggers"]:
            if "handlers" in config["loggers"][logger_name]:
                config["loggers"][logger_name]["handlers"].append("file")
        
        config["root"]["handlers"].append("file")
    
    return config


def setup_logging(
    log_level: str = "INFO",
    log_file: Optional[str] = None,
    enable_json_format: bool = True
) -> None:
    """
    ロギングを設定
    
    Args:
        log_level: ログレベル
        log_file: ログファイルパス
        enable_json_format: JSON形式を有効にするか
    """
    config = get_logging_config(
        log_level=log_level,
        log_file=log_file,
        enable_json_format=enable_json_format
    )
    
    logging.config.dictConfig(config)


@contextmanager
def request_context(request_id: Optional[str] = None, user_id: Optional[str] = None):
    """
    リクエストコンテキストマネージャー
    ログにリクエストIDとユーザーIDを追加
    """
    if request_id is None:
        request_id = str(uuid.uuid4())
    
    # コンテキスト情報を設定
    old_request_id = getattr(_local, 'request_id', None)
    old_user_id = getattr(_local, 'user_id', None)
    
    _local.request_id = request_id
    if user_id:
        _local.user_id = user_id
    
    try:
        yield request_id
    finally:
        # コンテキスト情報を復元
        if old_request_id:
            _local.request_id = old_request_id
        else:
            if hasattr(_local, 'request_id'):
                delattr(_local, 'request_id')
        
        if old_user_id:
            _local.user_id = old_user_id
        else:
            if hasattr(_local, 'user_id'):
                delattr(_local, 'user_id')


def get_logger(name: str) -> StructuredLogger:
    """
    構造化ロガーを取得
    
    Args:
        name: ロガー名
        
    Returns:
        StructuredLogger: 構造化ロガーインスタンス
    """
    return StructuredLogger(name)


# デフォルトロガー
def setup_default_logging() -> None:
    """本番環境向けのデフォルトロギング設定"""
    setup_logging(
        log_level="INFO",
        log_file="logs/multillm.log",
        enable_json_format=True
    )


def setup_development_logging() -> None:
    """開発環境向けのロギング設定"""
    setup_logging(
        log_level="DEBUG",
        log_file="logs/multillm_dev.log",
        enable_json_format=False
    )


if __name__ == "__main__":
    # テスト実行
    setup_development_logging()
    
    logger = get_logger("test")
    
    with request_context("test-request-123", "user-456"):
        logger.log_api_request("POST", "/api/generate", 200, 1500.5)
        logger.log_worker_event("openai", "task_started", "gpt-4", "task-789")
        logger.log_generation_metrics("openai", "gpt-4", 100, 500, 2000.0)
        
        try:
            raise ValueError("テストエラー")
        except Exception as e:
            logger.log_error(e, {"context": "test_context"})