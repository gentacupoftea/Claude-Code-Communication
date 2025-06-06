"""
ETL Common Utilities
ETL処理に必要な共通ユーティリティ関数
"""

import uuid
import logging
import time
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any, Optional, Callable
from functools import wraps


class ETLException(Exception):
    """ETL処理専用の例外クラス"""
    
    def __init__(self, message: str, error_code: str = "ETL_ERROR", context: Optional[Dict] = None):
        self.message = message
        self.error_code = error_code
        self.context = context or {}
        super().__init__(self.message)


def get_etl_logger(name: str = "etl") -> logging.Logger:
    """ETL専用のロガーを取得"""
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    return logger


def timing_decorator(operation_name: str):
    """実行時間計測デコレータ"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            logger = get_etl_logger()
            logger.info(f"🚀 {operation_name} 開始")
            
            try:
                result = func(*args, **kwargs)
                end_time = time.time()
                duration = end_time - start_time
                logger.info(f"✅ {operation_name} 完了 ({duration:.2f}秒)")
                return result
            except Exception as e:
                end_time = time.time()
                duration = end_time - start_time
                logger.error(f"❌ {operation_name} 失敗 ({duration:.2f}秒): {str(e)}")
                raise
        return wrapper
    return decorator


class ETLTimer:
    """ETL処理時間計測コンテキストマネージャー"""
    
    def __init__(self, operation_name: str, logger: Optional[logging.Logger] = None):
        self.operation_name = operation_name
        self.logger = logger or get_etl_logger()
        self.start_time = None
        self.end_time = None
    
    def __enter__(self):
        self.start_time = time.time()
        self.logger.info(f"⏱️ {self.operation_name} 開始")
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.end_time = time.time()
        duration = self.end_time - self.start_time
        
        if exc_type is None:
            self.logger.info(f"✅ {self.operation_name} 完了 ({duration:.2f}秒)")
        else:
            self.logger.error(f"❌ {self.operation_name} 失敗 ({duration:.2f}秒): {str(exc_val)}")
        
        return False  # 例外は再発生させる


class DateTimeUtils:
    """日時処理ユーティリティ"""
    
    @staticmethod
    def get_current_utc() -> datetime:
        """現在のUTC日時を取得"""
        return datetime.now(timezone.utc)
    
    @staticmethod
    def get_yesterday() -> datetime:
        """昨日のUTC日時を取得"""
        return DateTimeUtils.get_current_utc() - timedelta(days=1)
    
    @staticmethod
    def format_iso(dt: datetime) -> str:
        """ISO形式で日時をフォーマット"""
        return dt.isoformat()
    
    @staticmethod
    def get_date_range(start_date: datetime, end_date: datetime) -> tuple[datetime, datetime]:
        """日付範囲を正規化"""
        if start_date > end_date:
            start_date, end_date = end_date, start_date
        
        # タイムゾーンをUTCに統一
        if start_date.tzinfo is None:
            start_date = start_date.replace(tzinfo=timezone.utc)
        if end_date.tzinfo is None:
            end_date = end_date.replace(tzinfo=timezone.utc)
        
        return start_date, end_date


def generate_etl_id(prefix: str = "etl") -> str:
    """ETL処理用のユニークIDを生成"""
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    unique_suffix = str(uuid.uuid4())[:8]
    return f"{prefix}_{timestamp}_{unique_suffix}"


def calculate_data_hash(data: Dict[str, Any]) -> str:
    """データのハッシュ値を計算（重複検出用）"""
    # 辞書を安定したJSON文字列に変換
    import json
    data_str = json.dumps(data, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(data_str.encode('utf-8')).hexdigest()


def create_progress_callback(total_items: int, logger: logging.Logger, 
                           report_interval: int = 100) -> Callable:
    """プログレス報告コールバック関数を作成"""
    processed_count = 0
    
    def progress_callback():
        nonlocal processed_count
        processed_count += 1
        
        if processed_count % report_interval == 0 or processed_count == total_items:
            percentage = (processed_count / total_items) * 100
            logger.info(f"📊 進行状況: {processed_count}/{total_items} ({percentage:.1f}%)")
    
    return progress_callback


def sanitize_table_name(name: str) -> str:
    """テーブル名をサニタイズ"""
    # 英数字とアンダースコアのみ許可
    import re
    sanitized = re.sub(r'[^a-zA-Z0-9_]', '_', name)
    
    # 先頭が数字の場合はアンダースコアを追加
    if sanitized and sanitized[0].isdigit():
        sanitized = f"_{sanitized}"
    
    return sanitized.lower()


def batch_list(items: List[Any], batch_size: int) -> List[List[Any]]:
    """リストをバッチサイズごとに分割"""
    for i in range(0, len(items), batch_size):
        yield items[i:i + batch_size]


def safe_get_nested_value(data: Dict[str, Any], keys: str, default: Any = None) -> Any:
    """ネストされた辞書から安全に値を取得"""
    try:
        for key in keys.split('.'):
            if isinstance(data, dict) and key in data:
                data = data[key]
            else:
                return default
        return data
    except (AttributeError, TypeError, KeyError):
        return default


def validate_required_fields(data: Dict[str, Any], required_fields: List[str]) -> bool:
    """必須フィールドの存在をチェック"""
    missing_fields = []
    for field in required_fields:
        if field not in data or data[field] is None:
            missing_fields.append(field)
    
    if missing_fields:
        raise ETLException(
            f"必須フィールドが不足: {missing_fields}",
            "MISSING_REQUIRED_FIELDS",
            {"missing_fields": missing_fields, "data_keys": list(data.keys())}
        )
    
    return True