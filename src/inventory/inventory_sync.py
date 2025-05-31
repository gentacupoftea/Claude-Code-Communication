"""在庫同期ジョブ - Shopify APIとの在庫データ同期を管理"""
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, insert
from sqlalchemy.dialects.postgresql import insert as pg_insert

from ..api.shopify_api import ShopifyAPI
from ..models.inventory import Inventory, InventoryHistory
from ..database import get_db_session
from ..cache import get_redis_client
from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class InventorySyncJob:
    """Shopify在庫同期ジョブクラス"""
    
    def __init__(self, shopify_api: ShopifyAPI):
        self.shopify_api = shopify_api
        self.redis = get_redis_client()
        self._running = False
        
    async def sync_all_inventory(self) -> Dict[str, Any]:
        """全在庫の同期を実行"""
        logger.info("Starting full inventory sync")
        sync_result = {
            "started_at": datetime.utcnow(),
            "completed_at": None,
            "total_products": 0,
            "total_variants": 0,
            "updated_variants": 0,
            "errors": []
        }
        
        try:
            # Shopifyから全商品データを取得
            products = await self._fetch_all_products()
            sync_result["total_products"] = len(products)
            
            # 各商品の在庫を同期
            for product in products:
                try:
                    variant_count = await self._sync_product_inventory(product)
                    sync_result["total_variants"] += variant_count
                except Exception as e:
                    logger.error(f"Error syncing product {product.get('id')}: {e}")
                    sync_result["errors"].append({
                        "product_id": product.get('id'),
                        "error": str(e)
                    })
            
            sync_result["completed_at"] = datetime.utcnow()
            sync_result["duration"] = (
                sync_result["completed_at"] - sync_result["started_at"]
            ).total_seconds()
            
            # 同期結果をキャッシュに保存
            await self._cache_sync_result(sync_result)
            
            logger.info(f"Inventory sync completed: {sync_result}")
            return sync_result
            
        except Exception as e:
            logger.error(f"Inventory sync failed: {e}")
            sync_result["errors"].append({"error": str(e)})
            sync_result["completed_at"] = datetime.utcnow()
            return sync_result
    
    async def sync_specific_products(self, product_ids: List[str]) -> Dict[str, Any]:
        """特定の商品の在庫を同期"""
        logger.info(f"Syncing inventory for products: {product_ids}")
        sync_result = {
            "started_at": datetime.utcnow(),
            "product_ids": product_ids,
            "synced_variants": 0,
            "errors": []
        }
        
        for product_id in product_ids:
            try:
                product = await self._fetch_product(product_id)
                if product:
                    variant_count = await self._sync_product_inventory(product)
                    sync_result["synced_variants"] += variant_count
            except Exception as e:
                logger.error(f"Error syncing product {product_id}: {e}")
                sync_result["errors"].append({
                    "product_id": product_id,
                    "error": str(e)
                })
        
        sync_result["completed_at"] = datetime.utcnow()
        return sync_result
    
    async def _fetch_all_products(self) -> List[Dict[str, Any]]:
        """Shopifyから全商品を取得"""
        try:
            # GraphQLを使用して効率的に取得
            if self.shopify_api.use_graphql:
                return await self._fetch_products_graphql()
            else:
                return await self._fetch_products_rest()
        except Exception as e:
            logger.error(f"Failed to fetch products: {e}")
            raise
    
    async def _fetch_product(self, product_id: str) -> Optional[Dict[str, Any]]:
        """単一商品を取得"""
        try:
            if self.shopify_api.use_graphql:
                query = """
                query getProduct($id: ID!) {
                    product(id: $id) {
                        id
                        title
                        variants(first: 100) {
                            edges {
                                node {
                                    id
                                    title
                                    sku
                                    price
                                    inventoryQuantity
                                    inventoryItem {
                                        id
                                        tracked
                                    }
                                }
                            }
                        }
                    }
                }
                """
                result = await self.shopify_api._graphql_client.execute(
                    query, {"id": f"gid://shopify/Product/{product_id}"}
                )
                return result.get("data", {}).get("product")
            else:
                return self.shopify_api._make_request(
                    "GET", f"products/{product_id}.json"
                ).get("product")
        except Exception as e:
            logger.error(f"Failed to fetch product {product_id}: {e}")
            return None
    
    async def _sync_product_inventory(self, product: Dict[str, Any]) -> int:
        """商品の在庫情報を同期"""
        variant_count = 0
        
        async with get_db_session() as session:
            variants = product.get("variants", [])
            
            for variant in variants:
                try:
                    await self._sync_variant_inventory(session, product, variant)
                    variant_count += 1
                except Exception as e:
                    logger.error(
                        f"Error syncing variant {variant.get('id')}: {e}"
                    )
            
            await session.commit()
        
        return variant_count
    
    async def _sync_variant_inventory(
        self,
        session: AsyncSession,
        product: Dict[str, Any],
        variant: Dict[str, Any]
    ) -> None:
        """バリアントの在庫情報を同期"""
        variant_id = str(variant.get("id"))
        
        # 在庫情報の抽出
        inventory_data = {
            "product_id": str(product.get("id")),
            "variant_id": variant_id,
            "sku": variant.get("sku"),
            "title": f"{product.get('title')} - {variant.get('title')}",
            "available_quantity": variant.get("inventory_quantity", 0),
            "on_hand_quantity": variant.get("inventory_quantity", 0),
            "price": float(variant.get("price", 0)),
            "tracked": variant.get("inventory_management") == "shopify",
            "last_updated": datetime.utcnow()
        }
        
        # 既存レコードの確認
        stmt = select(Inventory).where(
            Inventory.variant_id == variant_id
        )
        existing = await session.execute(stmt)
        existing_inventory = existing.scalar_one_or_none()
        
        if existing_inventory:
            # 在庫量が変更された場合のみ更新
            if existing_inventory.available_quantity != inventory_data["available_quantity"]:
                # 履歴を記録
                history = InventoryHistory(
                    inventory_id=existing_inventory.id,
                    change_type="sync",
                    quantity_change=(
                        inventory_data["available_quantity"] - 
                        existing_inventory.available_quantity
                    ),
                    previous_quantity=existing_inventory.available_quantity,
                    new_quantity=inventory_data["available_quantity"],
                    reason="Shopify sync",
                    changed_by="system"
                )
                session.add(history)
                
                # 在庫情報を更新
                stmt = update(Inventory).where(
                    Inventory.id == existing_inventory.id
                ).values(**inventory_data)
                await session.execute(stmt)
        else:
            # 新規作成
            stmt = pg_insert(Inventory).values(**inventory_data)
            await session.execute(stmt)
            
            # 初期履歴を作成
            inventory_id = (
                await session.execute(
                    select(Inventory.id).where(
                        Inventory.variant_id == variant_id
                    )
                )
            ).scalar_one()
            
            history = InventoryHistory(
                inventory_id=inventory_id,
                change_type="initial",
                quantity_change=inventory_data["available_quantity"],
                previous_quantity=0,
                new_quantity=inventory_data["available_quantity"],
                reason="Initial sync",
                changed_by="system"
            )
            session.add(history)
    
    async def _cache_sync_result(self, sync_result: Dict[str, Any]) -> None:
        """同期結果をRedisにキャッシュ"""
        try:
            await self.redis.setex(
                "inventory:last_sync",
                3600,  # 1時間
                json.dumps(sync_result, default=str)
            )
        except Exception as e:
            logger.error(f"Failed to cache sync result: {e}")
    
    async def start_periodic_sync(self, interval_minutes: int = 5) -> None:
        """定期同期を開始"""
        self._running = True
        logger.info(f"Starting periodic inventory sync every {interval_minutes} minutes")
        
        while self._running:
            try:
                await self.sync_all_inventory()
            except Exception as e:
                logger.error(f"Periodic sync failed: {e}")
            
            # 次の同期まで待機
            await asyncio.sleep(interval_minutes * 60)
    
    def stop_periodic_sync(self) -> None:
        """定期同期を停止"""
        self._running = False
        logger.info("Stopping periodic inventory sync")
    
    async def _fetch_products_graphql(self) -> List[Dict[str, Any]]:
        """GraphQLで商品を取得"""
        query = """
        query getProducts($cursor: String) {
            products(first: 50, after: $cursor) {
                edges {
                    node {
                        id
                        title
                        variants(first: 100) {
                            edges {
                                node {
                                    id
                                    title
                                    sku
                                    price
                                    inventoryQuantity
                                    inventoryItem {
                                        id
                                        tracked
                                    }
                                }
                            }
                        }
                    }
                }
                pageInfo {
                    hasNextPage
                    endCursor
                }
            }
        }
        """
        
        products = []
        cursor = None
        
        while True:
            result = await self.shopify_api._graphql_client.execute(
                query, {"cursor": cursor}
            )
            
            edges = result.get("data", {}).get("products", {}).get("edges", [])
            products.extend([edge["node"] for edge in edges])
            
            page_info = result.get("data", {}).get("products", {}).get("pageInfo", {})
            if not page_info.get("hasNextPage"):
                break
            
            cursor = page_info.get("endCursor")
        
        return products
    
    async def _fetch_products_rest(self) -> List[Dict[str, Any]]:
        """REST APIで商品を取得"""
        return self.shopify_api.get_products(limit=250)