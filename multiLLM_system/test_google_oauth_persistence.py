#!/usr/bin/env python3
"""
Google OAuth Persistence のテストスクリプト
Google系プロバイダーのOAuthトークン永続化機能をテスト
"""
import os
import sys
import asyncio
import logging
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

# パスの設定
sys.path.insert(0, os.path.dirname(__file__))

from orchestrator.persistence import PersistenceManager
from services.mcp_integration import (
    GoogleAdsMCPProvider,
    GoogleAnalyticsMCPProvider,
    GoogleSearchConsoleMCPProvider
)

# ログ設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TestGoogleOAuthPersistence:
    """Google OAuth永続化機能のテストクラス"""
    
    def __init__(self):
        self.persistence_manager = None
        self.test_config = {
            'test_mode': True,
            'use_sqlite_for_tests': True,
            'cache_ttl': 3600
        }
    
    async def setup(self):
        """テスト環境のセットアップ"""
        logger.info("🔧 Setting up test environment...")
        
        # PersistenceManagerの初期化
        self.persistence_manager = PersistenceManager(self.test_config)
        await self.persistence_manager.initialize()
        
        logger.info("✅ Test environment ready")
    
    async def cleanup(self):
        """テスト環境のクリーンアップ"""
        if self.persistence_manager:
            await self.persistence_manager.shutdown()
        logger.info("🧹 Test environment cleaned up")
    
    async def test_google_ads_oauth_persistence(self):
        """Google Ads OAuth永続化テスト"""
        logger.info("📊 Testing Google Ads OAuth persistence...")
        
        # テスト用設定
        config = {
            'developer_token': 'test_dev_token',
            'client_id': 'test_client_id',
            'client_secret': 'test_client_secret',
            'refresh_token': 'test_refresh_token',
            'customer_id': '1234567890'
        }
        
        # プロバイダーの初期化
        provider = GoogleAdsMCPProvider('test_google_ads', config)
        provider.persistence_manager = self.persistence_manager
        await provider._initialize_provider()
        
        # モックレスポンスの準備
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={
            'access_token': 'test_access_token_ads',
            'expires_in': 3600
        })
        mock_response.content_type = 'application/json'
        
        # _make_rate_limited_requestをモック
        with patch.object(provider, '_make_rate_limited_request', return_value=mock_response):
            # トークン取得
            token = await provider._get_access_token()
            assert token == 'test_access_token_ads'
            
            # PersistenceManagerからトークンを確認
            cached_token = await self.persistence_manager.get_oauth_token(
                'google_ads', 
                config['customer_id']
            )
            assert cached_token is not None
            assert cached_token['access_token'] == 'test_access_token_ads'
            assert cached_token['refresh_token'] == config['refresh_token']
            
            # 2回目の呼び出しはキャッシュから取得
            token2 = await provider._get_access_token()
            assert token2 == 'test_access_token_ads'
        
        logger.info("✅ Google Ads OAuth persistence test passed")
    
    async def test_google_analytics_oauth_persistence(self):
        """Google Analytics OAuth永続化テスト"""
        logger.info("📈 Testing Google Analytics OAuth persistence...")
        
        # テスト用設定
        config = {
            'client_id': 'test_client_id_ga',
            'client_secret': 'test_client_secret_ga',
            'refresh_token': 'test_refresh_token_ga',
            'property_id': 'GA4_PROPERTY_ID'
        }
        
        # プロバイダーの初期化
        provider = GoogleAnalyticsMCPProvider('test_google_analytics', config)
        provider.persistence_manager = self.persistence_manager
        await provider._initialize_provider()
        
        # モックレスポンスの準備
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={
            'access_token': 'test_access_token_ga',
            'expires_in': 3600
        })
        mock_response.content_type = 'application/json'
        
        # _make_rate_limited_requestをモック
        with patch.object(provider, '_make_rate_limited_request', return_value=mock_response):
            # トークン取得
            token = await provider._get_access_token()
            assert token == 'test_access_token_ga'
            
            # PersistenceManagerからトークンを確認
            cached_token = await self.persistence_manager.get_oauth_token(
                'google_analytics', 
                config['property_id']
            )
            assert cached_token is not None
            assert cached_token['access_token'] == 'test_access_token_ga'
            assert cached_token['scope'] == 'https://www.googleapis.com/auth/analytics.readonly'
        
        logger.info("✅ Google Analytics OAuth persistence test passed")
    
    async def test_google_search_console_oauth_persistence(self):
        """Google Search Console OAuth永続化テスト"""
        logger.info("🔍 Testing Google Search Console OAuth persistence...")
        
        # テスト用設定
        config = {
            'client_id': 'test_client_id_gsc',
            'client_secret': 'test_client_secret_gsc',
            'refresh_token': 'test_refresh_token_gsc',
            'site_url': 'https://example.com'
        }
        
        # プロバイダーの初期化
        provider = GoogleSearchConsoleMCPProvider('test_google_search_console', config)
        provider.persistence_manager = self.persistence_manager
        await provider._initialize_provider()
        
        # モックレスポンスの準備
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={
            'access_token': 'test_access_token_gsc',
            'expires_in': 3600
        })
        mock_response.content_type = 'application/json'
        
        # _make_rate_limited_requestをモック
        with patch.object(provider, '_make_rate_limited_request', return_value=mock_response):
            # トークン取得
            token = await provider._get_access_token()
            assert token == 'test_access_token_gsc'
            
            # PersistenceManagerからトークンを確認
            cached_token = await self.persistence_manager.get_oauth_token(
                'google_search_console', 
                config['site_url']
            )
            assert cached_token is not None
            assert cached_token['access_token'] == 'test_access_token_gsc'
            assert cached_token['scope'] == 'https://www.googleapis.com/auth/webmasters.readonly'
        
        logger.info("✅ Google Search Console OAuth persistence test passed")
    
    async def test_token_refresh_failure_handling(self):
        """トークンリフレッシュ失敗時のハンドリングテスト"""
        logger.info("🚨 Testing token refresh failure handling...")
        
        config = {
            'developer_token': 'test_dev_token',  # Google Ads API requires developer_token
            'client_id': 'test_client_id',
            'client_secret': 'test_client_secret',
            'refresh_token': 'invalid_refresh_token',
            'customer_id': '1234567890'
        }
        
        provider = GoogleAdsMCPProvider('test_google_ads_fail', config)
        provider.persistence_manager = self.persistence_manager
        await provider._initialize_provider()
        
        # 失敗レスポンスのモック
        mock_response = AsyncMock()
        mock_response.status = 400
        mock_response.json = AsyncMock(return_value={
            'error': 'invalid_grant',
            'error_description': 'Token has been expired or revoked.'
        })
        mock_response.content_type = 'application/json'
        
        with patch.object(provider, '_make_rate_limited_request', return_value=mock_response):
            try:
                await provider._get_access_token()
                assert False, "Exception should have been raised"
            except Exception as e:
                assert 'Token has been expired' in str(e)
        
        logger.info("✅ Token refresh failure handling test passed")
    
    async def test_token_expiration_and_auto_refresh(self):
        """トークン期限切れ時の自動リフレッシュテスト"""
        logger.info("⏰ Testing token expiration and auto-refresh...")
        
        # 期限切れトークンを事前に保存
        await self.persistence_manager.save_oauth_token(
            'google_ads',
            'test_customer',
            'expired_access_token',
            'valid_refresh_token',
            datetime.now() - timedelta(hours=1),  # 期限切れ
            'Bearer',
            'https://www.googleapis.com/auth/adwords'
        )
        
        config = {
            'developer_token': 'test_dev_token',
            'client_id': 'test_client_id',
            'client_secret': 'test_client_secret',
            'refresh_token': 'valid_refresh_token',
            'customer_id': 'test_customer'
        }
        
        provider = GoogleAdsMCPProvider('test_google_ads_refresh', config)
        provider.persistence_manager = self.persistence_manager
        await provider._initialize_provider()
        
        # 新しいトークンレスポンスのモック
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={
            'access_token': 'new_refreshed_token',
            'expires_in': 3600
        })
        mock_response.content_type = 'application/json'
        
        with patch.object(provider, '_make_rate_limited_request', return_value=mock_response):
            # トークン取得（自動リフレッシュされるべき）
            token = await provider._get_access_token()
            assert token == 'new_refreshed_token'
            
            # PersistenceManagerで新しいトークンが保存されていることを確認
            cached_token = await self.persistence_manager.get_oauth_token(
                'google_ads', 
                'test_customer'
            )
            assert cached_token['access_token'] == 'new_refreshed_token'
        
        logger.info("✅ Token expiration and auto-refresh test passed")
    
    async def test_all_google_providers_persistence(self):
        """全Googleプロバイダーの永続化テスト統合"""
        logger.info("🌐 Testing all Google providers persistence integration...")
        
        # 各プロバイダーのテスト
        await self.test_google_ads_oauth_persistence()
        await self.test_google_analytics_oauth_persistence()
        await self.test_google_search_console_oauth_persistence()
        await self.test_token_refresh_failure_handling()
        await self.test_token_expiration_and_auto_refresh()
        
        # 保存されたトークンの一覧確認
        google_ads_tokens = await self.persistence_manager.get_oauth_tokens_by_provider('google_ads')
        google_analytics_tokens = await self.persistence_manager.get_oauth_tokens_by_provider('google_analytics')
        google_search_console_tokens = await self.persistence_manager.get_oauth_tokens_by_provider('google_search_console')
        
        logger.info(f"💾 Stored tokens - Ads: {len(google_ads_tokens)}, Analytics: {len(google_analytics_tokens)}, Search Console: {len(google_search_console_tokens)}")
        
        logger.info("✅ All Google providers persistence integration test passed")


async def main():
    """メイン実行関数"""
    tester = TestGoogleOAuthPersistence()
    
    try:
        await tester.setup()
        await tester.test_all_google_providers_persistence()
        logger.info("🎉 All tests passed successfully!")
        
    except Exception as e:
        logger.error(f"❌ Test failed: {e}")
        raise
    
    finally:
        await tester.cleanup()


if __name__ == '__main__':
    asyncio.run(main())