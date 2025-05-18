"""Tests for data integration services."""

import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime, timedelta

from src.data_integration.services.shopify_service import ShopifyService
from src.data_integration.services.analytics_service import AnalyticsService
from src.data_integration.services.email_service import EmailService

class TestShopifyService:
    """Tests for ShopifyService."""
    
    def test_get_products(self, mock_shopify_api, mock_cache_manager, mock_metrics_collector):
        """Test getting products from Shopify."""
        service = ShopifyService(
            api_key="test_key",
            secret="test_secret",
            store_domain="test.myshopify.com",
            cache_manager=mock_cache_manager,
            metrics_collector=mock_metrics_collector
        )
        service.api = mock_shopify_api
        
        products = service.get_products()
        
        assert len(products) == 2
        assert products[0]["id"] == "prod_1"
        assert products[0]["title"] == "Test Product 1"
        
        mock_metrics_collector.record_timing.assert_called()
        mock_cache_manager.get_or_set.assert_called()
    
    def test_get_orders(self, mock_shopify_api, mock_cache_manager, mock_metrics_collector):
        """Test getting orders from Shopify."""
        service = ShopifyService(
            api_key="test_key",
            secret="test_secret",
            store_domain="test.myshopify.com",
            cache_manager=mock_cache_manager,
            metrics_collector=mock_metrics_collector
        )
        service.api = mock_shopify_api
        
        orders = service.get_orders(
            start_date=datetime.now() - timedelta(days=7),
            end_date=datetime.now()
        )
        
        assert len(orders) == 1
        assert orders[0]["id"] == "order_1"
        assert orders[0]["financial_status"] == "paid"
    
    def test_get_customers(self, mock_shopify_api, mock_cache_manager, mock_metrics_collector):
        """Test getting customers from Shopify."""
        service = ShopifyService(
            api_key="test_key",
            secret="test_secret",
            store_domain="test.myshopify.com",
            cache_manager=mock_cache_manager,
            metrics_collector=mock_metrics_collector
        )
        service.api = mock_shopify_api
        
        customers = service.get_customers()
        
        assert len(customers) == 1
        assert customers[0]["id"] == "cust_1"
        assert customers[0]["email"] == "test@example.com"
    
    @pytest.mark.asyncio
    async def test_get_products_batch_async(self, mock_shopify_api, mock_cache_manager, mock_metrics_collector):
        """Test async batch product fetching."""
        service = ShopifyService(
            api_key="test_key",
            secret="test_secret",
            store_domain="test.myshopify.com",
            cache_manager=mock_cache_manager,
            metrics_collector=mock_metrics_collector
        )
        
        # Mock async method
        mock_async_api = AsyncMock()
        mock_async_api.get_products_batch.return_value = mock_shopify_api.get_products()
        service.api = mock_async_api
        
        products = await service.get_products_batch_async()
        
        assert len(products) == 2
        assert products[0]["id"] == "prod_1"

class TestAnalyticsService:
    """Tests for AnalyticsService."""
    
    def test_get_page_views(self, mock_analytics_api, mock_cache_manager, mock_metrics_collector):
        """Test getting page views data."""
        service = AnalyticsService(
            api_key="test_key",
            cache_manager=mock_cache_manager,
            metrics_collector=mock_metrics_collector
        )
        service.api = mock_analytics_api
        
        page_views = service.get_page_views(
            start_date=datetime.now() - timedelta(days=7),
            end_date=datetime.now()
        )
        
        assert len(page_views) == 1
        assert page_views[0]["page"] == "/products/test-product-1"
        assert page_views[0]["views"] == 1000
    
    def test_get_conversion_data(self, mock_analytics_api, mock_cache_manager, mock_metrics_collector):
        """Test getting conversion data."""
        service = AnalyticsService(
            api_key="test_key",
            cache_manager=mock_cache_manager,
            metrics_collector=mock_metrics_collector
        )
        service.api = mock_analytics_api
        
        conversion_data = service.get_conversion_data(
            start_date=datetime.now() - timedelta(days=7),
            end_date=datetime.now()
        )
        
        assert conversion_data["conversion_rate"] == 0.025
        assert conversion_data["cart_abandonment_rate"] == 0.7
    
    def test_get_custom_events(self, mock_analytics_api, mock_cache_manager, mock_metrics_collector):
        """Test getting custom events."""
        service = AnalyticsService(
            api_key="test_key",
            cache_manager=mock_cache_manager,
            metrics_collector=mock_metrics_collector
        )
        service.api = mock_analytics_api
        
        # Mock custom events
        mock_analytics_api.get_custom_events.return_value = [
            {
                "event_name": "add_to_cart",
                "count": 1500,
                "unique_users": 1200
            }
        ]
        
        events = service.get_custom_events(
            event_name="add_to_cart",
            start_date=datetime.now() - timedelta(days=7),
            end_date=datetime.now()
        )
        
        assert len(events) == 1
        assert events[0]["event_name"] == "add_to_cart"
        assert events[0]["count"] == 1500

class TestEmailService:
    """Tests for EmailService."""
    
    def test_get_campaign_metrics(self, mock_email_api, mock_cache_manager, mock_metrics_collector):
        """Test getting campaign metrics."""
        service = EmailService(
            api_key="test_key",
            cache_manager=mock_cache_manager,
            metrics_collector=mock_metrics_collector
        )
        service.api = mock_email_api
        
        metrics = service.get_campaign_metrics(campaign_id="camp_1")
        
        assert metrics[0]["campaign_id"] == "camp_1"
        assert metrics[0]["opens"] == 5000
        assert metrics[0]["clicks"] == 500
    
    def test_get_subscriber_lists(self, mock_email_api, mock_cache_manager, mock_metrics_collector):
        """Test getting subscriber lists."""
        service = EmailService(
            api_key="test_key",
            cache_manager=mock_cache_manager,
            metrics_collector=mock_metrics_collector
        )
        service.api = mock_email_api
        
        lists = service.get_subscriber_lists()
        
        assert len(lists) == 1
        assert lists[0]["list_id"] == "list_1"
        assert lists[0]["subscribers"] == 10000
    
    def test_get_subscriber_activity(self, mock_email_api, mock_cache_manager, mock_metrics_collector):
        """Test getting subscriber activity."""
        service = EmailService(
            api_key="test_key",
            cache_manager=mock_cache_manager,
            metrics_collector=mock_metrics_collector
        )
        service.api = mock_email_api
        
        # Mock subscriber activity
        mock_email_api.get_subscriber_activity.return_value = [
            {
                "email": "test@example.com",
                "opens": 10,
                "clicks": 2,
                "purchases": 1
            }
        ]
        
        activity = service.get_subscriber_activity(email="test@example.com")
        
        assert len(activity) == 1
        assert activity[0]["email"] == "test@example.com"
        assert activity[0]["opens"] == 10
    
    @pytest.mark.asyncio
    async def test_send_campaign_async(self, mock_email_api, mock_cache_manager, mock_metrics_collector):
        """Test async campaign sending."""
        service = EmailService(
            api_key="test_key",
            cache_manager=mock_cache_manager,
            metrics_collector=mock_metrics_collector
        )
        
        # Mock async method
        mock_async_api = AsyncMock()
        mock_async_api.send_campaign.return_value = {"campaign_id": "camp_2", "status": "sent"}
        service.api = mock_async_api
        
        result = await service.send_campaign_async(
            list_id="list_1",
            subject="Test Campaign",
            content="<p>Test content</p>"
        )
        
        assert result["campaign_id"] == "camp_2"
        assert result["status"] == "sent"
