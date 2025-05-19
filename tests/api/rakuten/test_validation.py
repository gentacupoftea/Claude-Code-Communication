"""
Tests for Rakuten API input validation
"""

import pytest
from pydantic import ValidationError

from src.api.rakuten.validators import (
    RakutenProductCreate,
    RakutenProductUpdate,
    RakutenOrderItem,
    RakutenAddressCreate,
    RakutenCustomerCreate,
    validate_product_data,
    validate_order_item,
    validate_address,
    validate_customer_data
)


class TestProductValidation:
    """Test product validation"""
    
    def test_valid_product_creation(self):
        """Test valid product creation data"""
        data = {
            'name': 'Test Product',
            'price': 1000,
            'description': 'Test description',
            'sku': 'TEST-001',
            'stock': 100,
            'categories': ['Category1', 'Category2'],
            'images': [{'url': 'image1.jpg'}, {'url': 'image2.jpg'}]
        }
        
        validated = validate_product_data(data, is_update=False)
        assert validated['name'] == 'Test Product'
        assert validated['price'] == 1000
        assert validated['sku'] == 'TEST-001'
    
    def test_invalid_product_price(self):
        """Test invalid product price"""
        data = {
            'name': 'Test Product',
            'price': -100,  # Negative price
            'sku': 'TEST-001',
            'stock': 100
        }
        
        with pytest.raises(ValidationError) as excinfo:
            validate_product_data(data, is_update=False)
        
        assert 'ensure this value is greater than 0' in str(excinfo.value)
    
    def test_invalid_sku_format(self):
        """Test invalid SKU format"""
        data = {
            'name': 'Test Product',
            'price': 1000,
            'sku': 'TEST 001 INVALID',  # Contains spaces
            'stock': 100
        }
        
        with pytest.raises(ValidationError) as excinfo:
            validate_product_data(data, is_update=False)
        
        assert 'SKU must contain only alphanumeric characters' in str(excinfo.value)
    
    def test_too_many_categories(self):
        """Test too many categories"""
        data = {
            'name': 'Test Product',
            'price': 1000,
            'sku': 'TEST-001',
            'stock': 100,
            'categories': ['Cat1', 'Cat2', 'Cat3', 'Cat4', 'Cat5', 'Cat6']  # 6 categories
        }
        
        with pytest.raises(ValidationError) as excinfo:
            validate_product_data(data, is_update=False)
        
        assert 'A maximum of 5 categories is allowed' in str(excinfo.value)
    
    def test_too_many_images(self):
        """Test too many images"""
        data = {
            'name': 'Test Product',
            'price': 1000,
            'sku': 'TEST-001',
            'stock': 100,
            'images': [{'url': f'image{i}.jpg'} for i in range(25)]  # 25 images
        }
        
        with pytest.raises(ValidationError) as excinfo:
            validate_product_data(data, is_update=False)
        
        assert 'A maximum of 20 images is allowed' in str(excinfo.value)
    
    def test_product_name_sanitization(self):
        """Test product name sanitization"""
        data = {
            'name': 'Test\x00Product\x1FWith\nControl\rChars',  # Control characters
            'price': 1000,
            'sku': 'TEST-001',
            'stock': 100
        }
        
        validated = validate_product_data(data, is_update=False)
        assert validated['name'] == 'TestProductWithControlChars'
    
    def test_product_update_validation(self):
        """Test product update validation"""
        data = {
            'name': 'Updated Product',
            'price': 1500,
            # Other fields are optional for updates
        }
        
        validated = validate_product_data(data, is_update=True)
        assert validated['name'] == 'Updated Product'
        assert validated['price'] == 1500
        assert 'sku' not in validated  # Not provided


