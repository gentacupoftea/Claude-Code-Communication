"""Tests for background tasks."""

import pytest
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime, timedelta
import asyncio

from src.data_integration.tasks.sync_tasks import SyncTasks
from src.data_integration.tasks.analytics_tasks import AnalyticsTasks
from src.data_integration.tasks.scheduler import TaskScheduler

class TestSyncTasks:
    """Tests for SyncTasks."""
    
    @pytest.mark.asyncio
    async def test_sync_shopify_data(self, mock_shopify_api, mock_cache_manager, mock_metrics_collector):
        """Test Shopify data sync task."""
        sync_tasks = SyncTasks(
            shopify_service=Mock(),
            analytics_service=Mock(),
            email_service=Mock(),
            cache_manager=mock_cache_manager,
            metrics_collector=mock_metrics_collector
        )
        
        # Mock the services
        sync_tasks.shopify_service.get_products = AsyncMock(return_value=mock_shopify_api.get_products())
        sync_tasks.shopify_service.get_orders = AsyncMock(return_value=mock_shopify_api.get_orders())
        sync_tasks.shopify_service.get_customers = AsyncMock(return_value=mock_shopify_api.get_customers())
        
        result = await sync_tasks.sync_shopify_data(store_domain="test.myshopify.com")
        
        assert result["status"] == "success"
        assert "products_synced" in result
        assert "orders_synced" in result
        assert "customers_synced" in result
    
    @pytest.mark.asyncio
    async def test_sync_analytics_data(self, mock_analytics_api, mock_cache_manager, mock_metrics_collector):
        """Test analytics data sync task."""
        sync_tasks = SyncTasks(
            shopify_service=Mock(),
            analytics_service=Mock(),
            email_service=Mock(),
            cache_manager=mock_cache_manager,
            metrics_collector=mock_metrics_collector
        )
        
        # Mock the analytics service
        sync_tasks.analytics_service.get_page_views = AsyncMock(return_value=mock_analytics_api.get_page_views())
        sync_tasks.analytics_service.get_conversion_data = AsyncMock(return_value=mock_analytics_api.get_conversion_data())
        
        result = await sync_tasks.sync_analytics_data(store_domain="test.myshopify.com")
        
        assert result["status"] == "success"
        assert "page_views_synced" in result
        assert "conversion_data_synced" in result
    
    @pytest.mark.asyncio
    async def test_sync_email_data(self, mock_email_api, mock_cache_manager, mock_metrics_collector):
        """Test email data sync task."""
        sync_tasks = SyncTasks(
            shopify_service=Mock(),
            analytics_service=Mock(),
            email_service=Mock(),
            cache_manager=mock_cache_manager,
            metrics_collector=mock_metrics_collector
        )
        
        # Mock the email service
        sync_tasks.email_service.get_campaign_metrics = AsyncMock(return_value=mock_email_api.get_campaign_metrics())
        sync_tasks.email_service.get_subscriber_lists = AsyncMock(return_value=mock_email_api.get_subscriber_lists())
        
        result = await sync_tasks.sync_email_data(store_domain="test.myshopify.com")
        
        assert result["status"] == "success"
        assert "campaigns_synced" in result
        assert "lists_synced" in result
    
    @pytest.mark.asyncio
    async def test_full_sync(self, mock_shopify_api, mock_analytics_api, mock_email_api, mock_cache_manager, mock_metrics_collector):
        """Test full data sync."""
        sync_tasks = SyncTasks(
            shopify_service=Mock(),
            analytics_service=Mock(),
            email_service=Mock(),
            cache_manager=mock_cache_manager,
            metrics_collector=mock_metrics_collector
        )
        
        # Mock all services
        sync_tasks.shopify_service.get_products = AsyncMock(return_value=mock_shopify_api.get_products())
        sync_tasks.analytics_service.get_page_views = AsyncMock(return_value=mock_analytics_api.get_page_views())
        sync_tasks.email_service.get_campaign_metrics = AsyncMock(return_value=mock_email_api.get_campaign_metrics())
        
        result = await sync_tasks.full_sync(store_domain="test.myshopify.com")
        
        assert result["status"] == "success"
        assert "shopify" in result
        assert "analytics" in result
        assert "email" in result

