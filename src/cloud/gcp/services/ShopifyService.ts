import * as express from 'express';
import { Shopify } from '@shopify/shopify-api';
import { Session } from '@shopify/shopify-api/dist/auth/session';
import { RestClient } from '@shopify/shopify-api/dist/clients/rest';
import { GraphqlClient } from '@shopify/shopify-api/dist/clients/graphql';
import { logger } from '../config/logger';
import { DataLayerClient } from '../core/DataLayerClient';
import { EventBroker } from '../core/EventBroker';
import { MonitoringService } from '../core/MonitoringService';

interface ShopifyServiceConfig {
  projectId: string;
  apiKey: string;
  apiSecretKey: string;
  scopes: string[];
  hostName: string;
  webhookPath: string;
}

interface Shop {
  id: string;
  domain: string;
  accessToken: string;
  installedAt: Date;
  metadata: {
    name: string;
    email: string;
    currency: string;
    timezone: string;
    country: string;
    plan: string;
  };
  webhooks: {
    id: string;
    topic: string;
    endpoint: string;
    createdAt: Date;
  }[];
  settings: {
    syncProducts: boolean;
    syncOrders: boolean;
    syncCustomers: boolean;
    syncInventory: boolean;
    webhooksEnabled: boolean;
  };
}

export class ShopifyService {
  private app: express.Application;
  private shopify: Shopify;
  private dataLayer: DataLayerClient;
  private eventBroker: EventBroker;
  private monitoring: MonitoringService;
  private config: ShopifyServiceConfig;
  private shopClients: Map<string, RestClient> = new Map();
  private graphqlClients: Map<string, GraphqlClient> = new Map();

