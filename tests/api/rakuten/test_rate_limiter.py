"""
楽天API率制限テスト
"""

import pytest
import asyncio
import time
import os
import logging
from unittest.mock import patch, MagicMock

import httpx

from src.api.rakuten.client import RakutenAPIClient
from src.api.rakuten.rate_limiter import RakutenRateLimiter, rakuten_rate_limiter

# ロギング設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@pytest.fixture
def mock_credentials():
    """テスト用クレデンシャル"""
    return {
        'service_secret': 'test_secret',
        'license_key': 'test_license',
        'shop_id': 'test_shop',
        'test_mode': True,
        'rate_limiting_enabled': True
    }


@pytest.fixture
def mock_headers():
    """モックレスポンスヘッダー"""
    return {
        'X-RateLimit-Limit': '30',
        'X-RateLimit-Remaining': '25',
        'X-RateLimit-Reset': str(int(time.time()) + 300)
    }


@pytest.fixture
async def rate_limiter():
    """テスト用のレート制限インスタンス"""
    limiter = RakutenRateLimiter(
        requests_per_minute=30,
        max_burst=5,
        max_retries=2,
        enable_log=True
    )
    return limiter


@pytest.mark.asyncio
async def test_rate_limiter_wait(rate_limiter):
    """基本的な待機機能のテスト"""
    # 通常の待機は短時間で完了するはず
    start_time = time.time()
    await rate_limiter.wait()
    elapsed = time.time() - start_time
    
    # 最初のリクエストなので待機時間は短いはず
    assert elapsed < 0.1
    
    # レート情報を更新
    rate_limiter.state.requests_remaining = 1
    rate_limiter.state.requests_limit = 30
    
    # レート制限に近いときの待機
    start_time = time.time()
    await rate_limiter.wait()
    elapsed = time.time() - start_time
    
    # 残りリクエスト数が少ないので待機時間が長くなるはず
    assert elapsed > 0


@pytest.mark.asyncio
async def test_header_update(rate_limiter, mock_headers):
    """ヘッダーからのレート制限情報更新テスト"""
    # 初期状態を確認
    assert rate_limiter.state.requests_limit == 30
    
    # ヘッダーから更新
    rate_limiter.update_from_headers(mock_headers)
    
    # 更新後の状態を確認
    assert rate_limiter.state.requests_limit == 30
    assert rate_limiter.state.requests_remaining == 25
    assert rate_limiter.state.reset_at > time.time()


@pytest.mark.asyncio
async def test_function_decorator(rate_limiter):
    """関数デコレータとしての機能テスト"""
    call_count = 0
    
    @rate_limiter
    async def test_function():
        nonlocal call_count
        call_count += 1
        return "success"
    
    # 複数回呼び出し
    results = []
    for _ in range(3):
        result = await test_function()
        results.append(result)
    
    # すべての呼び出しが成功するはず
    assert all(r == "success" for r in results)
    assert call_count == 3


@pytest.mark.asyncio
async def test_get_stats(rate_limiter):
    """統計情報取得テスト"""
    # いくつかのリクエストを実行
    for _ in range(3):
        await rate_limiter.wait()
    
    # 統計情報を取得
    stats = rate_limiter.get_stats()
    
    # 基本的な統計情報が含まれているか確認
    assert 'total_requests' in stats
    assert 'throttled_requests' in stats
    assert 'max_requests_per_minute' in stats
    assert stats['max_requests_per_minute'] == 30


@pytest.mark.asyncio
async def test_retry_mechanism(rate_limiter):
    """再試行メカニズムのテスト"""
    # 失敗後に成功するモック関数
    attempt_count = 0
    
    @rate_limiter
    async def flaky_function():
        nonlocal attempt_count
        attempt_count += 1
        
        if attempt_count == 1:
            # 最初の呼び出しでレート制限エラー
            error = Exception("Rate limit exceeded")
            error.response = MagicMock()
            error.response.status_code = 429
            error.response.headers = {'Retry-After': '0.1'}  # 短い待機時間
            error.code = 'RATE_LIMIT'
            raise error
        return "success after retry"
    
    # 関数を実行
    result = await flaky_function()
    
    # 2回の試行（1回目は失敗、2回目は成功）
    assert attempt_count == 2
    assert result == "success after retry"


@pytest.mark.asyncio
async def test_client_integration(mock_credentials):
    """APIクライアントとの統合テスト"""
    client = RakutenAPIClient(mock_credentials)
    
    # モックレスポンスを作成
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"test": "success"}
    mock_response.headers = {
        'X-RateLimit-Limit': '30',
        'X-RateLimit-Remaining': '29',
        'X-RateLimit-Reset': str(int(time.time()) + 300)
    }
    
    # モックのHTTPリクエストメソッド
    with patch('httpx.AsyncClient.request', return_value=mock_response):
        with patch('src.api.rakuten.auth.RakutenAuth.ensure_valid_token', return_value=True):
            # APIリクエストを実行
            response = await client._make_request('GET', '/test/endpoint')
            
            # レート制限ヘッダーが処理されたことを確認
            assert client.rate_limiter.state.requests_remaining == 29


@pytest.mark.asyncio
async def test_concurrent_requests(rate_limiter):
    """並行リクエストのテスト"""
    results = []
    
    @rate_limiter
    async def test_function(i):
        await asyncio.sleep(0.05)  # 少し処理時間がかかるタスク
        return f"result-{i}"
    
    # 複数の並行リクエスト
    tasks = [test_function(i) for i in range(10)]
    results = await asyncio.gather(*tasks)
    
    # すべてのリクエストが成功した
    assert len(results) == 10
    assert all(r.startswith("result-") for r in results)


@pytest.mark.asyncio
async def test_rate_limit_stats_from_client(mock_credentials):
    """クライアントからのレート制限統計取得テスト"""
    client = RakutenAPIClient(mock_credentials)
    
    # モックレスポンスを作成
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"test": "success"}
    mock_response.headers = {
        'X-RateLimit-Limit': '30',
        'X-RateLimit-Remaining': '25',
        'X-RateLimit-Reset': str(int(time.time()) + 300)
    }
    
    # モックのHTTPリクエストメソッド
    with patch('httpx.AsyncClient.request', return_value=mock_response):
        with patch('src.api.rakuten.auth.RakutenAuth.ensure_valid_token', return_value=True):
            # APIリクエストを実行
            await client._make_request('GET', '/test/endpoint')
            
            # 統計情報を取得
            stats = client.get_rate_limit_stats()
            
            # 基本的な統計情報が含まれているか確認
            assert 'api_requests_remaining' in stats
            assert 'api_requests_limit' in stats
            assert stats['api_requests_remaining'] == 25
            assert stats['rate_limiting_enabled'] is True


# メイン実行
if __name__ == "__main__":
    pytest.main(["-xvs", __file__])