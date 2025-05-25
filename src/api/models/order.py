#!/usr/bin/env python
# -*- coding: utf-8 -*-

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Union

@dataclass
class Address:
    """Address data model."""
    name: str
    address1: str
    city: str
    province: Optional[str] = None
    country: str = "JP"
    postal_code: Optional[str] = None
    address2: Optional[str] = None
    company: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None

@dataclass
class LineItem:
    """Order line item data model."""
    sku: str
    quantity: int
    price: float
    title: Optional[str] = None
    variant_id: Optional[str] = None
    product_id: Optional[str] = None
    tax_amount: Optional[float] = None
    discount_amount: Optional[float] = None
    properties: Dict[str, str] = field(default_factory=dict)

@dataclass
class Order:
    """Order data model for standardized representation."""
    order_number: str
    email: Optional[str]
    created_at: datetime
    total_price: float
    line_items: List[LineItem]
    order_id: Optional[str] = None
    updated_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    status: str = "open"
    currency: str = "JPY"
    shipping_address: Optional[Address] = None
    billing_address: Optional[Address] = None
    shipping_amount: Optional[float] = None
    tax_amount: Optional[float] = None
    discount_amount: Optional[float] = None
    note: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    source: Optional[str] = None
    source_id: Optional[str] = None
    metadata: Dict[str, any] = field(default_factory=dict)
    
    @classmethod
    def from_amazon_order(cls, order_data: Dict, order_items: List[Dict]) -> 'Order':
        """
        Create an Order from Amazon SP API order data.
        
        Args:
            order_data: Amazon SP API order data
            order_items: Amazon SP API order items data
        
        Returns:
            Standardized Order object
        """
        # Extract order info
        order_id = order_data.get("AmazonOrderId", "")
        order_status = order_data.get("OrderStatus", "").lower()
        
        # Map Amazon status to standardized status
        status_map = {
            "pending": "open",
            "unshipped": "open",
            "partiallyshipped": "partially_fulfilled",
            "shipped": "fulfilled",
            "canceled": "cancelled",
            "unfulfillable": "cancelled"
        }
        status = status_map.get(order_status, "open")
        
        # Parse dates
        created_at = datetime.now()
        updated_at = None
        closed_at = None
        cancelled_at = None
        
        if "PurchaseDate" in order_data:
            try:
                created_at = datetime.fromisoformat(order_data["PurchaseDate"].replace('Z', '+00:00'))
            except (ValueError, TypeError):
                pass
        
        if "LastUpdateDate" in order_data:
            try:
                updated_at = datetime.fromisoformat(order_data["LastUpdateDate"].replace('Z', '+00:00'))
            except (ValueError, TypeError):
                pass
        
        if status == "fulfilled" and "LastUpdateDate" in order_data:
            try:
                closed_at = datetime.fromisoformat(order_data["LastUpdateDate"].replace('Z', '+00:00'))
            except (ValueError, TypeError):
                pass
        
        if status == "cancelled" and "LastUpdateDate" in order_data:
            try:
                cancelled_at = datetime.fromisoformat(order_data["LastUpdateDate"].replace('Z', '+00:00'))
            except (ValueError, TypeError):
                pass
        
        # Extract shipping address
        shipping_address = None
        if "ShippingAddress" in order_data:
            addr = order_data["ShippingAddress"]
            shipping_address = Address(
                name=addr.get("Name", ""),
                address1=addr.get("AddressLine1", ""),
                address2=addr.get("AddressLine2", ""),
                city=addr.get("City", ""),
                province=addr.get("StateOrRegion", ""),
                postal_code=addr.get("PostalCode", ""),
                country=addr.get("CountryCode", "JP"),
                phone=addr.get("Phone", "")
            )
        
        # Extract money values
        total_price = 0.0
        if "OrderTotal" in order_data:
            try:
                total_price = float(order_data["OrderTotal"].get("Amount", "0"))
            except (ValueError, TypeError):
                pass
        
        shipping_amount = 0.0
        if "ShippingPrice" in order_data:
            try:
                shipping_amount = float(order_data["ShippingPrice"].get("Amount", "0"))
            except (ValueError, TypeError):
                pass
        
        # Create line items
        line_items = []
        for item in order_items:
            price = 0.0
            if "ItemPrice" in item:
                try:
                    price = float(item["ItemPrice"].get("Amount", "0"))
                except (ValueError, TypeError):
                    pass
            
            quantity = 1
            if "QuantityOrdered" in item:
                try:
                    quantity = int(item["QuantityOrdered"])
                except (ValueError, TypeError):
                    pass
            
            tax_amount = 0.0
            if "ItemTax" in item:
                try:
                    tax_amount = float(item["ItemTax"].get("Amount", "0"))
                except (ValueError, TypeError):
                    pass
            
            line_items.append(LineItem(
                sku=item.get("SellerSKU", ""),
                quantity=quantity,
                price=price / quantity if quantity > 0 else price,
                title=item.get("Title", ""),
                variant_id=item.get("ASIN", ""),
                product_id=item.get("ASIN", ""),
                tax_amount=tax_amount
            ))
        
        # Create order
        order = cls(
            order_number=order_id,
            email=order_data.get("BuyerEmail", ""),
            created_at=created_at,
            updated_at=updated_at,
            closed_at=closed_at,
            cancelled_at=cancelled_at,
            total_price=total_price,
            status=status,
            currency=order_data.get("OrderTotal", {}).get("CurrencyCode", "JPY"),
            shipping_address=shipping_address,
            billing_address=shipping_address,  # Amazon typically uses same address for both
            shipping_amount=shipping_amount,
            line_items=line_items,
            note=order_data.get("BuyerNote", ""),
            source="amazon",
            source_id=order_id,
            metadata={
                "amazon_order_type": order_data.get("OrderType", ""),
                "amazon_fulfillment_channel": order_data.get("FulfillmentChannel", ""),
                "amazon_sales_channel": order_data.get("SalesChannel", ""),
                "amazon_marketplace_id": order_data.get("MarketplaceId", "")
            }
        )
        
        return order
    
    @classmethod
    def from_nextengine_order(cls, order_data: Dict, order_rows: List[Dict]) -> 'Order':
        """
        Create an Order from NextEngine order data.
        
        Args:
            order_data: NextEngine order data
            order_rows: NextEngine order row data
        
        Returns:
            Standardized Order object
        """
        # Extract order info
        order_id = order_data.get("receive_order_id", "")
        order_number = order_data.get("receive_order_shop_no", order_id)
        
        # Map NextEngine status to standardized status
        status_map = {
            "1": "open",            # 新規受注
            "2": "open",            # 入金待ち
            "3": "open",            # 決済中
            "4": "open",            # 入金済み
            "5": "partially_fulfilled",  # 一部発送
            "6": "fulfilled",       # 発送完了
            "7": "cancelled",       # キャンセル
            "8": "cancelled",       # 取り寄せ中
            "9": "cancelled"        # 保留
        }
        ne_status = order_data.get("receive_order_status", "1")
        status = status_map.get(ne_status, "open")
        
        # Parse dates
        created_at = datetime.now()
        updated_at = None
        closed_at = None
        cancelled_at = None
        
        if "receive_order_date" in order_data:
            try:
                created_at = datetime.strptime(order_data["receive_order_date"], "%Y-%m-%d %H:%M:%S")
            except (ValueError, TypeError):
                pass
        
        if "receive_order_modified_date" in order_data:
            try:
                updated_at = datetime.strptime(order_data["receive_order_modified_date"], "%Y-%m-%d %H:%M:%S")
            except (ValueError, TypeError):
                pass
        
        if status == "fulfilled" and "receive_order_send_date" in order_data:
            try:
                closed_at = datetime.strptime(order_data["receive_order_send_date"], "%Y-%m-%d %H:%M:%S")
            except (ValueError, TypeError):
                pass
        
        if status == "cancelled" and "receive_order_modified_date" in order_data:
            try:
                cancelled_at = datetime.strptime(order_data["receive_order_modified_date"], "%Y-%m-%d %H:%M:%S")
            except (ValueError, TypeError):
                pass
        
        # Extract shipping address
        shipping_address = None
        if all(k in order_data for k in ["receive_order_delivery_name", "receive_order_delivery_address1"]):
            shipping_address = Address(
                name=order_data.get("receive_order_delivery_name", ""),
                address1=order_data.get("receive_order_delivery_address1", ""),
                address2=order_data.get("receive_order_delivery_address2", ""),
                city=order_data.get("receive_order_delivery_address1", "").split()[0] if order_data.get("receive_order_delivery_address1") else "",
                postal_code=order_data.get("receive_order_delivery_zip", ""),
                country="JP",
                phone=order_data.get("receive_order_delivery_tel", "")
            )
        
        # Extract billing address
        billing_address = None
        if all(k in order_data for k in ["receive_order_customer_name", "receive_order_customer_address1"]):
            billing_address = Address(
                name=order_data.get("receive_order_customer_name", ""),
                address1=order_data.get("receive_order_customer_address1", ""),
                address2=order_data.get("receive_order_customer_address2", ""),
                city=order_data.get("receive_order_customer_address1", "").split()[0] if order_data.get("receive_order_customer_address1") else "",
                postal_code=order_data.get("receive_order_customer_zip", ""),
                country="JP",
                phone=order_data.get("receive_order_customer_tel", ""),
                email=order_data.get("receive_order_customer_mail", "")
            )
        
        # Extract money values
        total_price = 0.0
        if "receive_order_total_amount" in order_data:
            try:
                total_price = float(order_data["receive_order_total_amount"])
            except (ValueError, TypeError):
                pass
        
        shipping_amount = 0.0
        if "receive_order_delivery_fee" in order_data:
            try:
                shipping_amount = float(order_data["receive_order_delivery_fee"])
            except (ValueError, TypeError):
                pass
        
        tax_amount = 0.0
        if "receive_order_consumption_tax" in order_data:
            try:
                tax_amount = float(order_data["receive_order_consumption_tax"])
            except (ValueError, TypeError):
                pass
        
        # Create line items
        line_items = []
        for row in order_rows:
            price = 0.0
            if "receive_order_row_unit_price" in row:
                try:
                    price = float(row["receive_order_row_unit_price"])
                except (ValueError, TypeError):
                    pass
            
            quantity = 1
            if "receive_order_row_quantity" in row:
                try:
                    quantity = int(row["receive_order_row_quantity"])
                except (ValueError, TypeError):
                    quantity = 1
            
            line_items.append(LineItem(
                sku=row.get("receive_order_row_goods_code", ""),
                quantity=quantity,
                price=price,
                title=row.get("receive_order_row_goods_name", ""),
                product_id=row.get("receive_order_row_goods_id", "")
            ))
        
        # Create order
        order = cls(
            order_id=order_id,
            order_number=order_number,
            email=order_data.get("receive_order_customer_mail", ""),
            created_at=created_at,
            updated_at=updated_at,
            closed_at=closed_at,
            cancelled_at=cancelled_at,
            total_price=total_price,
            status=status,
            currency="JPY",
            shipping_address=shipping_address,
            billing_address=billing_address,
            shipping_amount=shipping_amount,
            tax_amount=tax_amount,
            line_items=line_items,
            note=order_data.get("receive_order_message", ""),
            source="nextengine",
            source_id=order_id,
            metadata={
                "ne_receive_order_shop_id": order_data.get("receive_order_shop_id", ""),
                "ne_receive_order_paid_status": order_data.get("receive_order_paid_status", ""),
                "ne_receive_order_type": order_data.get("receive_order_type", "")
            }
        )
        
        return order
    
    def to_dict(self) -> Dict:
        """
        Convert the order to a dictionary.
        
        Returns:
            Dictionary representation of the order
        """
        return {
            "order_id": self.order_id,
            "order_number": self.order_number,
            "email": self.email,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "closed_at": self.closed_at.isoformat() if self.closed_at else None,
            "cancelled_at": self.cancelled_at.isoformat() if self.cancelled_at else None,
            "total_price": self.total_price,
            "status": self.status,
            "currency": self.currency,
            "shipping_address": vars(self.shipping_address) if self.shipping_address else None,
            "billing_address": vars(self.billing_address) if self.billing_address else None,
            "shipping_amount": self.shipping_amount,
            "tax_amount": self.tax_amount,
            "discount_amount": self.discount_amount,
            "line_items": [vars(item) for item in self.line_items],
            "note": self.note,
            "tags": self.tags,
            "source": self.source,
            "source_id": self.source_id,
            "metadata": self.metadata
        }