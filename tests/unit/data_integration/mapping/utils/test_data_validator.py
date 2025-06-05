"""
データバリデーターのテスト
"""
import pytest
from datetime import datetime, timezone
from decimal import Decimal
from src.data_integration.mapping.utils.data_validator import (
    DataValidator, ValidationRule, ValidationResult, RuleType
)


class TestDataValidator:
    @pytest.fixture
    def validator(self):
        return DataValidator()
    
    def test_required_field_validation(self, validator):
        """必須フィールド検証のテスト"""
        # 必須ルール設定
        validator.add_rule('name', ValidationRule(
            rule_type=RuleType.REQUIRED,
            error_message="商品名は必須です"
        ))
        validator.add_rule('price', ValidationRule(
            rule_type=RuleType.REQUIRED,
            error_message="価格は必須です"
        ))
        
        # 有効なデータ
        valid_data = {'name': 'テスト商品', 'price': 1000}
        result = validator.validate(valid_data)
        assert result.is_valid is True
        assert len(result.errors) == 0
        
        # 無効なデータ（nameが欠損）
        invalid_data = {'price': 1000}
        result = validator.validate(invalid_data)
        assert result.is_valid is False
        assert len(result.errors) == 1
        assert 'name' in result.errors
        assert result.errors['name'] == "商品名は必須です"
    
    def test_type_validation(self, validator):
        """型検証のテスト"""
        # 型ルール設定
        validator.add_rule('price', ValidationRule(
            rule_type=RuleType.TYPE,
            expected_type=Decimal,
            error_message="価格は数値である必要があります"
        ))
        validator.add_rule('created_at', ValidationRule(
            rule_type=RuleType.TYPE,
            expected_type=datetime,
            error_message="作成日時は日時型である必要があります"
        ))
        
        # 有効なデータ
        valid_data = {
            'price': Decimal('1000.50'),
            'created_at': datetime.now(timezone.utc)
        }
        result = validator.validate(valid_data)
        assert result.is_valid is True
        
        # 無効なデータ
        invalid_data = {
            'price': "文字列価格",
            'created_at': "2024-01-01"
        }
        result = validator.validate(invalid_data)
        assert result.is_valid is False
        assert len(result.errors) == 2
    
    def test_range_validation(self, validator):
        """範囲検証のテスト"""
        # 範囲ルール設定
        validator.add_rule('stock_quantity', ValidationRule(
            rule_type=RuleType.RANGE,
            min_value=0,
            max_value=99999,
            error_message="在庫数は0〜99999の範囲である必要があります"
        ))
        validator.add_rule('discount_rate', ValidationRule(
            rule_type=RuleType.RANGE,
            min_value=Decimal('0'),
            max_value=Decimal('1'),
            error_message="割引率は0〜1の範囲である必要があります"
        ))
        
        # 有効なデータ
        valid_data = {
            'stock_quantity': 100,
            'discount_rate': Decimal('0.15')
        }
        result = validator.validate(valid_data)
        assert result.is_valid is True
        
        # 無効なデータ（範囲外）
        invalid_data = {
            'stock_quantity': -10,
            'discount_rate': Decimal('1.5')
        }
        result = validator.validate(invalid_data)
        assert result.is_valid is False
        assert len(result.errors) == 2
    
    def test_pattern_validation(self, validator):
        """パターン検証のテスト"""
        # パターンルール設定
        validator.add_rule('email', ValidationRule(
            rule_type=RuleType.PATTERN,
            pattern=r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
            error_message="有効なメールアドレスではありません"
        ))
        validator.add_rule('phone', ValidationRule(
            rule_type=RuleType.PATTERN,
            pattern=r'^0\d{1,4}-\d{1,4}-\d{4}$',
            error_message="電話番号の形式が正しくありません"
        ))
        
        # 有効なデータ
        valid_data = {
            'email': 'test@example.com',
            'phone': '03-1234-5678'
        }
        result = validator.validate(valid_data)
        assert result.is_valid is True
        
        # 無効なデータ
        invalid_data = {
            'email': 'invalid-email',
            'phone': '123456789'
        }
        result = validator.validate(invalid_data)
        assert result.is_valid is False
        assert 'email' in result.errors
        assert 'phone' in result.errors
    
    def test_custom_validation(self, validator):
        """カスタム検証のテスト"""
        # カスタム検証関数
        def validate_japanese_zip(value):
            if not isinstance(value, str):
                return False
            return len(value) == 7 and value.isdigit()
        
        def validate_future_date(value):
            if not isinstance(value, datetime):
                return False
            return value > datetime.now(timezone.utc)
        
        # カスタムルール設定
        validator.add_rule('zip_code', ValidationRule(
            rule_type=RuleType.CUSTOM,
            custom_validator=validate_japanese_zip,
            error_message="郵便番号は7桁の数字である必要があります"
        ))
        validator.add_rule('delivery_date', ValidationRule(
            rule_type=RuleType.CUSTOM,
            custom_validator=validate_future_date,
            error_message="配送日は未来の日付である必要があります"
        ))
        
        # 有効なデータ
        valid_data = {
            'zip_code': '1234567',
            'delivery_date': datetime(2025, 1, 1, tzinfo=timezone.utc)
        }
        result = validator.validate(valid_data)
        assert result.is_valid is True
        
        # 無効なデータ
        invalid_data = {
            'zip_code': '123-4567',
            'delivery_date': datetime(2020, 1, 1, tzinfo=timezone.utc)
        }
        result = validator.validate(invalid_data)
        assert result.is_valid is False
        assert len(result.errors) == 2
    
    def test_conditional_validation(self, validator):
        """条件付き検証のテスト"""
        # 条件付きルール設定
        def requires_shipping_address(data):
            return data.get('requires_shipping', False)
        
        validator.add_rule('shipping_address', ValidationRule(
            rule_type=RuleType.REQUIRED,
            condition=requires_shipping_address,
            error_message="配送が必要な場合、配送先住所は必須です"
        ))
        
        # 配送不要の場合（有効）
        data_no_shipping = {
            'requires_shipping': False
        }
        result = validator.validate(data_no_shipping)
        assert result.is_valid is True
        
        # 配送必要だが住所なし（無効）
        data_needs_shipping = {
            'requires_shipping': True
        }
        result = validator.validate(data_needs_shipping)
        assert result.is_valid is False
        assert 'shipping_address' in result.errors
        
        # 配送必要で住所あり（有効）
        data_with_shipping = {
            'requires_shipping': True,
            'shipping_address': '東京都千代田区...'
        }
        result = validator.validate(data_with_shipping)
        assert result.is_valid is True
    
    def test_validate_list_of_items(self, validator):
        """複数アイテムの検証テスト"""
        # ルール設定
        validator.add_rule('name', ValidationRule(
            rule_type=RuleType.REQUIRED,
            error_message="商品名は必須です"
        ))
        validator.add_rule('price', ValidationRule(
            rule_type=RuleType.RANGE,
            min_value=0,
            error_message="価格は0以上である必要があります"
        ))
        
        # 複数アイテムのデータ
        items = [
            {'name': '商品1', 'price': 1000},
            {'name': '商品2', 'price': 2000},
            {'price': -100},  # nameなし、価格が負
            {'name': '商品4', 'price': 3000}
        ]
        
        results = validator.validate_list(items)
        
        assert len(results) == 4
        assert results[0].is_valid is True
        assert results[1].is_valid is True
        assert results[2].is_valid is False
        assert len(results[2].errors) == 2  # name必須エラーと価格範囲エラー
        assert results[3].is_valid is True
    
    def test_clear_rules(self, validator):
        """ルールクリアのテスト"""
        # ルール追加
        validator.add_rule('test_field', ValidationRule(
            rule_type=RuleType.REQUIRED
        ))
        
        assert len(validator.rules) == 1
        
        # ルールクリア
        validator.clear_rules()
        
        assert len(validator.rules) == 0
        
        # クリア後の検証（ルールなしなので全て有効）
        result = validator.validate({})
        assert result.is_valid is True