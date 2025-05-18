"""Tests for the GA4 integration module."""
import pytest
from datetime import datetime

import pandas as pd

from src.data_integration.ga4.ga4_mapper import GA4Mapper


@pytest.fixture
def shopify_order():
    """Create a Shopify order for testing."""
    return {
        "order_id": "123456789",
        "order_number": "1001",
        "created_at": "2023-01-01T12:00:00Z",
        "updated_at": "2023-01-02T12:00:00Z",
        "processed_at": "2023-01-01T12:05:00Z",
        "currency": "JPY",
        "total_price": "5000.00",
        "subtotal_price": "4500.00",
        "total_tax": "400.00",
        "total_discounts": "200.00",
        "total_shipping": "300.00",
        "financial_status": "paid",
        "fulfillment_status": "fulfilled",
        "customer": {
            "id": "customer_123",
            "email": "customer@example.com",
            "first_name": "Test",
            "last_name": "Customer"
        },
        "line_items": [
            {
                "id": "line_item_123",
                "product_id": "product_123",
                "variant_id": "variant_123",
                "title": "Test Product",
                "quantity": 2,
                "price": "2250.00",
                "total_price": "4500.00"
            }
        ]
    }


def test_map_order_to_ga4(shopify_order):
    """Test mapping a Shopify order to GA4 format."""
    ga4_order = GA4Mapper.map_order_to_ga4(shopify_order)
    
    assert ga4_order["transaction_id"] == "123456789"
    assert ga4_order["currency"] == "JPY"
    assert ga4_order["value"] == "5000.00"
    assert ga4_order["item_revenue"] == "4500.00"
    assert ga4_order["tax"] == "400.00"
    assert ga4_order["discount"] == "200.00"
    assert ga4_order["shipping"] == "300.00"
    assert ga4_order["payment_status"] == "paid"
    assert ga4_order["shipping_status"] == "fulfilled"
    assert ga4_order["user_id"] == "customer_123"
    assert ga4_order["user_email"] == "customer@example.com"
    assert ga4_order["user_first_name"] == "Test"
    assert ga4_order["user_last_name"] == "Customer"
    
    assert len(ga4_order["items"]) == 1
    item = ga4_order["items"][0]
    assert item["item_id"] == "product_123"
    assert item["item_variant_id"] == "variant_123"
    assert item["item_name"] == "Test Product"
    assert item["quantity"] == 2
    assert item["price"] == "2250.00"
    assert item["item_revenue"] == "4500.00"


@pytest.fixture
def shopify_product():
    """Create a Shopify product for testing."""
    return {
        "product_id": "product_123",
        "title": "Test Product",
        "vendor": "Test Vendor",
        "product_type": "Test Type",
        "created_at": "2023-01-01T12:00:00Z",
        "updated_at": "2023-01-02T12:00:00Z",
        "published_at": "2023-01-03T12:00:00Z",
        "tags": "tag1, tag2, tag3"
    }


def test_map_product_to_ga4(shopify_product):
    """Test mapping a Shopify product to GA4 format."""
    ga4_product = GA4Mapper.map_product_to_ga4(shopify_product)
    
    assert ga4_product["item_id"] == "product_123"
    assert ga4_product["item_name"] == "Test Product"
    assert ga4_product["item_brand"] == "Test Vendor"
    assert ga4_product["item_category"] == "Test Type"
    assert ga4_product["item_category2"] == "tag1, tag2, tag3"


@pytest.fixture
def shopify_transaction():
    """Create a Shopify transaction for testing."""
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


def test_map_transaction_to_ga4(shopify_transaction):
    """Test mapping a Shopify transaction to GA4 format."""
    ga4_transaction = GA4Mapper.map_transaction_to_ga4(shopify_transaction)
    
    assert ga4_transaction["transaction_id"] == "transaction_123"
    assert ga4_transaction["value"] == "5000.00"
    assert ga4_transaction["currency"] == "JPY"
    assert ga4_transaction["payment_status"] == "success"
    assert ga4_transaction["payment_type"] == "stripe"
    assert ga4_transaction["event_timestamp"] is not None


def test_orders_to_ga4_dataframe():
    """Test converting orders to a GA4 format DataFrame."""
    orders = [
        {
            "order_id": "123456789",
            "created_at": "2023-01-01T12:00:00Z",
            "currency": "JPY",
            "total_price": "5000.00"
        },
        {
            "order_id": "987654321",
            "created_at": "2023-01-02T12:00:00Z",
            "currency": "USD",
            "total_price": "100.00"
        }
    ]
    
    df = GA4Mapper.orders_to_ga4_dataframe(orders)
    
    assert isinstance(df, pd.DataFrame)
    assert len(df) == 2
    assert "transaction_id" in df.columns
    assert "currency" in df.columns
    assert "value" in df.columns
    assert "event_timestamp" in df.columns
    assert df["transaction_id"].tolist() == ["123456789", "987654321"]
    assert df["currency"].tolist() == ["JPY", "USD"]
    assert df["value"].tolist() == ["5000.00", "100.00"]
