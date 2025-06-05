"""
ファイルマッパーのテスト
"""
import pytest
from datetime import datetime, timezone
from decimal import Decimal
from src.data_integration.mapping.mappers.file_mapper import FileDataMapper
from src.data_integration.mapping.schema_registry import SchemaRegistry
from src.data_integration.mapping.base_mapper import MappingResult


class TestFileDataMapper:
    @pytest.fixture
    def mapper(self):
        schema_registry = SchemaRegistry()
        return FileDataMapper(schema_registry)
    
    @pytest.fixture
    def product_csv_data(self):
        """CSV形式の商品データ"""
        return [
            {
                'product_id': 'PROD001',
                'product_name': 'テスト商品1',
                'sku': 'SKU001',
                'price': '1000',
                'cost': '600',
                'stock_quantity': '50',
                'created_at': '2024-01-01 09:00:00',
                'updated_at': '2024-01-15 14:30:00'
            },
            {
                'product_id': 'PROD002',
                'product_name': 'テスト商品2',
                'sku': 'SKU002',
                'price': '2500.50',
                'cost': '1200',
                'stock_quantity': '0',
                'created_at': '2024-01-02 10:00:00',
                'updated_at': '2024-01-20 16:00:00'
            }
        ]
    
    @pytest.fixture
    def order_excel_data(self):
        """Excel形式の注文データ"""
        return [
            {
                'Order ID': 'ORD-2024-001',
                'Order Date': '2024-01-15',
                'Customer Name': '山田太郎',
                'Customer Email': 'yamada@example.com',
                'Total Amount': 3500,
                'Tax': 350,
                'Shipping': 500,
                'Status': 'delivered',
                'Items': '商品1 x2, 商品2 x1'
            },
            {
                'Order ID': 'ORD-2024-002',
                'Order Date': '2024-01-16',
                'Customer Name': '佐藤花子',
                'Customer Email': 'sato@example.com',
                'Total Amount': 5000.5,
                'Tax': 500,
                'Shipping': 0,
                'Status': 'processing',
                'Items': '商品3 x3'
            }
        ]
    
    def test_map_product_csv_data(self, mapper, product_csv_data):
        """商品CSVデータのマッピングテスト"""
        # データタイプ定義
        mapper.column_types = {
            'price': 'decimal',
            'cost': 'decimal',
            'stock_quantity': 'integer',
            'created_at': 'datetime',
            'updated_at': 'datetime'
        }
        
        result = mapper.map_data(product_csv_data, 'products')
        
        assert isinstance(result, MappingResult)
        assert result.success is True
        assert len(result.mapped_data) == 2
        assert result.error_count == 0
        
        # 最初の商品を検証
        product1 = result.mapped_data[0]
        assert product1['external_id'] == 'PROD001'
        assert product1['name'] == 'テスト商品1'
        assert product1['sku'] == 'SKU001'
        assert product1['price'] == Decimal('1000')
        assert product1['cost'] == Decimal('600')
        assert product1['stock_quantity'] == 50
        assert isinstance(product1['created_at'], datetime)
        assert isinstance(product1['updated_at'], datetime)
    
    def test_map_order_excel_data(self, mapper, order_excel_data):
        """注文Excelデータのマッピングテスト"""
        # カラムマッピング設定
        mapper.column_mappings = {
            'Order ID': 'order_number',
            'Order Date': 'created_at',
            'Customer Name': 'customer_name',
            'Customer Email': 'email',
            'Total Amount': 'total_amount',
            'Tax': 'tax_amount',
            'Shipping': 'shipping_amount',
            'Status': 'status'
        }
        
        # データタイプ定義
        mapper.column_types = {
            'Order Date': 'date',
            'Total Amount': 'decimal',
            'Tax': 'decimal',
            'Shipping': 'decimal'
        }
        
        result = mapper.map_data(order_excel_data, 'orders')
        
        assert isinstance(result, MappingResult)
        assert result.success is True
        assert len(result.mapped_data) == 2
        
        # 最初の注文を検証
        order1 = result.mapped_data[0]
        assert order1['order_number'] == 'ORD-2024-001'
        assert isinstance(order1['created_at'], datetime)
        assert order1['email'] == 'yamada@example.com'
        assert order1['total_amount'] == Decimal('3500')
        assert order1['tax_amount'] == Decimal('350')
        assert order1['shipping_amount'] == Decimal('500')
        assert order1['status'] == 'delivered'
    
    def test_map_with_invalid_data(self, mapper):
        """無効なデータのマッピングテスト"""
        invalid_data = [
            {
                'product_id': 'PROD003',
                'price': 'invalid_price',  # 数値変換できない
                'stock_quantity': 'abc',    # 数値変換できない
                'created_at': 'invalid_date'
            }
        ]
        
        mapper.column_types = {
            'price': 'decimal',
            'stock_quantity': 'integer',
            'created_at': 'datetime'
        }
        
        result = mapper.map_data(invalid_data, 'products')
        
        assert result.success is True
        assert len(result.mapped_data) == 1
        assert result.error_count > 0
        assert len(result.errors) > 0
        
        # エラーの内容を確認
        errors = result.errors
        assert any('price' in str(error) for error in errors)
        assert any('stock_quantity' in str(error) for error in errors)
    
    def test_map_with_custom_mappings(self, mapper):
        """カスタムマッピングのテスト"""
        data = [
            {
                'item_code': 'ITEM001',
                'item_name': 'カスタム商品',
                'unit_price': '1500',
                'quantity': '25'
            }
        ]
        
        # カスタムマッピング設定
        mapper.column_mappings = {
            'item_code': 'sku',
            'item_name': 'name',
            'unit_price': 'price',
            'quantity': 'stock_quantity'
        }
        
        mapper.column_types = {
            'unit_price': 'decimal',
            'quantity': 'integer'
        }
        
        result = mapper.map_data(data, 'products')
        
        assert result.success is True
        product = result.mapped_data[0]
        assert product['sku'] == 'ITEM001'
        assert product['name'] == 'カスタム商品'
        assert product['price'] == Decimal('1500')
        assert product['stock_quantity'] == 25
    
    def test_map_empty_data(self, mapper):
        """空データのマッピングテスト"""
        result = mapper.map_data([], 'products')
        
        assert result.success is True
        assert len(result.mapped_data) == 0
        assert result.error_count == 0
    
    def test_map_with_missing_required_fields(self, mapper):
        """必須フィールド欠損のテスト"""
        data = [
            {
                'product_id': 'PROD004',
                # nameフィールドが欠損
                'price': '1000'
            }
        ]
        
        result = mapper.map_data(data, 'products')
        
        # マッピングは成功するが、警告が記録される
        assert result.success is True
        assert len(result.warnings) > 0
        assert any('name' in str(warning) for warning in result.warnings)
    
    def test_auto_detect_data_types(self, mapper):
        """データ型自動検出のテスト"""
        data = [
            {
                'id': '123',
                'name': 'テスト商品',
                'price': '1000.50',
                'quantity': '100',
                'is_active': 'true',
                'created_date': '2024-01-01',
                'updated_time': '2024-01-01 10:30:00'
            }
        ]
        
        # 自動検出を有効化
        mapper.auto_detect_types = True
        
        result = mapper.map_data(data, 'products')
        
        assert result.success is True
        product = result.mapped_data[0]
        
        # 自動検出された型を確認
        assert isinstance(product.get('price'), Decimal)
        assert isinstance(product.get('quantity'), int)
        assert product.get('is_active') is True
        assert isinstance(product.get('created_date'), datetime)