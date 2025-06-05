"""
楽天RMS WebAPIデータマッパー
楽天RMS WebAPIからのデータをDWHスキーマにマッピング
"""
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone
from decimal import Decimal

from ..base_mapper import BaseDataMapper, MappingResult, MappingError
from ..schema_registry import SchemaRegistry

logger = logging.getLogger(__name__)


class RakutenMapper(BaseDataMapper):
    """楽天RMS WebAPI データ専用マッパー"""
    
    def __init__(self, schema_registry: SchemaRegistry):
        super().__init__(schema_registry)
        self.data_source = "rakuten_rms"
        
        # 楽天固有のフィールドマッピング定義
        self.product_mapping = {
            "managementNumber": "external_id",
            "itemName": "name",
            "catchCopy": "description",
            "itemPrice": "price",
            "genreId": "category",
            "itemInventory": "inventory_quantity",
            "displayFlag": "status",
            "tagId": "tags",
            "registDate": "created_at",
            "updateDate": "updated_at"
        }
        
        self.order_mapping = {
            "orderNumber": "external_id",
            "orderDatetime": "order_date",
            "updateDatetime": "updated_at",
            "orderProgress": "status",
            "purchaserName": "customer_name",
            "purchaserEmail": "customer_email",
            "deliveryName": "shipping_name",
            "deliveryPostCode": "shipping_zip",
            "deliveryAddress1": "shipping_address1",
            "deliveryAddress2": "shipping_address2",
            "totalPrice": "total_amount",
            "tax": "tax_amount",
            "postagePrice": "shipping_amount",
            "paymentMethod": "payment_method",
            "basketId": "_basket_data"
        }
        
        self.customer_mapping = {
            "purchaserName": "name",
            "purchaserEmail": "email",
            "purchaserPhoneNumber": "phone",
            "purchaserZipCode": "zip",
            "purchaserAddress1": "address1",
            "purchaserAddress2": "address2",
            "purchaserPrefecture": "province"
        }

    async def map_products(self, rakuten_products: List[Dict[str, Any]]) -> MappingResult:
        """楽天商品データをDWHスキーマにマッピング"""
        try:
            mapped_products = []
            errors = []
            
            for product in rakuten_products:
                try:
                    mapped_product = await self._map_single_product(product)
                    mapped_products.append(mapped_product)
                except Exception as e:
                    error = MappingError(
                        field="product",
                        value=str(product.get("managementNumber", "unknown")),
                        error_type="mapping_error",
                        message=str(e)
                    )
                    errors.append(error)
                    logger.error(f"楽天商品マッピングエラー: {e}", extra={"management_number": product.get("managementNumber")})
            
            return MappingResult(
                mapped_data=mapped_products,
                errors=errors,
                total_records=len(rakuten_products),
                successful_records=len(mapped_products)
            )
            
        except Exception as e:
            logger.error(f"楽天商品マッピング処理エラー: {e}")
            raise

    async def _map_single_product(self, product: Dict[str, Any]) -> Dict[str, Any]:
        """単一商品のマッピング処理"""
        mapped = self._apply_field_mapping(product, self.product_mapping)
        
        # 楽天固有の処理
        mapped["data_source"] = self.data_source
        mapped["created_at"] = self._parse_rakuten_date(product.get("registDate"))
        mapped["updated_at"] = self._parse_rakuten_date(product.get("updateDate"))
        
        # 価格情報の処理
        mapped["price"] = self._parse_decimal(product.get("itemPrice"))
        
        # SKU情報
        mapped["sku"] = product.get("itemUrl", "")  # 楽天では商品URLをSKUとして使用
        
        # カテゴリの処理
        genre_id = product.get("genreId")
        if genre_id:
            mapped["category"] = self._map_rakuten_genre(genre_id)
        
        # ブランド情報（メーカー名から取得）
        mapped["brand"] = product.get("maker", "")
        
        # ステータスの正規化
        display_flag = product.get("displayFlag")
        mapped["status"] = self._normalize_rakuten_status(display_flag)
        
        # タグの処理
        tag_id = product.get("tagId")
        if tag_id:
            mapped["tags"] = self._process_rakuten_tags(tag_id)
            
        # 在庫数の処理
        inventory = product.get("itemInventory", {})
        if isinstance(inventory, dict):
            mapped["inventory_quantity"] = inventory.get("normalStock", 0)
        else:
            mapped["inventory_quantity"] = int(inventory) if inventory else 0
        
        return mapped

    async def map_orders(self, rakuten_orders: List[Dict[str, Any]]) -> MappingResult:
        """楽天注文データをDWHスキーマにマッピング"""
        try:
            mapped_orders = []
            errors = []
            
            for order in rakuten_orders:
                try:
                    mapped_order = await self._map_single_order(order)
                    mapped_orders.append(mapped_order)
                except Exception as e:
                    error = MappingError(
                        field="order",
                        value=str(order.get("orderNumber", "unknown")),
                        error_type="mapping_error",
                        message=str(e)
                    )
                    errors.append(error)
                    logger.error(f"楽天注文マッピングエラー: {e}", extra={"order_number": order.get("orderNumber")})
            
            return MappingResult(
                mapped_data=mapped_orders,
                errors=errors,
                total_records=len(rakuten_orders),
                successful_records=len(mapped_orders)
            )
            
        except Exception as e:
            logger.error(f"楽天注文マッピング処理エラー: {e}")
            raise

    async def _map_single_order(self, order: Dict[str, Any]) -> Dict[str, Any]:
        """単一注文のマッピング処理"""
        mapped = self._apply_field_mapping(order, self.order_mapping)
        
        # 楽天固有の処理
        mapped["data_source"] = self.data_source
        mapped["order_date"] = self._parse_rakuten_date(order.get("orderDatetime"))
        mapped["updated_at"] = self._parse_rakuten_date(order.get("updateDatetime"))
        
        # 金額の処理
        mapped["total_amount"] = self._parse_decimal(order.get("totalPrice"))
        mapped["tax_amount"] = self._parse_decimal(order.get("tax"))
        mapped["shipping_amount"] = self._parse_decimal(order.get("postagePrice"))
        
        # 小計の計算
        total = mapped.get("total_amount", Decimal('0'))
        tax = mapped.get("tax_amount", Decimal('0'))
        shipping = mapped.get("shipping_amount", Decimal('0'))
        mapped["subtotal_amount"] = total - tax - shipping
        
        # 通貨（楽天は基本的に日本円）
        mapped["currency"] = "JPY"
        
        # 顧客情報の処理
        mapped["customer_external_id"] = order.get("purchaserEmail")  # Emailを外部IDとして使用
        
        # 配送先住所の統合
        address1 = order.get("deliveryAddress1", "")
        address2 = order.get("deliveryAddress2", "")
        mapped["shipping_address"] = f"{address1} {address2}".strip()
        mapped["shipping_country"] = "JP"  # 楽天は日本のみ
        
        # ステータスの正規化
        order_progress = order.get("orderProgress")
        mapped["payment_status"] = self._normalize_rakuten_payment_status(order_progress)
        mapped["fulfillment_status"] = self._normalize_rakuten_fulfillment_status(order_progress)
        
        # 支払い方法の正規化
        payment_method = order.get("paymentMethod")
        mapped["payment_method"] = self._normalize_rakuten_payment_method(payment_method)
        
        return mapped

    async def map_customers(self, rakuten_customers: List[Dict[str, Any]]) -> MappingResult:
        """楽天顧客データをDWHスキーマにマッピング"""
        try:
            mapped_customers = []
            errors = []
            
            for customer in rakuten_customers:
                try:
                    mapped_customer = await self._map_single_customer(customer)
                    mapped_customers.append(mapped_customer)
                except Exception as e:
                    error = MappingError(
                        field="customer",
                        value=str(customer.get("purchaserEmail", "unknown")),
                        error_type="mapping_error",
                        message=str(e)
                    )
                    errors.append(error)
                    logger.error(f"楽天顧客マッピングエラー: {e}", extra={"customer_email": customer.get("purchaserEmail")})
            
            return MappingResult(
                mapped_data=mapped_customers,
                errors=errors,
                total_records=len(rakuten_customers),
                successful_records=len(mapped_customers)
            )
            
        except Exception as e:
            logger.error(f"楽天顧客マッピング処理エラー: {e}")
            raise

    async def _map_single_customer(self, customer: Dict[str, Any]) -> Dict[str, Any]:
        """単一顧客のマッピング処理"""
        mapped = self._apply_field_mapping(customer, self.customer_mapping)
        
        # 楽天固有の処理
        mapped["data_source"] = self.data_source
        mapped["external_id"] = customer.get("purchaserEmail")
        mapped["country"] = "JP"  # 楽天は日本のみ
        
        # 名前の分割
        full_name = customer.get("purchaserName", "")
        if full_name:
            # 日本語の名前は「姓 名」の順番
            name_parts = full_name.split(" ", 1)
            mapped["last_name"] = name_parts[0] if len(name_parts) > 0 else ""
            mapped["first_name"] = name_parts[1] if len(name_parts) > 1 else ""
        
        # 住所の統合
        address1 = customer.get("purchaserAddress1", "")
        address2 = customer.get("purchaserAddress2", "")
        mapped["address"] = f"{address1} {address2}".strip()
        
        return mapped

    def _parse_rakuten_date(self, date_str: Optional[str]) -> Optional[datetime]:
        """楽天日付文字列をdatetimeに変換"""
        if not date_str:
            return None
            
        try:
            # 楽天形式: "2023-01-15 10:30:00" or "2023-01-15T10:30:00"
            if 'T' in date_str:
                return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            else:
                # スペース区切りの場合
                return datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        except ValueError:
            logger.warning(f"楽天日付解析エラー: {date_str}")
            return None

    def _map_rakuten_genre(self, genre_id: str) -> str:
        """楽天ジャンルIDをカテゴリ名にマッピング"""
        # 楽天の主要ジャンルIDマッピング（一部例）
        genre_mapping = {
            "100371": "レディースファッション",
            "101070": "メンズファッション", 
            "101241": "バッグ・小物・ブランド雑貨",
            "101590": "靴",
            "100804": "インナー・下着・ナイトウェア",
            "200162": "腕時計",
            "101378": "ジュエリー・アクセサリー",
            "101164": "食品",
            "101213": "スイーツ・お菓子",
            "101316": "水・ソフトドリンク",
            "101318": "ビール・洋酒",
            "101240": "日本酒・焼酎",
            "100227": "美容・コスメ・香水",
            "101205": "ダイエット・健康",
            "101070": "医薬品・コンタクト・介護",
            "200260": "家電",
            "101070": "TV・オーディオ・カメラ",
            "101070": "パソコン・周辺機器",
            "101070": "スマートフォン・タブレット"
        }
        
        return genre_mapping.get(genre_id, f"カテゴリ_{genre_id}")

    def _normalize_rakuten_status(self, display_flag: Any) -> str:
        """楽天表示フラグをステータスに変換"""
        if display_flag is None:
            return "draft"
            
        # 楽天の表示フラグ: 1=表示, 0=非表示
        if str(display_flag) == "1":
            return "active"
        else:
            return "inactive"

    def _normalize_rakuten_payment_status(self, order_progress: Optional[str]) -> str:
        """楽天注文進行状況から支払いステータスを推定"""
        if not order_progress:
            return "unknown"
            
        # 楽天の注文進行状況マッピング
        status_mapping = {
            "100": "pending",      # 注文確認待ち
            "200": "pending",      # 楽天処理中
            "300": "completed",    # 発送準備中
            "400": "completed",    # 変更確定待ち
            "500": "completed",    # 発送済み
            "600": "cancelled",    # 支払手続中
            "700": "cancelled",    # 発送前キャンセル
            "800": "cancelled",    # 発送後キャンセル
            "900": "cancelled"     # 返品
        }
        
        return status_mapping.get(str(order_progress), "unknown")

    def _normalize_rakuten_fulfillment_status(self, order_progress: Optional[str]) -> str:
        """楽天注文進行状況から配送ステータスを推定"""
        if not order_progress:
            return "unfulfilled"
            
        # 楽天の注文進行状況から配送ステータスをマッピング
        status_mapping = {
            "100": "unfulfilled",    # 注文確認待ち
            "200": "unfulfilled",    # 楽天処理中
            "300": "preparing",      # 発送準備中
            "400": "preparing",      # 変更確定待ち
            "500": "shipped",        # 発送済み
            "600": "unfulfilled",    # 支払手続中
            "700": "cancelled",      # 発送前キャンセル
            "800": "cancelled",      # 発送後キャンセル
            "900": "returned"        # 返品
        }
        
        return status_mapping.get(str(order_progress), "unfulfilled")

    def _normalize_rakuten_payment_method(self, payment_method: Optional[str]) -> str:
        """楽天支払い方法の正規化"""
        if not payment_method:
            return "unknown"
            
        # 楽天の支払い方法マッピング
        method_mapping = {
            "クレジットカード": "credit_card",
            "銀行振込": "bank_transfer",
            "代金引換": "cash_on_delivery",
            "楽天バンク決済": "rakuten_bank",
            "楽天Edy決済": "rakuten_edy",
            "楽天ポイント": "rakuten_points",
            "コンビニ決済": "convenience_store",
            "PayPal": "paypal",
            "後払い決済": "deferred_payment"
        }
        
        return method_mapping.get(payment_method, "other")

    def _process_rakuten_tags(self, tag_id: Any) -> List[str]:
        """楽天タグIDをタグリストに変換"""
        if not tag_id:
            return []
            
        # タグIDが複数ある場合はカンマ区切りで分割
        if isinstance(tag_id, str):
            tag_ids = [tid.strip() for tid in tag_id.split(",") if tid.strip()]
        else:
            tag_ids = [str(tag_id)]
            
        # タグIDをタグ名にマッピング（実際の実装では楽天API呼び出しが必要）
        return [f"tag_{tid}" for tid in tag_ids]

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