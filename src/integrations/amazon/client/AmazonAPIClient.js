/**
 * Amazon SP-API Client
 * Selling Partner APIクライアント実装
 */

import axios from 'axios';
import axiosRetry from 'axios-retry';
import AmazonAuth from '../auth/AmazonAuth';
import { logger  } from '../../../utils/logger';
import { performanceMonitor  } from '../../../utils/performance';
import ErrorHandler from '../utils/ErrorHandler';

class AmazonAPIClient {
  constructor(config) {
    this.config = config;
    this.auth = new AmazonAuth(config);
    this.baseURL = config.baseURL || 'https://sellingpartnerapi-fe.amazon.com';
    this.errorHandler = new ErrorHandler();
    
    // API versions
    this.apiVersions = {
      catalog: 'v0',
      orders: 'v0',
      reports: 'v2021-06-30',
      finances: 'v0',
      inventory: 'v1',
      pricing: 'v0',
      listings: 'v2021-08-01'
    };
    
    // Initialize axios instance with retry mechanism
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: config.timeout || 60000, // 60 seconds for large requests
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ShopifyMCPServer/1.0 (Language=Node.js; Platform=Amazon-SP-API)'
      }
    });

    // Configure retry mechanism with SP-API specific logic
    axiosRetry(this.client, {
      retries: config.retries || 3,
      retryDelay: (retryCount, error) => {
        // SP-API specific retry delays
        if (error.response?.status === 429) {
          // Rate limit - check Retry-After header
          const retryAfter = error.response.headers['retry-after'];
          if (retryAfter) {
            return parseInt(retryAfter) * 1000;
          }
        }
        return axiosRetry.exponentialDelay(retryCount);
      },
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
               error.response?.status === 429 || // Rate limit
               error.response?.status === 503; // Service unavailable
      }
    });

    // Add request/response interceptors
    this.setupInterceptors();
  }

  /**
   * Setup axios interceptors for request/response handling
   */
  setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      async (config) => {
        // Generate authentication headers
        const authHeaders = await this.auth.generateAuthHeader({
          method: config.method,
          path: config.url,
          body: config.data
        });
        
        config.headers = { ...config.headers, ...authHeaders };

        // Add marketplace ID
        if (!config.params) {
          config.params = {};
        }
        config.params.marketplaceIds = this.auth.marketplaceId;

        // Add performance monitoring
        config.metadata = { startTime: Date.now() };

        logger.debug(`Amazon SP-API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('Request interceptor error', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        // Performance monitoring
        const duration = Date.now() - response.config.metadata.startTime;
        performanceMonitor.recordAPICall('amazon', response.config.url, duration);

        // Log rate limit headers
        if (response.headers['x-amzn-ratelimit-limit']) {
          logger.info('Rate limit info', {
            limit: response.headers['x-amzn-ratelimit-limit'],
            remaining: response.headers['x-amzn-ratelimit-remaining'],
            reset: response.headers['x-amzn-ratelimit-reset']
          });
        }

        logger.debug(`Amazon SP-API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      async (error) => {
        // Handle errors
        const handledError = await this.errorHandler.handle(error);
        
        // If authentication error, try to refresh credentials
        if (handledError.code === 'AUTHENTICATION_FAILED' || handledError.statusCode === 403) {
          try {
            await this.auth.refreshCredentials();
            return this.client.request(error.config);
          } catch (refreshError) {
            logger.error('Failed to refresh credentials', refreshError);
          }
        }

        return Promise.reject(handledError);
      }
    );
  }

  /**
   * Make authenticated API request
   * @param {string} method - HTTP method
   * @param {string} path - API path
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response data
   */
  async request(method, path, options = {}) {
    try {
      const response = await this.client.request({
        method,
        url: path,
        ...options
      });

      return response.data;
    } catch (error) {
      logger.error(`Amazon SP-API request failed: ${method} ${path}`, error);
      throw error;
    }
  }

  /**
   * Get products from catalog
   * カタログから商品を取得
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Product data
   */
  async getProducts(params = {}) {
    const version = this.apiVersions.catalog;
    return this.request('GET', `/catalog/${version}/items`, { params });
  }

  /**
   * Get orders
   * 注文を取得
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Order data
   */
  async getOrders(params = {}) {
    const version = this.apiVersions.orders;
    return this.request('GET', `/orders/${version}/orders`, { params });
  }

  /**
   * Get order details
   * 注文詳細を取得
   * @param {string} orderId - Order ID
   * @returns {Promise<Object>} Order details
   */
  async getOrderDetails(orderId) {
    const version = this.apiVersions.orders;
    return this.request('GET', `/orders/${version}/orders/${orderId}`);
  }

  /**
   * Create report request
   * レポートリクエストを作成
   * @param {Object} reportData - Report configuration
   * @returns {Promise<Object>} Report request response
   */
  async createReport(reportData) {
    const version = this.apiVersions.reports;
    return this.request('POST', `/reports/${version}/reports`, { data: reportData });
  }

  /**
   * Get report status
   * レポートステータスを取得
   * @param {string} reportId - Report ID
   * @returns {Promise<Object>} Report status
   */
  async getReportStatus(reportId) {
    const version = this.apiVersions.reports;
    return this.request('GET', `/reports/${version}/reports/${reportId}`);
  }

  /**
   * Download report
   * レポートをダウンロード
   * @param {string} reportDocumentId - Report document ID
   * @returns {Promise<Object>} Report data
   */
  async downloadReport(reportDocumentId) {
    const version = this.apiVersions.reports;
    const response = await this.request('GET', `/reports/${version}/documents/${reportDocumentId}`);
    
    // Download the actual report from the URL
    if (response.url) {
      const reportData = await axios.get(response.url);
      return reportData.data;
    }
    
    return response;
  }

  /**
   * Update inventory
   * 在庫を更新
   * @param {Object} inventoryData - Inventory update data
   * @returns {Promise<Object>} Update response
   */
  async updateInventory(inventoryData) {
    const version = this.apiVersions.inventory;
    return this.request('PUT', `/inventory/${version}/items`, { data: inventoryData });
  }

  /**
   * Get pricing information
   * 価格情報を取得
   * @param {string} asin - Product ASIN
   * @returns {Promise<Object>} Pricing data
   */
  async getPricing(asin) {
    const version = this.apiVersions.pricing;
    return this.request('GET', `/pricing/${version}/price`, {
      params: { Asins: asin, ItemType: 'Asin' }
    });
  }

  /**
   * Get financial events
   * 財務イベントを取得
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Financial events
   */
  async getFinancialEvents(params = {}) {
    const version = this.apiVersions.finances;
    return this.request('GET', `/finances/${version}/financialEvents`, { params });
  }

  /**
   * Batch request processor
   * @param {Array} requests - Array of request configurations
   * @returns {Promise<Array>} Array of responses
   */
  async batchRequest(requests) {
    const results = [];
    const batchSize = this.config.batchSize || 10;
    
    // Process requests in batches
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchPromises = batch.map(req => 
        this.request(req.method, req.path, req.options)
          .catch(error => ({ error, request: req }))
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Rate limiting between batches
      if (i + batchSize < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }

  /**
   * Health check endpoint
   * @returns {Promise<boolean>} API health status
   */
  async healthCheck() {
    try {
      // Check authentication
      const authValid = await this.auth.validateAuth();
      if (!authValid) {
        return false;
      }
      
      // Make a simple API call
      await this.getOrders({ maxResultsPerPage: 1 });
      return true;
    } catch (error) {
      logger.error('Health check failed', error);
      return false;
    }
  }

  /**
   * Get rate limit status
   * レート制限ステータスを取得
   * @returns {Object} Rate limit information
   */
  getRateLimitStatus() {
    // This would typically be populated from response headers
    return {
      ordersAPI: {
        limit: 60,
        remaining: 60,
        resetTime: new Date()
      },
      catalogAPI: {
        limit: 20,
        remaining: 20,
        resetTime: new Date()
      },
      reportsAPI: {
        limit: 60,
        remaining: 60,
        resetTime: new Date()
      }
    };
  }
}

module.exports = AmazonAPIClient;