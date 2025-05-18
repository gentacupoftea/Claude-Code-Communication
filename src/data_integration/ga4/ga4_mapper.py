"""GA4 Integration module for Shopify data."""
from typing import Any, Dict, List, Optional
import logging
from datetime import datetime

import pandas as pd

logger = logging.getLogger(__name__)


class GA4Mapper:
    """Maps Shopify data to GA4 format according to the common data model."""

    @staticmethod
    def map_order_to_ga4(order: Dict[str, Any]) -> Dict[str, Any]:
        """Map a Shopify order to GA4 format.
        
        Args:
            order: The Shopify order data.
            
        Returns:
            The order data in GA4 format.
        """
        ga4_order = {
            "transaction_id": order.get("order_id") or order.get("id"),
            "event_timestamp": GA4Mapper._convert_timestamp(order.get("created_at")),
            "payment_status": order.get("financial_status"),
            "shipping_status": order.get("fulfillment_status"),
            "currency": order.get("currency"),
            "value": order.get("total_price"),
            "item_revenue": order.get("subtotal_price"),
            "tax": order.get("total_tax"),
            "discount": order.get("total_discounts"),
            "shipping": order.get("total_shipping")
        }
        
        if "customer" in order and order["customer"]:
            ga4_order.update({
                "user_id": order["customer"].get("id"),
                "user_email": order["customer"].get("email"),
                "user_first_name": order["customer"].get("first_name"),
                "user_last_name": order["customer"].get("last_name")
            })
        
        if "line_items" in order and order["line_items"]:
            ga4_order["items"] = [
                GA4Mapper._map_line_item_to_ga4(item) for item in order["line_items"]
            ]
        
        return ga4_order

    @staticmethod
    def map_orders_to_ga4(orders: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Map a list of Shopify orders to GA4 format.
        
        Args:
            orders: The list of Shopify order data.
            
        Returns:
            The list of order data in GA4 format.
        """
        return [GA4Mapper.map_order_to_ga4(order) for order in orders]

    @staticmethod
    def map_product_to_ga4(product: Dict[str, Any]) -> Dict[str, Any]:
        """Map a Shopify product to GA4 format.
        
        Args:
            product: The Shopify product data.
            
        Returns:
            The product data in GA4 format.
        """
        ga4_product = {
            "item_id": product.get("product_id") or product.get("id"),
            "item_name": product.get("title"),
            "item_brand": product.get("vendor"),
            "item_category": product.get("product_type")
        }
        
        if "tags" in product and product["tags"]:
            ga4_product["item_category2"] = product["tags"]
        
        return ga4_product

    @staticmethod
    def map_products_to_ga4(products: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Map a list of Shopify products to GA4 format.
        
        Args:
            products: The list of Shopify product data.
            
        Returns:
            The list of product data in GA4 format.
        """
        return [GA4Mapper.map_product_to_ga4(product) for product in products]

    @staticmethod
    def map_transaction_to_ga4(transaction: Dict[str, Any]) -> Dict[str, Any]:
        """Map a Shopify transaction to GA4 format.
        
        Args:
            transaction: The Shopify transaction data.
            
        Returns:
            The transaction data in GA4 format.
        """
        ga4_transaction = {
            "transaction_id": transaction.get("transaction_id") or transaction.get("id"),
            "value": transaction.get("amount"),
            "currency": transaction.get("currency"),
            "payment_status": transaction.get("status"),
            "payment_type": transaction.get("gateway"),
            "event_timestamp": GA4Mapper._convert_timestamp(transaction.get("created_at"))
        }
        
        return ga4_transaction

    @staticmethod
    def map_transactions_to_ga4(transactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Map a list of Shopify transactions to GA4 format.
        
        Args:
            transactions: The list of Shopify transaction data.
            
        Returns:
            The list of transaction data in GA4 format.
        """
        return [GA4Mapper.map_transaction_to_ga4(transaction) for transaction in transactions]

    @staticmethod
    def orders_to_ga4_dataframe(orders: List[Dict[str, Any]]) -> pd.DataFrame:
        """Convert a list of Shopify orders to a GA4 format DataFrame.
        
        Args:
            orders: The list of Shopify order data.
            
        Returns:
            DataFrame with orders in GA4 format.
        """
        ga4_orders = GA4Mapper.map_orders_to_ga4(orders)
        df = pd.DataFrame(ga4_orders)
        
        if "event_timestamp" in df.columns:
            df["event_timestamp"] = pd.to_datetime(df["event_timestamp"]).dt.tz_localize(None)
        
        return df

    @staticmethod
    def _map_line_item_to_ga4(item: Dict[str, Any]) -> Dict[str, Any]:
        """Map a Shopify line item to GA4 format.
        
        Args:
            item: The Shopify line item data.
            
        Returns:
            The line item data in GA4 format.
        """
        ga4_item = {
            "item_id": item.get("product_id"),
            "item_variant_id": item.get("variant_id"),
            "item_name": item.get("title"),
            "quantity": item.get("quantity"),
            "price": item.get("price"),
            "item_revenue": item.get("total_price")
        }
        
        return ga4_item

    @staticmethod
    def _convert_timestamp(timestamp: Optional[str]) -> Optional[str]:
        """Convert a Shopify timestamp to GA4 format.
        
        Args:
            timestamp: The Shopify timestamp string.
            
        Returns:
            The timestamp in GA4 format.
        """
        if not timestamp:
            return None
            
        try:
            dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            return dt.isoformat()
        except (ValueError, TypeError):
            logger.warning(f"Failed to convert timestamp: {timestamp}")
            return None
