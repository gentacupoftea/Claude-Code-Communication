/**
 * Amazon Order Sync Processor
 * アマゾン注文同期処理
 */

const AmazonAPIClient = require('../client/AmazonAPIClient');
const AmazonOrder = require('../models/AmazonOrder');
const { logger } = require('../../../utils/logger');
const { cache } = require('../../../utils/cache');
const { queue } = require('../../../utils/queue');
const BatchProcessor = require('../../../utils/BatchProcessor');
const EventEmitter = require('events');

class OrderSyncProcessor extends EventEmitter {
  constructor(config) {
    super();
    this.client = new AmazonAPIClient(config);
    this.cache = cache.namespace('amazon-orders');
    this.queue = queue.create('amazon-order-sync');
    this.batchProcessor = new BatchProcessor({
      batchSize: config.batchSize || 50,
      concurrency: config.concurrency || 2
    });
    this.syncConfig = {
      interval: config.syncInterval || 300000, // 5 minutes default
      lookbackHours: config.lookbackHours || 24,
      orderStatuses: config.orderStatuses || null, // null = all statuses
      fulfillmentChannels: config.fulfillmentChannels || null,
      paymentMethods: config.paymentMethods || null,
      marketplaceIds: config.marketplaceIds || ['A1VC38T7YXB528'] // Japan
    };
    this.lastSyncTime = null;
    this.syncTimer = null;
  }

  /**
   * Sync all orders from Amazon
   * @param {Object} options - Sync options
   * @returns {Promise<Object>} Sync result
   */
  async syncAllOrders(options = {}) {
    const startTime = Date.now();
    const results = {
      total: 0,
      synced: 0,
      failed: 0,
      errors: []
    };

    try {
      logger.info('Starting Amazon order sync');
      this.emit('sync:start', { timestamp: new Date() });
      
      // Calculate date range
      const dateRange = this.calculateDateRange(options);
      
      // Get order list
      const orders = await this.fetchOrderList(dateRange, options);
      results.total = orders.length;
      
      // Process orders in batches
      await this.batchProcessor.process(orders, async (batch) => {
        const batchResults = await this.processBatch(batch);
        results.synced += batchResults.synced;
        results.failed += batchResults.failed;
        results.errors.push(...batchResults.errors);
        
        // Emit progress event
        this.emit('sync:progress', {
          processed: results.synced + results.failed,
          total: results.total
        });
      });
      
      // Update last sync time
      this.lastSyncTime = new Date();
      await this.cache.set('last-sync-time', this.lastSyncTime);
      
      const duration = Date.now() - startTime;
      logger.info(`Amazon order sync completed in ${duration}ms`, results);
      
      this.emit('sync:complete', results);
      return results;
    } catch (error) {
      logger.error('Order sync failed', error);
      this.emit('sync:error', error);
      throw error;
    }
  }

