"""
Shopify Integration API Routes for Conea
FastAPI routes for Shopify store management, OAuth, and data operations
"""

from datetime import datetime
from typing import Dict, List, Optional, Any
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, validator
from sqlalchemy.ext.asyncio import AsyncSession

from .models import (
    ShopifyStoreConnection, ShopifyProduct, ShopifyOrder, ShopifyCustomer,
    ShopifyAPIResponse, PaginatedResponse, SyncStatus
)
from .client import ShopifyClient, ShopifyAPIError
from .auth import ShopifyAuth, OAuthConfig, InvalidShopError, OAuthVerificationError
from .sync import DataSyncManager, SyncEntityType, SyncStrategy, SyncConfig
from .webhooks import WebhookHandler
from ..auth.dependencies import get_current_user
from ..database.connection import get_db_session
from ..cache.cache_manager import get_cache_manager
from ..utils.logger import get_logger

logger = get_logger(__name__)

# Create router
router = APIRouter(prefix="/api/v1/shopify", tags=["shopify"])

# Initialize Shopify components (these would be dependency injected in production)
oauth_config = OAuthConfig(
    client_id="your_client_id",  # From environment
    client_secret="your_client_secret",  # From environment
    redirect_uri="https://api.conea.ai/api/v1/shopify/oauth/callback",
    scopes=["read_products", "write_products", "read_orders", "read_customers", "write_inventory"]
)

shopify_auth = ShopifyAuth(oauth_config)
webhook_handler = WebhookHandler(shopify_auth)


# ================================
# Request/Response Models
# ================================

class StoreConnectionRequest(BaseModel):
    """Request model for connecting a store"""
    shop_domain: str
    redirect_url: Optional[str] = None
    
    @validator('shop_domain')
    def validate_shop_domain(cls, v):
        if not v:
            raise ValueError("Shop domain is required")
        return v.lower().strip()


class OAuthCallbackRequest(BaseModel):
    """OAuth callback parameters"""
    shop: str
    code: str
    state: str
    hmac: Optional[str] = None


class SyncRequest(BaseModel):
    """Request to start data synchronization"""
    entity_type: SyncEntityType
    full_sync: bool = False
    custom_filters: Dict[str, Any] = {}


class WebhookRegistrationRequest(BaseModel):
    """Request to register webhooks"""
    force_reregister: bool = False


class ConflictResolutionRequest(BaseModel):
    """Request to resolve data conflicts"""
    conflict_index: int
    resolution_strategy: str
    custom_data: Optional[Dict[str, Any]] = None


# ================================
# OAuth & Store Connection Routes
# ================================

@router.post("/stores/connect", response_model=Dict[str, str])
async def connect_store(
    request: StoreConnectionRequest,
    current_user = Depends(get_current_user)
):
    """
    Initiate OAuth flow to connect a Shopify store
    
    Returns OAuth URL for user to authorize the app
    """
    try:
        # Validate shop domain
        shop = shopify_auth.validate_shop_domain(request.shop_domain)
        
        # Generate OAuth URL
        oauth_url, state = shopify_auth.generate_oauth_url(
            shop, 
            redirect_url=request.redirect_url
        )
        
        logger.info("Generated OAuth URL for shop: %s", shop)
        
        return {
            "oauth_url": oauth_url,
            "state": state,
            "shop": shop
        }
        
    except InvalidShopError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Error generating OAuth URL: %s", e)
        raise HTTPException(status_code=500, detail="Failed to generate OAuth URL")


@router.get("/oauth/callback")
async def oauth_callback(
    request: Request,
    shop: str,
    code: str,
    state: str,
    hmac: Optional[str] = None,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user)
):
    """
    Handle OAuth callback from Shopify
    
    Exchanges authorization code for access token and stores connection
    """
    try:
        # Verify OAuth callback
        query_string = str(request.url.query)
        shopify_auth.verify_oauth_callback(
            shop=shop,
            code=code,
            state=state,
            hmac_header=hmac,
            query_string=query_string
        )
        
        # Exchange code for token
        store_connection = await shopify_auth.exchange_code_for_token(shop, code)
        
        # Store connection in database
        # Implementation depends on your database schema
        await _save_store_connection(db, current_user.id, store_connection)
        
        # Register webhooks
        await webhook_handler.register_webhooks_for_store(store_connection)
        
        logger.info("Successfully connected store: %s", shop)
        
        # Redirect to success page or return JSON
        return {
            "success": True,
            "message": "Store connected successfully",
            "store_id": store_connection.store_id,
            "shop_domain": store_connection.shop_domain
        }
        
    except OAuthVerificationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("OAuth callback error: %s", e)
        raise HTTPException(status_code=500, detail="Failed to complete OAuth flow")


