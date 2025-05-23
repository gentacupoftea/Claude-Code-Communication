"""
Simplified FastAPI server for Shopify MCP integration
Demo version with basic endpoints
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Any

# Create FastAPI app
app = FastAPI(
    title="Conea Shopify MCP Server",
    description="Enterprise-grade Shopify integration API",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mock data store
stores_db = []
products_db = []
orders_db = []

# ================================
# Health and System Routes
# ================================

@app.get("/")
async def root():
    return {
        "message": "Conea Shopify MCP Server",
        "version": "1.0.0",
        "status": "running",
        "shopify_integration": "enabled",
        "features": [
            "OAuth2 Authentication",
            "Product Management", 
            "Order Processing",
            "Real-time Webhooks",
            "Data Synchronization"
        ]
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
        "services": {
            "api": "running",
            "database": "connected",
            "cache": "ready",
            "webhooks": "listening"
        }
    }

# ================================
# Shopify Integration Routes
# ================================

@app.post("/api/v1/shopify/stores/connect")
async def connect_store(request: Request):
    """Initialize Shopify store connection"""
    body = await request.json()
    shop_domain = body.get("shop_domain")
    
    if not shop_domain:
        raise HTTPException(status_code=400, detail="Shop domain is required")
    
    # Generate mock OAuth URL
    oauth_url = f"https://{shop_domain}.myshopify.com/admin/oauth/authorize?client_id=demo&scope=read_products,write_products&redirect_uri=https://staging-conea-ai.web.app/oauth/callback"
    state = f"state_{datetime.utcnow().timestamp()}"
    
    return {
        "oauth_url": oauth_url,
        "state": state,
        "shop": shop_domain.replace(".myshopify.com", "")
    }

@app.get("/api/v1/shopify/stores")
async def list_stores():
    """Get list of connected stores"""
    return [
        {
            "store_id": "demo_store_1",
            "shop_domain": "demo-store",
            "store_name": "Demo Store",
            "connected_at": "2025-05-23T10:00:00Z",
            "last_sync": "2025-05-23T12:00:00Z",
            "sync_enabled": True
        }
    ]

@app.get("/api/v1/shopify/stores/{store_id}/products")
async def get_products(store_id: str, limit: int = 50):
    """Get products from a store"""
    mock_products = [
        {
            "id": 1,
            "title": "Premium T-Shirt",
            "body_html": "<p>High quality cotton t-shirt</p>",
            "vendor": "Conea Fashion",
            "product_type": "Apparel",
            "status": "active",
            "created_at": "2025-05-23T10:00:00Z",
            "updated_at": "2025-05-23T12:00:00Z",
            "variants": [
                {
                    "id": 101,
                    "title": "Medium / Red",
                    "price": "29.99",
                    "sku": "TSHIRT-M-RED",
                    "inventory_quantity": 100
                }
            ]
        },
        {
            "id": 2,
            "title": "Smart Watch Pro",
            "body_html": "<p>Advanced smartwatch with health tracking</p>",
            "vendor": "Conea Tech",
            "product_type": "Electronics",
            "status": "active",
            "created_at": "2025-05-23T09:00:00Z",
            "updated_at": "2025-05-23T11:30:00Z",
            "variants": [
                {
                    "id": 201,
                    "title": "42mm / Black",
                    "price": "299.99",
                    "sku": "WATCH-42-BLK",
                    "inventory_quantity": 50
                }
            ]
        }
    ]
    
    return {
        "items": mock_products[:limit],
        "total_count": len(mock_products),
        "page": 1,
        "per_page": limit,
        "has_next": False,
        "has_previous": False
    }

@app.get("/api/v1/shopify/stores/{store_id}/orders")
async def get_orders(store_id: str, limit: int = 50):
    """Get orders from a store"""
    mock_orders = [
        {
            "id": 1001,
            "name": "#1001",
            "email": "customer@example.com",
            "total_price": "59.98",
            "subtotal_price": "49.98",
            "total_tax": "10.00",
            "currency": "USD",
            "financial_status": "paid",
            "fulfillment_status": "fulfilled",
            "created_at": "2025-05-23T11:00:00Z",
            "updated_at": "2025-05-23T11:30:00Z",
            "line_items": [
                {
                    "id": 2001,
                    "title": "Premium T-Shirt",
                    "quantity": 2,
                    "price": "29.99",
                    "total_discount": "0.00"
                }
            ]
        }
    ]
    
    return {
        "items": mock_orders[:limit],
        "total_count": len(mock_orders),
        "page": 1,
        "per_page": limit,
        "has_next": False,
        "has_previous": False
    }

@app.post("/api/v1/shopify/stores/{store_id}/sync")
async def start_sync(store_id: str, request: Request):
    """Start data synchronization"""
    body = await request.json()
    entity_type = body.get("entity_type", "products")
    full_sync = body.get("full_sync", False)
    
    operation_id = f"sync_{store_id}_{entity_type}_{int(datetime.utcnow().timestamp())}"
    
    return {
        "success": True,
        "operation_id": operation_id,
        "message": f"Started {entity_type} sync for store {store_id}",
        "sync_type": "full" if full_sync else "incremental"
    }

@app.get("/api/v1/shopify/stores/{store_id}/sync/status")
async def get_sync_status(store_id: str):
    """Get synchronization status"""
    return {
        "store_id": store_id,
        "last_sync": "2025-05-23T12:00:00Z",
        "sync_in_progress": False,
        "products_synced": 150,
        "orders_synced": 45,
        "customers_synced": 25,
        "webhook_status": "active",
        "api_health": "healthy"
    }

@app.post("/api/v1/shopify/webhooks/{topic:path}")
async def handle_webhook(topic: str, request: Request):
    """Handle Shopify webhooks"""
    body = await request.json()
    
    # Log webhook event
    print(f"Received webhook: {topic}")
    print(f"Payload: {json.dumps(body, indent=2)}")
    
    return {"status": "received", "topic": topic}

# ================================
# Analytics and Insights
# ================================

@app.get("/api/v1/shopify/stores/{store_id}/analytics")
async def get_analytics(store_id: str, period: str = "30d"):
    """Get store analytics"""
    return {
        "store_id": store_id,
        "period": period,
        "total_sales": "15,847.50",
        "total_orders": 234,
        "average_order_value": "67.73",
        "conversion_rate": "3.2%",
        "top_products": [
            {"name": "Premium T-Shirt", "sales": "2,847.50", "units": 95},
            {"name": "Smart Watch Pro", "sales": "8,997.00", "units": 30}
        ],
        "sales_by_day": [
            {"date": "2025-05-20", "sales": "1,234.56"},
            {"date": "2025-05-21", "sales": "1,567.89"},
            {"date": "2025-05-22", "sales": "2,345.67"},
            {"date": "2025-05-23", "sales": "1,876.54"}
        ]
    }

# ================================
# Error Handling
# ================================

@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return JSONResponse(
        status_code=404,
        content={
            "error": "Endpoint not found",
            "message": f"The endpoint {request.url.path} was not found",
            "available_endpoints": [
                "/",
                "/health", 
                "/api/v1/shopify/stores/connect",
                "/api/v1/shopify/stores",
                "/api/v1/shopify/stores/{store_id}/products",
                "/api/v1/shopify/stores/{store_id}/orders"
            ]
        }
    )

@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": "An unexpected error occurred",
            "timestamp": datetime.utcnow().isoformat()
        }
    )

if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)