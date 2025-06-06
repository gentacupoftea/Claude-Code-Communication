/**
 * Rakuten Product Sync Processor
 * 楽天商品同期処理
 */

import RakutenAPIClient from '../client/RakutenAPIClient';
import RakutenProduct from '../models/Product';
import { logger  } from '../../../utils/logger';
import { cache  } from '../../../utils/cache';
import { queue  } from '../../../utils/queue';
import BatchProcessor from '../../../utils/BatchProcessor';

class ProductSyncProcessor {
  constructor(config) {
    this.client = new RakutenAPIClient(config);
    this.cache = cache.namespace('rakuten-products');
    this.queue = queue.create('rakuten-product-sync');
    this.batchProcessor = new BatchProcessor({
      batchSize: config.batchSize || 50,
      concurrency: config.concurrency || 3
    });
    this.syncInterval = config.syncInterval || 3600000; // 1 hour default
    this.lastSyncTime = null;
  }

  /**
   * Sync all products from Rakuten
   * @param {Object} options - Sync options
   * @returns {Promise<Object>} Sync result
   */
  async syncAllProducts(options = {}) {
    const startTime = Date.now();
    const results = {
      total: 0,
      synced: 0,
      failed: 0,
      errors: []
    };

    try {
      logger.info('Starting Rakuten product sync');
      
      // Get product list
      const products = await this.fetchProductList(options);
      results.total = products.length;
      
      // Process products in batches
      await this.batchProcessor.process(products, async (batch) => {
        const batchResults = await this.processBatch(batch);
        results.synced += batchResults.synced;
        results.failed += batchResults.failed;
        results.errors.push(...batchResults.errors);
      });
      
      // Update last sync time
      this.lastSyncTime = new Date();
      await this.cache.set('last-sync-time', this.lastSyncTime);
      
      const duration = Date.now() - startTime;
      logger.info(`Rakuten product sync completed in ${duration}ms`, results);
      
      return results;
    } catch (error) {
      logger.error('Product sync failed', error);
      throw error;
    }
  }

  /**
   * Fetch product list from Rakuten
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Product list
   */
  async fetchProductList(options = {}) {
    const products = [];
    let page = 1;
    const pageSize = options.pageSize || 100;
    
    while (true) {
      try {
        const response = await this.client.get('/es/2.0/item/search', {
          page,
          pageSize,
          ...options.filters
        });
        
        if (!response.items || response.items.length === 0) {
          break;
        }
        
        products.push(...response.items);
        
        if (response.items.length < pageSize) {
          break;
        }
        
        page++;
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        logger.error(`Failed to fetch product page ${page}`, error);
        if (page === 1) {
          throw error;
        }
        break;
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
          itemNumber: productData.itemNumber,
          error: error.message
        });
        logger.error(`Failed to sync product ${productData.itemNumber}`, error);
      }
    }
    
    return results;
  }

  /**
   * Sync individual product
   * @param {Object} productData - Product data from API
   * @returns {Promise<Object>} Synced product
   */
  async syncProduct(productData) {
    // Create product model
    const product = RakutenProduct.fromAPI(productData);
    
    // Validate product
    const validation = product.validate();
    if (!validation.isValid) {
      throw new Error(`Invalid product data: ${validation.errors.join(', ')}`);
    }
    
    // Get detailed product info if needed
    if (!product.images || product.images.length === 0) {
      const detailedInfo = await this.fetchProductDetails(product.itemNumber);
      Object.assign(product, detailedInfo);
    }
    
    // Convert to common format
    const commonProduct = product.toCommonFormat();
    
    // Cache the product
    await this.cache.set(`product:${product.itemNumber}`, commonProduct, 3600);
    
    // Queue for further processing
    await this.queue.add('product-synced', {
      product: commonProduct,
      timestamp: new Date()
    });
    
    return commonProduct;
  }

  /**
   * Fetch detailed product information
   * @param {string} itemNumber - Product item number
   * @returns {Promise<Object>} Product details
   */
  async fetchProductDetails(itemNumber) {
    try {
      const response = await this.client.get(`/es/2.0/item/get`, {
        itemNumber
      });
      
      return response.item;
    } catch (error) {
      logger.error(`Failed to fetch product details for ${itemNumber}`, error);
      return {};
    }
  }

  /**
   * Update product inventory
   * @param {string} itemNumber - Product item number
   * @param {number} quantity - New quantity
   * @returns {Promise<Object>} Update result
   */
  async updateInventory(itemNumber, quantity) {
    try {
      const response = await this.client.put('/es/2.0/item/inventory/update', {
        itemNumber,
        inventory: {
          quantity,
          inventoryType: 'normal'
        }
      });
      
      // Update cache
      const cachedProduct = await this.cache.get(`product:${itemNumber}`);
      if (cachedProduct) {
        cachedProduct.inventory = { quantity };
        await this.cache.set(`product:${itemNumber}`, cachedProduct, 3600);
      }
      
      return response;
    } catch (error) {
      logger.error(`Failed to update inventory for ${itemNumber}`, error);
      throw error;
    }
  }

  /**
   * Search products
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
      const response = await this.client.get('/es/2.0/item/search', criteria);
      const products = response.items.map(item => RakutenProduct.fromAPI(item).toCommonFormat());
      
      // Cache results for 5 minutes
      await this.cache.set(cacheKey, products, 300);
      
      return products;
    } catch (error) {
      logger.error('Product search failed', error);
      throw error;
    }
  }

  /**
   * Start periodic sync
   */
  startPeriodicSync() {
    this.syncInterval = setInterval(async () => {
      try {
        await this.syncAllProducts();
      } catch (error) {
        logger.error('Periodic sync failed', error);
      }
    }, this.syncInterval);
    
    logger.info(`Started periodic product sync (interval: ${this.syncInterval}ms)`);
  }

  /**
   * Stop periodic sync
   */
  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
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
      isSyncing: this.syncInterval !== null
    };
  }
}

module.exports = ProductSyncProcessor;
