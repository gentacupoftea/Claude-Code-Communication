"""
Shopifyマッパーのテスト
"""
import pytest
from datetime import datetime, timezone
from decimal import Decimal

from src.data_integration.mapping.mappers.shopify_mapper import ShopifyMapper
from src.data_integration.mapping.schema_registry import SchemaRegistry
from src.data_integration.mapping.base_mapper import MappingResult


class TestShopifyMapper:
    """Shopifyマッパーのテストクラス"""
    
    @pytest.fixture
    def schema_registry(self):
        """テスト用スキーマレジストリ"""
        registry = SchemaRegistry()
        schema = registry.create_default_schema()
        registry.register_schema(schema)
        return registry
    
    @pytest.fixture
    def mapper(self, schema_registry):
        """テスト用Shopifyマッパー"""
        return ShopifyMapper(schema_registry)
    
    @pytest.fixture
    def sample_product(self):
        """サンプル商品データ"""
        return {
            "id": "123456789",
            "title": "Test Product",
            "body_html": "<p>Product description</p>",
            "vendor": "Test Brand",
            "product_type": "T-Shirts",
            "created_at": "2023-01-15T10:30:00-05:00",
            "updated_at": "2023-01-16T14:20:00-05:00",
            "status": "active",
            "tags": "new, sale, popular",
            "variants": [
                {
                    "id": "987654321",
                    "price": "29.99",
                    "sku": "TEST-SKU-001",
                    "inventory_quantity": 100
                }
            ]
        }
    
    @pytest.fixture
    def sample_order(self):
        """サンプル注文データ"""
        return {
            "id": "ORD123456",
            "order_number": "1001",
            "created_at": "2023-01-15T10:30:00-05:00",
            "updated_at": "2023-01-15T11:00:00-05:00",
            "customer": {
                "id": "CUST123",
                "email": "test@example.com",
                "first_name": "Test",
                "last_name": "User"
            },
            "line_items": [
                {
                    "id": "LINE001",
                    "product_id": "123456789",
                    "quantity": 2,
                    "price": "29.99"
                }
            ],
            "total_price": "65.48",
            "subtotal_price": "59.98",
            "total_tax": "5.50",
            "currency": "USD",
            "financial_status": "paid",
            "fulfillment_status": "fulfilled",
            "shipping_address": {
                "country": "US",
                "province": "CA",
                "city": "San Francisco",
                "zip": "94102"
            }
        }
    
    @pytest.fixture
    def sample_customer(self):
        """サンプル顧客データ"""
        return {
            "id": "CUST123",
            "email": "test@example.com",
            "first_name": "Test",
            "last_name": "User",
            "phone": "+1-555-123-4567",
            "created_at": "2023-01-01T00:00:00Z",
            "updated_at": "2023-01-15T10:30:00Z",
            "orders_count": 5,
            "total_spent": "499.95",
            "addresses": [
                {
                    "id": "ADDR001",
                    "default": True,
                    "country": "US",
                    "province": "CA",
                    "city": "San Francisco",
                    "zip": "94102"
                }
            ],
            "tags": "vip, returning"
        }
    
    def test_mapper_initialization(self, mapper):
        """マッパー初期化のテスト"""
        assert mapper.data_source == "shopify"
        assert mapper.product_mapping is not None
        assert mapper.order_mapping is not None
        assert mapper.customer_mapping is not None
    
    @pytest.mark.asyncio
    async def test_map_products(self, mapper, sample_product):
        """商品マッピングのテスト"""
        result = await mapper.map_products([sample_product])
        
        assert isinstance(result, MappingResult)
        assert result.total_records == 1
        assert result.successful_records == 1
        assert len(result.mapped_data) == 1
        
        mapped_product = result.mapped_data[0]
        assert mapped_product["external_id"] == "123456789"
        assert mapped_product["name"] == "Test Product"
        assert mapped_product["description"] == "<p>Product description</p>"
        assert mapped_product["brand"] == "Test Brand"
        assert mapped_product["category"] == "Tシャツ"  # 正規化されている
        assert mapped_product["price"] == Decimal("29.99")
        assert mapped_product["sku"] == "TEST-SKU-001"
        assert mapped_product["inventory_quantity"] == 100
        assert mapped_product["status"] == "active"
        assert mapped_product["tags"] == ["new", "sale", "popular"]
        assert mapped_product["data_source"] == "shopify"
    
    @pytest.mark.asyncio
    async def test_map_orders(self, mapper, sample_order):
        """注文マッピングのテスト"""
        result = await mapper.map_orders([sample_order])
        
        assert result.total_records == 1
        assert result.successful_records == 1
        
        mapped_order = result.mapped_data[0]
        assert mapped_order["external_id"] == "ORD123456"
        assert mapped_order["order_number"] == "1001"
        assert mapped_order["total_amount"] == Decimal("65.48")
        assert mapped_order["subtotal_amount"] == Decimal("59.98")
        assert mapped_order["tax_amount"] == Decimal("5.50")
        assert mapped_order["currency"] == "USD"
        assert mapped_order["customer_external_id"] == "CUST123"
        assert mapped_order["customer_email"] == "test@example.com"
        assert mapped_order["customer_name"] == "Test User"
        assert mapped_order["payment_status"] == "completed"
        assert mapped_order["fulfillment_status"] == "shipped"
        assert mapped_order["shipping_country"] == "US"
        assert mapped_order["shipping_province"] == "CA"
        assert mapped_order["shipping_city"] == "San Francisco"
        assert mapped_order["shipping_zip"] == "94102"
    
    @pytest.mark.asyncio
    async def test_map_customers(self, mapper, sample_customer):
        """顧客マッピングのテスト"""
        result = await mapper.map_customers([sample_customer])
        
        assert result.total_records == 1
        assert result.successful_records == 1
        
        mapped_customer = result.mapped_data[0]
        assert mapped_customer["external_id"] == "CUST123"
        assert mapped_customer["email"] == "test@example.com"
        assert mapped_customer["first_name"] == "Test"
        assert mapped_customer["last_name"] == "User"
        assert mapped_customer["phone"] == "+1-555-123-4567"
        assert mapped_customer["total_orders"] == 5
        assert mapped_customer["total_spent"] == Decimal("499.95")
        assert mapped_customer["tags"] == ["vip", "returning"]
        assert mapped_customer["country"] == "US"
        assert mapped_customer["province"] == "CA"
        assert mapped_customer["city"] == "San Francisco"
        assert mapped_customer["zip"] == "94102"
    
    def test_parse_shopify_date(self, mapper):
        """Shopify日付パースのテスト"""
        # タイムゾーン付き
        date1 = mapper._parse_shopify_date("2023-01-15T10:30:00-05:00")
        assert isinstance(date1, datetime)
        assert date1.tzinfo is not None
        
        # Z形式
        date2 = mapper._parse_shopify_date("2023-01-15T10:30:00Z")
        assert isinstance(date2, datetime)
        assert date2.tzinfo is not None
        
        # 無効な日付
        date3 = mapper._parse_shopify_date("invalid")
        assert date3 is None
        
        # null値
        date4 = mapper._parse_shopify_date(None)
        assert date4 is None
    
    def test_parse_decimal(self, mapper):
        """Decimal変換のテスト"""
        # 文字列から
        assert mapper._parse_decimal("29.99") == Decimal("29.99")
        
        # 数値から
        assert mapper._parse_decimal(29.99) == Decimal("29.99")
        
        # null値
        assert mapper._parse_decimal(None) is None
        
        # 無効な値
        assert mapper._parse_decimal("invalid") == Decimal("0")
    
    def test_normalize_category(self, mapper):
        """カテゴリ正規化のテスト"""
        assert mapper._normalize_category("T-Shirts") == "Tシャツ"
        assert mapper._normalize_category("Accessories") == "アクセサリー"
        assert mapper._normalize_category("Unknown") == "Unknown"
        assert mapper._normalize_category("") == "その他"
        assert mapper._normalize_category(None) == "その他"
    
    def test_normalize_payment_status(self, mapper):
        """支払いステータス正規化のテスト"""
        assert mapper._normalize_payment_status("paid") == "completed"
        assert mapper._normalize_payment_status("pending") == "pending"
        assert mapper._normalize_payment_status("refunded") == "refunded"
        assert mapper._normalize_payment_status("unknown") == "unknown"
        assert mapper._normalize_payment_status(None) == "unknown"
    
    def test_process_tags(self, mapper):
        """タグ処理のテスト"""
        assert mapper._process_tags("tag1, tag2, tag3") == ["tag1", "tag2", "tag3"]
        assert mapper._process_tags("single") == ["single"]
        assert mapper._process_tags("") == []
        assert mapper._process_tags(None) == []
        assert mapper._process_tags("tag1,  , tag2") == ["tag1", "tag2"]  # 空タグは除外
    
    @pytest.mark.asyncio
    async def test_map_data_router(self, mapper, sample_product):
        """map_dataルーターメソッドのテスト"""
        # products
        result = await mapper.map_data([sample_product], "products")
        assert result.successful_records == 1
        
        # サポートされていないテーブル
        with pytest.raises(ValueError):
            await mapper.map_data([], "invalid_table")
    
    @pytest.mark.asyncio
    async def test_error_handling(self, mapper):
        """エラーハンドリングのテスト"""
        # 不正な商品データ
        invalid_products = [
            {"id": "123"},  # 必要なフィールドが不足
            {"invalid": "data"}  # IDがない
        ]
        
        result = await mapper.map_products(invalid_products)
        assert result.total_records == 2
        assert result.successful_records < 2  # 一部またはすべて失敗
        assert len(result.errors) > 0