class TestOrderValidation:
    """Test order item validation"""
    
    def test_valid_order_item(self):
        """Test valid order item"""
        data = {
            'product_id': 'PROD-001',
            'quantity': 2,
            'price': 1000
        }
        
        validated = validate_order_item(data)
        assert validated['product_id'] == 'PROD-001'
        assert validated['quantity'] == 2
        assert validated['price'] == 1000
    
    def test_invalid_quantity(self):
        """Test invalid quantity"""
        data = {
            'product_id': 'PROD-001',
            'quantity': 0,  # Zero quantity
            'price': 1000
        }
        
        with pytest.raises(ValidationError) as excinfo:
            validate_order_item(data)
        
        assert 'ensure this value is greater than 0' in str(excinfo.value)
    
    def test_invalid_product_id(self):
        """Test invalid product ID format"""
        data = {
            'product_id': 'PROD#001!',  # Invalid characters
            'quantity': 1,
            'price': 1000
        }
        
        with pytest.raises(ValidationError) as excinfo:
            validate_order_item(data)
        
        assert 'Invalid product ID format' in str(excinfo.value)


class TestAddressValidation:
    """Test address validation"""
    
    def test_valid_address(self):
        """Test valid Japanese address"""
        data = {
            'full_name': '山田太郎',
            'postal_code': '123-4567',
            'prefecture': '東京都',
            'city': '千代田区',
            'address1': '丸の内1-1-1',
            'address2': 'ビル10F',
            'phone': '03-1234-5678'
        }
        
        validated = validate_address(data)
        assert validated['full_name'] == '山田太郎'
        assert validated['postal_code'] == '123-4567'
    
    def test_postal_code_normalization(self):
        """Test postal code normalization"""
        data = {
            'full_name': '山田太郎',
            'postal_code': '1234567',  # Without hyphen
            'prefecture': '東京都',
            'city': '千代田区',
            'address1': '丸の内1-1-1'
        }
        
        validated = validate_address(data)
        assert validated['postal_code'] == '123-4567'  # Hyphen added
    
    def test_invalid_postal_code(self):
        """Test invalid postal code"""
        data = {
            'full_name': '山田太郎',
            'postal_code': '12345',  # Too short
            'prefecture': '東京都',
            'city': '千代田区',
            'address1': '丸の内1-1-1'
        }
        
        with pytest.raises(ValidationError) as excinfo:
            validate_address(data)
        
        assert 'string does not match regex' in str(excinfo.value)
    
    def test_phone_validation(self):
        """Test phone number validation"""
        data = {
            'full_name': '山田太郎',
            'postal_code': '123-4567',
            'prefecture': '東京都',
            'city': '千代田区',
            'address1': '丸の内1-1-1',
            'phone': '03-1234-5678-9999'  # Too long
        }
        
        with pytest.raises(ValidationError) as excinfo:
            validate_address(data)
        
        assert 'Phone number must be 10 or 11 digits' in str(excinfo.value)


class TestCustomerValidation:
    """Test customer validation"""
    
    def test_valid_customer(self):
        """Test valid customer data"""
        data = {
            'email': 'test@example.com',
            'first_name': '太郎',
            'last_name': '山田',
            'phone': '090-1234-5678',
            'accepts_marketing': True
        }
        
        validated = validate_customer_data(data)
        assert validated['email'] == 'test@example.com'
        assert validated['first_name'] == '太郎'
        assert validated['accepts_marketing'] is True
    
    def test_email_normalization(self):
        """Test email normalization"""
        data = {
            'email': '  TEST@EXAMPLE.COM  ',  # Uppercase with spaces
        }
        
        validated = validate_customer_data(data)
        assert validated['email'] == 'test@example.com'  # Normalized
    
    def test_invalid_email(self):
        """Test invalid email format"""
        data = {
            'email': 'invalid.email',  # Missing @domain
        }
        
        with pytest.raises(ValidationError) as excinfo:
            validate_customer_data(data)
        
        assert 'string does not match regex' in str(excinfo.value)
    
    def test_name_sanitization(self):
        """Test name sanitization"""
        data = {
            'email': 'test@example.com',
            'first_name': '  太郎\n\r  ',  # Whitespace and newlines
            'last_name': '山田\x00\x1F'  # Control characters
        }
        
        validated = validate_customer_data(data)
        assert validated['first_name'] == '太郎'
        assert validated['last_name'] == '山田'