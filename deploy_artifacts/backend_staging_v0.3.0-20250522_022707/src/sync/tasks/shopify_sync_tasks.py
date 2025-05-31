"""
Shopify同期タスク (Celery)
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

from celery import shared_task

from ...api.shopify_api import ShopifyAPI
from ..shopify_sync import ShopifySyncEngine
from ..sync_engine.models import SyncType

logger = logging.getLogger(__name__)

# グローバル同期エンジンインスタンス
# 注: 本番環境では外部から初期化する方が望ましい
_sync_engine = None

def get_sync_engine() -> ShopifySyncEngine:
    """
    同期エンジンのシングルトンインスタンスを取得
    
    Returns:
        ShopifySyncEngine インスタンス
    """
    global _sync_engine
    if _sync_engine is None:
        # ShopifyAPIの初期化
        shopify_api = ShopifyAPI()
        
        # 同期エンジンの初期化
        _sync_engine = ShopifySyncEngine(shopify_api)
        
        # ここで外部プラットフォームを登録することも可能
        # _sync_engine.register_external_api("rakuten", rakuten_api)
    
    return _sync_engine

@shared_task(name="sync.shopify.all")
def sync_all() -> Dict[str, Any]:
    """
    すべてのデータタイプの同期を実行するタスク
    
    Returns:
        同期結果
    """
    logger.info("Shopify全データ同期タスクを開始")
    
    sync_engine = get_sync_engine()
    result = sync_engine.sync_all()
    
    logger.info(f"Shopify全データ同期タスクが完了: {result['status']}")
    return result

@shared_task(name="sync.shopify.products")
def sync_products() -> Dict[str, Any]:
    """
    商品データの同期タスク
    
    Returns:
        同期結果
    """
    logger.info("Shopify商品同期タスクを開始")
    
    sync_engine = get_sync_engine()
    result = sync_engine.sync_products_only()
    
    logger.info(f"Shopify商品同期タスクが完了: {result['status']}")
    return result

@shared_task(name="sync.shopify.inventory")
def sync_inventory() -> Dict[str, Any]:
    """
    在庫データの同期タスク
    
    Returns:
        同期結果
    """
    logger.info("Shopify在庫同期タスクを開始")
    
    sync_engine = get_sync_engine()
    result = sync_engine.sync_inventory_only()
    
    logger.info(f"Shopify在庫同期タスクが完了: {result['status']}")
    return result

@shared_task(name="sync.shopify.orders")
def sync_orders(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> Dict[str, Any]:
    """
    注文データの同期タスク
    
    Args:
        start_date: 開始日時（ISO 8601形式）
        end_date: 終了日時（ISO 8601形式）
    
    Returns:
        同期結果
    """
    logger.info(f"Shopify注文同期タスクを開始 (期間: {start_date} to {end_date})")
    
    # デフォルト値として直近24時間を設定
    if not start_date:
        start_date = (datetime.now() - timedelta(days=1)).isoformat()
    
    if not end_date:
        end_date = datetime.now().isoformat()
    
    sync_engine = get_sync_engine()
    result = sync_engine.sync_orders_only()
    
    logger.info(f"Shopify注文同期タスクが完了: {result['status']}")
    return result

@shared_task(name="sync.shopify.customers")
def sync_customers() -> Dict[str, Any]:
    """
    顧客データの同期タスク
    
    Returns:
        同期結果
    """
    logger.info("Shopify顧客同期タスクを開始")
    
    sync_engine = get_sync_engine()
    result = sync_engine.sync_customers_only()
    
    logger.info(f"Shopify顧客同期タスクが完了: {result['status']}")
    return result

@shared_task(name="sync.shopify.scheduled")
def run_scheduled_sync() -> Dict[str, Any]:
    """
    スケジュールされた定期同期タスク
    
    Returns:
        同期結果
    """
    logger.info("Shopifyスケジュール同期タスクを開始")
    
    sync_engine = get_sync_engine()
    result = sync_engine.sync_all()
    
    logger.info(f"Shopifyスケジュール同期タスクが完了: {result['status']}")
    return result

@shared_task(name="sync.shopify.status")
def get_sync_status() -> Dict[str, Any]:
    """
    同期エンジンの状態を取得するタスク
    
    Returns:
        状態情報
    """
    sync_engine = get_sync_engine()
    return sync_engine.get_status()

@shared_task(name="sync.shopify.history")
def get_sync_history(limit: int = 10) -> List[Dict[str, Any]]:
    """
    同期履歴を取得するタスク
    
    Args:
        limit: 取得する履歴の最大数
    
    Returns:
        同期履歴リスト
    """
    sync_engine = get_sync_engine()
    history = sync_engine.get_history()
    
    # 最大数を制限
    return history[-limit:] if len(history) > limit else history