"""
NextEngineマッパーのテスト
"""
import pytest
from datetime import datetime, timezone
from decimal import Decimal

from src.data_integration.mapping.mappers.nextengine_mapper import NextEngineMapper
from src.data_integration.mapping.schema_registry import SchemaRegistry
from src.data_integration.mapping.base_mapper import MappingResult


class TestNextEngineMapper:
    """NextEngineマッパーのテストクラス"""
    
    @pytest.fixture
    def schema_registry(self):
        """テスト用スキーマレジストリ"""
        registry = SchemaRegistry()
        schema = registry.create_default_schema()
        registry.register_schema(schema)
        return registry
    
    @pytest.fixture
    def mapper(self, schema_registry):
        """テスト用NextEngineマッパー"""
        return NextEngineMapper(schema_registry)
    
    @pytest.fixture
    def sample_product(self):
        """サンプル商品データ（NextEngine形式）"""
        return {
            "goods_id": "NE-GOODS-001",
            "goods_name": "テスト商品 NextEngine版",
            "goods_abbreviation": "テスト商品",
            "goods_type_id": "1",  # 通常商品
            "goods_type_name": "通常商品",
            "stock_management_level": "1",  # SKU単位
            "display_flag": "1",  # 表示
            "goods_status_id": "1",  # 販売中
            "goods_status_name": "販売中",
            "main_goods_id": None,  # 単品商品
            "parent_goods_id": None,
            "delivery_type": "1",  # 宅配便
            "receive_order_goods_type_id": "1",
            "stock_allocation_type": "1",
            "created_at": "2023-01-01 00:00:00",
            "updated_at": "2023-01-15 10:30:00",
            "goods_representation": [{
                "representation_id": "NE-REP-001",
                "goods_id": "NE-GOODS-001",
                "representation_code": "SKU-001",
                "representation_name": "Sサイズ/ブラック",
                "jan_code": "4901234567890",
                "supplier_goods_code": "SUP-001",
                "stock_management_target_flag": "1",
                "display_flag": "1",
                "stock_quantity": 50,
                "stock_allocation_quantity": 10,
                "free_stock_quantity": 40,
                "advance_order_quantity": 0,
                "defective_quantity": 0,
                "remaining_order_quantity": 5,
                "out_quantity": 100,
                "sales_quantity": 95,
                "last_sales_date": "2023-01-10",
                "last_upload_date": "2023-01-15",
                "created_at": "2023-01-01 00:00:00",
                "updated_at": "2023-01-15 10:30:00"
            }],
            "goods_category": [{
                "mall_id": "rakuten",
                "category_id": "cat001",
                "category_name": "ファッション > メンズ > Tシャツ"
            }],
            "goods_shop": [{
                "shop_id": "rakuten_shop",
                "mall_id": "rakuten",
                "shop_goods_id": "SHOP-GOODS-001",
                "shop_goods_name": "【楽天】テスト商品",
                "selling_price": "2980",
                "base_price": "2000",
                "tax_rate": "10",
                "currency": "JPY",
                "display_flag": "1",
                "last_update_date": "2023-01-15"
            }],
            "goods_image": [{
                "image_id": "IMG-001",
                "image_url": "https://example.com/images/product1.jpg",
                "image_type": "main",
                "display_order": 1
            }],
            "goods_tag": [
                {"tag_id": "tag001", "tag_name": "新商品"},
                {"tag_id": "tag002", "tag_name": "セール対象"}
            ]
        }
    
    @pytest.fixture
    def sample_order(self):
        """サンプル受注データ（NextEngine形式）"""
        return {
            "receive_order_id": "NE-ORDER-001",
            "shop_id": "rakuten_shop",
            "mall_id": "rakuten",
            "shop_order_id": "123456-20230115-00001",
            "order_date": "2023-01-15 10:30:00",
            "import_date": "2023-01-15 10:35:00",
            "important_check_id": "0",  # チェックなし
            "confirm_check_id": "1",  # 確認済み
            "receive_order_status_id": "40",  # 出荷済み
            "receive_order_status_name": "出荷済み",
            "payment_method_id": "1",
            "payment_method_name": "クレジットカード",
            "total_amount": "5960",
            "tax_amount": "542",
            "charge_amount": "0",
            "delivery_fee_amount": "0",
            "other_amount": "0",
            "point_amount": "100",
            "goods_amount": "5418",
            "deposit_amount": "5960",
            "deposit_type_id": "1",
            "deposit_date": "2023-01-15",
            "note": "お急ぎ便希望",
            "include_possible_order_id": None,
            "include_to_order_id": None,
            "multi_delivery_parent_order_id": None,
            "cancel_type_id": None,
            "cancel_date": None,
            "delivery_date": "2023-01-17",
            "delivery_time_zone": "14-16",
            "orderer": {
                "zip_code": "100-0001",
                "address1": "東京都千代田区",
                "address2": "千代田1-1-1",
                "name": "山田 太郎",
                "kana": "ヤマダ タロウ",
                "tel": "03-1234-5678",
                "email": "yamada@example.com"
            },
            "delivery": {
                "zip_code": "100-0001",
                "address1": "東京都千代田区",
                "address2": "千代田1-1-1",
                "name": "山田 太郎",
                "kana": "ヤマダ タロウ",
                "tel": "03-1234-5678"
            },
            "receive_order_row": [{
                "receive_order_row_id": "NE-ROW-001",
                "receive_order_id": "NE-ORDER-001",
                "goods_id": "NE-GOODS-001",
                "goods_name": "テスト商品",
                "goods_option": "Sサイズ/ブラック",
                "quantity": "2",
                "unit_price": "2709",
                "tax_rate": "10",
                "received_time_first_cost": "2000",
                "allocation_quantity": "2",
                "shipment_quantity": "2",
                "shipment_planned_date": "2023-01-16",
                "shortage_quantity": "0"
            }],
            "receive_order_shipping": [{
                "shipping_id": "SHIP-001",
                "shipping_date": "2023-01-16",
                "shipping_method_id": "1",
                "shipping_method_name": "ヤマト運輸",
                "shipping_number": "1234-5678-9012"
            }]
        }
    
    @pytest.fixture
    def sample_customer(self):
        """サンプル顧客データ（NextEngine形式）"""
        return {
            "customer_id": "NE-CUST-001",
            "customer_name": "山田 太郎",
            "customer_kana": "ヤマダ タロウ",
            "customer_zip_code": "100-0001",
            "customer_address1": "東京都千代田区",
            "customer_address2": "千代田1-1-1",
            "customer_tel": "03-1234-5678",
            "customer_mobile": "090-1234-5678",
            "customer_email": "yamada@example.com",
            "customer_sex": "1",  # 男性
            "customer_birthday": "1980-01-01",
            "customer_member_flag": "1",
            "customer_important_flag": "0",
            "customer_last_order_date": "2023-01-15",
            "customer_order_count": "15",
            "customer_order_total_amount": "150000",
            "customer_shop_member_info": [{
                "shop_id": "rakuten_shop",
                "member_id": "rakuten123456",
                "member_rank": "ゴールド",
                "point_balance": "5000",
                "last_access_date": "2023-01-14"
            }],
            "customer_note": "VIP顧客、丁寧な対応を",
            "created_at": "2020-01-01 00:00:00",
            "updated_at": "2023-01-15 10:30:00"
        }
    
    def test_mapper_initialization(self, mapper):
        """マッパー初期化のテスト"""
        assert mapper.data_source == "nextengine"
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
        assert mapped_product["external_id"] == "NE-GOODS-001"
        assert mapped_product["name"] == "テスト商品 NextEngine版"
        assert mapped_product["sku"] == "SKU-001"
        assert mapped_product["jan_code"] == "4901234567890"
        assert mapped_product["inventory_quantity"] == 50
        assert mapped_product["free_stock_quantity"] == 40
        assert mapped_product["status"] == "active"  # display_flag = 1
        assert mapped_product["category"] == "ファッション"
        assert mapped_product["price"] == Decimal("2980")
        assert mapped_product["base_price"] == Decimal("2000")
        assert mapped_product["tags"] == ["新商品", "セール対象"]
        assert mapped_product["data_source"] == "nextengine"
    
    @pytest.mark.asyncio
    async def test_map_orders(self, mapper, sample_order):
        """受注マッピングのテスト"""
        result = await mapper.map_orders([sample_order])
        
        assert result.total_records == 1
        assert result.successful_records == 1
        
        mapped_order = result.mapped_data[0]
        assert mapped_order["external_id"] == "NE-ORDER-001"
        assert mapped_order["order_number"] == "123456-20230115-00001"
        assert mapped_order["total_amount"] == Decimal("5960")
        assert mapped_order["subtotal_amount"] == Decimal("5418")
        assert mapped_order["tax_amount"] == Decimal("542")
        assert mapped_order["point_used"] == Decimal("100")
        assert mapped_order["customer_email"] == "yamada@example.com"
        assert mapped_order["customer_name"] == "山田 太郎"
        assert mapped_order["payment_status"] == "completed"  # 出荷済みは支払済み
        assert mapped_order["fulfillment_status"] == "shipped"
        assert mapped_order["payment_method"] == "クレジットカード"
        assert mapped_order["shipping_country"] == "JP"
        assert mapped_order["shipping_province"] == "東京都"
        assert mapped_order["shipping_city"] == "千代田区"
        assert mapped_order["shipping_zip"] == "100-0001"
        assert mapped_order["shipping_method"] == "ヤマト運輸"
        assert mapped_order["tracking_number"] == "1234-5678-9012"
    
    @pytest.mark.asyncio
    async def test_map_customers(self, mapper, sample_customer):
        """顧客マッピングのテスト"""
        result = await mapper.map_customers([sample_customer])
        
        assert result.total_records == 1
        assert result.successful_records == 1
        
        mapped_customer = result.mapped_data[0]
        assert mapped_customer["external_id"] == "NE-CUST-001"
        assert mapped_customer["email"] == "yamada@example.com"
        assert mapped_customer["first_name"] == "太郎"
        assert mapped_customer["last_name"] == "山田"
        assert mapped_customer["phone"] == "03-1234-5678"
        assert mapped_customer["mobile"] == "090-1234-5678"
        assert mapped_customer["total_orders"] == 15
        assert mapped_customer["total_spent"] == Decimal("150000")
        assert mapped_customer["is_member"] == True
        assert mapped_customer["country"] == "JP"
        assert mapped_customer["province"] == "東京都"
        assert mapped_customer["city"] == "千代田区"
        assert mapped_customer["zip"] == "100-0001"
        assert mapped_customer["gender"] == "男性"
        assert mapped_customer["birthday"] == "1980-01-01"
    
    def test_parse_nextengine_date(self, mapper):
        """NextEngine日付パースのテスト"""
        # 標準形式
        date1 = mapper._parse_nextengine_date("2023-01-15 10:30:00")
        assert isinstance(date1, datetime)
        
        # 日付のみ
        date2 = mapper._parse_nextengine_date("2023-01-15")
        assert isinstance(date2, datetime)
        
        # 無効な日付
        date3 = mapper._parse_nextengine_date("invalid")
        assert date3 is None
        
        # null値
        date4 = mapper._parse_nextengine_date(None)
        assert date4 is None
    
    def test_normalize_order_status(self, mapper):
        """受注ステータス正規化のテスト"""
        # 支払いステータス
        assert mapper._normalize_order_status("10") == ("pending", "pending")      # 新規受付
        assert mapper._normalize_order_status("20") == ("processing", "pending")   # 確認内容
        assert mapper._normalize_order_status("30") == ("processing", "processing") # 確認済み
        assert mapper._normalize_order_status("40") == ("completed", "shipped")    # 出荷済み
        assert mapper._normalize_order_status("50") == ("completed", "completed")  # 処理済み
        assert mapper._normalize_order_status("60") == ("cancelled", "cancelled")  # キャンセル
        assert mapper._normalize_order_status("70") == ("hold", "hold")           # 保留
        assert mapper._normalize_order_status("80") == ("refunded", "refunded")   # 返品
        assert mapper._normalize_order_status("999") == ("unknown", "unknown")
        assert mapper._normalize_order_status(None) == ("unknown", "unknown")
    
    def test_split_name(self, mapper):
        """名前分割のテスト"""
        # 通常の名前
        assert mapper._split_name("山田 太郎") == ("山田", "太郎")
        assert mapper._split_name("田中　花子") == ("田中", "花子")  # 全角スペース
        
        # スペースなし
        assert mapper._split_name("山田太郎") == ("山田太郎", "")
        
        # 複数スペース
        assert mapper._split_name("山田 太郎 次郎") == ("山田", "太郎 次郎")
        
        # 空文字
        assert mapper._split_name("") == ("", "")
        assert mapper._split_name(None) == ("", "")
    
    def test_calculate_total_stock(self, mapper):
        """在庫合計計算のテスト"""
        representations = [
            {"stock_quantity": 50, "stock_allocation_quantity": 10},
            {"stock_quantity": 30, "stock_allocation_quantity": 5},
            {"stock_quantity": 20}  # allocation_quantityなし
        ]
        
        total_stock = mapper._calculate_total_stock(representations)
        assert total_stock == 100
        
        total_free = mapper._calculate_free_stock(representations)
        assert total_free == 85  # (50-10) + (30-5) + 20
        
        # 空リスト
        assert mapper._calculate_total_stock([]) == 0
        assert mapper._calculate_free_stock([]) == 0
        
        # null値
        assert mapper._calculate_total_stock(None) == 0
        assert mapper._calculate_free_stock(None) == 0
    
    def test_normalize_goods_type(self, mapper):
        """商品タイプ正規化のテスト"""
        assert mapper._normalize_goods_type("1") == "通常商品"
        assert mapper._normalize_goods_type("2") == "セット商品"
        assert mapper._normalize_goods_type("3") == "オプション商品"
        assert mapper._normalize_goods_type("99") == "その他"
        assert mapper._normalize_goods_type(None) == "不明"
    
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
            {"goods_id": "123"},  # 必要なフィールドが不足
            {"invalid": "data"}  # goods_idがない
        ]
        
        result = await mapper.map_products(invalid_products)
        assert result.total_records == 2
        assert result.successful_records < 2  # 一部またはすべて失敗
        assert len(result.errors) > 0
    
    @pytest.mark.asyncio
    async def test_multi_shop_handling(self, mapper, sample_product):
        """複数店舗対応のテスト"""
        # 複数店舗で販売されている商品
        sample_product["goods_shop"].append({
            "shop_id": "yahoo_shop",
            "mall_id": "yahoo",
            "shop_goods_id": "YAHOO-GOODS-001",
            "shop_goods_name": "【Yahoo】テスト商品",
            "selling_price": "2780",
            "base_price": "2000",
            "display_flag": "1"
        })
        
        result = await mapper.map_products([sample_product])
        assert result.successful_records == 1
        
        mapped = result.mapped_data[0]
        # 最初の店舗の価格が使用される
        assert mapped["price"] == Decimal("2980")
        # 複数店舗情報が保存される
        assert len(mapped["shop_info"]) == 2
        assert mapped["shop_info"][0]["shop_id"] == "rakuten_shop"
        assert mapped["shop_info"][1]["shop_id"] == "yahoo_shop"