"""
楽天RMSマッパーのテスト
"""
import pytest
from datetime import datetime, timezone
from decimal import Decimal

from src.data_integration.mapping.mappers.rakuten_mapper import RakutenMapper
from src.data_integration.mapping.schema_registry import SchemaRegistry
from src.data_integration.mapping.base_mapper import MappingResult


class TestRakutenMapper:
    """楽天RMSマッパーのテストクラス"""
    
    @pytest.fixture
    def schema_registry(self):
        """テスト用スキーマレジストリ"""
        registry = SchemaRegistry()
        schema = registry.create_default_schema()
        registry.register_schema(schema)
        return registry
    
    @pytest.fixture
    def mapper(self, schema_registry):
        """テスト用楽天マッパー"""
        return RakutenMapper(schema_registry)
    
    @pytest.fixture
    def sample_product(self):
        """サンプル商品データ（楽天RMS形式）"""
        return {
            "itemUrl": "https://item.rakuten.co.jp/shop/item123",
            "itemNumber": "item123",
            "itemName": "テスト商品 - 楽天限定版",
            "itemPrice": 3980,
            "genreId": "123456",
            "catalogId": "cat123",
            "catalogIdExemptionReason": 0,
            "whiteBgImage": "https://image.rakuten.co.jp/shop/item123_1.jpg",
            "images": [
                {"imageUrl": "https://image.rakuten.co.jp/shop/item123_1.jpg"},
                {"imageUrl": "https://image.rakuten.co.jp/shop/item123_2.jpg"}
            ],
            "descriptionForPC": "PC用商品説明文",
            "descriptionForMobile": "モバイル用商品説明文",
            "descriptionForSmartPhone": "スマホ用商品説明文",
            "movieUrl": "",
            "options": {
                "option1": {"name": "サイズ", "values": ["S", "M", "L"]},
                "option2": {"name": "カラー", "values": ["ブラック", "ホワイト"]}
            },
            "tagIds": [1001, 1002, 1003],
            "catchCopyForPC": "【送料無料】期間限定セール中！",
            "catchCopyForMobile": "【送料無料】セール中！",
            "isIncludedTax": 1,
            "isIncludedPostage": 0,
            "isUnavailableForSearch": 0,
            "isAvailableForMobile": 1,
            "isDepot": 0,
            "detailSellType": 0,
            "releaseDate": "2023-01-15",
            "pointRate": 10,
            "pointRateStart": "2023-01-15 00:00:00",
            "pointRateEnd": "2023-12-31 23:59:59",
            "inventoryType": 1,
            "inventories": [{
                "inventoryCount": 100,
                "childNoVertical": "S",
                "childNoHorizontal": "ブラック",
                "optionNameVertical": "サイズ",
                "optionNameHorizontal": "カラー",
                "isBackorderAvailable": False
            }],
            "displayMakerContents": 1
        }
    
    @pytest.fixture
    def sample_order(self):
        """サンプル注文データ（楽天RMS形式）"""
        return {
            "orderNumber": "123456-20230115-00001",
            "orderProgress": 300,  # 発送済み
            "subStatusId": None,
            "orderDatetime": "2023-01-15 10:30:00",
            "shopOrderCfmDatetime": "2023-01-15 10:35:00",
            "orderFixDatetime": "2023-01-15 10:35:00",
            "shippingInstDatetime": "2023-01-15 14:00:00",
            "shippingCmplRptDatetime": "2023-01-15 16:00:00",
            "cancelDueDate": None,
            "deliveryDate": "2023-01-17",
            "shippingTerm": 2,
            "remarks": "お急ぎ便希望",
            "giftCheckFlag": 0,
            "severalSenderFlag": 0,
            "equalSenderFlag": 1,
            "isolatedIslandFlag": 0,
            "rakutenMemberFlag": 1,
            "carrierCode": 1001,  # ヤマト運輸
            "emailCarrierCode": 1,
            "orderType": 1,
            "reserveNumber": None,
            "reserveDeliveryCount": None,
            "cautionDisplayType": 0,
            "rakutenConfirmFlag": 0,
            "goodsPrice": 7960,
            "goodsTax": 796,
            "postagePrice": 0,
            "deliveryPrice": 0,
            "paymentCharge": 0,
            "totalPrice": 8756,
            "requestPrice": 8756,
            "couponAllTotalPrice": 0,
            "usedPoint": 0,
            "enclosureItemName1": None,
            "enclosureItemPrice1": None,
            "ordererInfo": {
                "emailAddress": "customer@example.com",
                "lastName": "山田",
                "firstName": "太郎",
                "lastNameKana": "ヤマダ",
                "firstNameKana": "タロウ",
                "phoneNumber1": "03",
                "phoneNumber2": "1234",
                "phoneNumber3": "5678",
                "zipCode1": "100",
                "zipCode2": "0001",
                "prefecture": "東京都",
                "city": "千代田区",
                "subAddress": "1-1-1"
            },
            "itemList": [{
                "itemDetailId": 1,
                "itemName": "テスト商品 - 楽天限定版",
                "itemId": 123456789,
                "itemNumber": "item123",
                "manageNumber": "SKU123-S-BLACK",
                "price": 3980,
                "units": 2,
                "includePostageFlag": 0,
                "includeTaxFlag": 1,
                "includeCashOnDeliveryPostageFlag": 0,
                "selectedChoice": "サイズ：S カラー：ブラック",
                "pointRate": 10,
                "inventoryType": 1,
                "dealFlag": 0,
                "drugFlag": 0
            }],
            "packageModel": [{
                "basketId": 123456789,
                "postagePrice": 0,
                "deliveryPrice": 0,
                "goodsTax": 796
            }]
        }
    
    @pytest.fixture
    def sample_customer(self):
        """サンプル顧客データ（楽天会員情報）"""
        return {
            "memberId": "rakuten123456",
            "emailAddress": "customer@example.com",
            "lastName": "山田",
            "firstName": "太郎",
            "lastNameKana": "ヤマダ",
            "firstNameKana": "タロウ",
            "nickname": "やまちゃん",
            "sex": 1,  # 男性
            "birthDate": "1980-01-01",
            "prefecture": "東京都",
            "phoneNumber": "03-1234-5678",
            "cellPhoneNumber": "090-1234-5678",
            "totalOrderCount": 15,
            "totalOrderAmount": 125000,
            "firstOrderDate": "2020-01-15",
            "lastOrderDate": "2023-01-15",
            "memberRank": "ゴールド",
            "pointBalance": 5000,
            "favoriteShops": ["shop123", "shop456"],
            "mailMagazineFlag": 1,
            "blackListFlag": 0
        }
    
    def test_mapper_initialization(self, mapper):
        """マッパー初期化のテスト"""
        assert mapper.data_source == "rakuten"
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
        assert mapped_product["external_id"] == "item123"
        assert mapped_product["name"] == "テスト商品 - 楽天限定版"
        assert mapped_product["price"] == Decimal("3980")
        assert mapped_product["sku"] == "item123"
        assert mapped_product["inventory_quantity"] == 100
        assert mapped_product["status"] == "active"  # isUnavailableForSearch = 0
        assert mapped_product["tags"] == ["1001", "1002", "1003"]
        assert mapped_product["data_source"] == "rakuten"
        assert mapped_product["point_rate"] == 10
        assert mapped_product["is_tax_included"] == True
        assert mapped_product["is_postage_included"] == False
    
    @pytest.mark.asyncio
    async def test_map_orders(self, mapper, sample_order):
        """注文マッピングのテスト"""
        result = await mapper.map_orders([sample_order])
        
        assert result.total_records == 1
        assert result.successful_records == 1
        
        mapped_order = result.mapped_data[0]
        assert mapped_order["external_id"] == "123456-20230115-00001"
        assert mapped_order["order_number"] == "123456-20230115-00001"
        assert mapped_order["total_amount"] == Decimal("8756")
        assert mapped_order["subtotal_amount"] == Decimal("7960")
        assert mapped_order["tax_amount"] == Decimal("796")
        assert mapped_order["customer_email"] == "customer@example.com"
        assert mapped_order["customer_name"] == "山田 太郎"
        assert mapped_order["payment_status"] == "completed"  # orderProgress = 300
        assert mapped_order["fulfillment_status"] == "shipped"
        assert mapped_order["shipping_country"] == "JP"
        assert mapped_order["shipping_province"] == "東京都"
        assert mapped_order["shipping_city"] == "千代田区"
        assert mapped_order["shipping_zip"] == "100-0001"
        assert mapped_order["is_rakuten_member"] == True
        assert mapped_order["used_points"] == 0
    
    @pytest.mark.asyncio
    async def test_map_customers(self, mapper, sample_customer):
        """顧客マッピングのテスト"""
        result = await mapper.map_customers([sample_customer])
        
        assert result.total_records == 1
        assert result.successful_records == 1
        
        mapped_customer = result.mapped_data[0]
        assert mapped_customer["external_id"] == "rakuten123456"
        assert mapped_customer["email"] == "customer@example.com"
        assert mapped_customer["first_name"] == "太郎"
        assert mapped_customer["last_name"] == "山田"
        assert mapped_customer["phone"] == "03-1234-5678"
        assert mapped_customer["total_orders"] == 15
        assert mapped_customer["total_spent"] == Decimal("125000")
        assert mapped_customer["province"] == "東京都"
        assert mapped_customer["member_rank"] == "ゴールド"
        assert mapped_customer["point_balance"] == 5000
        assert mapped_customer["newsletter_subscribed"] == True
    
    def test_parse_rakuten_date(self, mapper):
        """楽天日付パースのテスト"""
        # 標準形式
        date1 = mapper._parse_rakuten_date("2023-01-15 10:30:00")
        assert isinstance(date1, datetime)
        
        # 日付のみ
        date2 = mapper._parse_rakuten_date("2023-01-15")
        assert isinstance(date2, datetime)
        
        # 無効な日付
        date3 = mapper._parse_rakuten_date("invalid")
        assert date3 is None
        
        # null値
        date4 = mapper._parse_rakuten_date(None)
        assert date4 is None
    
    def test_normalize_order_progress(self, mapper):
        """注文進捗ステータス正規化のテスト"""
        assert mapper._normalize_order_progress(100) == ("pending", "pending")
        assert mapper._normalize_order_progress(200) == ("processing", "processing")
        assert mapper._normalize_order_progress(300) == ("completed", "shipped")
        assert mapper._normalize_order_progress(400) == ("completed", "delivered")
        assert mapper._normalize_order_progress(500) == ("completed", "completed")
        assert mapper._normalize_order_progress(700) == ("cancelled", "cancelled")
        assert mapper._normalize_order_progress(800) == ("cancelled", "cancelled")
        assert mapper._normalize_order_progress(999) == ("unknown", "unknown")
        assert mapper._normalize_order_progress(None) == ("unknown", "unknown")
    
    def test_process_inventory(self, mapper):
        """在庫データ処理のテスト"""
        inventories = [{
            "inventoryCount": 50,
            "childNoVertical": "M",
            "childNoHorizontal": "レッド"
        }, {
            "inventoryCount": 30,
            "childNoVertical": "L",
            "childNoHorizontal": "ブルー"
        }]
        
        total = mapper._calculate_total_inventory(inventories)
        assert total == 80
        
        # 空リスト
        assert mapper._calculate_total_inventory([]) == 0
        
        # null値
        assert mapper._calculate_total_inventory(None) == 0
    
    def test_format_phone_number(self, mapper):
        """電話番号フォーマットのテスト"""
        # 3パート形式
        assert mapper._format_phone_number("03", "1234", "5678") == "03-1234-5678"
        
        # 一部欠損
        assert mapper._format_phone_number("03", "1234", None) == "03-1234"
        assert mapper._format_phone_number("03", None, None) == "03"
        
        # 全てnull
        assert mapper._format_phone_number(None, None, None) == ""
        
        # 単一文字列
        assert mapper._format_phone_number("090-1234-5678") == "090-1234-5678"
    
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
            {"itemNumber": "123"},  # 必要なフィールドが不足
            {"invalid": "data"}  # itemNumberがない
        ]
        
        result = await mapper.map_products(invalid_products)
        assert result.total_records == 2
        assert result.successful_records < 2  # 一部またはすべて失敗
        assert len(result.errors) > 0
    
    @pytest.mark.asyncio
    async def test_genre_mapping(self, mapper):
        """ジャンルIDマッピングのテスト"""
        products = [
            {"itemNumber": "item1", "itemName": "商品1", "itemPrice": 1000, "genreId": "100000"},  # ファッション
            {"itemNumber": "item2", "itemName": "商品2", "itemPrice": 2000, "genreId": "200000"},  # 家電
            {"itemNumber": "item3", "itemName": "商品3", "itemPrice": 3000, "genreId": "999999"}   # 不明
        ]
        
        result = await mapper.map_products(products)
        assert result.successful_records == 3
        
        assert result.mapped_data[0]["category"] == "ファッション"
        assert result.mapped_data[1]["category"] == "家電"
        assert result.mapped_data[2]["category"] == "その他"