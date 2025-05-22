"""Data validation module for Shopify API data."""
from typing import Any, Dict, List, Optional, Set
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class ValidationError(Exception):
    """Exception raised for data validation errors."""

    def __init__(self, message: str, field: Optional[str] = None, errors: Optional[List[Dict[str, Any]]] = None):
        self.message = message
        self.field = field
        self.errors = errors or []
        super().__init__(self.message)


class DataValidator:
    """Validates data against the common data model specification."""

    def __init__(self, strict: bool = False):
        """Initialize the data validator.
        
        Args:
            strict: If True, validation failures will raise exceptions.
                   If False, validation failures will be logged as warnings.
        """
        self.strict = strict
        self.errors: List[Dict[str, Any]] = []

    def reset_errors(self) -> None:
        """Reset the validation errors."""
        self.errors = []

    def get_errors(self) -> List[Dict[str, Any]]:
        """Get the validation errors.
        
        Returns:
            List of validation error dictionaries.
        """
        return self.errors

    def validate_order(self, order: Dict[str, Any]) -> bool:
        """Validate an order against the common data model.
        
        Args:
            order: The order data to validate.
            
        Returns:
            True if the order is valid, False otherwise.
            
        Raises:
            ValidationError: If strict mode is enabled and validation fails.
        """
        self.reset_errors()
        
        required_fields = {"order_id", "created_at", "currency", "total_price"}
        self._validate_required_fields(order, required_fields, "order")
        
        if "created_at" in order:
            self._validate_iso8601_datetime(order["created_at"], "created_at", "order")
        
        if "updated_at" in order:
            self._validate_iso8601_datetime(order["updated_at"], "updated_at", "order")
        
        if "processed_at" in order:
            self._validate_iso8601_datetime(order["processed_at"], "processed_at", "order")
        
        if "currency" in order:
            self._validate_currency_code(order["currency"], "currency", "order")
        
        if "total_price" in order:
            self._validate_decimal(order["total_price"], "total_price", "order")
        
        if "customer" in order and order["customer"]:
            self._validate_customer(order["customer"])
        
        if "line_items" in order and isinstance(order["line_items"], list):
            for i, item in enumerate(order["line_items"]):
                self._validate_line_item(item, f"line_items[{i}]")
        
        if "transactions" in order and isinstance(order["transactions"], list):
            for i, transaction in enumerate(order["transactions"]):
                self._validate_transaction(transaction, f"transactions[{i}]")
        
        if "financial_status" in order:
            valid_financial_statuses = {
                "pending", "authorized", "partially_paid", "paid",
                "partially_refunded", "refunded", "voided"
            }
            self._validate_enum(
                order["financial_status"],
                valid_financial_statuses,
                "financial_status",
                "order"
            )
        
        if "fulfillment_status" in order:
            valid_fulfillment_statuses = {
                "fulfilled", "partial", "unfulfilled", "restocked",
                "pending_fulfillment", "open", "scheduled"
            }
            self._validate_enum(
                order["fulfillment_status"],
                valid_fulfillment_statuses,
                "fulfillment_status",
                "order"
            )
        
        if self.errors:
            error_message = f"Order validation failed with {len(self.errors)} errors"
            if self.strict:
                raise ValidationError(error_message, errors=self.errors)
            logger.warning(error_message)
            return False
        
        return True

    def validate_product(self, product: Dict[str, Any]) -> bool:
        """Validate a product against the common data model.
        
        Args:
            product: The product data to validate.
            
        Returns:
            True if the product is valid, False otherwise.
            
        Raises:
            ValidationError: If strict mode is enabled and validation fails.
        """
        self.reset_errors()
        
        required_fields = {"product_id", "title"}
        self._validate_required_fields(product, required_fields, "product")
        
        if "created_at" in product:
            self._validate_iso8601_datetime(product["created_at"], "created_at", "product")
        
        if "updated_at" in product:
            self._validate_iso8601_datetime(product["updated_at"], "updated_at", "product")
        
        if "published_at" in product:
            self._validate_iso8601_datetime(product["published_at"], "published_at", "product")
        
        if "variants" in product and isinstance(product["variants"], list):
            for i, variant in enumerate(product["variants"]):
                self._validate_variant(variant, f"variants[{i}]")
        
        if self.errors:
            error_message = f"Product validation failed with {len(self.errors)} errors"
            if self.strict:
                raise ValidationError(error_message, errors=self.errors)
            logger.warning(error_message)
            return False
        
        return True

    def validate_transaction(self, transaction: Dict[str, Any]) -> bool:
        """Validate a transaction against the common data model.
        
        Args:
            transaction: The transaction data to validate.
            
        Returns:
            True if the transaction is valid, False otherwise.
            
        Raises:
            ValidationError: If strict mode is enabled and validation fails.
        """
        self.reset_errors()
        
        self._validate_transaction(transaction, "transaction")
        
        if self.errors:
            error_message = f"Transaction validation failed with {len(self.errors)} errors"
            if self.strict:
                raise ValidationError(error_message, errors=self.errors)
            logger.warning(error_message)
            return False
        
        return True

    def _validate_required_fields(self, data: Dict[str, Any], required_fields: Set[str], context: str) -> None:
        """Validate that required fields are present in the data.
        
        Args:
            data: The data to validate.
            required_fields: Set of required field names.
            context: The context for error messages.
        """
        for field in required_fields:
            if field not in data or data[field] is None:
                self.errors.append({
                    "field": field,
                    "context": context,
                    "error": "Missing required field",
                    "value": None
                })

    def _validate_iso8601_datetime(self, value: Any, field: str, context: str) -> None:
        """Validate that a value is a valid ISO 8601 datetime string.
        
        Args:
            value: The value to validate.
            field: The field name for error messages.
            context: The context for error messages.
        """
        if not isinstance(value, str):
            self.errors.append({
                "field": field,
                "context": context,
                "error": "Expected ISO 8601 datetime string",
                "value": value
            })
            return
        
        try:
            datetime.fromisoformat(value.replace('Z', '+00:00'))
        except (ValueError, TypeError):
            self.errors.append({
                "field": field,
                "context": context,
                "error": "Invalid ISO 8601 datetime format",
                "value": value
            })

    def _validate_currency_code(self, value: Any, field: str, context: str) -> None:
        """Validate that a value is a valid ISO 4217 currency code.
        
        Args:
            value: The value to validate.
            field: The field name for error messages.
            context: The context for error messages.
        """
        if not isinstance(value, str) or len(value) != 3:
            self.errors.append({
                "field": field,
                "context": context,
                "error": "Expected 3-letter ISO 4217 currency code",
                "value": value
            })

    def _validate_decimal(self, value: Any, field: str, context: str) -> None:
        """Validate that a value is a valid decimal number.
        
        Args:
            value: The value to validate.
            field: The field name for error messages.
            context: The context for error messages.
        """
        try:
            float(value)
        except (ValueError, TypeError):
            self.errors.append({
                "field": field,
                "context": context,
                "error": "Expected decimal number",
                "value": value
            })

    def _validate_enum(self, value: Any, valid_values: Set[str], field: str, context: str) -> None:
        """Validate that a value is one of a set of valid values.
        
        Args:
            value: The value to validate.
            valid_values: Set of valid values.
            field: The field name for error messages.
            context: The context for error messages.
        """
        if value not in valid_values:
            self.errors.append({
                "field": field,
                "context": context,
                "error": f"Expected one of: {', '.join(valid_values)}",
                "value": value
            })

    def _validate_customer(self, customer: Dict[str, Any]) -> None:
        """Validate a customer object.
        
        Args:
            customer: The customer data to validate.
        """
        if not isinstance(customer, dict):
            self.errors.append({
                "field": "customer",
                "context": "order",
                "error": "Expected customer object",
                "value": customer
            })
            return
        
        required_fields = {"id", "email"}
        self._validate_required_fields(customer, required_fields, "customer")

    def _validate_line_item(self, item: Dict[str, Any], field_path: str) -> None:
        """Validate a line item object.
        
        Args:
            item: The line item data to validate.
            field_path: The field path for error messages.
        """
        if not isinstance(item, dict):
            self.errors.append({
                "field": field_path,
                "context": "order",
                "error": "Expected line item object",
                "value": item
            })
            return
        
        required_fields = {"id", "product_id", "variant_id", "title", "quantity", "price"}
        self._validate_required_fields(item, required_fields, field_path)
        
        if "quantity" in item:
            try:
                int(item["quantity"])
            except (ValueError, TypeError):
                self.errors.append({
                    "field": f"{field_path}.quantity",
                    "context": "line_item",
                    "error": "Expected integer",
                    "value": item["quantity"]
                })
        
        if "price" in item:
            self._validate_decimal(item["price"], f"{field_path}.price", "line_item")
        
        if "total_price" in item:
            self._validate_decimal(item["total_price"], f"{field_path}.total_price", "line_item")

    def _validate_variant(self, variant: Dict[str, Any], field_path: str) -> None:
        """Validate a product variant object.
        
        Args:
            variant: The variant data to validate.
            field_path: The field path for error messages.
        """
        if not isinstance(variant, dict):
            self.errors.append({
                "field": field_path,
                "context": "product",
                "error": "Expected variant object",
                "value": variant
            })
            return
        
        required_fields = {"id", "title", "price"}
        self._validate_required_fields(variant, required_fields, field_path)
        
        if "price" in variant:
            self._validate_decimal(variant["price"], f"{field_path}.price", "variant")
        
        if "inventory_quantity" in variant:
            try:
                int(variant["inventory_quantity"])
            except (ValueError, TypeError):
                self.errors.append({
                    "field": f"{field_path}.inventory_quantity",
                    "context": "variant",
                    "error": "Expected integer",
                    "value": variant["inventory_quantity"]
                })

    def _validate_transaction(self, transaction: Dict[str, Any], field_path: str) -> None:
        """Validate a transaction object.
        
        Args:
            transaction: The transaction data to validate.
            field_path: The field path for error messages.
        """
        if not isinstance(transaction, dict):
            self.errors.append({
                "field": field_path,
                "context": "order",
                "error": "Expected transaction object",
                "value": transaction
            })
            return
        
        required_fields = {"id", "amount", "currency", "status"}
        self._validate_required_fields(transaction, required_fields, field_path)
        
        if "amount" in transaction:
            self._validate_decimal(transaction["amount"], f"{field_path}.amount", "transaction")
        
        if "currency" in transaction:
            self._validate_currency_code(transaction["currency"], f"{field_path}.currency", "transaction")
        
        if "created_at" in transaction:
            self._validate_iso8601_datetime(transaction["created_at"], f"{field_path}.created_at", "transaction")
        
        if "processed_at" in transaction:
            self._validate_iso8601_datetime(transaction["processed_at"], f"{field_path}.processed_at", "transaction")
        
        if "status" in transaction:
            valid_statuses = {"success", "failure", "pending", "error", "voided"}
            self._validate_enum(
                transaction["status"],
                valid_statuses,
                f"{field_path}.status",
                "transaction"
            )
        
        if "kind" in transaction:
            valid_kinds = {"authorization", "capture", "sale", "void", "refund"}
            self._validate_enum(
                transaction["kind"],
                valid_kinds,
                f"{field_path}.kind",
                "transaction"
            )
