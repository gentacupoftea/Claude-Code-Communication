/**
 * Rakuten Order Sync Processor
 * 楽天注文同期処理
 */

import RakutenAPIClient from '../client/RakutenAPIClient';
import RakutenOrder from '../models/Order';
import { logger  } from '../../../utils/logger';
import { cache  } from '../../../utils/cache';
import { queue  } from '../../../utils/queue';
import BatchProcessor from '../../../utils/BatchProcessor';
import EventEmitter from 'events';

class OrderSyncProcessor extends EventEmitter {
  constructor(config) {
    super();
    this.client = new RakutenAPIClient(config);
    this.cache = cache.namespace('rakuten-orders');
    this.queue = queue.create('rakuten-order-sync');
    this.batchProcessor = new BatchProcessor({
      batchSize: config.batchSize || 20,
      concurrency: config.concurrency || 2
    });
    this.syncConfig = {
      interval: config.syncInterval || 300000, // 5 minutes default
      lookbackDays: config.lookbackDays || 7,
      orderStatuses: config.orderStatuses || ['100', '200', '300', '400', '500']
    };
    this.lastSyncTime = null;
    this.syncTimer = null;
    this.webhookEndpoint = config.webhookEndpoint;
  }

  /**
   * Sync all orders from Rakuten
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
      logger.info('Starting Rakuten order sync');
      this.emit('sync:start', { timestamp: new Date() });
      
      // Calculate date range
      const dateRange = this.calculateDateRange(options);
      
      // Get order list
      const orders = await this.fetchOrderList(dateRange);
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
      logger.info(`Rakuten order sync completed in ${duration}ms`, results);
      
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
      startDate.setHours(startDate.getHours() - 1); // 1 hour overlap
    } else {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - this.syncConfig.lookbackDays);
    }
    
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };
  }

  /**
   * Fetch order list from Rakuten
   * @param {Object} dateRange - Date range
   * @returns {Promise<Array>} Order list
   */
  async fetchOrderList(dateRange) {
    const orders = [];
    let page = 1;
    const pageSize = 100;
    
    while (true) {
      try {
        const response = await this.client.get('/es/2.0/order/search', {
          page,
          pageSize,
          orderDatetimeStart: dateRange.startDate,
          orderDatetimeEnd: dateRange.endDate,
          orderStatusList: this.syncConfig.orderStatuses.join(',')
        });
        
        if (!response.orders || response.orders.length === 0) {
          break;
        }
        
        orders.push(...response.orders);
        
        if (response.orders.length < pageSize) {
          break;
        }
        
        page++;
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        logger.error(`Failed to fetch order page ${page}`, error);
        if (page === 1) {
          throw error;
        }
        break;
      }
    }
    
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
          orderNumber: orderData.orderNumber,
          error: error.message
        });
        logger.error(`Failed to sync order ${orderData.orderNumber}`, error);
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
    // Get detailed order info
    const detailedOrder = await this.fetchOrderDetails(orderData.orderNumber);
    
    // Create order model
    const order = RakutenOrder.fromAPI(detailedOrder);
    
    // Validate order
    const validation = order.validate();
    if (!validation.isValid) {
      throw new Error(`Invalid order data: ${validation.errors.join(', ')}`);
    }
    
    // Convert to common format
    const commonOrder = order.toCommonFormat();
    
    // Cache the order
    await this.cache.set(`order:${order.orderNumber}`, commonOrder, 86400); // 24 hours
    
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
   * Fetch detailed order information
   * @param {string} orderNumber - Order number
   * @returns {Promise<Object>} Order details
   */
  async fetchOrderDetails(orderNumber) {
    try {
      const response = await this.client.get('/es/2.0/order/get', {
        orderNumber
      });
      
      return response.order;
    } catch (error) {
      logger.error(`Failed to fetch order details for ${orderNumber}`, error);
      throw error;
    }
  }

  /**
   * Update order status
   * @param {string} orderNumber - Order number
   * @param {string} status - New status
   * @param {string} message - Status message
   * @returns {Promise<Object>} Update result
   */
  async updateOrderStatus(orderNumber, status, message = '') {
    try {
      const response = await this.client.put('/es/2.0/order/status/update', {
        orderNumber,
        orderStatus: status,
        message
      });
      
      // Update cache
      const cachedOrder = await this.cache.get(`order:${orderNumber}`);
      if (cachedOrder) {
        cachedOrder.status = status;
        await this.cache.set(`order:${orderNumber}`, cachedOrder, 86400);
      }
      
      this.emit('order:statusUpdated', { orderNumber, status });
      return response;
    } catch (error) {
      logger.error(`Failed to update order status for ${orderNumber}`, error);
      throw error;
    }
  }

  /**
   * Process webhook notification
   * @param {Object} webhook - Webhook data
   * @returns {Promise<void>}
   */
  async processWebhook(webhook) {
    try {
      logger.info('Processing Rakuten webhook', webhook);
      
      switch (webhook.eventType) {
        case 'order.created':
        case 'order.updated':
          await this.syncOrder(webhook.order);
          break;
          
        case 'order.cancelled':
          await this.handleOrderCancellation(webhook.order);
          break;
          
        default:
          logger.warn(`Unknown webhook event type: ${webhook.eventType}`);
      }
    } catch (error) {
      logger.error('Failed to process webhook', error);
      throw error;
    }
  }

  /**
   * Handle order cancellation
   * @param {Object} orderData - Order data
   * @returns {Promise<void>}
   */
  async handleOrderCancellation(orderData) {
    const order = RakutenOrder.fromAPI(orderData);
    const commonOrder = order.toCommonFormat();
    
    // Update cache
    await this.cache.set(`order:${order.orderNumber}`, commonOrder, 86400);
    
    // Queue cancellation event
    await this.queue.add('order-cancelled', {
      order: commonOrder,
      timestamp: new Date()
    });
    
    this.emit('order:cancelled', commonOrder);
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
      const response = await this.client.get('/es/2.0/order/search', criteria);
      const orders = response.orders.map(order => RakutenOrder.fromAPI(order).toCommonFormat());
      
      // Cache results for 5 minutes
      await this.cache.set(cacheKey, orders, 300);
      
      return orders;
    } catch (error) {
      logger.error('Order search failed', error);
      throw error;
    }
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
      syncInterval: this.syncConfig.interval
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
      ordersByPaymentMethod: {}
    };
    
    orders.forEach(order => {
      stats.totalRevenue += order.totalPrice;
      
      // Count by status
      const status = order.status;
      stats.ordersByStatus[status] = (stats.ordersByStatus[status] || 0) + 1;
      
      // Count by payment method
      const paymentMethod = order.paymentMethod;
      stats.ordersByPaymentMethod[paymentMethod] = (stats.ordersByPaymentMethod[paymentMethod] || 0) + 1;
    });
    
    stats.averageOrderValue = stats.totalOrders > 0 ? stats.totalRevenue / stats.totalOrders : 0;
    
    return stats;
  }
}

module.exports = OrderSyncProcessor;
