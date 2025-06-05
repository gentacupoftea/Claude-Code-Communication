"""
Google Sheetsマッパーのテスト
"""
import pytest
from datetime import datetime, timezone
from decimal import Decimal

from src.data_integration.mapping.mappers.googlesheets_mapper import GoogleSheetsMapper
from src.data_integration.mapping.schema_registry import SchemaRegistry
from src.data_integration.mapping.base_mapper import MappingResult


class TestGoogleSheetsMapper:
    """Google Sheetsマッパーのテストクラス"""
    
    @pytest.fixture
    def schema_registry(self):
        """テスト用スキーマレジストリ"""
        registry = SchemaRegistry()
        schema = registry.create_default_schema()
        registry.register_schema(schema)
        return registry
    
    @pytest.fixture
    def mapper(self, schema_registry):
        """テスト用Google Sheetsマッパー"""
        return GoogleSheetsMapper(schema_registry)
    
    @pytest.fixture
    def sample_product_rows(self):
        """サンプル商品データ（スプレッドシート行形式）"""
        return [
            # ヘッダー行
            ["商品ID", "商品名", "説明", "ブランド", "カテゴリ", "価格", "在庫数", "SKU", "ステータス", "タグ", "作成日", "更新日"],
            # データ行
            ["GS-001", "テスト商品1", "これはテスト商品です", "テストブランド", "ファッション", "2980", "100", "SKU-001", "販売中", "新商品,セール", "2023/01/01", "2023/01/15"],
            ["GS-002", "テスト商品2", "別のテスト商品", "ブランドB", "家電", "19800", "50", "SKU-002", "在庫切れ", "人気商品", "2023/01/05", "2023/01/16"],
            ["GS-003", "テスト商品3", "", "ブランドC", "書籍", "1500", "200", "SKU-003", "予約受付中", "", "2023/01/10", "2023/01/17"]
        ]
    
    @pytest.fixture
    def sample_order_rows(self):
        """サンプル注文データ（スプレッドシート行形式）"""
        return [
            # ヘッダー行
            ["注文ID", "注文番号", "注文日時", "顧客名", "顧客メール", "商品名", "数量", "単価", "小計", "税額", "送料", "合計金額", "支払方法", "支払状況", "配送状況", "配送先住所", "配送先郵便番号", "備考"],
            # データ行
            ["ORD-001", "2023011501", "2023/01/15 10:30", "山田太郎", "yamada@example.com", "テスト商品1", "2", "2980", "5960", "596", "0", "6556", "クレジットカード", "支払済み", "発送済み", "東京都千代田区1-1-1", "100-0001", "お急ぎ便"],
            ["ORD-002", "2023011502", "2023/01/15 14:20", "鈴木花子", "suzuki@example.com", "テスト商品2", "1", "19800", "19800", "1980", "500", "22280", "代引き", "未払い", "準備中", "大阪府大阪市北区2-2-2", "530-0001", ""],
            ["ORD-003", "2023011503", "2023/01/16 09:15", "田中次郎", "tanaka@example.com", "テスト商品3", "3", "1500", "4500", "450", "0", "4950", "銀行振込", "確認中", "未発送", "愛知県名古屋市中区3-3-3", "460-0001", "ギフト包装希望"]
        ]
    
    @pytest.fixture
    def sample_customer_rows(self):
        """サンプル顧客データ（スプレッドシート行形式）"""
        return [
            # ヘッダー行
            ["顧客ID", "姓", "名", "メールアドレス", "電話番号", "郵便番号", "都道府県", "市区町村", "住所", "登録日", "最終購入日", "購入回数", "購入総額", "会員ランク", "メモ"],
            # データ行
            ["CUST-001", "山田", "太郎", "yamada@example.com", "03-1234-5678", "100-0001", "東京都", "千代田区", "1-1-1", "2020/01/01", "2023/01/15", "10", "50000", "ゴールド", "VIP顧客"],
            ["CUST-002", "鈴木", "花子", "suzuki@example.com", "06-9876-5432", "530-0001", "大阪府", "大阪市北区", "2-2-2", "2021/05/15", "2023/01/15", "5", "25000", "シルバー", ""],
            ["CUST-003", "田中", "次郎", "tanaka@example.com", "052-1111-2222", "460-0001", "愛知県", "名古屋市中区", "3-3-3", "2022/10/01", "2023/01/16", "3", "15000", "ブロンズ", "新規顧客"]
        ]
    
    @pytest.fixture
    def sample_sheet_metadata(self):
        """スプレッドシートのメタデータ"""
        return {
            "spreadsheet_id": "1ABC123DEF456",
            "spreadsheet_name": "商品管理マスター",
            "sheet_name": "商品一覧",
            "sheet_id": "0",
            "last_modified": "2023-01-15T10:30:00Z",
            "row_count": 100,
            "column_count": 15
        }
    
    def test_mapper_initialization(self, mapper):
        """マッパー初期化のテスト"""
        assert mapper.data_source == "googlesheets"
        assert mapper.product_mapping is not None
        assert mapper.order_mapping is not None
        assert mapper.customer_mapping is not None
    
    @pytest.mark.asyncio
    async def test_map_products(self, mapper, sample_product_rows):
        """商品マッピングのテスト"""
        # ヘッダーとデータを分離
        headers = sample_product_rows[0]
        data_rows = sample_product_rows[1:]
        
        # 辞書形式に変換
        products = mapper._rows_to_dicts(headers, data_rows)
        
        result = await mapper.map_products(products)
        
        assert isinstance(result, MappingResult)
        assert result.total_records == 3
        assert result.successful_records == 3
        assert len(result.mapped_data) == 3
        
        # 1つ目の商品を検証
        mapped_product = result.mapped_data[0]
        assert mapped_product["external_id"] == "GS-001"
        assert mapped_product["name"] == "テスト商品1"
        assert mapped_product["description"] == "これはテスト商品です"
        assert mapped_product["brand"] == "テストブランド"
        assert mapped_product["category"] == "ファッション"
        assert mapped_product["price"] == Decimal("2980")
        assert mapped_product["sku"] == "SKU-001"
        assert mapped_product["inventory_quantity"] == 100
        assert mapped_product["status"] == "active"
        assert mapped_product["tags"] == ["新商品", "セール"]
        assert mapped_product["data_source"] == "googlesheets"
    
    @pytest.mark.asyncio
    async def test_map_orders(self, mapper, sample_order_rows):
        """注文マッピングのテスト"""
        headers = sample_order_rows[0]
        data_rows = sample_order_rows[1:]
        orders = mapper._rows_to_dicts(headers, data_rows)
        
        result = await mapper.map_orders(orders)
        
        assert result.total_records == 3
        assert result.successful_records == 3
        
        # 1つ目の注文を検証
        mapped_order = result.mapped_data[0]
        assert mapped_order["external_id"] == "ORD-001"
        assert mapped_order["order_number"] == "2023011501"
        assert mapped_order["total_amount"] == Decimal("6556")
        assert mapped_order["subtotal_amount"] == Decimal("5960")
        assert mapped_order["tax_amount"] == Decimal("596")
        assert mapped_order["shipping_amount"] == Decimal("0")
        assert mapped_order["customer_email"] == "yamada@example.com"
        assert mapped_order["customer_name"] == "山田太郎"
        assert mapped_order["payment_method"] == "クレジットカード"
        assert mapped_order["payment_status"] == "completed"
        assert mapped_order["fulfillment_status"] == "shipped"
        assert mapped_order["shipping_zip"] == "100-0001"
        assert mapped_order["note"] == "お急ぎ便"
    
    @pytest.mark.asyncio
    async def test_map_customers(self, mapper, sample_customer_rows):
        """顧客マッピングのテスト"""
        headers = sample_customer_rows[0]
        data_rows = sample_customer_rows[1:]
        customers = mapper._rows_to_dicts(headers, data_rows)
        
        result = await mapper.map_customers(customers)
        
        assert result.total_records == 3
        assert result.successful_records == 3
        
        # 1つ目の顧客を検証
        mapped_customer = result.mapped_data[0]
        assert mapped_customer["external_id"] == "CUST-001"
        assert mapped_customer["email"] == "yamada@example.com"
        assert mapped_customer["first_name"] == "太郎"
        assert mapped_customer["last_name"] == "山田"
        assert mapped_customer["phone"] == "03-1234-5678"
        assert mapped_customer["total_orders"] == 10
        assert mapped_customer["total_spent"] == Decimal("50000")
        assert mapped_customer["member_rank"] == "ゴールド"
        assert mapped_customer["country"] == "JP"
        assert mapped_customer["province"] == "東京都"
        assert mapped_customer["city"] == "千代田区"
        assert mapped_customer["zip"] == "100-0001"
    
    def test_rows_to_dicts(self, mapper):
        """行データを辞書に変換するテスト"""
        headers = ["ID", "名前", "価格"]
        rows = [
            ["1", "商品A", "1000"],
            ["2", "商品B", "2000"]
        ]
        
        result = mapper._rows_to_dicts(headers, rows)
        assert len(result) == 2
        assert result[0] == {"ID": "1", "名前": "商品A", "価格": "1000"}
        assert result[1] == {"ID": "2", "名前": "商品B", "価格": "2000"}
        
        # ヘッダーと列数が異なる場合
        invalid_rows = [["1", "商品A"]]  # 価格が不足
        result = mapper._rows_to_dicts(headers, invalid_rows)
        assert len(result) == 1
        assert result[0]["価格"] == ""  # 不足分は空文字
    
    def test_parse_sheet_date(self, mapper):
        """スプレッドシート日付パースのテスト"""
        # 日本形式
        date1 = mapper._parse_sheet_date("2023/01/15")
        assert isinstance(date1, datetime)
        
        # 日時形式
        date2 = mapper._parse_sheet_date("2023/01/15 10:30")
        assert isinstance(date2, datetime)
        
        # ハイフン形式
        date3 = mapper._parse_sheet_date("2023-01-15")
        assert isinstance(date3, datetime)
        
        # ISO形式
        date4 = mapper._parse_sheet_date("2023-01-15T10:30:00Z")
        assert isinstance(date4, datetime)
        
        # 無効な日付
        date5 = mapper._parse_sheet_date("invalid")
        assert date5 is None
        
        # 空文字
        date6 = mapper._parse_sheet_date("")
        assert date6 is None
    
    def test_parse_number(self, mapper):
        """数値パースのテスト"""
        # 整数
        assert mapper._parse_number("100") == 100
        
        # 小数
        assert mapper._parse_number("99.99") == 99.99
        
        # カンマ付き
        assert mapper._parse_number("1,000") == 1000
        assert mapper._parse_number("10,000.50") == 10000.50
        
        # 空文字
        assert mapper._parse_number("") == 0
        
        # 無効な値
        assert mapper._parse_number("abc") == 0
    
    def test_parse_decimal(self, mapper):
        """Decimal変換のテスト"""
        # 文字列から
        assert mapper._parse_decimal("2980") == Decimal("2980")
        assert mapper._parse_decimal("99.99") == Decimal("99.99")
        
        # カンマ付き
        assert mapper._parse_decimal("1,000") == Decimal("1000")
        
        # 空文字
        assert mapper._parse_decimal("") == Decimal("0")
        
        # 無効な値
        assert mapper._parse_decimal("invalid") == Decimal("0")
    
    def test_parse_tags(self, mapper):
        """タグパースのテスト"""
        # カンマ区切り
        assert mapper._parse_tags("tag1,tag2,tag3") == ["tag1", "tag2", "tag3"]
        
        # スペース付き
        assert mapper._parse_tags("tag1, tag2, tag3") == ["tag1", "tag2", "tag3"]
        
        # 単一タグ
        assert mapper._parse_tags("single") == ["single"]
        
        # 空文字
        assert mapper._parse_tags("") == []
        
        # 空タグを除外
        assert mapper._parse_tags("tag1,,tag2") == ["tag1", "tag2"]
    
    def test_normalize_status(self, mapper):
        """ステータス正規化のテスト"""
        # 商品ステータス
        assert mapper._normalize_product_status("販売中") == "active"
        assert mapper._normalize_product_status("在庫切れ") == "out_of_stock"
        assert mapper._normalize_product_status("予約受付中") == "preorder"
        assert mapper._normalize_product_status("販売終了") == "discontinued"
        assert mapper._normalize_product_status("不明") == "unknown"
        assert mapper._normalize_product_status("") == "unknown"
        
        # 支払いステータス
        assert mapper._normalize_payment_status("支払済み") == "completed"
        assert mapper._normalize_payment_status("未払い") == "pending"
        assert mapper._normalize_payment_status("確認中") == "processing"
        assert mapper._normalize_payment_status("キャンセル") == "cancelled"
        assert mapper._normalize_payment_status("") == "unknown"
        
        # 配送ステータス
        assert mapper._normalize_fulfillment_status("発送済み") == "shipped"
        assert mapper._normalize_fulfillment_status("準備中") == "processing"
        assert mapper._normalize_fulfillment_status("未発送") == "pending"
        assert mapper._normalize_fulfillment_status("配達完了") == "delivered"
        assert mapper._normalize_fulfillment_status("") == "unknown"
    
    @pytest.mark.asyncio
    async def test_map_with_sheet_metadata(self, mapper, sample_product_rows, sample_sheet_metadata):
        """シートメタデータ付きマッピングのテスト"""
        headers = sample_product_rows[0]
        data_rows = sample_product_rows[1:]
        products = mapper._rows_to_dicts(headers, data_rows)
        
        # メタデータを追加
        for product in products:
            product["_sheet_metadata"] = sample_sheet_metadata
        
        result = await mapper.map_products(products)
        assert result.successful_records == 3
        
        # メタデータが保存されていることを確認
        mapped = result.mapped_data[0]
        assert mapped["source_metadata"]["spreadsheet_id"] == "1ABC123DEF456"
        assert mapped["source_metadata"]["sheet_name"] == "商品一覧"
    
    @pytest.mark.asyncio
    async def test_map_data_router(self, mapper, sample_product_rows):
        """map_dataルーターメソッドのテスト"""
        headers = sample_product_rows[0]
        data_rows = sample_product_rows[1:]
        products = mapper._rows_to_dicts(headers, data_rows)
        
        # products
        result = await mapper.map_data(products, "products")
        assert result.successful_records == 3
        
        # サポートされていないテーブル
        with pytest.raises(ValueError):
            await mapper.map_data([], "invalid_table")
    
    @pytest.mark.asyncio
    async def test_error_handling(self, mapper):
        """エラーハンドリングのテスト"""
        # 不正なデータ
        invalid_products = [
            {"商品ID": ""},  # IDが空
            {"invalid": "data"}  # 必要なフィールドがない
        ]
        
        result = await mapper.map_products(invalid_products)
        assert result.total_records == 2
        assert result.successful_records < 2  # 一部またはすべて失敗
        assert len(result.errors) > 0
    
    @pytest.mark.asyncio
    async def test_formula_handling(self, mapper):
        """スプレッドシートの数式処理のテスト"""
        products = [{
            "商品ID": "GS-004",
            "商品名": "数式テスト商品",
            "価格": "=SUM(1000,980)",  # 数式
            "在庫数": "=A1+B1",  # 数式（評価できない）
            "SKU": "SKU-004",
            "ステータス": "販売中"
        }]
        
        result = await mapper.map_products(products)
        assert result.successful_records == 1
        
        mapped = result.mapped_data[0]
        # 数式は文字列として扱われ、数値に変換できない場合は0
        assert mapped["price"] == Decimal("0")
        assert mapped["inventory_quantity"] == 0