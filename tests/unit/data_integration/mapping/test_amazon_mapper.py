"""
Amazon SP-APIマッパーのテスト
"""
import pytest
from datetime import datetime, timezone
from decimal import Decimal

from src.data_integration.mapping.mappers.amazon_mapper import AmazonMapper
from src.data_integration.mapping.schema_registry import SchemaRegistry
from src.data_integration.mapping.base_mapper import MappingResult


class TestAmazonMapper:
    """Amazon SP-APIマッパーのテストクラス"""
    
    @pytest.fixture
    def schema_registry(self):
        """テスト用スキーマレジストリ"""
        registry = SchemaRegistry()
        schema = registry.create_default_schema()
        registry.register_schema(schema)
        return registry
    
    @pytest.fixture
    def mapper(self, schema_registry):
        """テスト用Amazonマッパー"""
        return AmazonMapper(schema_registry)
    
    @pytest.fixture
    def sample_product(self):
        """サンプル商品データ（Amazon SP-API形式）"""
        return {
            "asin": "B08N5WRWNW",
            "attributes": {
                "title": [{"value": "Echo Dot (4th Gen)"}],
                "brand": [{"value": "Amazon"}],
                "product_category": [{"value": "Electronics"}],
                "list_price": [{"value": {"amount": 49.99, "currency": "USD"}}],
                "description": [{"value": "Smart speaker with Alexa"}]
            },
            "identifiers": {
                "asin": "B08N5WRWNW",
                "sku": "ECHO-DOT-4",
                "ean": ["1234567890123"],
                "upc": ["123456789012"]
            },
            "offers": [{
                "merchant_fulfillment": {
                    "availability": {
                        "quantity": 50,
                        "status": "IN_STOCK"
                    }
                }
            }],
            "product_types": [{"value": "CONSUMER_ELECTRONICS"}],
            "sales_rankings": [{
                "rank": 100,
                "category": "Electronics"
            }],
            "last_updated": "2023-01-15T10:30:00Z"
        }
    
    @pytest.fixture
    def sample_order(self):
        """サンプル注文データ（Amazon SP-API形式）"""
        return {
            "AmazonOrderId": "123-4567890-1234567",
            "PurchaseDate": "2023-01-15T10:30:00Z",
            "LastUpdateDate": "2023-01-15T11:00:00Z",
            "OrderStatus": "Shipped",
            "FulfillmentChannel": "MFN",
            "SalesChannel": "Amazon.com",
            "OrderTotal": {
                "CurrencyCode": "USD",
                "Amount": "79.98"
            },
            "ShippingAddress": {
                "StateOrRegion": "CA",
                "City": "Los Angeles",
                "CountryCode": "US",
                "PostalCode": "90001"
            },
            "BuyerInfo": {
                "BuyerEmail": "buyer@example.com",
                "BuyerName": "John Doe"
            },
            "PaymentMethod": "Other",
            "PaymentMethodDetails": ["CreditCard"],
            "MarketplaceId": "ATVPDKIKX0DER",
            "ShipmentServiceLevelCategory": "Standard",
            "OrderType": "StandardOrder",
            "IsPremiumOrder": False,
            "IsPrime": True,
            "IsBusinessOrder": False
        }
    
    @pytest.fixture
    def sample_order_items(self):
        """サンプル注文アイテムデータ"""
        return [{
            "ASIN": "B08N5WRWNW",
            "OrderItemId": "12345678901234",
            "SellerSKU": "ECHO-DOT-4",
            "Title": "Echo Dot (4th Gen)",
            "QuantityOrdered": 2,
            "QuantityShipped": 2,
            "ItemPrice": {
                "CurrencyCode": "USD",
                "Amount": "39.99"
            },
            "ItemTax": {
                "CurrencyCode": "USD",
                "Amount": "3.60"
            },
            "ShippingPrice": {
                "CurrencyCode": "USD",
                "Amount": "0.00"
            },
            "ShippingTax": {
                "CurrencyCode": "USD",
                "Amount": "0.00"
            }
        }]
    
    @pytest.fixture
    def sample_customer(self):
        """サンプル顧客データ（バイヤー情報）"""
        return {
            "buyer_id": "ABCDEFGH123456",
            "buyer_email": "buyer@example.com",
            "buyer_name": "John Doe",
            "is_prime_member": True,
            "purchase_history": {
                "total_orders": 25,
                "total_spent": 1250.50,
                "first_purchase_date": "2020-01-01T00:00:00Z",
                "last_purchase_date": "2023-01-15T10:30:00Z"
            },
            "shipping_addresses": [{
                "address_id": "ADDR001",
                "is_default": True,
                "country_code": "US",
                "state_or_region": "CA",
                "city": "Los Angeles",
                "postal_code": "90001"
            }]
        }
    
    def test_mapper_initialization(self, mapper):
        """マッパー初期化のテスト"""
        assert mapper.data_source == "amazon"
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
        assert mapped_product["external_id"] == "B08N5WRWNW"
        assert mapped_product["name"] == "Echo Dot (4th Gen)"
        assert mapped_product["brand"] == "Amazon"
        assert mapped_product["category"] == "家電"  # 正規化されている
        assert mapped_product["price"] == Decimal("49.99")
        assert mapped_product["sku"] == "ECHO-DOT-4"
        assert mapped_product["inventory_quantity"] == 50
        assert mapped_product["status"] == "active"
        assert mapped_product["data_source"] == "amazon"
    
    @pytest.mark.asyncio
    async def test_map_orders(self, mapper, sample_order, sample_order_items):
        """注文マッピングのテスト"""
        # Amazon注文では通常、注文とアイテムを組み合わせて処理
        sample_order["OrderItems"] = sample_order_items
        result = await mapper.map_orders([sample_order])
        
        assert result.total_records == 1
        assert result.successful_records == 1
        
        mapped_order = result.mapped_data[0]
        assert mapped_order["external_id"] == "123-4567890-1234567"
        assert mapped_order["order_number"] == "123-4567890-1234567"
        assert mapped_order["total_amount"] == Decimal("79.98")
        assert mapped_order["currency"] == "USD"
        assert mapped_order["customer_email"] == "buyer@example.com"
        assert mapped_order["customer_name"] == "John Doe"
        assert mapped_order["payment_status"] == "completed"  # Shippedは支払い済み
        assert mapped_order["fulfillment_status"] == "shipped"
        assert mapped_order["shipping_country"] == "US"
        assert mapped_order["shipping_province"] == "CA"
        assert mapped_order["shipping_city"] == "Los Angeles"
        assert mapped_order["shipping_zip"] == "90001"
        assert mapped_order["is_prime"] == True
        assert mapped_order["marketplace_id"] == "ATVPDKIKX0DER"
    
    @pytest.mark.asyncio
    async def test_map_customers(self, mapper, sample_customer):
        """顧客マッピングのテスト"""
        result = await mapper.map_customers([sample_customer])
        
        assert result.total_records == 1
        assert result.successful_records == 1
        
        mapped_customer = result.mapped_data[0]
        assert mapped_customer["external_id"] == "ABCDEFGH123456"
        assert mapped_customer["email"] == "buyer@example.com"
        assert mapped_customer["first_name"] == "John"
        assert mapped_customer["last_name"] == "Doe"
        assert mapped_customer["total_orders"] == 25
        assert mapped_customer["total_spent"] == Decimal("1250.50")
        assert mapped_customer["is_prime_member"] == True
        assert mapped_customer["country"] == "US"
        assert mapped_customer["province"] == "CA"
        assert mapped_customer["city"] == "Los Angeles"
        assert mapped_customer["zip"] == "90001"
    
    def test_extract_attribute_value(self, mapper):
        """属性値抽出のテスト"""
        # 通常の属性
        attr = [{"value": "Test Value"}]
        assert mapper._extract_attribute_value(attr) == "Test Value"
        
        # ネストした値
        price_attr = [{"value": {"amount": 49.99, "currency": "USD"}}]
        result = mapper._extract_attribute_value(price_attr)
        assert result["amount"] == 49.99
        assert result["currency"] == "USD"
        
        # 空リスト
        assert mapper._extract_attribute_value([]) is None
        
        # null値
        assert mapper._extract_attribute_value(None) is None
    
    def test_parse_amazon_date(self, mapper):
        """Amazon日付パースのテスト"""
        # ISO形式
        date1 = mapper._parse_amazon_date("2023-01-15T10:30:00Z")
        assert isinstance(date1, datetime)
        assert date1.tzinfo is not None
        
        # 無効な日付
        date2 = mapper._parse_amazon_date("invalid")
        assert date2 is None
        
        # null値
        date3 = mapper._parse_amazon_date(None)
        assert date3 is None
    
    def test_normalize_order_status(self, mapper):
        """注文ステータス正規化のテスト"""
        assert mapper._normalize_order_status("Shipped") == "shipped"
        assert mapper._normalize_order_status("Pending") == "pending"
        assert mapper._normalize_order_status("Canceled") == "cancelled"
        assert mapper._normalize_order_status("Unshipped") == "processing"
        assert mapper._normalize_order_status("Unknown") == "unknown"
        assert mapper._normalize_order_status(None) == "unknown"
    
    def test_normalize_category(self, mapper):
        """カテゴリ正規化のテスト"""
        assert mapper._normalize_category("Electronics") == "家電"
        assert mapper._normalize_category("CONSUMER_ELECTRONICS") == "家電"
        assert mapper._normalize_category("Books") == "書籍"
        assert mapper._normalize_category("Clothing") == "ファッション"
        assert mapper._normalize_category("Unknown") == "その他"
        assert mapper._normalize_category(None) == "その他"
    
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
            {"asin": "123"},  # 必要な属性が不足
            {"invalid": "data"}  # ASINがない
        ]
        
        result = await mapper.map_products(invalid_products)
        assert result.total_records == 2
        assert result.successful_records < 2  # 一部またはすべて失敗
        assert len(result.errors) > 0
    
    @pytest.mark.asyncio
    async def test_multi_marketplace_handling(self, mapper):
        """複数マーケットプレイス対応のテスト"""
        jp_product = {
            "asin": "B08N5WRWNW",
            "attributes": {
                "title": [{"value": "Echo Dot (第4世代)"}],
                "brand": [{"value": "Amazon"}],
                "list_price": [{"value": {"amount": 5980, "currency": "JPY"}}]
            },
            "marketplace_id": "A1VC38T7YXB528"  # 日本のマーケットプレイスID
        }
        
        result = await mapper.map_products([jp_product])
        assert result.successful_records == 1
        mapped = result.mapped_data[0]
        assert mapped["price"] == Decimal("5980")
        assert mapped["currency"] == "JPY"
        assert mapped["marketplace_id"] == "A1VC38T7YXB528"