  /**
   * Calculate date range for sync
   * @param {Object} options - Sync options
   * @returns {Object} Date range
   */
  calculateDateRange(options) {
    const endDate = new Date();
    let startDate;
    
    if (options.startDate) {
      startDate = new Date(options.startDate);
    } else if (this.lastSyncTime) {
      startDate = new Date(this.lastSyncTime);
      // Add some overlap to catch any missed orders
      startDate.setHours(startDate.getHours() - 1);
    } else {
      startDate = new Date();
      startDate.setHours(startDate.getHours() - this.syncConfig.lookbackHours);
    }
    
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };
  }

  /**
   * Fetch order list from Amazon
   * @param {Object} dateRange - Date range
   * @param {Object} options - Additional options
   * @returns {Promise<Array>} Order list
   */
  async fetchOrderList(dateRange, options = {}) {
    const orders = [];
    let nextToken = null;
    const maxResultsPerPage = 100;
    
    do {
      try {
        const params = {
          createdAfter: dateRange.startDate,
          createdBefore: dateRange.endDate,
          marketplaceIds: this.syncConfig.marketplaceIds,
          maxResultsPerPage,
          nextToken
        };
        
        // Add optional filters
        if (this.syncConfig.orderStatuses) {
          params.orderStatuses = this.syncConfig.orderStatuses;
        }
        if (this.syncConfig.fulfillmentChannels) {
          params.fulfillmentChannels = this.syncConfig.fulfillmentChannels;
        }
        if (this.syncConfig.paymentMethods) {
          params.paymentMethods = this.syncConfig.paymentMethods;
        }
        
        const response = await this.client.getOrders(params);
        
        if (response.orders) {
          orders.push(...response.orders);
        }
        
        nextToken = response.nextToken;
        
        // Add delay to respect rate limits
        if (nextToken) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (error) {
        logger.error('Failed to fetch order page', error);
        if (orders.length === 0) {
          throw error;
        }
        break; // Continue with partial results
      }
    } while (nextToken);
    
    return orders;
  }

  /**
   * Process a batch of orders
   * @param {Array} batch - Order batch
   * @returns {Promise<Object>} Batch results
   */
  async processBatch(batch) {
    const results = {
      synced: 0,
      failed: 0,
      errors: []
    };
    
    for (const orderData of batch) {
      try {
        await this.syncOrder(orderData);
        results.synced++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          orderId: orderData.AmazonOrderId,
          error: error.message
        });
        logger.error(`Failed to sync order ${orderData.AmazonOrderId}`, error);
      }
    }
    
    return results;
  }

  /**
   * Sync individual order
   * @param {Object} orderData - Order data from API
   * @returns {Promise<Object>} Synced order
   */
  async syncOrder(orderData) {
    // Create order model from API data
    const order = AmazonOrder.fromAPI(orderData);
    
    // Get order items
    const orderItems = await this.fetchOrderItems(order.amazonOrderId);
    order.addItemsFromAPI(orderItems);
    
    // Validate order
    const validation = order.validate();
    if (!validation.isValid) {
      throw new Error(`Invalid order data: ${validation.errors.join(', ')}`);
    }
    
    // Convert to common format
    const commonOrder = order.toCommonFormat();
    
    // Cache the order
    await this.cache.set(`order:${order.amazonOrderId}`, commonOrder, 86400); // 24 hours
    
    // Queue for further processing
    await this.queue.add('order-synced', {
      order: commonOrder,
      timestamp: new Date()
    });
    
    // Emit order synced event
    this.emit('order:synced', commonOrder);
    
    return commonOrder;
  }

  /**
   * Fetch order items
   * @param {string} orderId - Order ID
   * @returns {Promise<Array>} Order items
   */
  async fetchOrderItems(orderId) {
    try {
      const response = await this.client.request('GET', `/orders/v0/orders/${orderId}/orderItems`);
      return response.orderItems || [];
    } catch (error) {
      logger.error(`Failed to fetch items for order ${orderId}`, error);
      return [];
    }
  }

  /**
   * Update order shipment status
   * @param {string} orderId - Order ID
   * @param {Object} shipmentData - Shipment data
   * @returns {Promise<Object>} Update result
   */
  async updateShipmentStatus(orderId, shipmentData) {
    try {
      // SP-API shipment confirmation
      const response = await this.client.request('POST', `/orders/v0/orders/${orderId}/shipmentConfirmation`, {
        data: {
          marketplaceId: this.syncConfig.marketplaceIds[0],
          codCollectionMethod: shipmentData.codCollectionMethod,
          shipmentData: shipmentData.items
        }
      });
      
      // Update cache
      const cachedOrder = await this.cache.get(`order:${orderId}`);
      if (cachedOrder) {
        cachedOrder.fulfillmentStatus = 'fulfilled';
        cachedOrder.metadata.shipmentData = shipmentData;
        await this.cache.set(`order:${orderId}`, cachedOrder, 86400);
      }
      
      this.emit('order:shipmentUpdated', { orderId, shipmentData });
      return response;
    } catch (error) {
      logger.error(`Failed to update shipment for order ${orderId}`, error);
      throw error;
    }
  }

  /**
   * Search orders
   * @param {Object} criteria - Search criteria
   * @returns {Promise<Array>} Search results
   */
  async searchOrders(criteria) {
    const cacheKey = `search:${JSON.stringify(criteria)}`;
    
    // Check cache
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    try {
      const response = await this.client.getOrders(criteria);
      const orders = response.orders.map(order => 
        AmazonOrder.fromAPI(order).toCommonFormat()
      );
      
      // Cache results for 5 minutes
      await this.cache.set(cacheKey, orders, 300);
      
      return orders;
    } catch (error) {
      logger.error('Order search failed', error);
      throw error;
    }
  }

  /**
   * Get financial events for orders
   * @param {Object} criteria - Search criteria
   * @returns {Promise<Object>} Financial events
   */
  async getFinancialEvents(criteria) {
    try {
      const events = await this.client.getFinancialEvents(criteria);
      
      // Process and normalize financial events
      const normalizedEvents = {
        shipmentEvents: this.normalizeShipmentEvents(events.shipmentEventList),
        refundEvents: this.normalizeRefundEvents(events.refundEventList),
        guaranteeClaimEvents: events.guaranteeClaimEventList,
        chargebackEvents: events.chargebackEventList,
        taxWithheldEvents: events.taxWithheldEventList
      };
      
      return normalizedEvents;
    } catch (error) {
      logger.error('Failed to fetch financial events', error);
      throw error;
    }
  }

  /**
   * Normalize shipment events
   * @param {Array} events - Shipment events
   * @returns {Array} Normalized events
   */
  normalizeShipmentEvents(events = []) {
    return events.map(event => ({
      orderId: event.amazonOrderId,
      marketplaceId: event.marketplaceId,
      postedDate: event.postedDate,
      itemList: event.shipmentItemList?.map(item => ({
        sku: item.sellerSku,
        quantity: item.quantityShipped,
        charges: item.itemChargeList,
        fees: item.itemFeeList,
        promotions: item.promotionList,
        taxes: item.itemTaxWithheldList
      }))
    }));
  }

  /**
   * Normalize refund events
   * @param {Array} events - Refund events
   * @returns {Array} Normalized events
   */
  normalizeRefundEvents(events = []) {
    return events.map(event => ({
      orderId: event.amazonOrderId,
      marketplaceId: event.marketplaceId,
      postedDate: event.postedDate,
      itemList: event.shipmentItemAdjustmentList?.map(item => ({
        sku: item.sellerSku,
        quantity: item.quantityShipped,
        adjustments: item.itemChargeAdjustmentList,
        feeAdjustments: item.itemFeeAdjustmentList,
        promotionAdjustments: item.promotionAdjustmentList,
        taxAdjustments: item.itemTaxWithheldAdjustmentList
      }))
    }));
  }

  /**
   * Start periodic sync
   */
  startPeriodicSync() {
    this.syncTimer = setInterval(async () => {
      try {
        await this.syncAllOrders();
      } catch (error) {
        logger.error('Periodic sync failed', error);
      }
    }, this.syncConfig.interval);
    
    logger.info(`Started periodic order sync (interval: ${this.syncConfig.interval}ms)`);
  }

  /**
   * Stop periodic sync
   */
  stopPeriodicSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      logger.info('Stopped periodic order sync');
    }
  }

  /**
   * Get sync status
   * @returns {Object} Sync status
   */
  async getSyncStatus() {
    const lastSync = await this.cache.get('last-sync-time');
    const orderCount = await this.cache.count('order:*');
    
    return {
      lastSyncTime: lastSync,
      ordersCached: orderCount,
      isSyncing: this.syncTimer !== null,
      syncInterval: this.syncConfig.interval,
      marketplaceIds: this.syncConfig.marketplaceIds
    };
  }

  /**
   * Get order statistics
   * @param {Object} dateRange - Date range
   * @returns {Promise<Object>} Statistics
   */
  async getOrderStatistics(dateRange) {
    const orders = await this.searchOrders(dateRange);
    
    const stats = {
      totalOrders: orders.length,
      totalRevenue: 0,
      averageOrderValue: 0,
      ordersByStatus: {},
      ordersByFulfillmentChannel: {},
      ordersByPaymentMethod: {},
      primeOrders: 0,
      businessOrders: 0
    };
    
    orders.forEach(order => {
      stats.totalRevenue += order.totalPrice;
      
      // Count by status
      const status = order.status;
      stats.ordersByStatus[status] = (stats.ordersByStatus[status] || 0) + 1;
      
      // Count by fulfillment channel
      const channel = order.fulfillmentChannel;
      stats.ordersByFulfillmentChannel[channel] = 
        (stats.ordersByFulfillmentChannel[channel] || 0) + 1;
      
      // Count by payment method
      const paymentMethod = order.paymentMethod;
      stats.ordersByPaymentMethod[paymentMethod] = 
        (stats.ordersByPaymentMethod[paymentMethod] || 0) + 1;
      
      // Count Prime orders
      if (order.metadata?.isPrime) {
        stats.primeOrders++;
      }
      
      // Count business orders
      if (order.metadata?.isBusinessOrder) {
        stats.businessOrders++;
      }
    });
    
    stats.averageOrderValue = stats.totalOrders > 0 ? 
      stats.totalRevenue / stats.totalOrders : 0;
    
    return stats;
  }

  /**
   * Handle order state change notifications
   * @param {Object} notification - Notification data
   * @returns {Promise<void>}
   */
  async handleOrderNotification(notification) {
    try {
      logger.info('Processing Amazon order notification', notification);
      
      const orderId = notification.payload?.amazonOrderId;
      if (!orderId) {
        throw new Error('Invalid notification: missing order ID');
      }
      
      // Fetch and sync the updated order
      const orderData = await this.client.getOrderDetails(orderId);
      await this.syncOrder(orderData);
      
      this.emit('order:notification', { orderId, notification });
    } catch (error) {
      logger.error('Failed to process order notification', error);
      throw error;
    }
  }
}

module.exports = OrderSyncProcessor;