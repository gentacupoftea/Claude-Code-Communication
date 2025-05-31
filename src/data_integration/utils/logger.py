"""Logging configuration for data integration."""

import logging
import sys
from typing import Optional
import json
from datetime import datetime

class JsonFormatter(logging.Formatter):
    """JSON形式でログを出力するフォーマッター。"""
    
    def format(self, record):
        log_obj = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
            "message": record.getMessage(),
        }
        
        if hasattr(record, "extra_data"):
            log_obj["extra"] = record.extra_data
        
        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)
        
        return json.dumps(log_obj)

class ColoredFormatter(logging.Formatter):
    """色付きコンソール出力用フォーマッター。"""
    
    COLORS = {
        "DEBUG": "\033[36m",    # Cyan
        "INFO": "\033[32m",     # Green
        "WARNING": "\033[33m",  # Yellow
        "ERROR": "\033[31m",    # Red
        "CRITICAL": "\033[35m", # Magenta
    }
    RESET = "\033[0m"
    
    def format(self, record):
        log_color = self.COLORS.get(record.levelname, self.RESET)
        record.levelname = f"{log_color}{record.levelname}{self.RESET}"
        return super().format(record)

def setup_logger(
    name: str,
    level: str = "INFO",
    enable_json: bool = False,
    log_file: Optional[str] = None
) -> logging.Logger:
    """ロガーをセットアップします。"""
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, level.upper()))
    
    # Remove existing handlers
    logger.handlers = []
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.DEBUG)
    
    if enable_json:
        console_formatter = JsonFormatter()
    else:
        console_formatter = ColoredFormatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )
    
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)
    
    # File handler (optional)
    if log_file:
        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(logging.DEBUG)
        file_formatter = JsonFormatter() if enable_json else logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )
        file_handler.setFormatter(file_formatter)
        logger.addHandler(file_handler)
    
    return logger

class LoggerMixin:
    """ロガーを提供するミックスインクラス。"""
    
    @property
    def logger(self) -> logging.Logger:
        if not hasattr(self, "_logger"):
            self._logger = setup_logger(self.__class__.__name__)
        return self._logger

# Default logger for the module
default_logger = setup_logger("data_integration")

# Utility functions
def log_info(message: str, **kwargs):
    """情報メッセージをログに記録します。"""
    default_logger.info(message, extra={"extra_data": kwargs})

def log_error(message: str, exception: Optional[Exception] = None, **kwargs):
    """エラーメッセージをログに記録します。"""
    default_logger.error(message, exc_info=exception, extra={"extra_data": kwargs})

def log_warning(message: str, **kwargs):
    """警告メッセージをログに記録します。"""
    default_logger.warning(message, extra={"extra_data": kwargs})

def log_debug(message: str, **kwargs):
    """デバッグメッセージをログに記録します。"""
    default_logger.debug(message, extra={"extra_data": kwargs})
