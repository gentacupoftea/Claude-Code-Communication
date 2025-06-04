#!/usr/bin/env python
# -*- coding: utf-8 -*-

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Union

@dataclass
class ProductImage:
    """Product image data model."""
    url: str
    position: int = 0
    alt_text: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None

@dataclass
class ProductVariant:
    """Product variant data model."""
    sku: str
    price: float
    inventory_quantity: int = 0
    variant_id: Optional[str] = None
    barcode: Optional[str] = None
    title: Optional[str] = None
    weight: Optional[float] = None
    weight_unit: Optional[str] = "kg"
    option1: Optional[str] = None
    option2: Optional[str] = None
    option3: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

@dataclass
class Product:
    """Product data model for standardized representation."""
    title: str
    sku: str
    description: Optional[str] = None
    product_id: Optional[str] = None
    product_type: Optional[str] = None
    vendor: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    variants: List[ProductVariant] = field(default_factory=list)
    images: List[ProductImage] = field(default_factory=list)
    options: List[Dict[str, Union[str, List[str]]]] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    source: Optional[str] = None
    source_id: Optional[str] = None
    metadata: Dict[str, any] = field(default_factory=dict)
    
    @classmethod
    def from_amazon_listing(cls, listing_data: Dict) -> 'Product':
        """
        Create a Product from Amazon SP API listing data.
        
        Args:
            listing_data: Amazon SP API listing data
        
        Returns:
            Standardized Product object
        """
        sku = listing_data.get("sku", "")
        attributes = listing_data.get("attributes", {})
        
        # Extract basic information
        title = attributes.get("title", [{"value": "Unknown"}])[0].get("value", "Unknown")
        description = attributes.get("bullet_point", [{"value": ""}])[0].get("value", "")
        if "product_description" in attributes:
            description += "\n\n" + attributes.get("product_description", [{"value": ""}])[0].get("value", "")
        
        # Extract images
        images = []
        if "main_image" in attributes:
            main_image_url = attributes.get("main_image", [{"value": ""}])[0].get("value", "")
            if main_image_url:
                images.append(ProductImage(url=main_image_url, position=0))
        
        if "other_image" in attributes:
            other_images = attributes.get("other_image", [])
            for i, img in enumerate(other_images, 1):
                img_url = img.get("value", "")
                if img_url:
                    images.append(ProductImage(url=img_url, position=i))
        
        # Create variant
        price = 0.0
        if "list_price" in attributes:
            price_str = attributes.get("list_price", [{"value": "0"}])[0].get("value", "0")
            try:
                price = float(price_str)
            except (ValueError, TypeError):
                price = 0.0
        
        variant = ProductVariant(
            sku=sku,
            price=price,
            barcode=attributes.get("external_product_id", [{"value": ""}])[0].get("value", ""),
            title=title
        )
        
        # Create product
        product = cls(
            title=title,
            sku=sku,
            description=description,
            product_type=attributes.get("item_type", [{"value": ""}])[0].get("value", ""),
            vendor=attributes.get("brand", [{"value": ""}])[0].get("value", ""),
            variants=[variant],
            images=images,
            source="amazon",
            source_id=sku,
            metadata={
                "amazon_marketplace_id": listing_data.get("marketplaceId", ""),
                "amazon_condition": attributes.get("condition", [{"value": "New"}])[0].get("value", "New"),
                "amazon_condition_note": attributes.get("condition_note", [{"value": ""}])[0].get("value", "")
            }
        )
        
        return product
    
    @classmethod
    def from_nextengine_product(cls, product_data: Dict) -> 'Product':
        """
        Create a Product from NextEngine product data.
        
        Args:
            product_data: NextEngine product data
        
        Returns:
            Standardized Product object
        """
        sku = product_data.get("goods_code", "")
        title = product_data.get("goods_name", "Unknown")
        
        # Extract dates
        created_at = datetime.now()
        updated_at = datetime.now()
        
        if "goods_creation_date" in product_data:
            try:
                created_at = datetime.strptime(product_data["goods_creation_date"], "%Y-%m-%d %H:%M:%S")
            except (ValueError, TypeError):
                pass
        
        if "goods_modified_date" in product_data:
            try:
                updated_at = datetime.strptime(product_data["goods_modified_date"], "%Y-%m-%d %H:%M:%S")
            except (ValueError, TypeError):
                pass
        
        # Create variant
        price = 0.0
        if "goods_selling_price" in product_data:
            try:
                price = float(product_data["goods_selling_price"])
            except (ValueError, TypeError):
                pass
        
        inventory = 0
        if "goods_stock_quantity" in product_data:
            try:
                inventory = int(product_data["goods_stock_quantity"])
            except (ValueError, TypeError):
                pass
        
        variant = ProductVariant(
            sku=sku,
            price=price,
            inventory_quantity=inventory,
            barcode=product_data.get("goods_jan_code", ""),
            title=title,
            created_at=created_at,
            updated_at=updated_at
        )
        
        # Create product
        product = cls(
            title=title,
            sku=sku,
            description=product_data.get("goods_description", ""),
            product_id=product_data.get("goods_id", ""),
            product_type=product_data.get("goods_category", ""),
            variants=[variant],
            created_at=created_at,
            updated_at=updated_at,
            source="nextengine",
            source_id=product_data.get("goods_id", ""),
            metadata={
                "goods_model_number": product_data.get("goods_model_number", ""),
                "goods_maker_name": product_data.get("goods_maker_name", ""),
                "goods_tag": product_data.get("goods_tag", "")
            }
        )
        
        return product
    
    def to_dict(self) -> Dict:
        """
        Convert the product to a dictionary.
        
        Returns:
            Dictionary representation of the product
        """
        return {
            "product_id": self.product_id,
            "title": self.title,
            "sku": self.sku,
            "description": self.description,
            "product_type": self.product_type,
            "vendor": self.vendor,
            "tags": self.tags,
            "variants": [vars(v) for v in self.variants],
            "images": [vars(i) for i in self.images],
            "options": self.options,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "source": self.source,
            "source_id": self.source_id,
            "metadata": self.metadata
        }