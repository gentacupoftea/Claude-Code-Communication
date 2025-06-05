"""
ファイルアップロード用レート制限ミドルウェア
DoS攻撃を防ぐため、ファイルアップロードAPIにレート制限を適用
"""

import time
import logging
from typing import Dict, Optional, Tuple
from functools import wraps
from collections import defaultdict
from datetime import datetime, timedelta
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


class UploadRateLimiter:
    """
    ファイルアップロード用のレート制限実装
    """
    
    def __init__(self,
                 requests_per_hour: int = 100,
                 requests_per_minute: int = 10,
                 burst_size: int = 5,
                 block_duration_minutes: int = 60):
        """
        レート制限を初期化
        
        Args:
            requests_per_hour: 1時間あたりの最大リクエスト数
            requests_per_minute: 1分あたりの最大リクエスト数
            burst_size: 短期間での最大バーストサイズ
            block_duration_minutes: ブロック期間（分）
        """
        self.requests_per_hour = requests_per_hour
        self.requests_per_minute = requests_per_minute
        self.burst_size = burst_size
        self.block_duration = timedelta(minutes=block_duration_minutes)
        
        # リクエスト履歴を保存（メモリ内）
        self._request_history: Dict[str, list] = defaultdict(list)
        self._blocked_ips: Dict[str, datetime] = {}
        
    def _get_client_ip(self, request: Request) -> str:
        """
        クライアントIPアドレスを取得
        
        Args:
            request: FastAPIリクエストオブジェクト
            
        Returns:
            str: クライアントIPアドレス
        """
        # X-Forwarded-Forヘッダーをチェック（プロキシ経由の場合）
        forwarded_for = request.headers.get('X-Forwarded-For')
        if forwarded_for:
            # 最初のIPアドレスを取得
            return forwarded_for.split(',')[0].strip()
        
        # X-Real-IPヘッダーをチェック
        real_ip = request.headers.get('X-Real-IP')
        if real_ip:
            return real_ip
        
        # 直接接続の場合
        return request.client.host
    
    def _clean_old_requests(self, ip: str, current_time: datetime):
        """
        古いリクエスト履歴をクリーンアップ
        
        Args:
            ip: IPアドレス
            current_time: 現在時刻
        """
        # 1時間以上前のリクエストを削除
        cutoff_time = current_time - timedelta(hours=1)
        self._request_history[ip] = [
            req_time for req_time in self._request_history[ip]
            if req_time > cutoff_time
        ]
    
    def _is_blocked(self, ip: str, current_time: datetime) -> bool:
        """
        IPアドレスがブロックされているかチェック
        
        Args:
            ip: IPアドレス
            current_time: 現在時刻
            
        Returns:
            bool: ブロックされている場合True
        """
        if ip in self._blocked_ips:
            block_until = self._blocked_ips[ip]
            if current_time < block_until:
                return True
            else:
                # ブロック期間が終了
                del self._blocked_ips[ip]
        return False
    
    def _check_rate_limits(self, ip: str, current_time: datetime) -> Tuple[bool, Optional[str]]:
        """
        レート制限をチェック
        
        Args:
            ip: IPアドレス
            current_time: 現在時刻
            
        Returns:
            Tuple[bool, Optional[str]]: (制限内かどうか, エラーメッセージ)
        """
        # 古いリクエストをクリーンアップ
        self._clean_old_requests(ip, current_time)
        
        request_times = self._request_history[ip]
        
        # バーストチェック（5秒以内）
        burst_cutoff = current_time - timedelta(seconds=5)
        burst_requests = sum(1 for t in request_times if t > burst_cutoff)
        if burst_requests >= self.burst_size:
            return False, f"Burst limit exceeded: {self.burst_size} requests in 5 seconds"
        
        # 1分あたりのリクエスト数チェック
        minute_cutoff = current_time - timedelta(minutes=1)
        minute_requests = sum(1 for t in request_times if t > minute_cutoff)
        if minute_requests >= self.requests_per_minute:
            return False, f"Minute limit exceeded: {self.requests_per_minute} requests per minute"
        
        # 1時間あたりのリクエスト数チェック
        hour_requests = len(request_times)
        if hour_requests >= self.requests_per_hour:
            return False, f"Hour limit exceeded: {self.requests_per_hour} requests per hour"
        
        return True, None
    
    async def check_limit(self, request: Request) -> Optional[JSONResponse]:
        """
        レート制限をチェックし、必要に応じてエラーレスポンスを返す
        
        Args:
            request: FastAPIリクエストオブジェクト
            
        Returns:
            Optional[JSONResponse]: 制限に達している場合はエラーレスポンス
        """
        ip = self._get_client_ip(request)
        current_time = datetime.now()
        
        # ブロックチェック
        if self._is_blocked(ip, current_time):
            block_until = self._blocked_ips[ip]
            remaining_seconds = int((block_until - current_time).total_seconds())
            
            return JSONResponse(
                status_code=429,
                content={
                    "error": "RATE_001",
                    "message": "Too many requests. You have been temporarily blocked.",
                    "retry_after": remaining_seconds
                },
                headers={
                    "Retry-After": str(remaining_seconds),
                    "X-RateLimit-Limit": str(self.requests_per_hour),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(block_until.timestamp()))
                }
            )
        
        # レート制限チェック
        is_allowed, error_message = self._check_rate_limits(ip, current_time)
        
        if not is_allowed:
            # 制限超過の場合、IPをブロック
            self._blocked_ips[ip] = current_time + self.block_duration
            logger.warning(f"Rate limit exceeded for IP {ip}: {error_message}")
            
            return JSONResponse(
                status_code=429,
                content={
                    "error": "RATE_002",
                    "message": error_message,
                    "retry_after": int(self.block_duration.total_seconds())
                },
                headers={
                    "Retry-After": str(int(self.block_duration.total_seconds())),
                    "X-RateLimit-Limit": str(self.requests_per_hour),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int((current_time + self.block_duration).timestamp()))
                }
            )
        
        # リクエストを記録
        self._request_history[ip].append(current_time)
        
        # 残りリクエスト数を計算
        remaining = self.requests_per_hour - len(self._request_history[ip])
        
        # レート制限情報をリクエストに追加
        request.state.rate_limit_info = {
            "limit": self.requests_per_hour,
            "remaining": remaining,
            "reset": int((current_time + timedelta(hours=1)).timestamp())
        }
        
        return None


