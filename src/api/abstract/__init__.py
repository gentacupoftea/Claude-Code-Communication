"""
Abstract base classes for e-commerce platform integrations
"""

from .base_client import AbstractEcommerceClient, RateLimitInfo
from .base_models import (
    BaseProduct, BaseOrder, BaseCustomer, BaseAddress, BaseLineItem,
    ProductStatus, OrderStatus, PaymentStatus
)
from .platform_manager import PlatformManager, PlatformType, platform_manager

__all__ = [
    'AbstractEcommerceClient',
    'RateLimitInfo',
    'BaseProduct',
    'BaseOrder',
    'BaseCustomer',
    'BaseAddress',
    'BaseLineItem',
    'ProductStatus',
    'OrderStatus',
    'PaymentStatus',
    'PlatformManager',
    'PlatformType',
    'platform_manager',
]