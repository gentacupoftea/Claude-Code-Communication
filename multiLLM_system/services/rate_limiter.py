"""
Rate Limiter - LLMプロバイダーのレート制限管理
各プロバイダーのAPIレート制限を追跡し、制限を超えないように管理
"""

import asyncio
import time
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple
from collections import deque
import logging

logger = logging.getLogger(__name__)


class RateLimiter:
    """
    トークンバケットアルゴリズムとスライディングウィンドウを組み合わせたレート制限
    """
    
    def __init__(self, requests_per_minute: int, tokens_per_minute: int):
        self.requests_per_minute = requests_per_minute
        self.tokens_per_minute = tokens_per_minute
        
        # リクエスト履歴（スライディングウィンドウ）
        self.request_times = deque()
        
        # トークン使用履歴
        self.token_usage = deque()
        
        # 現在のトークン数
        self.current_tokens = tokens_per_minute
        self.last_refill = time.time()
        
        # ロック
        self.lock = asyncio.Lock()
    
    async def acquire(self, estimated_tokens: int = 0) -> bool:
        """
        レート制限をチェックし、リクエストを許可するか判定
        
        Args:
            estimated_tokens: 推定トークン使用量
            
        Returns:
            bool: リクエストが許可されるか
        """
        async with self.lock:
            current_time = time.time()
            
            # トークンバケットをリフィル
            self._refill_tokens(current_time)
            
            # 古いリクエストを削除（1分以上前）
            self._cleanup_old_requests(current_time)
            
            # リクエスト数チェック
            if len(self.request_times) >= self.requests_per_minute:
                return False
            
            # トークン数チェック
            if estimated_tokens > self.current_tokens:
                return False
            
            # リクエストを記録
            self.request_times.append(current_time)
            
            # トークンを消費
            if estimated_tokens > 0:
                self.current_tokens -= estimated_tokens
                self.token_usage.append((current_time, estimated_tokens))
            
            return True
    
    async def wait_if_needed(self, estimated_tokens: int = 0) -> float:
        """
        必要に応じて待機してからリクエストを許可
        
        Returns:
            float: 待機した秒数
        """
        wait_time = 0
        start_time = time.time()
        
        while not await self.acquire(estimated_tokens):
            # 次のリクエストまでの待機時間を計算
            async with self.lock:
                if self.request_times:
                    oldest_request = self.request_times[0]
                    wait_until = oldest_request + 60  # 1分後
                    wait_time = max(0, wait_until - time.time())
                else:
                    wait_time = 1  # デフォルト待機時間
            
            if wait_time > 0:
                logger.info(f"Rate limit reached, waiting {wait_time:.1f}s...")
                await asyncio.sleep(wait_time)
        
        return time.time() - start_time
    
    def _refill_tokens(self, current_time: float):
        """トークンバケットをリフィル"""
        time_passed = current_time - self.last_refill
        tokens_to_add = (time_passed / 60) * self.tokens_per_minute
        
        self.current_tokens = min(
            self.tokens_per_minute,
            self.current_tokens + tokens_to_add
        )
        self.last_refill = current_time
    
    def _cleanup_old_requests(self, current_time: float):
        """古いリクエスト記録を削除"""
        cutoff_time = current_time - 60  # 1分前
        
        while self.request_times and self.request_times[0] < cutoff_time:
            self.request_times.popleft()
        
        while self.token_usage and self.token_usage[0][0] < cutoff_time:
            self.token_usage.popleft()
    
    def get_status(self) -> Dict:
        """現在のレート制限ステータスを取得"""
        current_time = time.time()
        self._cleanup_old_requests(current_time)
        
        return {
            'requests_used': len(self.request_times),
            'requests_limit': self.requests_per_minute,
            'tokens_available': int(self.current_tokens),
            'tokens_limit': self.tokens_per_minute,
            'tokens_used_last_minute': sum(tokens for _, tokens in self.token_usage)
        }


