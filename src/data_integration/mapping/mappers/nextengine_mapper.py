"""
NextEngine APIデータマッパー
NextEngine APIからのデータをDWHスキーマにマッピング
"""
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone
from decimal import Decimal

from ..base_mapper import BaseDataMapper, MappingResult, MappingError
from ..schema_registry import SchemaRegistry

logger = logging.getLogger(__name__)


class NextEngineMapper(BaseDataMapper):
    """NextEngine API データ専用マッパー"""
    
    def __init__(self, schema_registry: SchemaRegistry):
        super().__init__(schema_registry)
        self.data_source = "nextengine"
        
        # NextEngine固有のフィールドマッピング定義
        self.product_mapping = {
            "goods_id": "external_id",
            "goods_name": "name",
            "goods_memo": "description",
            "goods_tag": "tags",
            "goods_price": "price",
            "stock_quantity": "inventory_quantity",
            "goods_image_name": "image_url",
            "goods_creation_date": "created_at",
            "goods_last_modified_date": "updated_at",
            "goods_display_flag": "status"
        }
        
        self.order_mapping = {
            "receive_order_id": "external_id",
            "receive_order_shop_id": "shop_id",
            "receive_order_date": "order_date",
            "receive_order_last_modified_date": "updated_at",
            "receive_order_total_amount": "total_amount",
            "receive_order_tax_amount": "tax_amount",
            "receive_order_delivery_fee": "shipping_amount",
            "receive_order_payment_method": "payment_method",
            "receive_order_confirm_status": "status",
            "receive_order_confirm_check_id": "_confirm_check_id",
            "receive_order_buyer_name": "customer_name",
            "receive_order_buyer_name_kana": "customer_name_kana",
            "receive_order_buyer_email": "customer_email",
            "receive_order_buyer_tel": "customer_phone",
            "receive_order_delivery_name": "shipping_name",
            "receive_order_delivery_zip": "shipping_zip",
            "receive_order_delivery_address": "shipping_address"
        }
        
        self.customer_mapping = {
            "receive_order_buyer_name": "name",
            "receive_order_buyer_name_kana": "name_kana",
            "receive_order_buyer_email": "email",
            "receive_order_buyer_tel": "phone",
            "receive_order_buyer_zip": "zip",
            "receive_order_buyer_address": "address"
        }

    async def map_products(self, nextengine_products: List[Dict[str, Any]]) -> MappingResult:
        """NextEngine商品データをDWHスキーマにマッピング"""
        try:
            mapped_products = []
            errors = []
            
            for product in nextengine_products:
                try:
                    mapped_product = await self._map_single_product(product)
                    mapped_products.append(mapped_product)
                except Exception as e:
                    error = MappingError(
                        field="product",
                        value=str(product.get("goods_id", "unknown")),
                        error_type="mapping_error",
                        message=str(e)
                    )
                    errors.append(error)
                    logger.error(f"NextEngine商品マッピングエラー: {e}", extra={"goods_id": product.get("goods_id")})
            
            return MappingResult(
                mapped_data=mapped_products,
                errors=errors,
                total_records=len(nextengine_products),
                successful_records=len(mapped_products)
            )
            
        except Exception as e:
            logger.error(f"NextEngine商品マッピング処理エラー: {e}")
            raise

    async def _map_single_product(self, product: Dict[str, Any]) -> Dict[str, Any]:
        """単一商品のマッピング処理"""
        mapped = self._apply_field_mapping(product, self.product_mapping)
        
        # NextEngine固有の処理
        mapped["data_source"] = self.data_source
        mapped["created_at"] = self._parse_nextengine_date(product.get("goods_creation_date"))
        mapped["updated_at"] = self._parse_nextengine_date(product.get("goods_last_modified_date"))
        
        # 価格情報の処理
        mapped["price"] = self._parse_decimal(product.get("goods_price"))
        
        # SKU情報（NextEngineでは商品IDをSKUとして使用）
        mapped["sku"] = str(product.get("goods_id", ""))
        
        # カテゴリ情報（NextEngineの商品分類から取得）
        goods_category = product.get("goods_category_name", "")
        if goods_category:
            mapped["category"] = goods_category
        else:
            mapped["category"] = "その他"
        
        # ブランド情報（メーカー名から取得）
        mapped["brand"] = product.get("goods_maker_name", "")
        
        # ステータスの正規化
        display_flag = product.get("goods_display_flag")
        mapped["status"] = self._normalize_nextengine_status(display_flag)
        
        # タグの処理
        tags = product.get("goods_tag", "")
        if tags:
            mapped["tags"] = self._process_nextengine_tags(tags)
        
        # 画像URL
        image_name = product.get("goods_image_name")
        if image_name:
            mapped["image_url"] = self._build_image_url(image_name)
        
        return mapped

    async def map_orders(self, nextengine_orders: List[Dict[str, Any]]) -> MappingResult:
        """NextEngine注文データをDWHスキーマにマッピング"""
        try:
            mapped_orders = []
            errors = []
            
            for order in nextengine_orders:
                try:
                    mapped_order = await self._map_single_order(order)
                    mapped_orders.append(mapped_order)
                except Exception as e:
                    error = MappingError(
                        field="order",
                        value=str(order.get("receive_order_id", "unknown")),
                        error_type="mapping_error",
                        message=str(e)
                    )
                    errors.append(error)
                    logger.error(f"NextEngine注文マッピングエラー: {e}", extra={"order_id": order.get("receive_order_id")})
            
            return MappingResult(
                mapped_data=mapped_orders,
                errors=errors,
                total_records=len(nextengine_orders),
                successful_records=len(mapped_orders)
            )
            
        except Exception as e:
            logger.error(f"NextEngine注文マッピング処理エラー: {e}")
            raise

    async def _map_single_order(self, order: Dict[str, Any]) -> Dict[str, Any]:
        """単一注文のマッピング処理"""
        mapped = self._apply_field_mapping(order, self.order_mapping)
        
        # NextEngine固有の処理
        mapped["data_source"] = self.data_source
        mapped["order_date"] = self._parse_nextengine_date(order.get("receive_order_date"))
        mapped["updated_at"] = self._parse_nextengine_date(order.get("receive_order_last_modified_date"))
        
        # 金額の処理
        mapped["total_amount"] = self._parse_decimal(order.get("receive_order_total_amount"))
        mapped["tax_amount"] = self._parse_decimal(order.get("receive_order_tax_amount"))
        mapped["shipping_amount"] = self._parse_decimal(order.get("receive_order_delivery_fee"))
        
        # 小計の計算
        total = mapped.get("total_amount", Decimal('0'))
        tax = mapped.get("tax_amount", Decimal('0'))
        shipping = mapped.get("shipping_amount", Decimal('0'))
        mapped["subtotal_amount"] = total - tax - shipping
        
        # 通貨（NextEngineは基本的に日本円）
        mapped["currency"] = "JPY"
        
        # 注文番号の生成（NextEngineの受注IDから）
        receive_order_id = order.get("receive_order_id")
        if receive_order_id:
            mapped["order_number"] = f"NE{receive_order_id}"
        
        # 顧客情報の処理
        mapped["customer_external_id"] = order.get("receive_order_buyer_email")  # Emailを外部IDとして使用
        
        # 配送先住所の処理
        shipping_address = order.get("receive_order_delivery_address", "")
        mapped["shipping_address"] = shipping_address
        mapped["shipping_country"] = "JP"  # NextEngineは基本的に日本
        
        # ステータスの正規化
        confirm_status = order.get("receive_order_confirm_status")
        mapped["payment_status"] = self._normalize_nextengine_payment_status(confirm_status)
        mapped["fulfillment_status"] = self._normalize_nextengine_fulfillment_status(confirm_status)
        
        # 支払い方法の正規化
        payment_method = order.get("receive_order_payment_method")
        mapped["payment_method"] = self._normalize_nextengine_payment_method(payment_method)
        
        # ショップ情報
        mapped["shop_id"] = order.get("receive_order_shop_id", "")
        
        return mapped

    async def map_customers(self, nextengine_customers: List[Dict[str, Any]]) -> MappingResult:
        """NextEngine顧客データをDWHスキーマにマッピング"""
        try:
            mapped_customers = []
            errors = []
            
            for customer in nextengine_customers:
                try:
                    mapped_customer = await self._map_single_customer(customer)
                    mapped_customers.append(mapped_customer)
                except Exception as e:
                    error = MappingError(
                        field="customer",
                        value=str(customer.get("receive_order_buyer_email", "unknown")),
                        error_type="mapping_error",
                        message=str(e)
                    )
                    errors.append(error)
                    logger.error(f"NextEngine顧客マッピングエラー: {e}", extra={"customer_email": customer.get("receive_order_buyer_email")})
            
            return MappingResult(
                mapped_data=mapped_customers,
                errors=errors,
                total_records=len(nextengine_customers),
                successful_records=len(mapped_customers)
            )
            
        except Exception as e:
            logger.error(f"NextEngine顧客マッピング処理エラー: {e}")
            raise

    async def _map_single_customer(self, customer: Dict[str, Any]) -> Dict[str, Any]:
        """単一顧客のマッピング処理"""
        mapped = self._apply_field_mapping(customer, self.customer_mapping)
        
        # NextEngine固有の処理
        mapped["data_source"] = self.data_source
        mapped["external_id"] = customer.get("receive_order_buyer_email")
        mapped["country"] = "JP"  # NextEngineは基本的に日本
        
        # 名前の分割（カナ名前がある場合はそれも処理）
        full_name = customer.get("receive_order_buyer_name", "")
        if full_name:
            # 日本語の名前は「姓 名」の順番
            name_parts = full_name.split(" ", 1)
            mapped["last_name"] = name_parts[0] if len(name_parts) > 0 else ""
            mapped["first_name"] = name_parts[1] if len(name_parts) > 1 else ""
        
        # カナ名前の処理
        name_kana = customer.get("receive_order_buyer_name_kana", "")
        if name_kana:
            name_kana_parts = name_kana.split(" ", 1)
            mapped["last_name_kana"] = name_kana_parts[0] if len(name_kana_parts) > 0 else ""
            mapped["first_name_kana"] = name_kana_parts[1] if len(name_kana_parts) > 1 else ""
        
        return mapped

    def _parse_nextengine_date(self, date_str: Optional[str]) -> Optional[datetime]:
        """NextEngine日付文字列をdatetimeに変換"""
        if not date_str:
            return None
            
        try:
            # NextEngine形式: "2023-01-15 10:30:00" or "2023-01-15T10:30:00"
            if 'T' in date_str:
                return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            else:
                # スペース区切りの場合
                return datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        except ValueError:
            logger.warning(f"NextEngine日付解析エラー: {date_str}")
            return None

    def _normalize_nextengine_status(self, display_flag: Any) -> str:
        """NextEngine表示フラグをステータスに変換"""
        if display_flag is None:
            return "draft"
            
        # NextEngineの表示フラグ: 1=表示, 0=非表示
        if str(display_flag) == "1":
            return "active"
        else:
            return "inactive"

    def _normalize_nextengine_payment_status(self, confirm_status: Optional[str]) -> str:
        """NextEngine確認ステータスから支払いステータスを推定"""
        if not confirm_status:
            return "unknown"
            
        # NextEngineの確認ステータスマッピング
        status_mapping = {
            "1": "pending",      # 未確認
            "2": "completed",    # 確認済み
            "3": "cancelled",    # キャンセル
            "4": "pending",      # 入金待ち
            "5": "completed",    # 入金済み
            "6": "refunded",     # 返金
            "7": "partial_refund" # 一部返金
        }
        
        return status_mapping.get(str(confirm_status), "unknown")

    def _normalize_nextengine_fulfillment_status(self, confirm_status: Optional[str]) -> str:
        """NextEngine確認ステータスから配送ステータスを推定"""
        if not confirm_status:
            return "unfulfilled"
            
        # NextEngineの確認ステータスから配送ステータスをマッピング
        status_mapping = {
            "1": "unfulfilled",   # 未確認
            "2": "preparing",     # 確認済み（準備中）
            "3": "cancelled",     # キャンセル
            "4": "unfulfilled",   # 入金待ち
            "5": "preparing",     # 入金済み（準備中）
            "6": "cancelled",     # 返金
            "7": "cancelled"      # 一部返金
        }
        
        return status_mapping.get(str(confirm_status), "unfulfilled")

    def _normalize_nextengine_payment_method(self, payment_method: Optional[str]) -> str:
        """NextEngine支払い方法の正規化"""
        if not payment_method:
            return "unknown"
            
        # NextEngineの支払い方法マッピング
        method_mapping = {
            "クレジットカード": "credit_card",
            "銀行振込": "bank_transfer",
            "代金引換": "cash_on_delivery",
            "コンビニ決済": "convenience_store",
            "後払い": "deferred_payment",
            "電子マネー": "electronic_money",
            "ポイント決済": "points"
        }
        
        return method_mapping.get(payment_method, "other")

    def _process_nextengine_tags(self, tags: str) -> List[str]:
        """NextEngineタグ文字列をタグリストに変換"""
        if not tags:
            return []
            
        # タグはカンマ区切りまたはスペース区切り
        import re
        tag_list = re.split(r'[,\s]+', tags)
        return [tag.strip() for tag in tag_list if tag.strip()]

    def _build_image_url(self, image_name: str) -> str:
        """画像名からURLを構築"""
        if not image_name:
            return ""
            
        # NextEngineの画像URLパターン（実際のパターンに合わせて調整が必要）
        base_url = "https://base.next-engine.com/api_v1_system_image"
        return f"{base_url}/{image_name}"

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