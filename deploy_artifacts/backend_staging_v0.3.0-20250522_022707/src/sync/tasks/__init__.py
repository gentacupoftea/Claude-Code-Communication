"""
同期タスクのCelery実装
"""

# 各タスクをインポートして使えるようにする
from .shopify_sync_tasks import (
    sync_all,
    sync_products,
    sync_inventory,
    sync_orders,
    sync_customers,
    run_scheduled_sync,
    get_sync_status,
    get_sync_history
)

__all__ = [
    'sync_all',
    'sync_products',
    'sync_inventory',
    'sync_orders',
    'sync_customers',
    'run_scheduled_sync',
    'get_sync_status',
    'get_sync_history'
]