class TestAnalyticsTasks:
    """Tests for AnalyticsTasks."""
    
    @pytest.mark.asyncio
    async def test_calculate_daily_metrics(self, sample_order_data, sample_customer_data):
        """Test daily metrics calculation."""
        analytics_tasks = AnalyticsTasks(
            analytics_engine=Mock(),
            cache_manager=Mock(),
            metrics_collector=Mock()
        )
        
        # Mock analytics engine
        analytics_tasks.analytics_engine.calculate_daily_metrics = AsyncMock(
            return_value={
                "revenue": 1000.0,
                "orders": 10,
                "average_order_value": 100.0
            }
        )
        
        result = await analytics_tasks.calculate_daily_metrics(store_domain="test.myshopify.com")
        
        assert result["status"] == "success"
        assert "metrics" in result
        assert "revenue" in result["metrics"]
    
    @pytest.mark.asyncio
    async def test_update_predictions(self, sample_customer_data):
        """Test prediction updates."""
        analytics_tasks = AnalyticsTasks(
            analytics_engine=Mock(),
            cache_manager=Mock(),
            metrics_collector=Mock()
        )
        
        # Mock predictive analytics
        analytics_tasks.analytics_engine.predictive_analytics = Mock()
        analytics_tasks.analytics_engine.predictive_analytics.predict_churn = AsyncMock(
            return_value={"cust_1": 0.1, "cust_2": 0.7}
        )
        analytics_tasks.analytics_engine.predictive_analytics.predict_ltv = AsyncMock(
            return_value={"cust_1": 500.0, "cust_2": 150.0}
        )
        
        result = await analytics_tasks.update_predictions(store_domain="test.myshopify.com")
        
        assert result["status"] == "success"
        assert "churn_predictions" in result
        assert "ltv_predictions" in result
    
    @pytest.mark.asyncio
    async def test_generate_insights(self):
        """Test insight generation."""
        analytics_tasks = AnalyticsTasks(
            analytics_engine=Mock(),
            cache_manager=Mock(),
            metrics_collector=Mock()
        )
        
        # Mock analytics engine
        analytics_tasks.analytics_engine.generate_insights = AsyncMock(
            return_value=[
                {"type": "trend", "message": "Sales up 20% this month"},
                {"type": "recommendation", "message": "Focus on email marketing"}
            ]
        )
        
        result = await analytics_tasks.generate_insights(store_domain="test.myshopify.com")
        
        assert result["status"] == "success"
        assert "insights" in result
        assert len(result["insights"]) == 2
    
    @pytest.mark.asyncio
    async def test_cleanup_old_data(self):
        """Test old data cleanup."""
        analytics_tasks = AnalyticsTasks(
            analytics_engine=Mock(),
            cache_manager=Mock(),
            metrics_collector=Mock()
        )
        
        # Mock cache cleanup
        analytics_tasks.cache_manager.clear_pattern = Mock()
        
        result = await analytics_tasks.cleanup_old_data(days_to_keep=30)
        
        assert result["status"] == "success"
        assert "cleaned_up" in result

class TestTaskScheduler:
    """Tests for TaskScheduler."""
    
    def test_schedule_task(self):
        """Test task scheduling."""
        scheduler = TaskScheduler()
        
        mock_task = Mock()
        scheduler.schedule_task(
            task_name="test_task",
            task_function=mock_task,
            schedule_type="interval",
            interval_minutes=60
        )
        
        assert "test_task" in scheduler.scheduled_tasks
        assert scheduler.scheduled_tasks["test_task"]["schedule_type"] == "interval"
    
    def test_schedule_cron_task(self):
        """Test cron task scheduling."""
        scheduler = TaskScheduler()
        
        mock_task = Mock()
        scheduler.schedule_task(
            task_name="cron_task",
            task_function=mock_task,
            schedule_type="cron",
            cron_expression="0 0 * * *"  # Daily at midnight
        )
        
        assert "cron_task" in scheduler.scheduled_tasks
        assert scheduler.scheduled_tasks["cron_task"]["schedule_type"] == "cron"
    
    @pytest.mark.asyncio
    async def test_run_scheduled_tasks(self):
        """Test running scheduled tasks."""
        scheduler = TaskScheduler()
        
        mock_task = AsyncMock(return_value={"status": "success"})
        scheduler.schedule_task(
            task_name="test_task",
            task_function=mock_task,
            schedule_type="interval",
            interval_minutes=60
        )
        
        # Override the check to run immediately
        scheduler.scheduled_tasks["test_task"]["last_run"] = datetime.now() - timedelta(minutes=61)
        
        await scheduler.run_scheduled_tasks()
        
        mock_task.assert_called_once()
    
    def test_get_task_status(self):
        """Test getting task status."""
        scheduler = TaskScheduler()
        
        mock_task = Mock()
        scheduler.schedule_task(
            task_name="test_task",
            task_function=mock_task,
            schedule_type="interval",
            interval_minutes=60
        )
        
        status = scheduler.get_task_status("test_task")
        
        assert status["name"] == "test_task"
        assert status["schedule_type"] == "interval"
        assert "last_run" in status
        assert "next_run" in status
    
    def test_cancel_task(self):
        """Test task cancellation."""
        scheduler = TaskScheduler()
        
        mock_task = Mock()
        scheduler.schedule_task(
            task_name="test_task",
            task_function=mock_task,
            schedule_type="interval",
            interval_minutes=60
        )
        
        scheduler.cancel_task("test_task")
        
        assert "test_task" not in scheduler.scheduled_tasks
    
    def test_update_task_schedule(self):
        """Test updating task schedule."""
        scheduler = TaskScheduler()
        
        mock_task = Mock()
        scheduler.schedule_task(
            task_name="test_task",
            task_function=mock_task,
            schedule_type="interval",
            interval_minutes=60
        )
        
        scheduler.update_task_schedule(
            task_name="test_task",
            interval_minutes=30
        )
        
        assert scheduler.scheduled_tasks["test_task"]["interval_minutes"] == 30
