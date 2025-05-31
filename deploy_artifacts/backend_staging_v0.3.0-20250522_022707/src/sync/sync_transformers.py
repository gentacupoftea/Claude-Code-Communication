"""
Sync Transformers - Data transformation utilities for sync operations.

This module provides functions for transforming data between Shopify and
external systems during synchronization operations.
"""

import logging
import re
from typing import Dict, List, Any, Optional, Union, Tuple


class ShopifyToRakutenTransformer:
    """
    Transformer for Shopify to Rakuten data conversions.
    
    This class provides methods to transform Shopify data formats to
    Rakuten RMS compatible formats for synchronization operations.
    """
    
    def __init__(self, options: Optional[Dict[str, Any]] = None):
        """
        Initialize the transformer.
        
        Args:
            options: Optional configuration options
        """
        self.options = options or {}
        self.logger = logging.getLogger("ShopifyToRakutenTransformer")
    
    def transform_product(self, shopify_product: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform a Shopify product to Rakuten format.
        
        Args:
            shopify_product: Shopify product data
            
        Returns:
            Rakuten product data
        """
        # Create base product with required fields
        rakuten_product = {
            "title": shopify_product.get("title", ""),
            "description": self._extract_description(shopify_product),
            "price": self._extract_price(shopify_product),
            "sku": shopify_product.get("sku", "")
        }
        
        # Add ID if available
        if "id" in shopify_product:
            rakuten_product["id"] = str(shopify_product["id"])
        
        # Add inventory if available
        inventory = self._extract_inventory(shopify_product)
        if inventory is not None:
            rakuten_product["inventory"] = inventory
        
        # Add images
        rakuten_product["images"] = self._extract_images(shopify_product)
        
        # Add variants
        rakuten_product["variants"] = self._extract_variants(shopify_product)
        
        return rakuten_product
    
    def transform_order(self, shopify_order: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform a Shopify order to Rakuten format.
        
        Args:
            shopify_order: Shopify order data
            
        Returns:
            Rakuten order data
        """
        # Create base order with required fields
        rakuten_order = {
            "id": str(shopify_order.get("id", "")),
            "status": self._map_order_status(shopify_order.get("financial_status", "")),
            "paymentAmount": float(shopify_order.get("total_price", 0)),
            "goodsPrice": float(shopify_order.get("subtotal_price", 0)),
            "goodsTax": self._extract_tax(shopify_order),
            "shippingFee": float(shopify_order.get("shipping_line", {}).get("price", 0))
        }
        
        # Add shipping address
        if "shipping_address" in shopify_order:
            shipping = shopify_order["shipping_address"]
            rakuten_order["shipping"] = {
                "name": f"{shipping.get('first_name', '')} {shipping.get('last_name', '')}".strip(),
                "postal_code": shipping.get("zip", ""),
                "address1": shipping.get("address1", ""),
                "address2": shipping.get("address2", "")
            }
        
        # Add line items
        rakuten_order["line_items"] = []
        if "line_items" in shopify_order:
            for item in shopify_order["line_items"]:
                line_item = {
                    "itemId": str(item.get("product_id", "")),
                    "itemName": item.get("title", ""),
                    "itemCode": item.get("sku", ""),
                    "itemEoCount": item.get("quantity", 0),
                    "itemPrice": float(item.get("price", 0)),
                    "itemEoPrice": float(item.get("price", 0)) * item.get("quantity", 0)
                }
                rakuten_order["line_items"].append(line_item)
        
        return rakuten_order
    
    def transform_customer(self, shopify_customer: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform a Shopify customer to Rakuten format.
        
        Args:
            shopify_customer: Shopify customer data
            
        Returns:
            Rakuten customer data
        """
        # Create base customer with required fields
        rakuten_customer = {
            "id": str(shopify_customer.get("id", "")),
            "emailAddress": shopify_customer.get("email", ""),
            "firstName": shopify_customer.get("first_name", ""),
            "lastName": shopify_customer.get("last_name", ""),
            "phoneNumber": shopify_customer.get("phone", "")
        }
        
        # Add default address if available
        if "default_address" in shopify_customer:
            address = shopify_customer["default_address"]
            rakuten_customer["zipCode"] = address.get("zip", "")
            rakuten_customer["prefecture"] = address.get("province", "")
            rakuten_customer["city"] = address.get("city", "")
            rakuten_customer["address1"] = address.get("address1", "")
            rakuten_customer["address2"] = address.get("address2", "")
        
        return rakuten_customer
    
    def _extract_description(self, shopify_product: Dict[str, Any]) -> str:
        """
        Extract product description from Shopify product.
        
        Args:
            shopify_product: Shopify product data
            
        Returns:
            Product description
        """
        # Try to get HTML description first
        body_html = shopify_product.get("body_html", "")
        if body_html:
            # Simple HTML to plain text conversion
            # In a real implementation, this would use a proper HTML parser
            description = re.sub(r'<[^>]+>', '', body_html)
            return description.strip()
        
        # Fallback to plain description if available
        return shopify_product.get("description", "")
    
    def _extract_price(self, shopify_product: Dict[str, Any]) -> float:
        """
        Extract price from Shopify product.
        
        Args:
            shopify_product: Shopify product data
            
        Returns:
            Product price
        """
        # Try to get price directly
        if "price" in shopify_product:
            try:
                return float(shopify_product["price"])
            except (ValueError, TypeError):
                pass
        
        # Try to get from variants
        if "variants" in shopify_product and shopify_product["variants"]:
            try:
                # Use price of first variant
                return float(shopify_product["variants"][0].get("price", 0))
            except (ValueError, TypeError, IndexError):
                pass
        
        # Fallback to zero
        return 0.0
    
    def _extract_inventory(self, shopify_product: Dict[str, Any]) -> Optional[int]:
        """
        Extract inventory quantity from Shopify product.
        
        Args:
            shopify_product: Shopify product data
            
        Returns:
            Inventory quantity or None if not available
        """
        # Try to get inventory directly
        if "inventory_quantity" in shopify_product:
            try:
                return int(shopify_product["inventory_quantity"])
            except (ValueError, TypeError):
                pass
        
        # Try to get from variants
        if "variants" in shopify_product and shopify_product["variants"]:
            try:
                # Sum inventory across all variants
                return sum(
                    int(variant.get("inventory_quantity", 0))
                    for variant in shopify_product["variants"]
                )
            except (ValueError, TypeError):
                pass
        
        # Not available
        return None
    
    def _extract_images(self, shopify_product: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Extract images from Shopify product.
        
        Args:
            shopify_product: Shopify product data
            
        Returns:
            List of image objects
        """
        images = []
        
        # Get images from product
        if "images" in shopify_product and shopify_product["images"]:
            for i, img in enumerate(shopify_product["images"]):
                image = {
                    "url": img.get("src", ""),
                    "position": img.get("position", i + 1)
                }
                images.append(image)
        
        # Get images from variants if no product images
        elif "variants" in shopify_product and not images:
            for i, variant in enumerate(shopify_product["variants"]):
                if "image" in variant and variant["image"]:
                    image = {
                        "url": variant["image"].get("src", ""),
                        "position": i + 1
                    }
                    images.append(image)
        
        return images
    
    def _extract_variants(self, shopify_product: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Extract variants from Shopify product.
        
        Args:
            shopify_product: Shopify product data
            
        Returns:
            List of variant objects
        """
        variants = []
        
        # Get variants from product
        if "variants" in shopify_product and shopify_product["variants"]:
            # Get options from product
            option_names = {}
            if "options" in shopify_product:
                for option in shopify_product["options"]:
                    option_names[option.get("id")] = option.get("name", "")
            
            # Group variants by option
            option_values = {}
            
            for variant in shopify_product["variants"]:
                for i in range(1, 4):  # Shopify has up to 3 options
                    option_key = f"option{i}"
                    option_value_key = f"option{i}_value"
                    
                    if option_key in variant and option_value_key in variant:
                        option_id = variant[option_key]
                        option_value = variant[option_value_key]
                        
                        option_name = option_names.get(option_id, f"Option {i}")
                        
                        if option_name not in option_values:
                            option_values[option_name] = set()
                        
                        option_values[option_name].add(option_value)
            
            # Convert to Rakuten variant format
            for option_name, values in option_values.items():
                variant = {
                    "option_name": option_name,
                    "option_values": list(values)
                }
                variants.append(variant)
        
        return variants
    
    def _map_order_status(self, shopify_status: str) -> str:
        """
        Map Shopify order status to Rakuten status.
        
        Args:
            shopify_status: Shopify order status
            
        Returns:
            Rakuten order status
        """
        # Map Shopify financial status to Rakuten status
        status_map = {
            "pending": "1",     # Waiting for payment
            "authorized": "2",  # Payment confirmed
            "paid": "2",        # Payment confirmed
            "partially_paid": "2",  # Payment confirmed
            "refunded": "7",    # Cancelled
            "voided": "7",      # Cancelled
            "partially_refunded": "5",  # Shipped with issues
            "failed": "9"       # Error
        }
        
        return status_map.get(shopify_status.lower(), "1")
    
    def _extract_tax(self, shopify_order: Dict[str, Any]) -> float:
        """
        Extract tax amount from Shopify order.
        
        Args:
            shopify_order: Shopify order data
            
        Returns:
            Tax amount
        """
        # Try to get total tax
        if "total_tax" in shopify_order:
            try:
                return float(shopify_order["total_tax"])
            except (ValueError, TypeError):
                pass
        
        # Try to calculate from tax lines
        if "tax_lines" in shopify_order and shopify_order["tax_lines"]:
            try:
                return sum(
                    float(tax.get("price", 0))
                    for tax in shopify_order["tax_lines"]
                )
            except (ValueError, TypeError):
                pass
        
        # Fallback to zero
        return 0.0


class RakutenToShopifyTransformer:
    """
    Transformer for Rakuten to Shopify data conversions.
    
    This class provides methods to transform Rakuten RMS data formats to
    Shopify compatible formats for synchronization operations.
    """
    
    def __init__(self, options: Optional[Dict[str, Any]] = None):
        """
        Initialize the transformer.
        
        Args:
            options: Optional configuration options
        """
        self.options = options or {}
        self.logger = logging.getLogger("RakutenToShopifyTransformer")
    
    def transform_product(self, rakuten_product: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform a Rakuten product to Shopify format.
        
        Args:
            rakuten_product: Rakuten product data
            
        Returns:
            Shopify product data
        """
        # Create base product with required fields
        shopify_product = {
            "title": rakuten_product.get("title", ""),
            "body_html": self._convert_to_html(rakuten_product.get("description", "")),
            "product_type": "",
            "vendor": "",
            "published": True
        }
        
        # Add ID if available
        if "id" in rakuten_product:
            shopify_product["id"] = rakuten_product["id"]
        
        # Add SKU if available
        if "sku" in rakuten_product:
            shopify_product["sku"] = rakuten_product["sku"]
        
        # Add price if available
        if "price" in rakuten_product:
            shopify_product["price"] = str(rakuten_product["price"])
        
        # Add variants
        shopify_product["variants"] = self._transform_variants(rakuten_product)
        
        # Add images
        shopify_product["images"] = self._transform_images(rakuten_product)
        
        # Add options if variants have options
        shopify_product["options"] = self._extract_options(rakuten_product)
        
        return shopify_product
    
    def transform_order(self, rakuten_order: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform a Rakuten order to Shopify format.
        
        Args:
            rakuten_order: Rakuten order data
            
        Returns:
            Shopify order data
        """
        # Create base order with required fields
        shopify_order = {
            "id": rakuten_order.get("id", ""),
            "financial_status": self._map_order_status(rakuten_order.get("status", "")),
            "total_price": str(rakuten_order.get("total_price", 0)),
            "subtotal_price": str(rakuten_order.get("subtotal_price", 0)),
            "total_tax": str(rakuten_order.get("total_tax", 0)),
            "currency": rakuten_order.get("currency", "JPY"),
            "processed_at": rakuten_order.get("created_at", ""),
            "created_at": rakuten_order.get("created_at", ""),
            "updated_at": rakuten_order.get("updated_at", "")
        }
        
        # Add customer if available
        if "customer" in rakuten_order:
            customer = rakuten_order["customer"]
            shopify_order["customer"] = {
                "email": customer.get("email", ""),
                "first_name": customer.get("first_name", ""),
                "last_name": customer.get("last_name", ""),
                "phone": customer.get("phone", "")
            }
        
        # Add shipping address if available
        if "shipping_address" in rakuten_order:
            shipping = rakuten_order["shipping_address"]
            shopify_order["shipping_address"] = {
                "first_name": shipping.get("first_name", ""),
                "last_name": shipping.get("last_name", ""),
                "address1": shipping.get("address1", ""),
                "address2": shipping.get("address2", ""),
                "city": shipping.get("city", ""),
                "zip": shipping.get("zip", ""),
                "country": shipping.get("country", "JP"),
                "phone": shipping.get("phone", "")
            }
        
        # Add line items
        shopify_order["line_items"] = []
        if "line_items" in rakuten_order:
            for item in rakuten_order["line_items"]:
                line_item = {
                    "id": item.get("id", ""),
                    "title": item.get("title", ""),
                    "sku": item.get("sku", ""),
                    "quantity": item.get("quantity", 0),
                    "price": str(item.get("price", 0)),
                    "total_discount": "0.00",
                    "requires_shipping": True
                }
                shopify_order["line_items"].append(line_item)
        
        return shopify_order
    
    def transform_customer(self, rakuten_customer: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform a Rakuten customer to Shopify format.
        
        Args:
            rakuten_customer: Rakuten customer data
            
        Returns:
            Shopify customer data
        """
        # Create base customer with required fields
        shopify_customer = {
            "id": rakuten_customer.get("id", ""),
            "email": rakuten_customer.get("emailAddress", ""),
            "first_name": rakuten_customer.get("firstName", ""),
            "last_name": rakuten_customer.get("lastName", ""),
            "phone": rakuten_customer.get("phoneNumber", ""),
            "accepts_marketing": False,
            "verified_email": True
        }
        
        # Add address if available
        address = {
            "first_name": rakuten_customer.get("firstName", ""),
            "last_name": rakuten_customer.get("lastName", ""),
            "phone": rakuten_customer.get("phoneNumber", ""),
            "zip": rakuten_customer.get("zipCode", ""),
            "province": rakuten_customer.get("prefecture", ""),
            "city": rakuten_customer.get("city", ""),
            "address1": rakuten_customer.get("address1", ""),
            "address2": rakuten_customer.get("address2", ""),
            "country": "Japan",
            "country_code": "JP"
        }
        
        shopify_customer["default_address"] = address
        shopify_customer["addresses"] = [address]
        
        return shopify_customer
    
    def _convert_to_html(self, description: str) -> str:
        """
        Convert plain text description to HTML.
        
        Args:
            description: Plain text description
            
        Returns:
            HTML description
        """
        if not description:
            return ""
        
        # Convert newlines to <br> tags
        html = description.replace("\n", "<br>")
        
        # Wrap in paragraph tags
        return f"<p>{html}</p>"
    
    def _transform_variants(self, rakuten_product: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Transform Rakuten variants to Shopify variants.
        
        Args:
            rakuten_product: Rakuten product data
            
        Returns:
            List of Shopify variant objects
        """
        variants = []
        
        # Check if product has variants
        if "variants" in rakuten_product and rakuten_product["variants"]:
            # Get all possible combinations of option values
            option_combinations = self._get_option_combinations(rakuten_product["variants"])
            
            # Create a variant for each combination
            for i, combination in enumerate(option_combinations):
                variant = {
                    "title": " / ".join(combination.values()),
                    "price": str(rakuten_product.get("price", 0)),
                    "sku": f"{rakuten_product.get('sku', '')}-{i+1}",
                    "inventory_quantity": 0,
                    "requires_shipping": True,
                    "taxable": True
                }
                
                # Add option values
                for pos, (option_name, option_value) in enumerate(combination.items(), 1):
                    variant[f"option{pos}"] = option_name
                    variant[f"option{pos}_value"] = option_value
                
                variants.append(variant)
                
            # If inventory is available, distribute it among variants
            if "inventory" in rakuten_product:
                inventory = rakuten_product["inventory"]
                per_variant = max(1, inventory // len(variants))
                
                for variant in variants:
                    variant["inventory_quantity"] = per_variant
        else:
            # No variants, create a single default variant
            variant = {
                "title": "Default",
                "price": str(rakuten_product.get("price", 0)),
                "sku": rakuten_product.get("sku", ""),
                "inventory_quantity": rakuten_product.get("inventory", 0),
                "requires_shipping": True,
                "taxable": True
            }
            variants.append(variant)
        
        return variants
    
    def _transform_images(self, rakuten_product: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Transform Rakuten images to Shopify images.
        
        Args:
            rakuten_product: Rakuten product data
            
        Returns:
            List of Shopify image objects
        """
        images = []
        
        # Convert Rakuten images to Shopify format
        if "images" in rakuten_product and rakuten_product["images"]:
            for img in rakuten_product["images"]:
                image = {
                    "src": img.get("url", ""),
                    "position": img.get("position", 1)
                }
                images.append(image)
        
        return images
    
    def _extract_options(self, rakuten_product: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Extract options from Rakuten product.
        
        Args:
            rakuten_product: Rakuten product data
            
        Returns:
            List of Shopify option objects
        """
        options = []
        
        # Extract unique option names and values
        if "variants" in rakuten_product and rakuten_product["variants"]:
            option_values = {}
            
            for variant in rakuten_product["variants"]:
                option_name = variant.get("option_name", "")
                if option_name:
                    if option_name not in option_values:
                        option_values[option_name] = set()
                    
                    # Add all option values
                    for value in variant.get("option_values", []):
                        option_values[option_name].add(value)
            
            # Convert to Shopify option format
            for i, (name, values) in enumerate(option_values.items(), 1):
                option = {
                    "id": i,
                    "name": name,
                    "position": i,
                    "values": list(values)
                }
                options.append(option)
        
        return options
    
    def _get_option_combinations(self, variants: List[Dict[str, Any]]) -> List[Dict[str, str]]:
        """
        Get all possible combinations of option values.
        
        Args:
            variants: List of Rakuten variant objects
            
        Returns:
            List of option combinations
        """
        # Extract all options and their values
        options = {}
        for variant in variants:
            option_name = variant.get("option_name", "")
            if option_name:
                if option_name not in options:
                    options[option_name] = set()
                
                # Add all option values
                for value in variant.get("option_values", []):
                    options[option_name].add(value)
        
        # Generate all combinations
        return self._generate_combinations(options)
    
    def _generate_combinations(self, options: Dict[str, set]) -> List[Dict[str, str]]:
        """
        Generate all possible combinations of option values.
        
        Args:
            options: Dictionary of option names to sets of values
            
        Returns:
            List of all possible combinations
        """
        if not options:
            return [{}]
        
        result = []
        option_name = next(iter(options))
        option_values = options[option_name]
        remaining_options = {k: v for k, v in options.items() if k != option_name}
        
        # Recursively generate combinations
        sub_combinations = self._generate_combinations(remaining_options)
        
        for value in option_values:
            for sub_comb in sub_combinations:
                combination = {option_name: value}
                combination.update(sub_comb)
                result.append(combination)
        
        return result
    
    def _map_order_status(self, rakuten_status: str) -> str:
        """
        Map Rakuten order status to Shopify status.
        
        Args:
            rakuten_status: Rakuten order status
            
        Returns:
            Shopify order financial status
        """
        # Map Rakuten status to Shopify financial status
        status_map = {
            "1": "pending",       # Waiting for payment
            "2": "paid",          # Payment confirmed
            "3": "paid",          # Processing order
            "4": "paid",          # Ready to ship
            "5": "paid",          # Shipped with issues
            "6": "paid",          # Shipped
            "7": "refunded",      # Cancelled
            "8": "pending",       # On hold
            "9": "failed"         # Error
        }
        
        return status_map.get(rakuten_status, "pending")