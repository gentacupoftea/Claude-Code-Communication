"""
Shopifyデータマッパー
ShopifyAPIからのデータをDWHスキーマにマッピング
"""
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone
from decimal import Decimal

from ..base_mapper import BaseDataMapper, MappingResult, MappingError
from ..schema_registry import SchemaRegistry

logger = logging.getLogger(__name__)


class ShopifyMapper(BaseDataMapper):
    """Shopifyデータ専用マッパー"""
    
    def __init__(self, schema_registry: SchemaRegistry):
        super().__init__(schema_registry)
        self.data_source = "shopify"
        
        # Shopify固有のフィールドマッピング定義
        self.product_mapping = {
            "id": "external_id",
            "title": "name", 
            "body_html": "description",
            "vendor": "brand",
            "product_type": "category",
            "created_at": "created_at",
            "updated_at": "updated_at",
            "status": "status",
            "tags": "tags",
            "variants": "_variants_data"
        }
        
        self.order_mapping = {
            "id": "external_id",
            "order_number": "order_number",
            "created_at": "order_date",
            "updated_at": "updated_at",
            "customer": "_customer_data",
            "line_items": "_line_items_data",
            "total_price": "total_amount",
            "subtotal_price": "subtotal_amount",
            "total_tax": "tax_amount",
            "currency": "currency",
            "financial_status": "payment_status",
            "fulfillment_status": "fulfillment_status",
            "shipping_address": "_shipping_address",
            "billing_address": "_billing_address"
        }
        
        self.customer_mapping = {
            "id": "external_id",
            "email": "email",
            "first_name": "first_name",
            "last_name": "last_name",
            "phone": "phone",
            "created_at": "created_at",
            "updated_at": "updated_at",
            "orders_count": "total_orders",
            "total_spent": "total_spent",
            "addresses": "_addresses_data",
            "tags": "tags"
        }

    async def map_products(self, shopify_products: List[Dict[str, Any]]) -> MappingResult:
        """Shopify商品データをDWHスキーマにマッピング"""
        try:
            mapped_products = []
            errors = []
            
            for product in shopify_products:
                try:
                    mapped_product = await self._map_single_product(product)
                    mapped_products.append(mapped_product)
                except Exception as e:
                    error = MappingError(
                        field="product",
                        value=str(product.get("id", "unknown")),
                        error_type="mapping_error",
                        message=str(e)
                    )
                    errors.append(error)
                    logger.error(f"商品マッピングエラー: {e}", extra={"product_id": product.get("id")})
            
            return MappingResult(
                mapped_data=mapped_products,
                errors=errors,
                total_records=len(shopify_products),
                successful_records=len(mapped_products)
            )
            
        except Exception as e:
            logger.error(f"Shopify商品マッピング処理エラー: {e}")
            raise

    async def _map_single_product(self, product: Dict[str, Any]) -> Dict[str, Any]:
        """単一商品のマッピング処理"""
        mapped = self._apply_field_mapping(product, self.product_mapping)
        
        # Shopify固有の処理
        mapped["data_source"] = self.data_source
        mapped["created_at"] = self._parse_shopify_date(product.get("created_at"))
        mapped["updated_at"] = self._parse_shopify_date(product.get("updated_at"))
        
        # バリアント情報の処理
        variants = product.get("variants", [])
        if variants:
            # 最初のバリアントの価格を商品価格として使用
            first_variant = variants[0]
            mapped["price"] = self._parse_decimal(first_variant.get("price"))
            mapped["sku"] = first_variant.get("sku", "")
            mapped["inventory_quantity"] = first_variant.get("inventory_quantity", 0)
            
        # カテゴリの正規化
        if mapped.get("category"):
            mapped["category"] = self._normalize_category(mapped["category"])
            
        # タグの処理
        if mapped.get("tags"):
            mapped["tags"] = self._process_tags(mapped["tags"])
            
        return mapped

    async def map_orders(self, shopify_orders: List[Dict[str, Any]]) -> MappingResult:
        """Shopify注文データをDWHスキーマにマッピング"""
        try:
            mapped_orders = []
            errors = []
            
            for order in shopify_orders:
                try:
                    mapped_order = await self._map_single_order(order)
                    mapped_orders.append(mapped_order)
                except Exception as e:
                    error = MappingError(
                        field="order",
                        value=str(order.get("id", "unknown")),
                        error_type="mapping_error",
                        message=str(e)
                    )
                    errors.append(error)
                    logger.error(f"注文マッピングエラー: {e}", extra={"order_id": order.get("id")})
            
            return MappingResult(
                mapped_data=mapped_orders,
                errors=errors,
                total_records=len(shopify_orders),
                successful_records=len(mapped_orders)
            )
            
        except Exception as e:
            logger.error(f"Shopify注文マッピング処理エラー: {e}")
            raise

    async def _map_single_order(self, order: Dict[str, Any]) -> Dict[str, Any]:
        """単一注文のマッピング処理"""
        mapped = self._apply_field_mapping(order, self.order_mapping)
        
        # Shopify固有の処理
        mapped["data_source"] = self.data_source
        mapped["order_date"] = self._parse_shopify_date(order.get("created_at"))
        mapped["updated_at"] = self._parse_shopify_date(order.get("updated_at"))
        
        # 金額の処理
        mapped["total_amount"] = self._parse_decimal(order.get("total_price"))
        mapped["subtotal_amount"] = self._parse_decimal(order.get("subtotal_price"))
        mapped["tax_amount"] = self._parse_decimal(order.get("total_tax"))
        
        # 顧客情報の処理
        customer = order.get("customer", {})
        if customer:
            mapped["customer_external_id"] = customer.get("id")
            mapped["customer_email"] = customer.get("email")
            mapped["customer_name"] = f"{customer.get('first_name', '')} {customer.get('last_name', '')}".strip()
        
        # 配送先住所の処理
        shipping_address = order.get("shipping_address", {})
        if shipping_address:
            mapped["shipping_country"] = shipping_address.get("country")
            mapped["shipping_province"] = shipping_address.get("province")
            mapped["shipping_city"] = shipping_address.get("city")
            mapped["shipping_zip"] = shipping_address.get("zip")
            
        # ステータスの正規化
        mapped["payment_status"] = self._normalize_payment_status(order.get("financial_status"))
        mapped["fulfillment_status"] = self._normalize_fulfillment_status(order.get("fulfillment_status"))
        
        return mapped

    async def map_customers(self, shopify_customers: List[Dict[str, Any]]) -> MappingResult:
        """Shopify顧客データをDWHスキーマにマッピング"""
        try:
            mapped_customers = []
            errors = []
            
            for customer in shopify_customers:
                try:
                    mapped_customer = await self._map_single_customer(customer)
                    mapped_customers.append(mapped_customer)
                except Exception as e:
                    error = MappingError(
                        field="customer",
                        value=str(customer.get("id", "unknown")),
                        error_type="mapping_error",
                        message=str(e)
                    )
                    errors.append(error)
                    logger.error(f"顧客マッピングエラー: {e}", extra={"customer_id": customer.get("id")})
            
            return MappingResult(
                mapped_data=mapped_customers,
                errors=errors,
                total_records=len(shopify_customers),
                successful_records=len(mapped_customers)
            )
            
        except Exception as e:
            logger.error(f"Shopify顧客マッピング処理エラー: {e}")
            raise

    async def _map_single_customer(self, customer: Dict[str, Any]) -> Dict[str, Any]:
        """単一顧客のマッピング処理"""
        mapped = self._apply_field_mapping(customer, self.customer_mapping)
        
        # Shopify固有の処理
        mapped["data_source"] = self.data_source
        mapped["created_at"] = self._parse_shopify_date(customer.get("created_at"))
        mapped["updated_at"] = self._parse_shopify_date(customer.get("updated_at"))
        
        # 金額の処理
        mapped["total_spent"] = self._parse_decimal(customer.get("total_spent"))
        
        # デフォルト住所の処理
        addresses = customer.get("addresses", [])
        if addresses:
            default_address = next((addr for addr in addresses if addr.get("default")), addresses[0])
            mapped["country"] = default_address.get("country")
            mapped["province"] = default_address.get("province")
            mapped["city"] = default_address.get("city")
            mapped["zip"] = default_address.get("zip")
            
        # タグの処理
        if mapped.get("tags"):
            mapped["tags"] = self._process_tags(mapped["tags"])
            
        return mapped

    def _parse_shopify_date(self, date_str: Optional[str]) -> Optional[datetime]:
        """Shopify日付文字列をdatetimeに変換"""
        if not date_str:
            return None
            
        try:
            # Shopify形式: "2023-01-15T10:30:00-05:00"
            return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        except ValueError:
            logger.warning(f"日付解析エラー: {date_str}")
            return None

    def _parse_decimal(self, value: Any) -> Optional[Decimal]:
        """数値をDecimalに変換"""
        if value is None:
            return None
            
        try:
            return Decimal(str(value))
        except (ValueError, TypeError):
            logger.warning(f"数値変換エラー: {value}")
            return Decimal('0')

    def _normalize_category(self, category: str) -> str:
        """カテゴリ名の正規化"""
        if not category:
            return "その他"
            
        # カテゴリ名の標準化
        category = category.strip().title()
        
        # Shopify固有のカテゴリマッピング
        category_mapping = {
            "T-Shirts": "Tシャツ",
            "Accessories": "アクセサリー",
            "Home & Garden": "ホーム・ガーデン"
        }
        
        return category_mapping.get(category, category)

    def _normalize_payment_status(self, status: Optional[str]) -> str:
        """支払いステータスの正規化"""
        if not status:
            return "unknown"
            
        status_mapping = {
            "pending": "pending",
            "authorized": "authorized", 
            "partially_paid": "partial",
            "paid": "completed",
            "partially_refunded": "partial_refund",
            "refunded": "refunded",
            "voided": "cancelled"
        }
        
        return status_mapping.get(status.lower(), "unknown")

    def _normalize_fulfillment_status(self, status: Optional[str]) -> str:
        """配送ステータスの正規化"""
        if not status:
            return "unfulfilled"
            
        status_mapping = {
            "fulfilled": "shipped",
            "partial": "partial",
            "restocked": "cancelled"
        }
        
        return status_mapping.get(status.lower(), "unfulfilled")

    def _process_tags(self, tags: str) -> List[str]:
        """タグ文字列をリストに変換"""
        if not tags:
            return []
            
        # Shopifyのタグはカンマ区切りの文字列
        return [tag.strip() for tag in tags.split(",") if tag.strip()]

    async def map_data(self, source_data: List[Dict[str, Any]], table_name: str) -> MappingResult:
        """データマッピングのメインメソッド"""
        if table_name == "products":
            return await self.map_products(source_data)
        elif table_name == "orders":
            return await self.map_orders(source_data)
        elif table_name == "customers":
            return await self.map_customers(source_data)
        else:
            raise ValueError(f"サポートされていないテーブル名: {table_name}")