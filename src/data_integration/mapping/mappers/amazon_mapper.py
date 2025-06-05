"""
Amazon SP-APIデータマッパー
Amazon SP-APIからのデータをDWHスキーマにマッピング
"""
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone
from decimal import Decimal

from ..base_mapper import BaseDataMapper, MappingResult, MappingError
from ..schema_registry import SchemaRegistry

logger = logging.getLogger(__name__)


class AmazonMapper(BaseDataMapper):
    """Amazon SP-API データ専用マッパー"""
    
    def __init__(self, schema_registry: SchemaRegistry):
        super().__init__(schema_registry)
        self.data_source = "amazon_sp_api"
        
        # Amazon固有のフィールドマッピング定義
        self.product_mapping = {
            "ASIN": "external_id",
            "ItemName": "name",
            "ItemDescription": "description", 
            "Brand": "brand",
            "ProductGroup": "category",
            "CreatedDate": "created_at",
            "LastUpdateDate": "updated_at",
            "ItemStatus": "status",
            "Keywords": "tags"
        }
        
        self.order_mapping = {
            "AmazonOrderId": "external_id",
            "OrderNumber": "order_number",
            "PurchaseDate": "order_date",
            "LastUpdateDate": "updated_at",
            "BuyerInfo": "_customer_data",
            "OrderItems": "_line_items_data",
            "OrderTotal": "total_amount",
            "NumberOfItemsShipped": "items_shipped",
            "NumberOfItemsUnshipped": "items_unshipped",
            "PaymentMethod": "payment_method",
            "OrderStatus": "status",
            "FulfillmentChannel": "fulfillment_channel",
            "ShippingAddress": "_shipping_address"
        }
        
        self.customer_mapping = {
            "BuyerEmail": "email",
            "BuyerName": "name",
            "BuyerCounty": "country",
            "BuyerTaxInfo": "_tax_info"
        }

    async def map_products(self, amazon_products: List[Dict[str, Any]]) -> MappingResult:
        """Amazon商品データをDWHスキーマにマッピング"""
        try:
            mapped_products = []
            errors = []
            
            for product in amazon_products:
                try:
                    mapped_product = await self._map_single_product(product)
                    mapped_products.append(mapped_product)
                except Exception as e:
                    error = MappingError(
                        field="product",
                        value=str(product.get("ASIN", "unknown")),
                        error_type="mapping_error",
                        message=str(e)
                    )
                    errors.append(error)
                    logger.error(f"Amazon商品マッピングエラー: {e}", extra={"asin": product.get("ASIN")})
            
            return MappingResult(
                mapped_data=mapped_products,
                errors=errors,
                total_records=len(amazon_products),
                successful_records=len(mapped_products)
            )
            
        except Exception as e:
            logger.error(f"Amazon商品マッピング処理エラー: {e}")
            raise

    async def _map_single_product(self, product: Dict[str, Any]) -> Dict[str, Any]:
        """単一商品のマッピング処理"""
        mapped = self._apply_field_mapping(product, self.product_mapping)
        
        # Amazon固有の処理
        mapped["data_source"] = self.data_source
        mapped["created_at"] = self._parse_amazon_date(product.get("CreatedDate"))
        mapped["updated_at"] = self._parse_amazon_date(product.get("LastUpdateDate"))
        
        # 価格情報の処理（Pricing APIから取得したデータがある場合）
        pricing_info = product.get("PricingInfo", {})
        if pricing_info:
            mapped["price"] = self._parse_amazon_money(pricing_info.get("ListPrice"))
            
        # 在庫情報の処理（Inventory APIから取得したデータがある場合）
        inventory_info = product.get("InventoryInfo", {})
        if inventory_info:
            mapped["inventory_quantity"] = inventory_info.get("TotalQuantity", 0)
            
        # SKU情報
        mapped["sku"] = product.get("SellerSKU", "")
        
        # カテゴリの正規化
        if mapped.get("category"):
            mapped["category"] = self._normalize_amazon_category(mapped["category"])
            
        # キーワードをタグとして処理
        if mapped.get("tags"):
            mapped["tags"] = self._process_amazon_keywords(mapped["tags"])
            
        # ステータスの正規化
        mapped["status"] = self._normalize_amazon_status(product.get("ItemStatus"))
        
        return mapped

    async def map_orders(self, amazon_orders: List[Dict[str, Any]]) -> MappingResult:
        """Amazon注文データをDWHスキーマにマッピング"""
        try:
            mapped_orders = []
            errors = []
            
            for order in amazon_orders:
                try:
                    mapped_order = await self._map_single_order(order)
                    mapped_orders.append(mapped_order)
                except Exception as e:
                    error = MappingError(
                        field="order",
                        value=str(order.get("AmazonOrderId", "unknown")),
                        error_type="mapping_error",
                        message=str(e)
                    )
                    errors.append(error)
                    logger.error(f"Amazon注文マッピングエラー: {e}", extra={"order_id": order.get("AmazonOrderId")})
            
            return MappingResult(
                mapped_data=mapped_orders,
                errors=errors,
                total_records=len(amazon_orders),
                successful_records=len(mapped_orders)
            )
            
        except Exception as e:
            logger.error(f"Amazon注文マッピング処理エラー: {e}")
            raise

    async def _map_single_order(self, order: Dict[str, Any]) -> Dict[str, Any]:
        """単一注文のマッピング処理"""
        mapped = self._apply_field_mapping(order, self.order_mapping)
        
        # Amazon固有の処理
        mapped["data_source"] = self.data_source
        mapped["order_date"] = self._parse_amazon_date(order.get("PurchaseDate"))
        mapped["updated_at"] = self._parse_amazon_date(order.get("LastUpdateDate"))
        
        # 金額の処理
        order_total = order.get("OrderTotal", {})
        if order_total:
            mapped["total_amount"] = self._parse_amazon_money(order_total)
            mapped["currency"] = order_total.get("CurrencyCode", "USD")
            
        # 顧客情報の処理
        buyer_info = order.get("BuyerInfo", {})
        if buyer_info:
            mapped["customer_email"] = buyer_info.get("BuyerEmail")
            mapped["customer_name"] = buyer_info.get("BuyerName")
            
        # 配送先住所の処理
        shipping_address = order.get("ShippingAddress", {})
        if shipping_address:
            mapped["shipping_country"] = shipping_address.get("CountryCode")
            mapped["shipping_province"] = shipping_address.get("StateOrRegion")
            mapped["shipping_city"] = shipping_address.get("City")
            mapped["shipping_zip"] = shipping_address.get("PostalCode")
            
        # ステータスの正規化
        mapped["payment_status"] = self._normalize_amazon_payment_status(order.get("OrderStatus"))
        mapped["fulfillment_status"] = self._normalize_amazon_fulfillment_status(order.get("FulfillmentChannel"))
        
        # 配送情報
        mapped["fulfillment_channel"] = order.get("FulfillmentChannel", "")
        mapped["is_business_order"] = order.get("IsBusinessOrder", False)
        mapped["is_prime"] = order.get("IsPrime", False)
        
        return mapped

    async def map_customers(self, amazon_customers: List[Dict[str, Any]]) -> MappingResult:
        """Amazon顧客データをDWHスキーマにマッピング"""
        try:
            mapped_customers = []
            errors = []
            
            for customer in amazon_customers:
                try:
                    mapped_customer = await self._map_single_customer(customer)
                    mapped_customers.append(mapped_customer)
                except Exception as e:
                    error = MappingError(
                        field="customer",
                        value=str(customer.get("BuyerEmail", "unknown")),
                        error_type="mapping_error",
                        message=str(e)
                    )
                    errors.append(error)
                    logger.error(f"Amazon顧客マッピングエラー: {e}", extra={"customer_email": customer.get("BuyerEmail")})
            
            return MappingResult(
                mapped_data=mapped_customers,
                errors=errors,
                total_records=len(amazon_customers),
                successful_records=len(mapped_customers)
            )
            
        except Exception as e:
            logger.error(f"Amazon顧客マッピング処理エラー: {e}")
            raise

    async def _map_single_customer(self, customer: Dict[str, Any]) -> Dict[str, Any]:
        """単一顧客のマッピング処理"""
        mapped = self._apply_field_mapping(customer, self.customer_mapping)
        
        # Amazon固有の処理
        mapped["data_source"] = self.data_source
        mapped["external_id"] = customer.get("BuyerEmail")  # AmazonではEmailをIDとして使用
        
        # 名前の分割
        full_name = customer.get("BuyerName", "")
        if full_name:
            name_parts = full_name.split(" ", 1)
            mapped["first_name"] = name_parts[0] if len(name_parts) > 0 else ""
            mapped["last_name"] = name_parts[1] if len(name_parts) > 1 else ""
        
        return mapped

    def _parse_amazon_date(self, date_str: Optional[str]) -> Optional[datetime]:
        """Amazon日付文字列をdatetimeに変換"""
        if not date_str:
            return None
            
        try:
            # Amazon形式: "2023-01-15T10:30:00.000Z" or "2023-01-15T10:30:00Z"
            if date_str.endswith('Z'):
                date_str = date_str[:-1] + '+00:00'
            return datetime.fromisoformat(date_str)
        except ValueError:
            logger.warning(f"Amazon日付解析エラー: {date_str}")
            return None

    def _parse_amazon_money(self, money_obj: Optional[Dict[str, Any]]) -> Optional[Decimal]:
        """Amazon Money オブジェクトをDecimalに変換"""
        if not money_obj or not isinstance(money_obj, dict):
            return None
            
        amount = money_obj.get("Amount")
        if amount is not None:
            try:
                return Decimal(str(amount))
            except (ValueError, TypeError):
                logger.warning(f"Amazon金額変換エラー: {amount}")
                
        return None

    def _normalize_amazon_category(self, category: str) -> str:
        """Amazonカテゴリ名の正規化"""
        if not category:
            return "その他"
            
        # Amazon固有のカテゴリマッピング
        category_mapping = {
            "Books": "書籍",
            "Electronics": "電子機器",
            "Clothing": "衣類",
            "Home": "ホーム・キッチン",
            "Sports": "スポーツ・アウトドア",
            "Toys": "おもちゃ"
        }
        
        return category_mapping.get(category, category)

    def _normalize_amazon_status(self, status: Optional[str]) -> str:
        """Amazon商品ステータスの正規化"""
        if not status:
            return "active"
            
        status_mapping = {
            "Active": "active",
            "Inactive": "inactive", 
            "Incomplete": "draft"
        }
        
        return status_mapping.get(status, "active")

    def _normalize_amazon_payment_status(self, order_status: Optional[str]) -> str:
        """Amazon注文ステータスから支払いステータスを推定"""
        if not order_status:
            return "unknown"
            
        status_mapping = {
            "Pending": "pending",
            "Unshipped": "completed",
            "PartiallyShipped": "completed",
            "Shipped": "completed",
            "Canceled": "cancelled",
            "Unfulfillable": "failed"
        }
        
        return status_mapping.get(order_status, "unknown")

    def _normalize_amazon_fulfillment_status(self, fulfillment_channel: Optional[str]) -> str:
        """Amazon配送チャネルから配送ステータスを推定"""
        if not fulfillment_channel:
            return "unfulfilled"
            
        # AmazonはFBA (Fulfillment by Amazon) かMFN (Merchant Fulfilled Network)
        if fulfillment_channel == "AFN":  # Amazon Fulfillment Network (FBA)
            return "amazon_fulfillment"
        elif fulfillment_channel == "MFN":  # Merchant Fulfillment Network
            return "merchant_fulfillment"
        else:
            return "unfulfilled"

    def _process_amazon_keywords(self, keywords: str) -> List[str]:
        """Amazonキーワード文字列をタグリストに変換"""
        if not keywords:
            return []
            
        # キーワードはスペースまたはカンマ区切り
        import re
        tags = re.split(r'[,\s]+', keywords)
        return [tag.strip() for tag in tags if tag.strip()]

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