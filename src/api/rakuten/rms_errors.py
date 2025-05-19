"""
Rakuten RMS API error code definitions and handlers
"""

from enum import Enum
from typing import Dict, Optional, Any


class RMSErrorCategory(Enum):
    """RMS error categories"""
    SYSTEM = "N"  # システムエラー
    AUTH = "C01"  # 認証エラー
    PERMISSION = "C02"  # アクセス権限エラー
    RATE_LIMIT = "C03"  # リクエスト上限エラー
    REQUIRED_PARAM = "E01"  # 必須パラメータエラー
    INVALID_PARAM = "E02"  # パラメータ値エラー
    DATA_CONFLICT = "E03"  # データ整合性エラー
    NOT_FOUND = "E04"  # データ不存在エラー


class RMSErrorCodes:
    """RMS error code definitions"""
    
    ERROR_CODES = {
        # System errors
        "N00-000": "システムエラー",
        "N00-001": "一時的なシステムエラー",
        "N00-002": "メンテナンス中",
        
        # Authentication errors
        "C01-001": "認証エラー",
        "C01-002": "アクセストークン無効",
        "C01-003": "アクセストークン期限切れ",
        "C01-004": "リフレッシュトークン無効",
        
        # Permission errors
        "C02-001": "アクセス権限エラー",
        "C02-002": "APIアクセス権限なし",
        "C02-003": "店舗アクセス権限なし",
        
        # Rate limit errors
        "C03-001": "リクエスト上限エラー",
        "C03-002": "日次リクエスト上限超過",
        "C03-003": "月次リクエスト上限超過",
        
        # Required parameter errors
        "E01-001": "必須パラメータ不足",
        "E01-002": "必須ヘッダー不足",
        
        # Invalid parameter errors
        "E02-001": "パラメータ値エラー",
        "E02-002": "パラメータ形式エラー",
        "E02-003": "パラメータ範囲エラー",
        "E02-004": "日付形式エラー",
        
        # Data conflict errors
        "E03-001": "データ整合性エラー",
        "E03-002": "在庫不足エラー",
        "E03-003": "重複エラー",
        "E03-004": "ステータス遷移エラー",
        
        # Not found errors
        "E04-001": "データ不存在エラー",
        "E04-002": "商品不存在",
        "E04-003": "注文不存在",
        "E04-004": "顧客不存在",
    }
    
    # Category mappings
    CATEGORY_MAP = {
        "N": RMSErrorCategory.SYSTEM,
        "C01": RMSErrorCategory.AUTH,
        "C02": RMSErrorCategory.PERMISSION,
        "C03": RMSErrorCategory.RATE_LIMIT,
        "E01": RMSErrorCategory.REQUIRED_PARAM,
        "E02": RMSErrorCategory.INVALID_PARAM,
        "E03": RMSErrorCategory.DATA_CONFLICT,
        "E04": RMSErrorCategory.NOT_FOUND,
    }
    
    @classmethod
    def get_error_message(cls, code: str) -> str:
        """
        Get error message for a code
        
        Args:
            code: Error code
            
        Returns:
            Error message in Japanese
        """
        return cls.ERROR_CODES.get(code, f"不明なエラー: {code}")
    
    @classmethod
    def get_error_category(cls, code: str) -> Optional[RMSErrorCategory]:
        """
        Get error category from code
        
        Args:
            code: Error code
            
        Returns:
            Error category or None
        """
        if not code or len(code) < 3:
            return None
            
        prefix = code[:3] if code.startswith("C") or code.startswith("E") else code[:1]
        return cls.CATEGORY_MAP.get(prefix)
    
    @classmethod
    def is_rate_limit_error(cls, code: str) -> bool:
        """Check if error is rate limit related"""
        return cls.get_error_category(code) == RMSErrorCategory.RATE_LIMIT
    
    @classmethod
    def is_auth_error(cls, code: str) -> bool:
        """Check if error is authentication related"""
        return cls.get_error_category(code) == RMSErrorCategory.AUTH
    
    @classmethod
    def is_retryable(cls, code: str) -> bool:
        """
        Check if error is retryable
        
        Args:
            code: Error code
            
        Returns:
            True if error can be retried
        """
        category = cls.get_error_category(code)
        
        # Retryable categories
        retryable_categories = {
            RMSErrorCategory.SYSTEM,
            RMSErrorCategory.RATE_LIMIT,
        }
        
        # Specific retryable codes
        retryable_codes = {
            "N00-001",  # Temporary system error
            "C03-001",  # Rate limit
        }
        
        return category in retryable_categories or code in retryable_codes


class RMSErrorHandler:
    """Handler for RMS API errors"""
    
    @staticmethod
    def handle_error(error_code: str, error_message: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle RMS error and provide appropriate response
        
        Args:
            error_code: RMS error code
            error_message: Original error message
            context: Additional context
            
        Returns:
            Dictionary with error details and recommendations
        """
        category = RMSErrorCodes.get_error_category(error_code)
        detailed_message = RMSErrorCodes.get_error_message(error_code)
        is_retryable = RMSErrorCodes.is_retryable(error_code)
        
        response = {
            "code": error_code,
            "category": category.value if category else "UNKNOWN",
            "message": detailed_message,
            "original_message": error_message,
            "is_retryable": is_retryable,
            "context": context
        }
        
        # Add specific recommendations based on error type
        if RMSErrorCodes.is_rate_limit_error(error_code):
            response["recommendation"] = "リクエスト頻度を下げるか、しばらく待ってから再試行してください"
            response["retry_after"] = context.get("retry_after", 60)
        elif RMSErrorCodes.is_auth_error(error_code):
            response["recommendation"] = "認証情報を確認し、必要に応じて再認証してください"
        elif category == RMSErrorCategory.REQUIRED_PARAM:
            response["recommendation"] = "必須パラメータを確認してください"
            response["missing_params"] = context.get("missing_params", [])
        elif category == RMSErrorCategory.INVALID_PARAM:
            response["recommendation"] = "パラメータの値や形式を確認してください"
            response["invalid_params"] = context.get("invalid_params", [])
        
        return response