# グローバルインスタンス
# 本番環境に適した設定値：
# - 1時間あたり100回のアップロード（大規模な一括処理を考慮）
# - 1分あたり20回（短期間での複数ファイルアップロードを許可）
# - バーストサイズ10（連続アップロードに対応）
# - ブロック期間15分（過度な制限を避ける）
upload_rate_limiter = UploadRateLimiter(
    requests_per_hour=100,
    requests_per_minute=20,
    burst_size=10,
    block_duration_minutes=15
)


def rate_limit_upload(func):
    """
    ファイルアップロードエンドポイント用のレート制限デコレーター
    
    使用例:
        @router.post("/upload")
        @rate_limit_upload
        async def upload_file(request: Request, file: UploadFile):
            ...
    """
    @wraps(func)
    async def wrapper(request: Request, *args, **kwargs):
        # レート制限チェック
        error_response = await upload_rate_limiter.check_limit(request)
        if error_response:
            return error_response
        
        # 元の関数を実行
        response = await func(request, *args, **kwargs)
        
        # レート制限ヘッダーを追加
        if hasattr(request.state, 'rate_limit_info'):
            info = request.state.rate_limit_info
            response.headers["X-RateLimit-Limit"] = str(info['limit'])
            response.headers["X-RateLimit-Remaining"] = str(info['remaining'])
            response.headers["X-RateLimit-Reset"] = str(info['reset'])
        
        return response
    
    return wrapper