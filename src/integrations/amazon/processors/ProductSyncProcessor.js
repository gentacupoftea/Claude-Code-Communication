/**
 * Amazon Product Sync Processor
 * アマゾン商品同期処理
 */

import AmazonAPIClient from '../client/AmazonAPIClient';
import AmazonProduct from '../models/AmazonProduct';
import { logger  } from '../../../utils/logger';
import { cache  } from '../../../utils/cache';
import { queue  } from '../../../utils/queue';
import BatchProcessor from '../../../utils/BatchProcessor';
import EventEmitter from 'events';

class ProductSyncProcessor extends EventEmitter {
  constructor(config) {
    super();
    this.client = new AmazonAPIClient(config);
    this.cache = cache.namespace('amazon-products');
    this.queue = queue.create('amazon-product-sync');
    this.batchProcessor = new BatchProcessor({
      batchSize: config.batchSize || 20, // Amazon API limits
      concurrency: config.concurrency || 2
    });
    this.syncConfig = {
      interval: config.syncInterval || 3600000, // 1 hour default
      includeRelationships: config.includeRelationships || true,
      includeSalesRank: config.includeSalesRank || true,
      marketplaceIds: config.marketplaceIds || ['A1VC38T7YXB528'] // Japan by default
    };
    this.lastSyncTime = null;
    this.syncTimer = null;
  }

  /**
   * Sync all products from Amazon
   * @param {Object} options - Sync options
   * @returns {Promise<Object>} Sync result
   */
  async syncAllProducts(_options = {}) {
    const startTime = Date.now();
    const results = {
      total: 0,
      synced: 0,
      failed: 0,
      errors: []
    };

    try {
      logger.info('Starting Amazon product sync');
      this.emit('sync:start', { timestamp: new Date() });
      
      // Get product catalog report
      const reportId = await this.requestCatalogReport();
      
      // Wait for report to be ready
      const reportData = await this.waitForReport(reportId);
      
      // Parse products from report
      const products = this.parseReportData(reportData);
      results.total = products.length;
      
      // Process products in batches
      await this.batchProcessor.process(products, async (batch) => {
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
      logger.info(`Amazon product sync completed in ${duration}ms`, results);
      
      this.emit('sync:complete', results);
      return results;
    } catch (error) {
      logger.error('Product sync failed', error);
      this.emit('sync:error', error);
      throw error;
    }
  }

  /**
   * Request catalog report from Amazon
   * カタログレポートをリクエスト
   * @returns {Promise<string>} Report ID
   */
  async requestCatalogReport() {
    try {
      const reportData = {
        reportType: 'GET_MERCHANT_LISTINGS_ALL_DATA',
        marketplaceIds: this.syncConfig.marketplaceIds,
        dataStartTime: this.lastSyncTime || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        dataEndTime: new Date()
      };
      
      const response = await this.client.createReport(reportData);
      logger.info(`Catalog report requested: ${response.reportId}`);
      
      return response.reportId;
    } catch (error) {
      logger.error('Failed to request catalog report', error);
      throw error;
    }
  }

  /**
   * Wait for report to be ready
   * レポートの準備完了を待つ
   * @param {string} reportId - Report ID
   * @returns {Promise<Object>} Report data
   */
  async waitForReport(reportId, maxWaitTime = 600000) { // 10 minutes max
    const startTime = Date.now();
    const checkInterval = 30000; // Check every 30 seconds
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const status = await this.client.getReportStatus(reportId);
        
        if (status.processingStatus === 'DONE') {
          // Download report
          return await this.client.downloadReport(status.reportDocumentId);
        }
        
        if (status.processingStatus === 'FATAL' || status.processingStatus === 'CANCELLED') {
          throw new Error(`Report processing failed: ${status.processingStatus}`);
        }
        
        logger.info(`Report ${reportId} status: ${status.processingStatus}`);
        
        // Wait before next check
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      } catch (error) {
        logger.error(`Error checking report status for ${reportId}`, error);
        throw error;
      }
    }
    
    throw new Error(`Report ${reportId} timed out after ${maxWaitTime}ms`);
  }