  constructor(config: ShopifyServiceConfig) {
    this.config = config;
    this.app = express();
    
    // Initialize Shopify API
    this.shopify = new Shopify({
      apiKey: config.apiKey,
      apiSecretKey: config.apiSecretKey,
      scopes: config.scopes,
      hostName: config.hostName,
      apiVersion: '2024-01'
    });

    // Initialize services
    this.dataLayer = new DataLayerClient({
      projectId: config.projectId,
      region: 'asia-northeast1',
      firestore: { databaseId: 'shopify-mcp-db' },
      bigquery: { datasetId: 'shopify_data' },
      redis: {
        host: 'localhost',
        port: 6379
      },
      storage: { bucketName: `${config.projectId}-shopify` }
    });

    this.eventBroker = new EventBroker({
      projectId: config.projectId,
      region: 'asia-northeast1'
    });

    this.monitoring = new MonitoringService({
      projectId: config.projectId,
      region: 'asia-northeast1',
      serviceName: 'shopify-service',
      environment: process.env.ENVIRONMENT || 'production'
    });

    this.setupRoutes();
    this.setupWebhooks();
    this.registerMetrics();
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: unknown, res: unknown) => {
      res.json({ status: 'healthy', service: 'shopify' });
    });

    // OAuth routes
    this.app.get('/auth', this.handleAuth.bind(this));
    this.app.get('/auth/callback', this.handleCallback.bind(this));

    // Shop management
    this.app.get('/shops', this.handleListShops.bind(this));
    this.app.get('/shops/:domain', this.handleGetShop.bind(this));
    this.app.put('/shops/:domain/settings', this.handleUpdateSettings.bind(this));
    this.app.delete('/shops/:domain', this.handleUninstall.bind(this));

    // Product endpoints
    this.app.get('/shops/:domain/products', this.handleGetProducts.bind(this));
    this.app.get('/shops/:domain/products/:id', this.handleGetProduct.bind(this));
    this.app.post('/shops/:domain/products', this.handleCreateProduct.bind(this));
    this.app.put('/shops/:domain/products/:id', this.handleUpdateProduct.bind(this));
    this.app.delete('/shops/:domain/products/:id', this.handleDeleteProduct.bind(this));
    this.app.post('/shops/:domain/products/sync', this.handleSyncProducts.bind(this));

    // Order endpoints
    this.app.get('/shops/:domain/orders', this.handleGetOrders.bind(this));
    this.app.get('/shops/:domain/orders/:id', this.handleGetOrder.bind(this));
    this.app.post('/shops/:domain/orders/:id/fulfill', this.handleFulfillOrder.bind(this));
    this.app.post('/shops/:domain/orders/:id/cancel', this.handleCancelOrder.bind(this));
    this.app.post('/shops/:domain/orders/sync', this.handleSyncOrders.bind(this));

    // Customer endpoints
    this.app.get('/shops/:domain/customers', this.handleGetCustomers.bind(this));
    this.app.get('/shops/:domain/customers/:id', this.handleGetCustomer.bind(this));
    this.app.post('/shops/:domain/customers', this.handleCreateCustomer.bind(this));
    this.app.put('/shops/:domain/customers/:id', this.handleUpdateCustomer.bind(this));

    // Inventory endpoints
    this.app.get('/shops/:domain/inventory', this.handleGetInventory.bind(this));
    this.app.put('/shops/:domain/inventory/:id', this.handleUpdateInventory.bind(this));
    this.app.post('/shops/:domain/inventory/sync', this.handleSyncInventory.bind(this));

    // Analytics endpoints
    this.app.get('/shops/:domain/analytics/overview', this.handleGetAnalytics.bind(this));
    this.app.get('/shops/:domain/analytics/products', this.handleGetProductAnalytics.bind(this));
    this.app.get('/shops/:domain/analytics/customers', this.handleGetCustomerAnalytics.bind(this));

    // Webhook endpoints
    this.app.post('/webhooks/:topic', this.handleWebhook.bind(this));
  }

  private setupWebhooks(): void {
    // Define webhook topics to subscribe to
    const webhookTopics = [
      'APP_UNINSTALLED',
      'PRODUCTS_CREATE',
      'PRODUCTS_UPDATE',
      'PRODUCTS_DELETE',
      'ORDERS_CREATE',
      'ORDERS_UPDATED',
      'ORDERS_FULFILLED',
      'ORDERS_CANCELLED',
      'CUSTOMERS_CREATE',
      'CUSTOMERS_UPDATE',
      'INVENTORY_LEVELS_UPDATE'
    ];

    // Register webhook handlers
    webhookTopics.forEach(topic => {
      this.shopify.webhooks.addHandler(topic, {
        deliveryMethod: 'http',
        callbackUrl: `${this.config.hostName}${this.config.webhookPath}/${topic.toLowerCase()}`,
        callback: async (topic: unknown, shopDomain: unknown, body: unknown) => {
          await this.processWebhook(topic, shopDomain, body);
        }
      });
    });
  }

  private registerMetrics(): void {
    // Register custom metrics
    this.monitoring.registerMetric({
      name: 'shopify_api_calls',
      type: 'CUMULATIVE',
      unit: '1',
      description: 'Number of Shopify API calls',
      labels: ['shop', 'endpoint', 'method', 'status']
    });

    this.monitoring.registerMetric({
      name: 'shopify_webhook_received',
      type: 'CUMULATIVE',
      unit: '1',
      description: 'Number of Shopify webhooks received',
      labels: ['shop', 'topic']
    });

    this.monitoring.registerMetric({
      name: 'shopify_sync_duration',
      type: 'GAUGE',
      unit: 'ms',
      description: 'Duration of Shopify sync operations',
      labels: ['shop', 'resource', 'status']
    });
  }

  // OAuth handlers
  private async handleAuth(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { shop } = req.query;
      
      if (!shop) {
        res.status(400).send('Missing shop parameter');
        return;
      }

      const authRoute = await this.shopify.auth.begin({
        shop: shop as string,
        callbackPath: '/auth/callback',
        isOnline: false
      });

      res.redirect(authRoute);
    } catch (error) {
      logger.error('Auth error', { error });
      res.status(500).send('Authentication failed');
    }
  }

  private async handleCallback(req: express.Request, res: express.Response): Promise<void> {
    try {
      const callbackResponse = await this.shopify.auth.callback({
        rawRequest: req,
        rawResponse: res
      });

      if (!callbackResponse.session) {
        throw new Error('No session returned from callback');
      }

      // Store shop data
      await this.installApp(callbackResponse.session);

      // Redirect to success page
      res.redirect(`/success?shop=${callbackResponse.session.shop}`);
    } catch (error) {
      logger.error('Callback error', { error });
      res.status(500).send('Authentication callback failed');
    }
  }

  // Shop management
  private async installApp(session: Session): Promise<void> {
    const client = new RestClient({ session });
    
    // Get shop details
    const shopData = await client.get({ path: 'shop' });
    
    const shop: Shop = {
      id: session.shop,
      domain: session.shop,
      accessToken: session.accessToken!,
      installedAt: new Date(),
      metadata: {
        name: shopData.body.shop.name,
        email: shopData.body.shop.email,
        currency: shopData.body.shop.currency,
        timezone: shopData.body.shop.timezone,
        country: shopData.body.shop.country_name,
        plan: shopData.body.shop.plan_name
      },
      webhooks: [],
      settings: {
        syncProducts: true,
        syncOrders: true,
        syncCustomers: true,
        syncInventory: true,
        webhooksEnabled: true
      }
    };

    // Save to database
    await this.dataLayer.firestoreSet('shops', shop.id, shop);

    // Register webhooks
    await this.registerWebhooksForShop(shop);

    // Initial sync
    await this.performInitialSync(shop);

    // Emit installation event
    await this.eventBroker.publish('shopify-events', 'app.installed', {
      shopId: shop.id,
      shopDomain: shop.domain,
      metadata: shop.metadata
    });
  }

  private async registerWebhooksForShop(shop: Shop): Promise<void> {
    const client = new RestClient({
      session: {
        shop: shop.domain,
        accessToken: shop.accessToken
      } as Session
    });

    const webhookTopics = [
      'APP_UNINSTALLED',
      'PRODUCTS_CREATE',
      'PRODUCTS_UPDATE',
      'PRODUCTS_DELETE',
      'ORDERS_CREATE',
      'ORDERS_UPDATED',
      'ORDERS_FULFILLED',
      'ORDERS_CANCELLED',
      'CUSTOMERS_CREATE',
      'CUSTOMERS_UPDATE',
      'INVENTORY_LEVELS_UPDATE'
    ];

    for (const topic of webhookTopics) {
      try {
        const webhook = await client.post({
          path: 'webhooks',
          data: {
            webhook: {
              topic: topic,
              address: `${this.config.hostName}${this.config.webhookPath}/${topic.toLowerCase()}`,
              format: 'json'
            }
          }
        });

        shop.webhooks.push({
          id: webhook.body.webhook.id,
          topic: topic,
          endpoint: webhook.body.webhook.address,
          createdAt: new Date()
        });
      } catch (error) {
        logger.error(`Failed to register webhook: ${topic}`, { error, shop: shop.domain });
      }
    }

    // Update shop with webhook info
    await this.dataLayer.firestoreSet('shops', shop.id, shop);
  }

  private async performInitialSync(shop: Shop): Promise<void> {
    const tasks = [];

    if (shop.settings.syncProducts) {
      tasks.push(this.syncProducts(shop));
    }

    if (shop.settings.syncOrders) {
      tasks.push(this.syncOrders(shop));
    }

    if (shop.settings.syncCustomers) {
      tasks.push(this.syncCustomers(shop));
    }

    if (shop.settings.syncInventory) {
      tasks.push(this.syncInventory(shop));
    }

    await Promise.all(tasks);
  }

  // Shop endpoints
  private async handleListShops(req: express.Request, res: express.Response): Promise<void> {
    try {
      const shops = await this.dataLayer.firestoreQuery('shops', {
        orderBy: [{ field: 'installedAt', direction: 'desc' }]
      });

      res.json(shops);
    } catch (error) {
      logger.error('List shops error', { error });
      res.status(500).json({ error: 'Failed to list shops' });
    }
  }

  private async handleGetShop(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { domain } = req.params;
      const shop = await this.getShop(domain);

      if (!shop) {
        res.status(404).json({ error: 'Shop not found' });
        return;
      }

      res.json(shop);
    } catch (error) {
      logger.error('Get shop error', { error });
      res.status(500).json({ error: 'Failed to get shop' });
    }
  }

  private async handleUpdateSettings(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { domain } = req.params;
      const settings = req.body;

      const shop = await this.getShop(domain);
      if (!shop) {
        res.status(404).json({ error: 'Shop not found' });
        return;
      }

      shop.settings = { ...shop.settings, ...settings };
      await this.dataLayer.firestoreSet('shops', shop.id, shop);

      res.json(shop);
    } catch (error) {
      logger.error('Update settings error', { error });
      res.status(500).json({ error: 'Failed to update settings' });
    }
  }

  private async handleUninstall(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { domain } = req.params;
      
      const shop = await this.getShop(domain);
      if (!shop) {
        res.status(404).json({ error: 'Shop not found' });
        return;
      }

      // Remove webhooks
      const client = this.getClient(shop);
      for (const webhook of shop.webhooks) {
        try {
          await client.delete({ path: `webhooks/${webhook.id}` });
        } catch (error) {
          logger.error('Failed to delete webhook', { error, webhookId: webhook.id });
        }
      }

      // Delete shop data
      await this.dataLayer.firestoreSet('shops', shop.id, null);

      // Emit uninstall event
      await this.eventBroker.publish('shopify-events', 'app.uninstalled', {
        shopId: shop.id,
        shopDomain: shop.domain
      });

      res.status(204).end();
    } catch (error) {
      logger.error('Uninstall error', { error });
      res.status(500).json({ error: 'Failed to uninstall app' });
    }
  }

  // Product endpoints
  private async handleGetProducts(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { domain } = req.params;
      const { page = 1, limit = 50, fields, search } = req.query;

      const shop = await this.getShop(domain);
      if (!shop) {
        res.status(404).json({ error: 'Shop not found' });
        return;
      }

      // Get from cache first
      const cacheKey = `products:${domain}:${page}:${limit}:${fields}:${search}`;
      const cached = await this.dataLayer.cacheGet(cacheKey);
      if (cached) {
        res.json(cached);
        return;
      }

      const client = this.getClient(shop);
      const timer = this.monitoring.createPerformanceTimer('shopify_api_call');

      const products = await client.get({
        path: 'products',
        query: {
          limit: limit as string,
          page: page as string,
          fields: fields as string
        }
      });

      await timer();
      await this.recordApiCall(shop.domain, 'products', 'GET', 200);

      // Cache the results
      await this.dataLayer.cacheSet(cacheKey, products.body, { ttl: 300 });

      res.json(products.body);
    } catch (error) {
      logger.error('Get products error', { error });
      await this.recordApiCall(req.params.domain, 'products', 'GET', 500);
      res.status(500).json({ error: 'Failed to get products' });
    }
  }

  private async handleGetProduct(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { domain, id } = req.params;
      
      const shop = await this.getShop(domain);
      if (!shop) {
        res.status(404).json({ error: 'Shop not found' });
        return;
      }

      const client = this.getClient(shop);
      const product = await client.get({ path: `products/${id}` });

      res.json(product.body);
    } catch (error) {
      logger.error('Get product error', { error });
      res.status(500).json({ error: 'Failed to get product' });
    }
  }

  private async handleCreateProduct(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { domain } = req.params;
      const productData = req.body;

      const shop = await this.getShop(domain);
      if (!shop) {
        res.status(404).json({ error: 'Shop not found' });
        return;
      }

      const client = this.getClient(shop);
      const product = await client.post({
        path: 'products',
        data: { product: productData }
      });

      // Emit event
      await this.eventBroker.publish('shopify-events', 'product.created', {
        shopId: shop.id,
        productId: product.body.product.id,
        product: product.body.product
      });

      res.status(201).json(product.body);
    } catch (error) {
      logger.error('Create product error', { error });
      res.status(500).json({ error: 'Failed to create product' });
    }
  }

  private async handleUpdateProduct(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { domain, id } = req.params;
      const productData = req.body;

      const shop = await this.getShop(domain);
      if (!shop) {
        res.status(404).json({ error: 'Shop not found' });
        return;
      }

      const client = this.getClient(shop);
      const product = await client.put({
        path: `products/${id}`,
        data: { product: productData }
      });

      // Emit event
      await this.eventBroker.publish('shopify-events', 'product.updated', {
        shopId: shop.id,
        productId: id,
        product: product.body.product
      });

      res.json(product.body);
    } catch (error) {
      logger.error('Update product error', { error });
      res.status(500).json({ error: 'Failed to update product' });
    }
  }

  private async handleDeleteProduct(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { domain, id } = req.params;

      const shop = await this.getShop(domain);
      if (!shop) {
        res.status(404).json({ error: 'Shop not found' });
        return;
      }

      const client = this.getClient(shop);
      await client.delete({ path: `products/${id}` });

      // Emit event
      await this.eventBroker.publish('shopify-events', 'product.deleted', {
        shopId: shop.id,
        productId: id
      });

      res.status(204).end();
    } catch (error) {
      logger.error('Delete product error', { error });
      res.status(500).json({ error: 'Failed to delete product' });
    }
  }

  private async handleSyncProducts(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { domain } = req.params;
      
      const shop = await this.getShop(domain);
      if (!shop) {
        res.status(404).json({ error: 'Shop not found' });
        return;
      }

      // Start async sync
      this.syncProducts(shop).catch(error => {
        logger.error('Product sync failed', { error, shop: shop.domain });
      });

      res.json({ message: 'Product sync started' });
    } catch (error) {
      logger.error('Sync products error', { error });
      res.status(500).json({ error: 'Failed to start product sync' });
    }
  }

  // Order endpoints
  private async handleGetOrders(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { domain } = req.params;
      const { status, page = 1, limit = 50, created_at_min, created_at_max } = req.query;

      const shop = await this.getShop(domain);
      if (!shop) {
        res.status(404).json({ error: 'Shop not found' });
        return;
      }

      const client = this.getClient(shop);
      const orders = await client.get({
        path: 'orders',
        query: {
          status: status as string,
          limit: limit as string,
          page: page as string,
          created_at_min: created_at_min as string,
          created_at_max: created_at_max as string
        }
      });

      res.json(orders.body);
    } catch (error) {
      logger.error('Get orders error', { error });
      res.status(500).json({ error: 'Failed to get orders' });
    }
  }

  private async handleGetOrder(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { domain, id } = req.params;

      const shop = await this.getShop(domain);
      if (!shop) {
        res.status(404).json({ error: 'Shop not found' });
        return;
      }

      const client = this.getClient(shop);
      const order = await client.get({ path: `orders/${id}` });

      res.json(order.body);
    } catch (error) {
      logger.error('Get order error', { error });
      res.status(500).json({ error: 'Failed to get order' });
    }
  }

  private async handleFulfillOrder(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { domain, id } = req.params;
      const fulfillmentData = req.body;

      const shop = await this.getShop(domain);
      if (!shop) {
        res.status(404).json({ error: 'Shop not found' });
        return;
      }

      const client = this.getClient(shop);
      const fulfillment = await client.post({
        path: `orders/${id}/fulfillments`,
        data: { fulfillment: fulfillmentData }
      });

      // Emit event
      await this.eventBroker.publish('shopify-events', 'order.fulfilled', {
        shopId: shop.id,
        orderId: id,
        fulfillment: fulfillment.body.fulfillment
      });

      res.json(fulfillment.body);
    } catch (error) {
      logger.error('Fulfill order error', { error });
      res.status(500).json({ error: 'Failed to fulfill order' });
    }
  }

  private async handleCancelOrder(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { domain, id } = req.params;
      const { reason } = req.body;

      const shop = await this.getShop(domain);
      if (!shop) {
        res.status(404).json({ error: 'Shop not found' });
        return;
      }

      const client = this.getClient(shop);
      const order = await client.post({
        path: `orders/${id}/cancel`,
        data: { reason }
      });

      // Emit event
      await this.eventBroker.publish('shopify-events', 'order.cancelled', {
        shopId: shop.id,
        orderId: id,
        reason
      });

      res.json(order.body);
    } catch (error) {
      logger.error('Cancel order error', { error });
      res.status(500).json({ error: 'Failed to cancel order' });
    }
  }

  private async handleSyncOrders(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { domain } = req.params;
      
      const shop = await this.getShop(domain);
      if (!shop) {
        res.status(404).json({ error: 'Shop not found' });
        return;
      }

      // Start async sync
      this.syncOrders(shop).catch(error => {
        logger.error('Order sync failed', { error, shop: shop.domain });
      });

      res.json({ message: 'Order sync started' });
    } catch (error) {
      logger.error('Sync orders error', { error });
      res.status(500).json({ error: 'Failed to start order sync' });
    }
  }

  // Customer endpoints
  private async handleGetCustomers(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { domain } = req.params;
      const { page = 1, limit = 50, _search } = req.query;

      const shop = await this.getShop(domain);
      if (!shop) {
        res.status(404).json({ error: 'Shop not found' });
        return;
      }

      const client = this.getClient(shop);
      const customers = await client.get({
        path: 'customers',
        query: {
          limit: limit as string,
          page: page as string
        }
      });

      res.json(customers.body);
    } catch (error) {
      logger.error('Get customers error', { error });
      res.status(500).json({ error: 'Failed to get customers' });
    }
  }

  private async handleGetCustomer(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { domain, id } = req.params;

      const shop = await this.getShop(domain);
      if (!shop) {
        res.status(404).json({ error: 'Shop not found' });
        return;
      }

      const client = this.getClient(shop);
      const customer = await client.get({ path: `customers/${id}` });

      res.json(customer.body);
    } catch (error) {
      logger.error('Get customer error', { error });
      res.status(500).json({ error: 'Failed to get customer' });
    }
  }

  private async handleCreateCustomer(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { domain } = req.params;
      const customerData = req.body;

      const shop = await this.getShop(domain);
      if (!shop) {
        res.status(404).json({ error: 'Shop not found' });
        return;
      }

      const client = this.getClient(shop);
      const customer = await client.post({
        path: 'customers',
        data: { customer: customerData }
      });

      res.status(201).json(customer.body);
    } catch (error) {
      logger.error('Create customer error', { error });
      res.status(500).json({ error: 'Failed to create customer' });
    }
  }

  private async handleUpdateCustomer(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { domain, id } = req.params;
      const customerData = req.body;

      const shop = await this.getShop(domain);
      if (!shop) {
        res.status(404).json({ error: 'Shop not found' });
        return;
      }

      const client = this.getClient(shop);
      const customer = await client.put({
        path: `customers/${id}`,
        data: { customer: customerData }
      });

      res.json(customer.body);
    } catch (error) {
      logger.error('Update customer error', { error });
      res.status(500).json({ error: 'Failed to update customer' });
    }
  }

  // Inventory endpoints
  private async handleGetInventory(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { domain } = req.params;
      const { location_id } = req.query;

      const shop = await this.getShop(domain);
      if (!shop) {
        res.status(404).json({ error: 'Shop not found' });
        return;
      }

      const client = this.getClient(shop);
      const inventory = await client.get({
        path: 'inventory_levels',
        query: {
          location_ids: location_id as string
        }
      });

      res.json(inventory.body);
    } catch (error) {
      logger.error('Get inventory error', { error });
      res.status(500).json({ error: 'Failed to get inventory' });
    }
  }

  private async handleUpdateInventory(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { domain } = req.params;
      const { inventory_item_id, location_id, available } = req.body;

      const shop = await this.getShop(domain);
      if (!shop) {
        res.status(404).json({ error: 'Shop not found' });
        return;
      }

      const client = this.getClient(shop);
      const inventory = await client.post({
        path: 'inventory_levels/set',
        data: {
          inventory_item_id,
          location_id,
          available
        }
      });

      res.json(inventory.body);
    } catch (error) {
      logger.error('Update inventory error', { error });
      res.status(500).json({ error: 'Failed to update inventory' });
    }
  }

  private async handleSyncInventory(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { domain } = req.params;
      
      const shop = await this.getShop(domain);
      if (!shop) {
        res.status(404).json({ error: 'Shop not found' });
        return;
      }

      // Start async sync
      this.syncInventory(shop).catch(error => {
        logger.error('Inventory sync failed', { error, shop: shop.domain });
      });

      res.json({ message: 'Inventory sync started' });
    } catch (error) {
      logger.error('Sync inventory error', { error });
      res.status(500).json({ error: 'Failed to start inventory sync' });
    }
  }

  // Analytics endpoints
  private async handleGetAnalytics(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { domain } = req.params;
      const { start_date, end_date } = req.query;

      const shop = await this.getShop(domain);
      if (!shop) {
        res.status(404).json({ error: 'Shop not found' });
        return;
      }

      // Query BigQuery for analytics
      const analytics = await this.getShopAnalytics(shop.id, start_date as string, end_date as string);

      res.json(analytics);
    } catch (error) {
      logger.error('Get analytics error', { error });
      res.status(500).json({ error: 'Failed to get analytics' });
    }
  }

  private async handleGetProductAnalytics(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { domain } = req.params;
      const { start_date, end_date, product_id } = req.query;

      const shop = await this.getShop(domain);
      if (!shop) {
        res.status(404).json({ error: 'Shop not found' });
        return;
      }

      const analytics = await this.getProductAnalytics(
        shop.id,
        start_date as string,
        end_date as string,
        product_id as string
      );

      res.json(analytics);
    } catch (error) {
      logger.error('Get product analytics error', { error });
      res.status(500).json({ error: 'Failed to get product analytics' });
    }
  }

  private async handleGetCustomerAnalytics(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { domain } = req.params;
      const { start_date, end_date } = req.query;

      const shop = await this.getShop(domain);
      if (!shop) {
        res.status(404).json({ error: 'Shop not found' });
        return;
      }

      const analytics = await this.getCustomerAnalytics(
        shop.id,
        start_date as string,
        end_date as string
      );

      res.json(analytics);
    } catch (error) {
      logger.error('Get customer analytics error', { error });
      res.status(500).json({ error: 'Failed to get customer analytics' });
    }
  }

  // Webhook handler
  private async handleWebhook(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { topic } = req.params;
      const shopDomain = req.headers['x-shopify-shop-domain'] as string;
      const _hmac = req.headers['x-shopify-hmac-sha256'] as string;

      // Verify webhook
      const isValid = await this.shopify.webhooks.validate({
        rawBody: req.body,
        rawRequest: req
      });

      if (!isValid) {
        res.status(401).send('Unauthorized');
        return;
      }

      // Process webhook
      await this.processWebhook(topic.toUpperCase(), shopDomain, req.body);

      res.status(200).send('OK');
    } catch (error) {
      logger.error('Webhook error', { error, topic: req.params.topic });
      res.status(500).send('Webhook processing failed');
    }
  }

  // Helper methods
  private async getShop(domain: string): Promise<Shop | null> {
    const shop = await this.dataLayer.firestoreGet('shops', domain);
    return shop as Shop || null;
  }

  private getClient(shop: Shop): RestClient {
    if (!this.shopClients.has(shop.domain)) {
      const client = new RestClient({
        session: {
          shop: shop.domain,
          accessToken: shop.accessToken
        } as Session
      });
      this.shopClients.set(shop.domain, client);
    }
    return this.shopClients.get(shop.domain)!;
  }

  private getGraphqlClient(shop: Shop): GraphqlClient {
    if (!this.graphqlClients.has(shop.domain)) {
      const client = new GraphqlClient({
        session: {
          shop: shop.domain,
          accessToken: shop.accessToken
        } as Session
      });
      this.graphqlClients.set(shop.domain, client);
    }
    return this.graphqlClients.get(shop.domain)!;
  }

  // Sync methods
  private async syncProducts(shop: Shop): Promise<void> {
    const startTime = Date.now();
    logger.info(`Starting product sync for ${shop.domain}`);

    try {
      const client = this.getClient(shop);
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await client.get({
          path: 'products',
          query: {
            limit: '250',
            page: page.toString()
          }
        });

        const products = response.body.products;
        
        if (products.length === 0) {
          hasMore = false;
          break;
        }

        // Save to Firestore
        const batch = products.map((product: unknown) => ({
          type: 'set' as const,
          collection: 'products',
          documentId: `${shop.id}_${product.id}`,
          data: {
            shopId: shop.id,
            shopDomain: shop.domain,
            ...product,
            syncedAt: new Date()
          }
        }));

        await this.dataLayer.firestoreBatchWrite(batch);

        // Save to BigQuery
        const bigQueryRows = products.map((product: unknown) => ({
          id: product.id,
          shop_id: shop.id,
          title: product.title,
          vendor: product.vendor,
          created_at: product.created_at,
          updated_at: product.updated_at,
          data: JSON.stringify(product)
        }));

        await this.dataLayer.bigqueryInsert('shopify_data', 'products', bigQueryRows);

        logger.info(`Synced ${products.length} products for ${shop.domain} (page ${page})`);
        page++;
      }

      const duration = Date.now() - startTime;
      await this.monitoring.recordMetric('shopify_sync_duration', duration, {
        shop: shop.domain,
        resource: 'products',
        status: 'success'
      });

      logger.info(`Product sync completed for ${shop.domain} in ${duration}ms`);
    } catch (error) {
      logger.error(`Product sync failed for ${shop.domain}`, { error });
      
      await this.monitoring.recordMetric('shopify_sync_duration', Date.now() - startTime, {
        shop: shop.domain,
        resource: 'products',
        status: 'error'
      });

      throw error;
    }
  }

  private async syncOrders(shop: Shop): Promise<void> {
    const startTime = Date.now();
    logger.info(`Starting order sync for ${shop.domain}`);

    try {
      const client = this.getClient(shop);
      let page = 1;
      let hasMore = true;

      // Get orders from the last 30 days
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      while (hasMore) {
        const response = await client.get({
          path: 'orders',
          query: {
            limit: '250',
            page: page.toString(),
            created_at_min: startDate.toISOString(),
            status: 'any'
          }
        });

        const orders = response.body.orders;
        
        if (orders.length === 0) {
          hasMore = false;
          break;
        }

        // Save to Firestore
        const batch = orders.map((order: unknown) => ({
          type: 'set' as const,
          collection: 'orders',
          documentId: `${shop.id}_${order.id}`,
          data: {
            shopId: shop.id,
            shopDomain: shop.domain,
            ...order,
            syncedAt: new Date()
          }
        }));

        await this.dataLayer.firestoreBatchWrite(batch);

        // Save to BigQuery
        const bigQueryRows = orders.map((order: unknown) => ({
          id: order.id,
          shop_id: shop.id,
          customer_id: order.customer?.id,
          total_price: parseFloat(order.total_price),
          currency: order.currency,
          created_at: order.created_at,
          data: JSON.stringify(order)
        }));

        await this.dataLayer.bigqueryInsert('shopify_data', 'orders', bigQueryRows);

        logger.info(`Synced ${orders.length} orders for ${shop.domain} (page ${page})`);
        page++;
      }

      const duration = Date.now() - startTime;
      await this.monitoring.recordMetric('shopify_sync_duration', duration, {
        shop: shop.domain,
        resource: 'orders',
        status: 'success'
      });

      logger.info(`Order sync completed for ${shop.domain} in ${duration}ms`);
    } catch (error) {
      logger.error(`Order sync failed for ${shop.domain}`, { error });
      
      await this.monitoring.recordMetric('shopify_sync_duration', Date.now() - startTime, {
        shop: shop.domain,
        resource: 'orders',
        status: 'error'
      });

      throw error;
    }
  }

  private async syncCustomers(shop: Shop): Promise<void> {
    const startTime = Date.now();
    logger.info(`Starting customer sync for ${shop.domain}`);

    try {
      const client = this.getClient(shop);
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await client.get({
          path: 'customers',
          query: {
            limit: '250',
            page: page.toString()
          }
        });

        const customers = response.body.customers;
        
        if (customers.length === 0) {
          hasMore = false;
          break;
        }

        // Save to Firestore
        const batch = customers.map((customer: unknown) => ({
          type: 'set' as const,
          collection: 'customers',
          documentId: `${shop.id}_${customer.id}`,
          data: {
            shopId: shop.id,
            shopDomain: shop.domain,
            ...customer,
            syncedAt: new Date()
          }
        }));

        await this.dataLayer.firestoreBatchWrite(batch);

        logger.info(`Synced ${customers.length} customers for ${shop.domain} (page ${page})`);
        page++;
      }

      const duration = Date.now() - startTime;
      await this.monitoring.recordMetric('shopify_sync_duration', duration, {
        shop: shop.domain,
        resource: 'customers',
        status: 'success'
      });

      logger.info(`Customer sync completed for ${shop.domain} in ${duration}ms`);
    } catch (error) {
      logger.error(`Customer sync failed for ${shop.domain}`, { error });
      
      await this.monitoring.recordMetric('shopify_sync_duration', Date.now() - startTime, {
        shop: shop.domain,
        resource: 'customers',
        status: 'error'
      });

      throw error;
    }
  }

  private async syncInventory(shop: Shop): Promise<void> {
    const startTime = Date.now();
    logger.info(`Starting inventory sync for ${shop.domain}`);

    try {
      const client = this.getClient(shop);
      
      // Get all locations
      const locationsResponse = await client.get({ path: 'locations' });
      const locations = locationsResponse.body.locations;

      for (const location of locations) {
        let page = 1;
        let hasMore = true;

        while (hasMore) {
          const response = await client.get({
            path: 'inventory_levels',
            query: {
              location_ids: location.id.toString(),
              limit: '250',
              page: page.toString()
            }
          });

          const inventoryLevels = response.body.inventory_levels;
          
          if (inventoryLevels.length === 0) {
            hasMore = false;
            break;
          }

          // Save to Firestore
          const batch = inventoryLevels.map((inventory: unknown) => ({
            type: 'set' as const,
            collection: 'inventory',
            documentId: `${shop.id}_${inventory.inventory_item_id}_${location.id}`,
            data: {
              shopId: shop.id,
              shopDomain: shop.domain,
              locationId: location.id,
              locationName: location.name,
              ...inventory,
              syncedAt: new Date()
            }
          }));

          await this.dataLayer.firestoreBatchWrite(batch);

          logger.info(`Synced ${inventoryLevels.length} inventory levels for ${shop.domain} at ${location.name} (page ${page})`);
          page++;
        }
      }

      const duration = Date.now() - startTime;
      await this.monitoring.recordMetric('shopify_sync_duration', duration, {
        shop: shop.domain,
        resource: 'inventory',
        status: 'success'
      });

      logger.info(`Inventory sync completed for ${shop.domain} in ${duration}ms`);
    } catch (error) {
      logger.error(`Inventory sync failed for ${shop.domain}`, { error });
      
      await this.monitoring.recordMetric('shopify_sync_duration', Date.now() - startTime, {
        shop: shop.domain,
        resource: 'inventory',
        status: 'error'
      });

      throw error;
    }
  }

  // Webhook processing
  private async processWebhook(topic: string, shopDomain: string, data: unknown): Promise<void> {
    logger.info(`Processing webhook: ${topic} for ${shopDomain}`);

    // Record webhook metric
    await this.monitoring.recordMetric('shopify_webhook_received', 1, {
      shop: shopDomain,
      topic
    });

    const shop = await this.getShop(shopDomain);
    if (!shop) {
      logger.error(`Shop not found for webhook: ${shopDomain}`);
      return;
    }

    // Process based on topic
    switch (topic) {
      case 'APP_UNINSTALLED':
        await this.handleUninstallWebhook(shop);
        break;
      
      case 'PRODUCTS_CREATE':
      case 'PRODUCTS_UPDATE':
        await this.handleProductWebhook(shop, data, topic);
        break;
      
      case 'PRODUCTS_DELETE':
        await this.handleProductDeleteWebhook(shop, data);
        break;
      
      case 'ORDERS_CREATE':
      case 'ORDERS_UPDATED':
      case 'ORDERS_FULFILLED':
      case 'ORDERS_CANCELLED':
        await this.handleOrderWebhook(shop, data, topic);
        break;
      
      case 'CUSTOMERS_CREATE':
      case 'CUSTOMERS_UPDATE':
        await this.handleCustomerWebhook(shop, data, topic);
        break;
      
      case 'INVENTORY_LEVELS_UPDATE':
        await this.handleInventoryWebhook(shop, data);
        break;
      
      default:
        logger.warn(`Unknown webhook topic: ${topic}`);
    }

    // Emit webhook event
    await this.eventBroker.publish('shopify-events', `webhook.${topic.toLowerCase()}`, {
      shopId: shop.id,
      shopDomain: shop.domain,
      topic,
      data
    });
  }

  private async handleUninstallWebhook(shop: Shop): Promise<void> {
    // The app has been uninstalled
    await this.dataLayer.firestoreSet('shops', shop.id, {
      ...shop,
      uninstalledAt: new Date()
    });

    // Emit uninstall event
    await this.eventBroker.publish('shopify-events', 'app.uninstalled', {
      shopId: shop.id,
      shopDomain: shop.domain
    });
  }

  private async handleProductWebhook(shop: Shop, data: unknown, _topic: string): Promise<void> {
    const product = data;
    
    // Save to Firestore
    await this.dataLayer.firestoreSet(
      'products',
      `${shop.id}_${product.id}`,
      {
        shopId: shop.id,
        shopDomain: shop.domain,
        ...product,
        syncedAt: new Date()
      }
    );

    // Save to BigQuery
    await this.dataLayer.bigqueryInsert('shopify_data', 'products', [{
      id: product.id,
      shop_id: shop.id,
      title: product.title,
      vendor: product.vendor,
      created_at: product.created_at,
      updated_at: product.updated_at,
      data: JSON.stringify(product)
    }]);
  }

  private async handleProductDeleteWebhook(shop: Shop, data: unknown): Promise<void> {
    const productId = data.id;
    
    // Delete from Firestore
    await this.dataLayer.firestoreSet(
      'products',
      `${shop.id}_${productId}`,
      null
    );
  }

  private async handleOrderWebhook(shop: Shop, data: unknown, _topic: string): Promise<void> {
    const order = data;
    
    // Save to Firestore
    await this.dataLayer.firestoreSet(
      'orders',
      `${shop.id}_${order.id}`,
      {
        shopId: shop.id,
        shopDomain: shop.domain,
        ...order,
        syncedAt: new Date()
      }
    );

    // Save to BigQuery
    await this.dataLayer.bigqueryInsert('shopify_data', 'orders', [{
      id: order.id,
      shop_id: shop.id,
      customer_id: order.customer?.id,
      total_price: parseFloat(order.total_price),
      currency: order.currency,
      created_at: order.created_at,
      data: JSON.stringify(order)
    }]);
  }

  private async handleCustomerWebhook(shop: Shop, data: unknown, _topic: string): Promise<void> {
    const customer = data;
    
    // Save to Firestore
    await this.dataLayer.firestoreSet(
      'customers',
      `${shop.id}_${customer.id}`,
      {
        shopId: shop.id,
        shopDomain: shop.domain,
        ...customer,
        syncedAt: new Date()
      }
    );
  }

  private async handleInventoryWebhook(shop: Shop, data: unknown): Promise<void> {
    const inventory = data;
    
    // Save to Firestore
    await this.dataLayer.firestoreSet(
      'inventory',
      `${shop.id}_${inventory.inventory_item_id}_${inventory.location_id}`,
      {
        shopId: shop.id,
        shopDomain: shop.domain,
        ...inventory,
        syncedAt: new Date()
      }
    );
  }

  // Analytics methods
  private async getShopAnalytics(shopId: string, startDate: string, endDate: string): Promise<unknown> {
    const query = `
      SELECT 
        COUNT(DISTINCT id) as total_orders,
        SUM(total_price) as total_revenue,
        AVG(total_price) as avg_order_value,
        COUNT(DISTINCT customer_id) as unique_customers
      FROM shopify_data.orders
      WHERE shop_id = @shopId
        AND created_at >= @startDate
        AND created_at <= @endDate
    `;

    const results = await this.dataLayer.bigqueryQuery(query, [shopId, startDate, endDate]);
    return results[0] || {};
  }

  private async getProductAnalytics(
    shopId: string,
    startDate: string,
    endDate: string,
    productId?: string
  ): Promise<unknown> {
    let query = `
      SELECT 
        p.id as product_id,
        p.title as product_title,
        COUNT(DISTINCT o.id) as order_count,
        SUM(oi.quantity) as units_sold,
        SUM(oi.price * oi.quantity) as revenue
      FROM shopify_data.orders o
      JOIN UNNEST(JSON_EXTRACT_ARRAY(o.data, '$.line_items')) as oi
      JOIN shopify_data.products p ON p.id = CAST(JSON_EXTRACT_SCALAR(oi, '$.product_id') AS INT64)
      WHERE o.shop_id = @shopId
        AND o.created_at >= @startDate
        AND o.created_at <= @endDate
    `;

    const params = [shopId, startDate, endDate];
    
    if (productId) {
      query += ` AND p.id = @productId`;
      params.push(productId);
    }

    query += ` GROUP BY p.id, p.title ORDER BY revenue DESC`;

    return await this.dataLayer.bigqueryQuery(query, params);
  }

  private async getCustomerAnalytics(
    shopId: string,
    startDate: string,
    endDate: string
  ): Promise<unknown> {
    const query = `
      SELECT 
        customer_id,
        COUNT(id) as order_count,
        SUM(total_price) as lifetime_value,
        MAX(created_at) as last_order_date,
        MIN(created_at) as first_order_date
      FROM shopify_data.orders
      WHERE shop_id = @shopId
        AND created_at >= @startDate
        AND created_at <= @endDate
        AND customer_id IS NOT NULL
      GROUP BY customer_id
      ORDER BY lifetime_value DESC
      LIMIT 100
    `;

    return await this.dataLayer.bigqueryQuery(query, [shopId, startDate, endDate]);
  }

  // Monitoring
  private async recordApiCall(shop: string, endpoint: string, method: string, status: number): Promise<void> {
    await this.monitoring.recordMetric('shopify_api_calls', 1, {
      shop,
      endpoint,
      method,
      status: status.toString()
    });
  }

  // Service lifecycle
  async start(port: number = 3002): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(port, () => {
        logger.info(`Shopify service started on port ${port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    await this.dataLayer.close();
    await this.monitoring.close();
  }
}