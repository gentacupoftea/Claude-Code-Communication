"""Data validation for incoming and outgoing data."""

from typing import Dict, Any, List, Optional, Union
from pydantic import BaseModel, ValidationError
import json
import re

class DataValidator:
    """データバリデーションを行います。"""
    
    @staticmethod
    def validate_email(email: str) -> bool:
        """メールアドレスの検証を行います。"""
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return bool(re.match(pattern, email))
    
    @staticmethod
    def validate_phone(phone: str) -> bool:
        """電話番号の検証を行います。"""
        pattern = r'^\+?[1-9]\d{1,14}$'
        cleaned = re.sub(r'\D', '', phone)
        return bool(re.match(pattern, cleaned))
    
    @staticmethod
    def validate_currency(currency: str) -> bool:
        """通貨コードの検証を行います。"""
        return currency.upper() in ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD']
    
    @staticmethod
    def validate_shopify_domain(domain: str) -> bool:
        """Shopifyドメインの検証を行います。"""
        pattern = r'^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$'
        return bool(re.match(pattern, domain))
    
    @staticmethod
    def validate_product_data(product: Dict[str, Any]) -> List[str]:
        """商品データの検証を行い、エラーのリストを返します。"""
        errors = []
        
        if not product.get('title'):
            errors.append("Title is required")
        
        if not product.get('vendor'):
            errors.append("Vendor is required")
            
        if 'price' in product:
            try:
                price = float(product['price'])
                if price < 0:
                    errors.append("Price must be non-negative")
            except (ValueError, TypeError):
                errors.append("Invalid price format")
        
        if product.get('inventory_quantity') is not None:
            try:
                qty = int(product['inventory_quantity'])
                if qty < 0:
                    errors.append("Inventory quantity must be non-negative")
            except (ValueError, TypeError):
                errors.append("Invalid inventory quantity format")
        
        return errors
    
    @staticmethod
    def validate_order_data(order: Dict[str, Any]) -> List[str]:
        """注文データの検証を行い、エラーのリストを返します。"""
        errors = []
        
        if not order.get('email'):
            errors.append("Email is required")
        elif not DataValidator.validate_email(order['email']):
            errors.append("Invalid email format")
        
        if not order.get('line_items'):
            errors.append("Order must have at least one line item")
        
        if order.get('financial_status') not in ['pending', 'paid', 'refunded', 'voided']:
            errors.append("Invalid financial status")
        
        return errors
    
    @staticmethod
    def validate_customer_data(customer: Dict[str, Any]) -> List[str]:
        """顧客データの検証を行い、エラーのリストを返します。"""
        errors = []
        
        if not customer.get('email'):
            errors.append("Email is required")
        elif not DataValidator.validate_email(customer['email']):
            errors.append("Invalid email format")
        
        if not customer.get('first_name') or not customer.get('last_name'):
            errors.append("First name and last name are required")
        
        if customer.get('phone') and not DataValidator.validate_phone(customer['phone']):
            errors.append("Invalid phone number format")
        
        return errors
    
    @staticmethod
    def sanitize_string(value: str) -> str:
        """文字列をサニタイズします。"""
        # Remove HTML tags
        value = re.sub('<.*?>', '', value)
        # Remove excessive whitespace
        value = ' '.join(value.split())
        return value.strip()
    
    @staticmethod
    def sanitize_data(data: Dict[str, Any]) -> Dict[str, Any]:
        """データ全体をサニタイズします。"""
        sanitized = {}
        for key, value in data.items():
            if isinstance(value, str):
                sanitized[key] = DataValidator.sanitize_string(value)
            elif isinstance(value, dict):
                sanitized[key] = DataValidator.sanitize_data(value)
            elif isinstance(value, list):
                sanitized[key] = [
                    DataValidator.sanitize_data(item) if isinstance(item, dict) else item
                    for item in value
                ]
            else:
                sanitized[key] = value
        return sanitized