  /**
   * Parse report data
   * レポートデータを解析
   * @param {Object} reportData - Report data
   * @returns {Array} Parsed products
   */
  parseReportData(reportData) {
    // Amazon reports are typically TSV format
    const lines = reportData.split('\n');
    const headers = lines[0].split('\t');
    const products = [];
    
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim()) {
        const values = lines[i].split('\t');
        const product = {};
        
        headers.forEach((header, index) => {
          product[header] = values[index];
        });
        
        products.push(product);
      }
    }
    
    return products;
  }

  /**
   * Process a batch of products
   * @param {Array} batch - Product batch
   * @returns {Promise<Object>} Batch results
   */
  async processBatch(batch) {
    const results = {
      synced: 0,
      failed: 0,
      errors: []
    };
    
    for (const productData of batch) {
      try {
        await this.syncProduct(productData);
        results.synced++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          asin: productData.asin || productData['ASIN'] || 'unknown',
          error: error.message
        });
        logger.error(`Failed to sync product`, error);
      }
    }
    
    return results;
  }

  /**
   * Sync individual product
   * @param {Object} productData - Product data from report
   * @returns {Promise<Object>} Synced product
   */
  async syncProduct(productData) {
    const asin = productData.asin || productData['ASIN'];
    
    // Get detailed product info
    const detailedInfo = await this.fetchProductDetails(asin);
    
    // Create product model
    const product = AmazonProduct.fromAPI(detailedInfo);
    
    // Validate product
    const validation = product.validate();
    if (!validation.isValid) {
      throw new Error(`Invalid product data: ${validation.errors.join(', ')}`);
    }
    
    // Convert to common format
    const commonProduct = product.toCommonFormat();
    
    // Cache the product
    await this.cache.set(`product:${product.asin}`, commonProduct, 3600);
    
    // Queue for further processing
    await this.queue.add('product-synced', {
      product: commonProduct,
      timestamp: new Date()
    });
    
    // Emit product synced event
    this.emit('product:synced', commonProduct);
    
    return commonProduct;
  }

  /**
   * Fetch detailed product information
   * @param {string} asin - Product ASIN
   * @returns {Promise<Object>} Product details
   */
  async fetchProductDetails(asin) {
    try {
      const response = await this.client.getProducts({
        identifiers: [asin],
        identifierType: 'ASIN',
        includedData: [
          'attributes',
          'images',
          'productTypes',
          'salesRanks',
          'summaries',
          'variations',
          'vendorDetails'
        ]
      });
      
      if (!response.items || response.items.length === 0) {
        throw new Error(`Product not found: ${asin}`);
      }
      
      return response.items[0];
    } catch (error) {
      logger.error(`Failed to fetch product details for ${asin}`, error);
      throw error;
    }
  }

  /**
   * Search products with specific criteria
   * @param {Object} criteria - Search criteria
   * @returns {Promise<Array>} Search results
   */
  async searchProducts(criteria) {
    const cacheKey = `search:${JSON.stringify(criteria)}`;
    
    // Check cache
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    try {
      const response = await this.client.getProducts({
        ...criteria,
        pageSize: criteria.pageSize || 20,
        pageToken: criteria.pageToken
      });
      
      const products = response.items.map(item => 
        AmazonProduct.fromAPI(item).toCommonFormat()
      );
      
      // Cache results for 5 minutes
      await this.cache.set(cacheKey, products, 300);
      
      return products;
    } catch (error) {
      logger.error('Product search failed', error);
      throw error;
    }
  }

  /**
   * Update product inventory
   * @param {string} sku - Product SKU
   * @param {number} quantity - New quantity
   * @returns {Promise<Object>} Update result
   */
  async updateInventory(sku, quantity) {
    try {
      const inventoryData = {
        sellerId: this.client.config.sellerId,
        skus: [{
          sku: sku,
          quantity: quantity,
          fulfillmentChannel: 'DEFAULT'
        }]
      };
      
      const response = await this.client.updateInventory(inventoryData);
      
      // Update cache
      const cachedProduct = await this.cache.get(`product:${sku}`);
      if (cachedProduct) {
        cachedProduct.inventory.quantity = quantity;
        await this.cache.set(`product:${sku}`, cachedProduct, 3600);
      }
      
      this.emit('inventory:updated', { sku, quantity });
      return response;
    } catch (error) {
      logger.error(`Failed to update inventory for ${sku}`, error);
      throw error;
    }
  }

  /**
   * Update product pricing
   * @param {string} sku - Product SKU
   * @param {Object} pricing - Pricing data
   * @returns {Promise<Object>} Update result
   */
  async updatePricing(sku, pricing) {
    try {
      // Amazon pricing update logic would go here
      logger.info(`Updating pricing for SKU: ${sku}`, pricing);
      
      // This is a placeholder - actual implementation would use Amazon Pricing API
      const response = {
        sku,
        pricing,
        status: 'updated'
      };
      
      this.emit('pricing:updated', { sku, pricing });
      return response;
    } catch (error) {
      logger.error(`Failed to update pricing for ${sku}`, error);
      throw error;
    }
  }

  /**
   * Start periodic sync
   */
  startPeriodicSync() {
    this.syncTimer = setInterval(async () => {
      try {
        await this.syncAllProducts();
      } catch (error) {
        logger.error('Periodic sync failed', error);
      }
    }, this.syncConfig.interval);
    
    logger.info(`Started periodic product sync (interval: ${this.syncConfig.interval}ms)`);
  }

  /**
   * Stop periodic sync
   */
  stopPeriodicSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      logger.info('Stopped periodic product sync');
    }
  }

  /**
   * Get sync status
   * @returns {Object} Sync status
   */
  async getSyncStatus() {
    const lastSync = await this.cache.get('last-sync-time');
    const productCount = await this.cache.count('product:*');
    
    return {
      lastSyncTime: lastSync,
      productsCached: productCount,
      isSyncing: this.syncTimer !== null,
      syncInterval: this.syncConfig.interval,
      marketplaceIds: this.syncConfig.marketplaceIds
    };
  }

  /**
   * Get product statistics
   * @returns {Promise<Object>} Statistics
   */
  async getProductStatistics() {
    const allProducts = await this.cache.getPattern('product:*');
    
    const stats = {
      totalProducts: allProducts.length,
      byFulfillmentChannel: {},
      byStatus: {},
      byCategory: {},
      priceRanges: {
        '0-1000': 0,
        '1000-5000': 0,
        '5000-10000': 0,
        '10000+': 0
      }
    };
    
    allProducts.forEach(product => {
      // Count by fulfillment channel
      const channel = product.metadata?.fulfillment?.channel || 'DEFAULT';
      stats.byFulfillmentChannel[channel] = (stats.byFulfillmentChannel[channel] || 0) + 1;
      
      // Count by status
      const status = product.status || 'unknown';
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
      
      // Count by category
      if (product.categories?.length > 0) {
        const category = product.categories[0].name;
        stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
      }
      
      // Price ranges
      const price = product.price?.amount || 0;
      if (price < 1000) stats.priceRanges['0-1000']++;
      else if (price < 5000) stats.priceRanges['1000-5000']++;
      else if (price < 10000) stats.priceRanges['5000-10000']++;
      else stats.priceRanges['10000+']++;
    });
    
    return stats;
  }
}

module.exports = ProductSyncProcessor;