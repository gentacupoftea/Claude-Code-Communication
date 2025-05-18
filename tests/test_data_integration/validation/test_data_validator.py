"""Tests for the data validator."""
import pytest
from datetime import datetime

from src.data_integration.validation.data_validator import DataValidator, ValidationError


@pytest.fixture
def validator():
    """Create a test data validator."""
    return DataValidator(strict=False)


@pytest.fixture
def strict_validator():
    """Create a test data validator in strict mode."""
    return DataValidator(strict=True)


@pytest.fixture
def valid_order():
    """Create a valid order for testing."""
    return {
        "order_id": "123456789",
        "order_number": "1001",
        "created_at": "2023-01-01T12:00:00Z",
        "currency": "JPY",
        "total_price": "5000.00",
        "customer": {
            "id": "customer_123",
            "email": "customer@example.com",
            "first_name": "Test",
            "last_name": "Customer"
        },
        "financial_status": "paid",
        "fulfillment_status": "fulfilled",
        "line_items": [
            {
                "id": "line_item_123",
                "product_id": "product_123",
                "variant_id": "variant_123",
                "title": "Test Product",
                "quantity": 2,
                "price": "2500.00",
                "total_price": "5000.00"
            }
        ]
    }


def test_validate_order_valid(validator, valid_order):
    """Test validating a valid order."""
    assert validator.validate_order(valid_order) is True
    assert validator.get_errors() == []


def test_validate_order_missing_required_fields(validator):
    """Test validating an order with missing required fields."""
    invalid_order = {
        "order_number": "1001",
        "currency": "JPY",
        "total_price": "5000.00"
    }
    
    assert validator.validate_order(invalid_order) is False
    errors = validator.get_errors()
    assert len(errors) == 2
    assert any(e["field"] == "order_id" and e["error"] == "Missing required field" for e in errors)
    assert any(e["field"] == "created_at" and e["error"] == "Missing required field" for e in errors)


def test_validate_order_invalid_date_format(validator, valid_order):
    """Test validating an order with invalid date format."""
    valid_order["created_at"] = "not-a-date"
    
    assert validator.validate_order(valid_order) is False
    errors = validator.get_errors()
    assert len(errors) == 1
    assert errors[0]["field"] == "created_at"
    assert "Invalid ISO 8601" in errors[0]["error"]


def test_validate_order_invalid_currency(validator, valid_order):
    """Test validating an order with invalid currency code."""
    valid_order["currency"] = "INVALID"
    
    assert validator.validate_order(valid_order) is False
    errors = validator.get_errors()
    assert len(errors) == 1
    assert errors[0]["field"] == "currency"
    assert "Expected 3-letter ISO 4217" in errors[0]["error"]


def test_validate_order_invalid_status(validator, valid_order):
    """Test validating an order with invalid status value."""
    valid_order["financial_status"] = "invalid_status"
    
    assert validator.validate_order(valid_order) is False
    errors = validator.get_errors()
    assert len(errors) == 1
    assert errors[0]["field"] == "financial_status"
    assert "Expected one of:" in errors[0]["error"]


def test_validate_order_strict_mode(strict_validator, valid_order):
    """Test validating an order in strict mode."""
    assert strict_validator.validate_order(valid_order) is True
    
    invalid_order = valid_order.copy()
    invalid_order["currency"] = "INVALID"
    
    with pytest.raises(ValidationError) as excinfo:
        strict_validator.validate_order(invalid_order)
        
    assert "Order validation failed" in str(excinfo.value)
    assert len(excinfo.value.errors) == 1
    assert excinfo.value.errors[0]["field"] == "currency"


@pytest.fixture
def valid_product():
    """Create a valid product for testing."""
    return {
        "product_id": "product_123",
        "title": "Test Product",
        "vendor": "Test Vendor",
        "product_type": "Test Type",
        "created_at": "2023-01-01T12:00:00Z",
        "updated_at": "2023-01-02T12:00:00Z",
        "published_at": "2023-01-03T12:00:00Z",
        "variants": [
            {
                "id": "variant_123",
                "title": "Default Variant",
                "price": "2500.00",
                "sku": "SKU123",
                "inventory_quantity": 10
            }
        ]
    }


def test_validate_product_valid(validator, valid_product):
    """Test validating a valid product."""
    assert validator.validate_product(valid_product) is True
    assert validator.get_errors() == []


def test_validate_product_missing_required_fields(validator):
    """Test validating a product with missing required fields."""
    invalid_product = {
        "vendor": "Test Vendor",
        "product_type": "Test Type"
    }
    
    assert validator.validate_product(invalid_product) is False
    errors = validator.get_errors()
    assert len(errors) == 2  # Missing both product_id and title
    assert any(e["field"] == "product_id" for e in errors)
    assert any(e["field"] == "title" for e in errors)


@pytest.fixture
def valid_transaction():
    """Create a valid transaction for testing."""
    return {
        "id": "transaction_123",
        "order_id": "order_123",
        "amount": "5000.00",
        "currency": "JPY",
        "status": "success",
        "gateway": "stripe",
        "kind": "sale",
        "created_at": "2023-01-01T12:00:00Z"
    }


def test_validate_transaction_valid(validator, valid_transaction):
    """Test validating a valid transaction."""
    assert validator.validate_transaction(valid_transaction) is True
    assert validator.get_errors() == []


def test_validate_transaction_invalid_status(validator, valid_transaction):
    """Test validating a transaction with invalid status."""
    valid_transaction["status"] = "invalid_status"
    
    assert validator.validate_transaction(valid_transaction) is False
    errors = validator.get_errors()
    assert len(errors) == 1
    assert errors[0]["field"] == "transaction.status"
    assert "Expected one of:" in errors[0]["error"]
