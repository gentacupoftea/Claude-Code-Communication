from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import asyncio
import logging
from celery import Celery
from celery.schedules import crontab

from ..services.integration_service import IntegrationService
from ..schemas.request import SyncRequest, SyncMode
from ..schemas.integration import DataSource, EntityType
from ..config import get_settings


logger = logging.getLogger(__name__)
settings = get_settings()

# Celery設定
app = Celery(
    "data_integration",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND
)


# タスクスケジュール設定
app.conf.beat_schedule = {
    "sync-orders-hourly": {
        "task": "sync_orders",
        "schedule": crontab(minute="0"),
        "args": ()
    },
    "sync-customers-daily": {
        "task": "sync_customers",
        "schedule": crontab(hour="2", minute="0"),
        "args": ()
    },
    "sync-campaigns-hourly": {
        "task": "sync_campaigns",
        "schedule": crontab(minute="30"),
        "args": ()
    },
    "sync-all-daily": {
        "task": "sync_all_data",
        "schedule": crontab(hour="0", minute="0"),
        "args": ()
    },
    "cleanup-old-data": {
        "task": "cleanup_old_data",
        "schedule": crontab(hour="3", minute="0"),
        "args": ()
    }
}


@app.task(name="sync_orders")
async def sync_orders(
    sources: Optional[List[str]] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> Dict[str, Any]:
    """
    注文データの同期タスク
    """
    logger.info("Starting order sync task")
    
    service = IntegrationService()
    
    if not sources:
        sources = [DataSource.SHOPIFY.value]
    
    if not start_date:
        start_date = datetime.now() - timedelta(hours=2)
    
    if not end_date:
        end_date = datetime.now()
    
    try:
        result = await service.sync_data(
            sources=sources,
            entity_types=[EntityType.ORDER.value],
            sync_mode=SyncMode.INCREMENTAL,
            start_date=start_date,
            end_date=end_date
        )
        
        logger.info(f"Order sync completed: {result}")
        return result
    
    except Exception as e:
        logger.error(f"Order sync failed: {str(e)}")
        raise


@app.task(name="sync_customers")
async def sync_customers(
    sources: Optional[List[str]] = None,
    full_sync: bool = False
) -> Dict[str, Any]:
    """
    顧客データの同期タスク
    """
    logger.info("Starting customer sync task")
    
    service = IntegrationService()
    
    if not sources:
        sources = [DataSource.SHOPIFY.value, DataSource.MAILCHIMP.value]
    
    try:
        # 同期期間の設定
        if full_sync:
            start_date = None
            sync_mode = SyncMode.FULL
        else:
            start_date = datetime.now() - timedelta(days=1)
            sync_mode = SyncMode.INCREMENTAL
        
        result = await service.sync_data(
            sources=sources,
            entity_types=[EntityType.CUSTOMER.value],
            sync_mode=sync_mode,
            start_date=start_date
        )
        
        logger.info(f"Customer sync completed: {result}")
        return result
    
    except Exception as e:
        logger.error(f"Customer sync failed: {str(e)}")
        raise


@app.task(name="sync_campaigns")
async def sync_campaigns(
    sources: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    キャンペーンデータの同期タスク
    """
    logger.info("Starting campaign sync task")
    
    service = IntegrationService()
    
    if not sources:
        sources = [
            DataSource.GOOGLE_ADS.value,
            DataSource.FACEBOOK_ADS.value,
            DataSource.INSTAGRAM.value
        ]
    
    try:
        result = await service.sync_data(
            sources=sources,
            entity_types=[EntityType.CAMPAIGN.value],
            sync_mode=SyncMode.INCREMENTAL,
            start_date=datetime.now() - timedelta(hours=2)
        )
        
        logger.info(f"Campaign sync completed: {result}")
        return result
    
    except Exception as e:
        logger.error(f"Campaign sync failed: {str(e)}")
        raise


@app.task(name="sync_all_data")
async def sync_all_data(
    full_sync: bool = False
) -> Dict[str, Any]:
    """
    すべてのデータを同期するデイリータスク
    """
    logger.info("Starting full data sync task")
    
    # 各同期タスクを実行
    tasks = [
        sync_orders.apply_async(),
        sync_customers.apply_async(kwargs={"full_sync": full_sync}),
        sync_campaigns.apply_async(),
        sync_products.apply_async(),
        sync_events.apply_async()
    ]
    
    # すべてのタスクが完了するのを待つ
    results = []
    for task in tasks:
        try:
            result = task.get(timeout=300)
            results.append(result)
        except Exception as e:
            logger.error(f"Task failed: {str(e)}")
            results.append({"error": str(e)})
    
    logger.info(f"Full sync completed: {results}")
    return {"results": results}


@app.task(name="sync_products")
async def sync_products(
    sources: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    商品データの同期タスク
    """
    logger.info("Starting product sync task")
    
    service = IntegrationService()
    
    if not sources:
        sources = [DataSource.SHOPIFY.value]
    
    try:
        result = await service.sync_data(
            sources=sources,
            entity_types=[EntityType.PRODUCT.value],
            sync_mode=SyncMode.INCREMENTAL,
            start_date=datetime.now() - timedelta(days=1)
        )
        
        logger.info(f"Product sync completed: {result}")
        return result
    
    except Exception as e:
        logger.error(f"Product sync failed: {str(e)}")
        raise


@app.task(name="sync_events")
async def sync_events(
    sources: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    イベントデータの同期タスク
    """
    logger.info("Starting event sync task")
    
    service = IntegrationService()
    
    if not sources:
        sources = [
            DataSource.GOOGLE_ANALYTICS.value,
            DataSource.KLAVIYO.value
        ]
    
    try:
        result = await service.sync_data(
            sources=sources,
            entity_types=[EntityType.EVENT.value],
            sync_mode=SyncMode.INCREMENTAL,
            start_date=datetime.now() - timedelta(hours=1)
        )
        
        logger.info(f"Event sync completed: {result}")
        return result
    
    except Exception as e:
        logger.error(f"Event sync failed: {str(e)}")
        raise


@app.task(name="cleanup_old_data")
async def cleanup_old_data(
    retention_days: int = 90
) -> Dict[str, Any]:
    """
    古いデータをクリーンアップするタスク
    """
    logger.info(f"Starting data cleanup task (retention: {retention_days} days)")
    
    service = IntegrationService()
    cutoff_date = datetime.now() - timedelta(days=retention_days)
    
    try:
        result = await service.cleanup_old_data(
            cutoff_date=cutoff_date,
            entity_types=[
                EntityType.EVENT.value,
                EntityType.METRIC.value
            ]
        )
        
        logger.info(f"Data cleanup completed: {result}")
        return result
    
    except Exception as e:
        logger.error(f"Data cleanup failed: {str(e)}")
        raise


@app.task(name="sync_delta")
async def sync_delta(
    entity_type: str,
    source: str,
    delta_token: Optional[str] = None
) -> Dict[str, Any]:
    """
    差分同期タスク
    """
    logger.info(f"Starting delta sync for {entity_type} from {source}")
    
    service = IntegrationService()
    
    try:
        result = await service.sync_delta(
            source=source,
            entity_type=entity_type,
            delta_token=delta_token
        )
        
        logger.info(f"Delta sync completed: {result}")
        return result
    
    except Exception as e:
        logger.error(f"Delta sync failed: {str(e)}")
        raise


@app.task(name="sync_webhook_data")
async def sync_webhook_data(
    source: str,
    event_type: str,
    payload: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Webhookデータの同期タスク
    """
    logger.info(f"Processing webhook from {source}: {event_type}")
    
    service = IntegrationService()
    
    try:
        result = await service.handle_webhook(
            source=source,
            payload=payload
        )
        
        logger.info(f"Webhook processing completed: {result}")
        return result
    
    except Exception as e:
        logger.error(f"Webhook processing failed: {str(e)}")
        raise


# ユーティリティタスク
@app.task(name="health_check")
async def health_check() -> Dict[str, Any]:
    """
    システムヘルスチェックタスク
    """
    logger.info("Running health check")
    
    service = IntegrationService()
    
    try:
        result = await service.check_health()
        
        if result["status"] != "healthy":
            logger.warning(f"Health check warning: {result}")
        else:
            logger.info("Health check passed")
        
        return result
    
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return {"status": "error", "error": str(e)}