class MultiProviderRateLimiter:
    """
    複数のLLMプロバイダーのレート制限を管理
    """
    
    # プロバイダーごとのデフォルトレート制限
    DEFAULT_LIMITS = {
        'openai': {
            'gpt-4-turbo': (500, 150000),  # (requests/min, tokens/min)
            'gpt-4': (500, 40000),
            'gpt-3.5-turbo': (3500, 90000)
        },
        'anthropic': {
            'claude-3-sonnet': (50, 40000),
            'claude-3-haiku': (50, 50000),
            'claude-3-opus': (50, 20000)
        },
        'google': {
            'gemini-1.5-flash': (60, 1000000),
            'gemini-1.5-pro': (60, 32000)
        }
    }
    
    def __init__(self, custom_limits: Optional[Dict] = None):
        self.limiters = {}
        self.custom_limits = custom_limits or {}
        
        # 各プロバイダー/モデルのレート制限を初期化
        self._initialize_limiters()
    
    def _initialize_limiters(self):
        """レート制限を初期化"""
        for provider, models in self.DEFAULT_LIMITS.items():
            for model, (rpm, tpm) in models.items():
                key = f"{provider}:{model}"
                
                # カスタム制限があれば使用
                if provider in self.custom_limits and model in self.custom_limits[provider]:
                    rpm, tpm = self.custom_limits[provider][model]
                
                self.limiters[key] = RateLimiter(rpm, tpm)
                logger.info(f"Initialized rate limiter for {key}: {rpm} RPM, {tpm} TPM")
    
    async def check_rate_limit(self, provider: str, model: str, estimated_tokens: int = 0) -> Tuple[bool, Optional[float]]:
        """
        レート制限をチェック
        
        Returns:
            Tuple[bool, Optional[float]]: (許可されるか, 待機時間)
        """
        key = f"{provider}:{model}"
        limiter = self.limiters.get(key)
        
        if not limiter:
            # 未知のモデルの場合はデフォルトを使用
            logger.warning(f"No rate limiter for {key}, using default")
            limiter = RateLimiter(60, 50000)  # 控えめなデフォルト
            self.limiters[key] = limiter
        
        can_proceed = await limiter.acquire(estimated_tokens)
        
        if not can_proceed:
            # 待機時間を計算
            status = limiter.get_status()
            wait_time = 60 - (time.time() - limiter.request_times[0]) if limiter.request_times else 1
            return False, wait_time
        
        return True, None
    
    async def wait_and_acquire(self, provider: str, model: str, estimated_tokens: int = 0) -> float:
        """
        必要に応じて待機してからリクエストを許可
        
        Returns:
            float: 待機した秒数
        """
        key = f"{provider}:{model}"
        limiter = self.limiters.get(key)
        
        if not limiter:
            limiter = RateLimiter(60, 50000)
            self.limiters[key] = limiter
        
        return await limiter.wait_if_needed(estimated_tokens)
    
    def get_all_status(self) -> Dict[str, Dict]:
        """すべてのプロバイダーのステータスを取得"""
        status = {}
        
        for key, limiter in self.limiters.items():
            provider, model = key.split(':', 1)
            if provider not in status:
                status[provider] = {}
            status[provider][model] = limiter.get_status()
        
        return status
    
    def get_least_busy_provider(self, providers: list) -> Optional[Tuple[str, str]]:
        """
        最も余裕のあるプロバイダー/モデルを取得
        
        Args:
            providers: [(provider, model), ...] のリスト
            
        Returns:
            Optional[Tuple[str, str]]: (provider, model) または None
        """
        best_provider = None
        best_score = -1
        
        for provider, model in providers:
            key = f"{provider}:{model}"
            limiter = self.limiters.get(key)
            
            if limiter:
                status = limiter.get_status()
                # スコア計算（利用可能率）
                request_score = 1 - (status['requests_used'] / status['requests_limit'])
                token_score = status['tokens_available'] / status['tokens_limit']
                score = (request_score + token_score) / 2
                
                if score > best_score:
                    best_score = score
                    best_provider = (provider, model)
        
        return best_provider


# 使用例
async def main():
    # カスタム制限を設定
    custom_limits = {
        'openai': {
            'gpt-4-turbo': (100, 50000)  # より厳しい制限
        }
    }
    
    rate_limiter = MultiProviderRateLimiter(custom_limits)
    
    # レート制限チェック
    can_proceed, wait_time = await rate_limiter.check_rate_limit('openai', 'gpt-4-turbo', 1000)
    
    if not can_proceed:
        print(f"Rate limit reached, need to wait {wait_time:.1f}s")
        await asyncio.sleep(wait_time)
    
    # 自動待機
    wait_time = await rate_limiter.wait_and_acquire('anthropic', 'claude-3-sonnet', 2000)
    if wait_time > 0:
        print(f"Waited {wait_time:.1f}s for rate limit")
    
    # ステータス確認
    status = rate_limiter.get_all_status()
    print("Rate limit status:")
    for provider, models in status.items():
        print(f"\n{provider}:")
        for model, model_status in models.items():
            print(f"  {model}: {model_status['requests_used']}/{model_status['requests_limit']} requests")
    
    # 最も余裕のあるプロバイダーを取得
    providers = [
        ('openai', 'gpt-4-turbo'),
        ('anthropic', 'claude-3-sonnet'),
        ('google', 'gemini-1.5-flash')
    ]
    best = rate_limiter.get_least_busy_provider(providers)
    if best:
        print(f"\nLeast busy provider: {best[0]} - {best[1]}")


if __name__ == "__main__":
    asyncio.run(main())