"""
Shopify Webhook Handler for Conea Integration
Manages webhook registration, processing, and real-time event handling
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Callable, Set
from enum import Enum
from dataclasses import dataclass, field

from pydantic import BaseModel, validator
import aiohttp
from aiohttp import web

from .models import (
    ShopifyProduct, ShopifyOrder, ShopifyCustomer, 
    WebhookEvent, ShopifyStoreConnection
)
from .auth import ShopifyAuth
from ..utils.logger import get_logger

logger = get_logger(__name__)


class WebhookTopic(str, Enum):
    """Shopify webhook topics"""
    # Order webhooks
    ORDERS_CREATE = "orders/create"
    ORDERS_UPDATE = "orders/updated"
    ORDERS_PAID = "orders/paid"
    ORDERS_CANCELLED = "orders/cancelled"
    ORDERS_FULFILLED = "orders/fulfilled"
    ORDERS_PARTIALLY_FULFILLED = "orders/partially_fulfilled"
    
    # Product webhooks
    PRODUCTS_CREATE = "products/create"
    PRODUCTS_UPDATE = "products/update"
    PRODUCTS_DELETE = "products/delete"
    
    # Customer webhooks
    CUSTOMERS_CREATE = "customers/create"
    CUSTOMERS_UPDATE = "customers/update"
    CUSTOMERS_DELETE = "customers/delete"
    
    # Inventory webhooks
    INVENTORY_LEVELS_UPDATE = "inventory_levels/update"
    INVENTORY_ITEMS_UPDATE = "inventory_items/update"
    
    # App webhooks
    APP_UNINSTALLED = "app/uninstalled"
    APP_SUBSCRIPTIONS_UPDATE = "app_subscriptions/update"
    
    # Shop webhooks
    SHOP_UPDATE = "shop/update"
    
    # Cart webhooks
    CARTS_CREATE = "carts/create"
    CARTS_UPDATE = "carts/update"
    
    # Checkout webhooks
    CHECKOUTS_CREATE = "checkouts/create"
    CHECKOUTS_UPDATE = "checkouts/update"
    CHECKOUTS_DELETE = "checkouts/delete"


class WebhookFormat(str, Enum):
    """Webhook delivery formats"""
    JSON = "json"
    XML = "xml"


class WebhookStatus(str, Enum):
    """Webhook processing status"""
    PENDING = "pending"
    PROCESSING = "processing"
    PROCESSED = "processed"
    FAILED = "failed"
    RETRY = "retry"


@dataclass
class WebhookConfig:
    """Configuration for webhook registration"""
    topic: WebhookTopic
    endpoint: str
    format: WebhookFormat = WebhookFormat.JSON
    fields: Optional[List[str]] = None
    metafield_namespaces: Optional[List[str]] = None
    
    def to_shopify_dict(self) -> Dict[str, Any]:
        """Convert to Shopify webhook format"""
        config = {
            'topic': self.topic.value,
            'address': self.endpoint,
            'format': self.format.value
        }
        
        if self.fields:
            config['fields'] = self.fields
        if self.metafield_namespaces:
            config['metafield_namespaces'] = self.metafield_namespaces
            
        return config


class WebhookEventHandler:
    """Base class for webhook event handlers"""
    
    def __init__(self, store_id: str):
        self.store_id = store_id
        
    async def handle_event(self, topic: WebhookTopic, payload: Dict[str, Any]) -> bool:
        """
        Handle webhook event
        
        Args:
            topic: Webhook topic
            payload: Event payload
            
        Returns:
            True if handled successfully
        """
        method_name = f"handle_{topic.value.replace('/', '_')}"
        handler = getattr(self, method_name, None)
        
        if handler and callable(handler):
            try:
                await handler(payload)
                return True
            except Exception as e:
                logger.error("Error handling %s webhook: %s", topic.value, e)
                return False
        else:
            logger.warning("No handler found for topic: %s", topic.value)
            return False
    
    # Override these methods in subclasses
    async def handle_orders_create(self, payload: Dict[str, Any]):
        """Handle order creation webhook"""
        pass
    
    async def handle_orders_update(self, payload: Dict[str, Any]):
        """Handle order update webhook"""
        pass
    
    async def handle_products_create(self, payload: Dict[str, Any]):
        """Handle product creation webhook"""
        pass
    
    async def handle_products_update(self, payload: Dict[str, Any]):
        """Handle product update webhook"""
        pass
    
    async def handle_customers_create(self, payload: Dict[str, Any]):
        """Handle customer creation webhook"""
        pass


class WebhookProcessor:
    """Process webhook events with retry logic and error handling"""
    
    def __init__(
        self,
        max_retries: int = 3,
        retry_delay: int = 5,
        batch_size: int = 10
    ):
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.batch_size = batch_size
        self.processing_queue: asyncio.Queue = asyncio.Queue()
        self.failed_events: List[WebhookEvent] = []
        self.is_running = False
        
    async def start(self):
        """Start the webhook processor"""
        if self.is_running:
            return
            
        self.is_running = True
        asyncio.create_task(self._process_events())
        logger.info("Webhook processor started")
    
    async def stop(self):
        """Stop the webhook processor"""
        self.is_running = False
        logger.info("Webhook processor stopped")
    
    async def add_event(self, event: WebhookEvent):
        """Add event to processing queue"""
        await self.processing_queue.put(event)
    
    async def _process_events(self):
        """Main event processing loop"""
        while self.is_running:
            try:
                # Process events in batches
                events = []
                
                # Collect batch of events
                for _ in range(self.batch_size):
                    try:
                        event = await asyncio.wait_for(
                            self.processing_queue.get(), 
                            timeout=1.0
                        )
                        events.append(event)
                    except asyncio.TimeoutError:
                        break
                
                if events:
                    await self._process_batch(events)
                
            except Exception as e:
                logger.error("Error in webhook processor: %s", e)
                await asyncio.sleep(1)
    
    async def _process_batch(self, events: List[WebhookEvent]):
        """Process a batch of webhook events"""
        tasks = [self._process_single_event(event) for event in events]
        await asyncio.gather(*tasks, return_exceptions=True)
    
    async def _process_single_event(self, event: WebhookEvent):
        """Process a single webhook event with retry logic"""
        for attempt in range(self.max_retries + 1):
            try:
                event.processing_status = WebhookStatus.PROCESSING
                
                # Get handler for this store
                handler = self._get_handler(event.store_id)
                if not handler:
                    logger.error("No handler found for store: %s", event.store_id)
                    event.processing_status = WebhookStatus.FAILED
                    event.error_message = "No handler configured"
                    return
                
                # Process the event
                topic = WebhookTopic(event.topic)
                success = await handler.handle_event(topic, event.payload)
                
                if success:
                    event.processing_status = WebhookStatus.PROCESSED
                    event.processed_at = datetime.utcnow()
                    logger.info("Successfully processed webhook: %s/%s", event.store_id, event.topic)
                    return
                else:
                    raise Exception("Handler returned False")
                    
            except Exception as e:
                event.retry_count = attempt + 1
                event.error_message = str(e)
                
                if attempt < self.max_retries:
                    logger.warning(
                        "Webhook processing failed (attempt %d/%d): %s. Retrying in %ds",
                        attempt + 1, self.max_retries + 1, e, self.retry_delay
                    )
                    event.processing_status = WebhookStatus.RETRY
                    await asyncio.sleep(self.retry_delay * (attempt + 1))  # Exponential backoff
                else:
                    logger.error("Webhook processing failed after %d attempts: %s", self.max_retries + 1, e)
                    event.processing_status = WebhookStatus.FAILED
                    self.failed_events.append(event)
    
    def _get_handler(self, store_id: str) -> Optional[WebhookEventHandler]:
        """Get webhook handler for store (implement based on your architecture)"""
        # This would typically retrieve the handler from a registry
        # For now, return None - implement based on your needs
        return None


class WebhookHandler:
    """
    Main webhook handler class for Shopify integration
    Manages webhook registration, verification, and event processing
    """
    
    def __init__(
        self,
        auth: ShopifyAuth,
        webhook_processor: Optional[WebhookProcessor] = None,
        webhook_endpoint_base: str = "https://api.conea.ai/webhooks/shopify"
    ):
        self.auth = auth
        self.webhook_processor = webhook_processor or WebhookProcessor()
        self.webhook_endpoint_base = webhook_endpoint_base.rstrip('/')
        
        # Webhook configurations
        self.webhook_configs: List[WebhookConfig] = [
            WebhookConfig(WebhookTopic.ORDERS_CREATE, f"{self.webhook_endpoint_base}/orders/create"),
            WebhookConfig(WebhookTopic.ORDERS_UPDATE, f"{self.webhook_endpoint_base}/orders/update"),
            WebhookConfig(WebhookTopic.ORDERS_PAID, f"{self.webhook_endpoint_base}/orders/paid"),
            WebhookConfig(WebhookTopic.PRODUCTS_CREATE, f"{self.webhook_endpoint_base}/products/create"),
            WebhookConfig(WebhookTopic.PRODUCTS_UPDATE, f"{self.webhook_endpoint_base}/products/update"),
            WebhookConfig(WebhookTopic.CUSTOMERS_CREATE, f"{self.webhook_endpoint_base}/customers/create"),
            WebhookConfig(WebhookTopic.INVENTORY_LEVELS_UPDATE, f"{self.webhook_endpoint_base}/inventory/update"),
            WebhookConfig(WebhookTopic.APP_UNINSTALLED, f"{self.webhook_endpoint_base}/app/uninstalled"),
        ]
        
        # Store webhook registrations
        self.registered_webhooks: Dict[str, List[Dict[str, Any]]] = {}
        
        # Event handlers by store
        self.event_handlers: Dict[str, WebhookEventHandler] = {}
        
        logger.info("Initialized webhook handler with %d configurations", len(self.webhook_configs))

    async def register_webhooks_for_store(
        self,
        store_connection: ShopifyStoreConnection
    ) -> List[Dict[str, Any]]:
        """
        Register all webhooks for a store
        
        Args:
            store_connection: Store connection details
            
        Returns:
            List of registered webhook details
        """
        registered = []
        
        # First, get existing webhooks
        existing_webhooks = await self._get_existing_webhooks(store_connection)
        existing_topics = {wh.get('topic') for wh in existing_webhooks}
        
        for config in self.webhook_configs:
            if config.topic.value in existing_topics:
                logger.info("Webhook already exists for %s: %s", store_connection.shop_domain, config.topic.value)
                continue
            
            try:
                webhook = await self._register_webhook(store_connection, config)
                if webhook:
                    registered.append(webhook)
                    logger.info("Registered webhook for %s: %s", store_connection.shop_domain, config.topic.value)
                
            except Exception as e:
                logger.error("Failed to register webhook %s for %s: %s", 
                           config.topic.value, store_connection.shop_domain, e)
        
        # Store registration details
        self.registered_webhooks[store_connection.store_id] = registered
        
        logger.info("Registered %d webhooks for store: %s", len(registered), store_connection.shop_domain)
        return registered

    async def _get_existing_webhooks(self, store_connection: ShopifyStoreConnection) -> List[Dict[str, Any]]:
        """Get existing webhooks for a store"""
        url = f"https://{store_connection.shop_domain}.myshopify.com/admin/api/2024-01/webhooks.json"
        
        headers = {
            'X-Shopify-Access-Token': store_connection.access_token,
            'Content-Type': 'application/json'
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data.get('webhooks', [])
                    else:
                        logger.error("Failed to get existing webhooks: %s", response.status)
                        return []
        except Exception as e:
            logger.error("Error getting existing webhooks: %s", e)
            return []

    async def _register_webhook(
        self,
        store_connection: ShopifyStoreConnection,
        config: WebhookConfig
    ) -> Optional[Dict[str, Any]]:
        """Register a single webhook"""
        url = f"https://{store_connection.shop_domain}.myshopify.com/admin/api/2024-01/webhooks.json"
        
        headers = {
            'X-Shopify-Access-Token': store_connection.access_token,
            'Content-Type': 'application/json'
        }
        
        webhook_data = {
            'webhook': config.to_shopify_dict()
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=webhook_data, headers=headers) as response:
                    if response.status == 201:
                        data = await response.json()
                        return data.get('webhook')
                    else:
                        error_text = await response.text()
                        logger.error("Failed to register webhook: %s - %s", response.status, error_text)
                        return None
                        
        except Exception as e:
            logger.error("Error registering webhook: %s", e)
            return None

    async def unregister_webhooks_for_store(self, store_connection: ShopifyStoreConnection) -> bool:
        """Unregister all webhooks for a store"""
        try:
            existing_webhooks = await self._get_existing_webhooks(store_connection)
            
            for webhook in existing_webhooks:
                webhook_id = webhook.get('id')
                if webhook_id:
                    await self._unregister_webhook(store_connection, webhook_id)
            
            # Clear from tracking
            if store_connection.store_id in self.registered_webhooks:
                del self.registered_webhooks[store_connection.store_id]
            
            logger.info("Unregistered all webhooks for store: %s", store_connection.shop_domain)
            return True
            
        except Exception as e:
            logger.error("Error unregistering webhooks: %s", e)
            return False

    async def _unregister_webhook(self, store_connection: ShopifyStoreConnection, webhook_id: int):
        """Unregister a single webhook"""
        url = f"https://{store_connection.shop_domain}.myshopify.com/admin/api/2024-01/webhooks/{webhook_id}.json"
        
        headers = {
            'X-Shopify-Access-Token': store_connection.access_token,
            'Content-Type': 'application/json'
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.delete(url, headers=headers) as response:
                    if response.status == 200:
                        logger.info("Unregistered webhook: %s", webhook_id)
                    else:
                        logger.error("Failed to unregister webhook %s: %s", webhook_id, response.status)
                        
        except Exception as e:
            logger.error("Error unregistering webhook %s: %s", webhook_id, e)

    async def process_webhook_request(
        self,
        request: web.Request
    ) -> web.Response:
        """
        Process incoming webhook request
        
        Args:
            request: aiohttp request object
            
        Returns:
            HTTP response
        """
        try:
            # Get headers
            hmac_header = request.headers.get('X-Shopify-Hmac-Sha256')
            topic_header = request.headers.get('X-Shopify-Topic')
            shop_domain = request.headers.get('X-Shopify-Shop-Domain')
            
            if not all([hmac_header, topic_header, shop_domain]):
                logger.warning("Missing required webhook headers")
                return web.Response(status=400, text="Missing required headers")
            
            # Read request body
            body = await request.read()
            
            # Verify HMAC
            if not self.auth.verify_webhook_hmac(body, hmac_header):
                logger.warning("Invalid webhook HMAC from %s", shop_domain)
                return web.Response(status=401, text="Invalid HMAC")
            
            # Parse payload
            try:
                payload = json.loads(body.decode('utf-8'))
            except json.JSONDecodeError:
                logger.error("Invalid JSON payload from %s", shop_domain)
                return web.Response(status=400, text="Invalid JSON")
            
            # Create webhook event
            event = WebhookEvent(
                event_id=f"{shop_domain}_{topic_header}_{datetime.utcnow().timestamp()}",
                store_id=shop_domain.replace('.myshopify.com', ''),  # Normalize
                topic=topic_header,
                payload=payload,
                received_at=datetime.utcnow()
            )
            
            # Add to processing queue
            await self.webhook_processor.add_event(event)
            
            logger.info("Received webhook: %s/%s", shop_domain, topic_header)
            return web.Response(status=200, text="OK")
            
        except Exception as e:
            logger.error("Error processing webhook request: %s", e)
            return web.Response(status=500, text="Internal server error")

    def register_event_handler(self, store_id: str, handler: WebhookEventHandler):
        """Register an event handler for a store"""
        self.event_handlers[store_id] = handler
        logger.info("Registered event handler for store: %s", store_id)

    def unregister_event_handler(self, store_id: str):
        """Unregister event handler for a store"""
        if store_id in self.event_handlers:
            del self.event_handlers[store_id]
            logger.info("Unregistered event handler for store: %s", store_id)

    async def get_webhook_status(self, store_id: str) -> Dict[str, Any]:
        """Get webhook status for a store"""
        registered = self.registered_webhooks.get(store_id, [])
        
        return {
            'store_id': store_id,
            'registered_webhooks': len(registered),
            'webhook_topics': [wh.get('topic') for wh in registered],
            'has_event_handler': store_id in self.event_handlers,
            'last_updated': datetime.utcnow().isoformat()
        }

    async def test_webhook_connectivity(self, store_connection: ShopifyStoreConnection) -> bool:
        """Test webhook connectivity for a store"""
        try:
            # Make a test API call to verify connection
            url = f"https://{store_connection.shop_domain}.myshopify.com/admin/api/2024-01/webhooks.json"
            
            headers = {
                'X-Shopify-Access-Token': store_connection.access_token,
                'Content-Type': 'application/json'
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers) as response:
                    return response.status == 200
                    
        except Exception as e:
            logger.error("Webhook connectivity test failed for %s: %s", store_connection.shop_domain, e)
            return False

    def create_webhook_routes(self) -> web.Application:
        """Create aiohttp routes for webhook endpoints"""
        app = web.Application()
        
        # Generic webhook endpoint
        app.router.add_post('/webhook/{topic:.*}', self.process_webhook_request)
        
        # Specific endpoints for different topics
        for config in self.webhook_configs:
            topic_path = config.topic.value.replace('/', '_')
            app.router.add_post(f'/{topic_path}', self.process_webhook_request)
        
        return app

    async def start_processing(self):
        """Start webhook processing"""
        await self.webhook_processor.start()

    async def stop_processing(self):
        """Stop webhook processing"""
        await self.webhook_processor.stop()

    def get_failed_events(self) -> List[WebhookEvent]:
        """Get list of failed webhook events"""
        return self.webhook_processor.failed_events.copy()

    async def retry_failed_events(self) -> int:
        """Retry all failed webhook events"""
        failed_events = self.webhook_processor.failed_events.copy()
        self.webhook_processor.failed_events.clear()
        
        retry_count = 0
        for event in failed_events:
            # Reset event status for retry
            event.processing_status = WebhookStatus.PENDING
            event.retry_count = 0
            event.error_message = None
            
            await self.webhook_processor.add_event(event)
            retry_count += 1
        
        logger.info("Queued %d failed events for retry", retry_count)
        return retry_count