@router.get("/stores", response_model=List[Dict[str, Any]])
async def list_stores(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """List all connected Shopify stores for the current user"""
    try:
        # Get user's stores from database
        stores = await _get_user_stores(db, current_user.id)
        
        return [
            {
                "store_id": store.store_id,
                "shop_domain": store.shop_domain,
                "store_name": store.store_name,
                "connected_at": store.connected_at,
                "last_sync": store.last_sync,
                "sync_enabled": store.sync_enabled
            }
            for store in stores
        ]
        
    except Exception as e:
        logger.error("Error listing stores: %s", e)
        raise HTTPException(status_code=500, detail="Failed to retrieve stores")


@router.delete("/stores/{store_id}")
async def disconnect_store(
    store_id: str,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Disconnect a Shopify store"""
    try:
        # Get store connection
        store_connection = await _get_store_connection(db, current_user.id, store_id)
        if not store_connection:
            raise HTTPException(status_code=404, detail="Store not found")
        
        # Unregister webhooks
        await webhook_handler.unregister_webhooks_for_store(store_connection)
        
        # Remove from database
        await _delete_store_connection(db, current_user.id, store_id)
        
        logger.info("Disconnected store: %s", store_id)
        
        return {"success": True, "message": "Store disconnected successfully"}
        
    except Exception as e:
        logger.error("Error disconnecting store: %s", e)
        raise HTTPException(status_code=500, detail="Failed to disconnect store")


# ================================
# Product Management Routes
# ================================

@router.get("/stores/{store_id}/products", response_model=PaginatedResponse)
async def get_products(
    store_id: str,
    limit: int = 50,
    page_info: Optional[str] = None,
    status: Optional[str] = None,
    vendor: Optional[str] = None,
    product_type: Optional[str] = None,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    cache_manager = Depends(get_cache_manager)
):
    """Get products from a Shopify store"""
    try:
        store_connection = await _get_store_connection(db, current_user.id, store_id)
        if not store_connection:
            raise HTTPException(status_code=404, detail="Store not found")
        
        # Build filters
        filters = {}
        if status:
            filters['status'] = status
        if vendor:
            filters['vendor'] = vendor
        if product_type:
            filters['product_type'] = product_type
        
        async with ShopifyClient(store_connection, cache_manager) as client:
            result = await client.get_products(
                limit=limit,
                page_info=page_info,
                **filters
            )
            
            return result
            
    except ShopifyAPIError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Error getting products: %s", e)
        raise HTTPException(status_code=500, detail="Failed to retrieve products")


@router.get("/stores/{store_id}/products/{product_id}", response_model=ShopifyProduct)
async def get_product(
    store_id: str,
    product_id: int,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    cache_manager = Depends(get_cache_manager)
):
    """Get a specific product by ID"""
    try:
        store_connection = await _get_store_connection(db, current_user.id, store_id)
        if not store_connection:
            raise HTTPException(status_code=404, detail="Store not found")
        
        async with ShopifyClient(store_connection, cache_manager) as client:
            product = await client.get_product(product_id)
            return product
            
    except ShopifyAPIError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Error getting product: %s", e)
        raise HTTPException(status_code=500, detail="Failed to retrieve product")


@router.post("/stores/{store_id}/products", response_model=ShopifyProduct)
async def create_product(
    store_id: str,
    product: ShopifyProduct,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    cache_manager = Depends(get_cache_manager)
):
    """Create a new product"""
    try:
        store_connection = await _get_store_connection(db, current_user.id, store_id)
        if not store_connection:
            raise HTTPException(status_code=404, detail="Store not found")
        
        async with ShopifyClient(store_connection, cache_manager) as client:
            created_product = await client.create_product(product)
            return created_product
            
    except ShopifyAPIError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Error creating product: %s", e)
        raise HTTPException(status_code=500, detail="Failed to create product")


@router.put("/stores/{store_id}/products/{product_id}", response_model=ShopifyProduct)
async def update_product(
    store_id: str,
    product_id: int,
    updates: Dict[str, Any],
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    cache_manager = Depends(get_cache_manager)
):
    """Update an existing product"""
    try:
        store_connection = await _get_store_connection(db, current_user.id, store_id)
        if not store_connection:
            raise HTTPException(status_code=404, detail="Store not found")
        
        async with ShopifyClient(store_connection, cache_manager) as client:
            updated_product = await client.update_product(product_id, updates)
            return updated_product
            
    except ShopifyAPIError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Error updating product: %s", e)
        raise HTTPException(status_code=500, detail="Failed to update product")


# ================================
# Order Management Routes
# ================================

@router.get("/stores/{store_id}/orders", response_model=PaginatedResponse)
async def get_orders(
    store_id: str,
    limit: int = 50,
    page_info: Optional[str] = None,
    status: str = 'any',
    financial_status: Optional[str] = None,
    fulfillment_status: Optional[str] = None,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    cache_manager = Depends(get_cache_manager)
):
    """Get orders from a Shopify store"""
    try:
        store_connection = await _get_store_connection(db, current_user.id, store_id)
        if not store_connection:
            raise HTTPException(status_code=404, detail="Store not found")
        
        filters = {}
        if financial_status:
            filters['financial_status'] = financial_status
        if fulfillment_status:
            filters['fulfillment_status'] = fulfillment_status
        
        async with ShopifyClient(store_connection, cache_manager) as client:
            result = await client.get_orders(
                limit=limit,
                page_info=page_info,
                status=status,
                **filters
            )
            
            return result
            
    except ShopifyAPIError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Error getting orders: %s", e)
        raise HTTPException(status_code=500, detail="Failed to retrieve orders")


@router.get("/stores/{store_id}/orders/{order_id}", response_model=ShopifyOrder)
async def get_order(
    store_id: str,
    order_id: int,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    cache_manager = Depends(get_cache_manager)
):
    """Get a specific order by ID"""
    try:
        store_connection = await _get_store_connection(db, current_user.id, store_id)
        if not store_connection:
            raise HTTPException(status_code=404, detail="Store not found")
        
        async with ShopifyClient(store_connection, cache_manager) as client:
            order = await client.get_order(order_id)
            return order
            
    except ShopifyAPIError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Error getting order: %s", e)
        raise HTTPException(status_code=500, detail="Failed to retrieve order")


# ================================
# Customer Management Routes
# ================================

@router.get("/stores/{store_id}/customers", response_model=PaginatedResponse)
async def get_customers(
    store_id: str,
    limit: int = 50,
    page_info: Optional[str] = None,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    cache_manager = Depends(get_cache_manager)
):
    """Get customers from a Shopify store"""
    try:
        store_connection = await _get_store_connection(db, current_user.id, store_id)
        if not store_connection:
            raise HTTPException(status_code=404, detail="Store not found")
        
        async with ShopifyClient(store_connection, cache_manager) as client:
            result = await client.get_customers(
                limit=limit,
                page_info=page_info
            )
            
            return result
            
    except ShopifyAPIError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Error getting customers: %s", e)
        raise HTTPException(status_code=500, detail="Failed to retrieve customers")


# ================================
# Synchronization Routes
# ================================

@router.post("/stores/{store_id}/sync")
async def start_sync(
    store_id: str,
    sync_request: SyncRequest,
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    cache_manager = Depends(get_cache_manager)
):
    """Start data synchronization for a store"""
    try:
        store_connection = await _get_store_connection(db, current_user.id, store_id)
        if not store_connection:
            raise HTTPException(status_code=404, detail="Store not found")
        
        # Initialize sync manager (would be dependency injected in production)
        sync_manager = DataSyncManager(db, cache_manager)
        
        # Start sync in background
        operation_id = await sync_manager.start_sync(
            store_connection,
            sync_request.entity_type,
            sync_request.full_sync
        )
        
        return {
            "success": True,
            "operation_id": operation_id,
            "message": f"Started {sync_request.entity_type.value} sync"
        }
        
    except Exception as e:
        logger.error("Error starting sync: %s", e)
        raise HTTPException(status_code=500, detail="Failed to start synchronization")


@router.get("/stores/{store_id}/sync/status", response_model=Dict[str, Any])
async def get_sync_status(
    store_id: str,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    cache_manager = Depends(get_cache_manager)
):
    """Get synchronization status for a store"""
    try:
        store_connection = await _get_store_connection(db, current_user.id, store_id)
        if not store_connection:
            raise HTTPException(status_code=404, detail="Store not found")
        
        sync_manager = DataSyncManager(db, cache_manager)
        status = await sync_manager.get_sync_status(store_id)
        
        return status
        
    except Exception as e:
        logger.error("Error getting sync status: %s", e)
        raise HTTPException(status_code=500, detail="Failed to get sync status")


# ================================
# Webhook Management Routes
# ================================

@router.post("/stores/{store_id}/webhooks/register")
async def register_webhooks(
    store_id: str,
    request: WebhookRegistrationRequest,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Register webhooks for a store"""
    try:
        store_connection = await _get_store_connection(db, current_user.id, store_id)
        if not store_connection:
            raise HTTPException(status_code=404, detail="Store not found")
        
        if request.force_reregister:
            await webhook_handler.unregister_webhooks_for_store(store_connection)
        
        webhooks = await webhook_handler.register_webhooks_for_store(store_connection)
        
        return {
            "success": True,
            "registered_webhooks": len(webhooks),
            "webhooks": webhooks
        }
        
    except Exception as e:
        logger.error("Error registering webhooks: %s", e)
        raise HTTPException(status_code=500, detail="Failed to register webhooks")


@router.get("/stores/{store_id}/webhooks/status")
async def get_webhook_status(
    store_id: str,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Get webhook status for a store"""
    try:
        store_connection = await _get_store_connection(db, current_user.id, store_id)
        if not store_connection:
            raise HTTPException(status_code=404, detail="Store not found")
        
        status = await webhook_handler.get_webhook_status(store_id)
        
        return status
        
    except Exception as e:
        logger.error("Error getting webhook status: %s", e)
        raise HTTPException(status_code=500, detail="Failed to get webhook status")


# ================================
# Webhook Endpoint (Public)
# ================================

@router.post("/webhooks/{topic:path}")
async def handle_webhook(request: Request):
    """Handle incoming Shopify webhooks"""
    return await webhook_handler.process_webhook_request(request)


# ================================
# Health & Diagnostics
# ================================

@router.get("/stores/{store_id}/health")
async def check_store_health(
    store_id: str,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    cache_manager = Depends(get_cache_manager)
):
    """Check health of Shopify store connection"""
    try:
        store_connection = await _get_store_connection(db, current_user.id, store_id)
        if not store_connection:
            raise HTTPException(status_code=404, detail="Store not found")
        
        async with ShopifyClient(store_connection, cache_manager) as client:
            health_status = await client.health_check()
            
            return health_status
            
    except Exception as e:
        logger.error("Error checking store health: %s", e)
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


# ================================
# Database Helper Functions (Implement based on your schema)
# ================================

async def _save_store_connection(
    db: AsyncSession,
    user_id: str,
    store_connection: ShopifyStoreConnection
):
    """Save store connection to database"""
    # Implement based on your database schema
    pass


async def _get_user_stores(db: AsyncSession, user_id: str) -> List[ShopifyStoreConnection]:
    """Get all stores for a user"""
    # Implement based on your database schema
    return []


async def _get_store_connection(
    db: AsyncSession,
    user_id: str,
    store_id: str
) -> Optional[ShopifyStoreConnection]:
    """Get specific store connection"""
    # Implement based on your database schema
    return None


async def _delete_store_connection(db: AsyncSession, user_id: str, store_id: str):
    """Delete store connection"""
    # Implement based on your database schema
    pass