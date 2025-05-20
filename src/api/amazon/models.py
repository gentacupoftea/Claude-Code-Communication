"""
Amazon API data models
"""

from datetime import datetime
from typing import Dict, Any, List, Optional

from ..abstract.base_models import (
    BaseProduct, BaseOrder, BaseCustomer, BaseAddress, BaseLineItem,
    ProductStatus, OrderStatus, PaymentStatus
)


class AmazonProduct(BaseProduct):
    """Amazon product model"""
    
    @classmethod
    def from_platform_format(cls, data: Dict[str, Any]) -> 'AmazonProduct':
        """
        Create product from Amazon API format
        
        Args:
            data: Amazon API product data
            
        Returns:
            AmazonProduct instance
        """
        # Determine status
        status = ProductStatus.ACTIVE
        if data.get("status") == "INACTIVE":
            status = ProductStatus.DRAFT
        
        # Get images
        images = []
        for image in data.get("images", []):
            images.append({
                "url": image.get("link", ""),
                "position": image.get("height", 0),
                "alt": "",
            })
        
        # Create product
        return cls(
            id=data.get("asin", ""),
            title=data.get("attributes", {}).get("title", {}).get("value", ""),
            description=data.get("attributes", {}).get("productDescription", {}).get("value", ""),
            created_at=None,  # Amazon doesn't provide creation date
            updated_at=None,  # Amazon doesn't provide update date
            status=status,
            images=images,
            options=[],  # Amazon doesn't provide options in the same way
            variants=[],  # Variants would need to be processed separately
            price=None,  # Price not included in catalog item response
            sku=data.get("identifiers", {}).get("SKU", ""),
            vendor=data.get("attributes", {}).get("brand", {}).get("value", ""),
            product_type=data.get("productTypes", [None])[0] if data.get("productTypes") else None,
            platform_data=data
        )
    
    def to_platform_format(self) -> Dict[str, Any]:
        """
        Convert to Amazon API format
        
        Returns:
            Product data in Amazon API format
        """
        # Amazon doesn't allow direct creation/update of products
        # This method would be used for inventory updates only
        return {
            "productId": self.id,
            "sku": self.sku,
            "quantity": self.platform_data.get("quantity", 0)
        }


class AmazonOrder(BaseOrder):
    """Amazon order model"""
    
    @classmethod
    def from_platform_format(cls, data: Dict[str, Any]) -> 'AmazonOrder':
        """
        Create order from Amazon API format
        
        Args:
            data: Amazon API order data
            
        Returns:
            AmazonOrder instance
        """
        # Map Amazon order status to common status
        status_map = {
            "PendingAvailability": OrderStatus.PENDING,
            "Pending": OrderStatus.PENDING,
            "Unshipped": OrderStatus.PROCESSING,
            "PartiallyShipped": OrderStatus.PARTIALLY_SHIPPED,
            "Shipped": OrderStatus.SHIPPED,
            "Canceled": OrderStatus.CANCELLED,
            "Unfulfillable": OrderStatus.FAILED
        }
        
        status = status_map.get(data.get("orderStatus"), OrderStatus.OTHER)
        
        # Process line items
        line_items = []
        for item in data.get("items", []):
            line_items.append(BaseLineItem(
                id=item.get("orderItemId", ""),
                product_id=item.get("asin", ""),
                sku=item.get("sellerSku", ""),
                name=item.get("title", ""),
                quantity=int(item.get("quantityOrdered", 0)),
                price=float(item.get("itemPrice", {}).get("amount", 0)),
                total=float(item.get("itemPrice", {}).get("amount", 0)) * int(item.get("quantityOrdered", 0)),
                currency=item.get("itemPrice", {}).get("currencyCode", ""),
                refunded=False,
                metadata={}
            ))
        
        # Create address if available
        shipping_address = None
        address_data = data.get("shippingAddress", {})
        if address_data:
            shipping_address = BaseAddress(
                name=f"{address_data.get('name', '')}",
                company=address_data.get('company', ''),
                street_address=address_data.get('addressLine1', ''),
                street_address2=address_data.get('addressLine2', ''),
                city=address_data.get('city', ''),
                state=address_data.get('stateOrRegion', ''),
                postal_code=address_data.get('postalCode', ''),
                country=address_data.get('countryCode', ''),
                phone=address_data.get('phoneNumber', ''),
                email=""  # Not provided in shipping address
            )
        
        # Create customer
        customer = BaseCustomer(
            id="",  # Amazon doesn't provide customer ID
            email=data.get("buyerInfo", {}).get("buyerEmail", ""),
            name=data.get("buyerInfo", {}).get("buyerName", ""),
            phone="",
            addresses=[shipping_address] if shipping_address else [],
            tags=[],
            metadata={}
        )
        
        # Determine payment status
        payment_status = PaymentStatus.PAID  # Amazon orders are typically pre-paid
        
        # Create order
        return cls(
            id=data.get("amazonOrderId", ""),
            number=data.get("amazonOrderId", ""),
            status=status,
            payment_status=payment_status,
            fulfillment_status=status if status in [OrderStatus.SHIPPED, OrderStatus.PARTIALLY_SHIPPED] else None,
            created_at=data.get("purchaseDate"),
            updated_at=data.get("lastUpdateDate"),
            customer=customer,
            shipping_address=shipping_address,
            billing_address=shipping_address,  # Amazon doesn't provide separate billing address
            line_items=line_items,
            subtotal=float(data.get("orderTotal", {}).get("amount", 0)),
            shipping=0.0,  # Need to calculate from order items
            tax=0.0,  # Need to calculate from order items
            total=float(data.get("orderTotal", {}).get("amount", 0)),
            currency=data.get("orderTotal", {}).get("currencyCode", ""),
            tags=[],
            notes=data.get("orderType", ""),
            metadata={},
            platform_data=data
        )
    
    def to_platform_format(self) -> Dict[str, Any]:
        """
        Convert to Amazon API format
        
        Returns:
            Order data in Amazon API format
        """
        # Amazon doesn't allow order creation, this would only be for updates
        return {
            "orderId": self.id,
            "marketplaceId": self.platform_data.get("marketplaceId"),
            "orderStatus": self.status.value
        }