"""
アップロードレート制限のテスト
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import Mock, MagicMock
from fastapi import Request
from fastapi.responses import JSONResponse

from src.middleware.upload_rate_limit import UploadRateLimiter, rate_limit_upload


class TestUploadRateLimiter:
    """アップロードレート制限のテスト"""
    
    @pytest.fixture
    def rate_limiter(self):
        return UploadRateLimiter(
            requests_per_hour=10,
            requests_per_minute=5,
            burst_size=3,
            block_duration_minutes=5
        )
    
    def create_mock_request(self, ip: str = "192.168.1.1", headers: dict = None):
        """モックリクエストを作成"""
        request = Mock(spec=Request)
        request.client = Mock()
        request.client.host = ip
        request.headers = headers or {}
        request.state = MagicMock()
        return request
    
    @pytest.mark.asyncio
    async def test_normal_request_allowed(self, rate_limiter):
        """通常のリクエストが許可されることを確認"""
        request = self.create_mock_request("192.168.1.1")
        
        # 最初のリクエストは許可される
        result = await rate_limiter.check_limit(request)
        assert result is None
        
        # レート制限情報が設定されていることを確認
        assert hasattr(request.state, 'rate_limit_info')
        assert request.state.rate_limit_info['limit'] == 10
        assert request.state.rate_limit_info['remaining'] == 9
    
    @pytest.mark.asyncio
    async def test_burst_limit_exceeded(self, rate_limiter):
        """バースト制限超過のテスト"""
        request = self.create_mock_request("192.168.1.2")
        
        # バースト制限（3リクエスト/5秒）まで許可
        for i in range(3):
            result = await rate_limiter.check_limit(request)
            assert result is None
        
        # 4回目のリクエストはブロック
        result = await rate_limiter.check_limit(request)
        assert isinstance(result, JSONResponse)
        assert result.status_code == 429
        
        # エラーメッセージの確認
        content = result.body.decode('utf-8')
        assert 'Burst limit exceeded' in content
    
    @pytest.mark.asyncio
    async def test_minute_limit_exceeded(self, rate_limiter):
        """分単位制限超過のテスト"""
        request = self.create_mock_request("192.168.1.3")
        
        # 時間をずらしながらリクエスト（バーストを回避）
        for i in range(5):
            result = await rate_limiter.check_limit(request)
            assert result is None
            await asyncio.sleep(2)  # 2秒間隔でリクエスト
        
        # 6回目のリクエストは分単位制限でブロック
        result = await rate_limiter.check_limit(request)
        assert isinstance(result, JSONResponse)
        assert result.status_code == 429
        
        content = result.body.decode('utf-8')
        assert 'Minute limit exceeded' in content
    
    @pytest.mark.asyncio
    async def test_hour_limit_exceeded(self, rate_limiter):
        """時間単位制限超過のテスト"""
        request = self.create_mock_request("192.168.1.4")
        
        # 手動でリクエスト履歴を追加（テスト高速化のため）
        current_time = datetime.now()
        ip = "192.168.1.4"
        
        # 過去1時間に9リクエストを追加
        for i in range(9):
            rate_limiter._request_history[ip].append(
                current_time - timedelta(minutes=i*5)
            )
        
        # 10回目のリクエストは許可
        result = await rate_limiter.check_limit(request)
        assert result is None
        
        # 11回目のリクエストはブロック
        result = await rate_limiter.check_limit(request)
        assert isinstance(result, JSONResponse)
        assert result.status_code == 429
        
        content = result.body.decode('utf-8')
        assert 'Hour limit exceeded' in content
    
    @pytest.mark.asyncio
    async def test_ip_blocking(self, rate_limiter):
        """IPブロッキングのテスト"""
        request = self.create_mock_request("192.168.1.5")
        
        # 制限を超過させてブロック
        for i in range(4):
            await rate_limiter.check_limit(request)
        
        # ブロックされていることを確認
        result = await rate_limiter.check_limit(request)
        assert isinstance(result, JSONResponse)
        assert result.status_code == 429
        
        # ブロック期間中は全てのリクエストが拒否される
        for i in range(5):
            result = await rate_limiter.check_limit(request)
            assert isinstance(result, JSONResponse)
            assert result.status_code == 429
            assert 'temporarily blocked' in result.body.decode('utf-8')
    
    @pytest.mark.asyncio
    async def test_x_forwarded_for_header(self, rate_limiter):
        """X-Forwarded-Forヘッダーの処理テスト"""
        headers = {'X-Forwarded-For': '10.0.0.1, 192.168.1.1'}
        request = self.create_mock_request("192.168.1.100", headers)
        
        # X-Forwarded-Forの最初のIPが使用される
        result = await rate_limiter.check_limit(request)
        assert result is None
        
        # 同じX-Forwarded-For IPからのリクエストはカウントされる
        headers2 = {'X-Forwarded-For': '10.0.0.1, 192.168.1.200'}
        request2 = self.create_mock_request("192.168.1.200", headers2)
        result2 = await rate_limiter.check_limit(request2)
        assert result2 is None
        assert request2.state.rate_limit_info['remaining'] == 8
    
    @pytest.mark.asyncio
    async def test_x_real_ip_header(self, rate_limiter):
        """X-Real-IPヘッダーの処理テスト"""
        headers = {'X-Real-IP': '10.0.0.2'}
        request = self.create_mock_request("192.168.1.100", headers)
        
        result = await rate_limiter.check_limit(request)
        assert result is None
    
    @pytest.mark.asyncio
    async def test_old_requests_cleanup(self, rate_limiter):
        """古いリクエスト履歴のクリーンアップテスト"""
        request = self.create_mock_request("192.168.1.6")
        current_time = datetime.now()
        ip = "192.168.1.6"
        
        # 古いリクエストを追加
        old_time = current_time - timedelta(hours=2)
        rate_limiter._request_history[ip].append(old_time)
        
        # 新しいリクエストも追加
        recent_time = current_time - timedelta(minutes=30)
        rate_limiter._request_history[ip].append(recent_time)
        
        # リクエスト実行（クリーンアップが発生）
        result = await rate_limiter.check_limit(request)
        assert result is None
        
        # 古いリクエストが削除されていることを確認
        assert len(rate_limiter._request_history[ip]) == 2  # 最近の1つ + 今のリクエスト
        assert all(t > current_time - timedelta(hours=1) for t in rate_limiter._request_history[ip])
    
    @pytest.mark.asyncio
    async def test_rate_limit_headers(self, rate_limiter):
        """レート制限ヘッダーのテスト"""
        request = self.create_mock_request("192.168.1.7")
        
        # 正常なリクエスト
        result = await rate_limiter.check_limit(request)
        assert result is None
        
        # レート制限情報が設定されている
        info = request.state.rate_limit_info
        assert info['limit'] == 10
        assert info['remaining'] == 9
        assert 'reset' in info
        
        # エラーレスポンスのヘッダー確認
        for i in range(10):
            await rate_limiter.check_limit(request)
        
        result = await rate_limiter.check_limit(request)
        assert isinstance(result, JSONResponse)
        
        # ヘッダーの確認
        assert 'Retry-After' in result.headers
        assert 'X-RateLimit-Limit' in result.headers
        assert 'X-RateLimit-Remaining' in result.headers
        assert 'X-RateLimit-Reset' in result.headers
    
    @pytest.mark.asyncio
    async def test_decorator_functionality(self):
        """デコレーターの機能テスト"""
        # テスト用のレート制限付き関数
        call_count = 0
        
        @rate_limit_upload
        async def test_endpoint(request: Request):
            nonlocal call_count
            call_count += 1
            response = Mock()
            response.headers = {}
            return response
        
        # 正常なリクエスト
        request = self.create_mock_request("192.168.1.8")
        result = await test_endpoint(request)
        assert call_count == 1
        assert 'X-RateLimit-Limit' in result.headers