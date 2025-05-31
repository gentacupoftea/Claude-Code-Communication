/**
 * Rakuten API Client
 * 楽天RMS APIクライアント実装
 */

const axios = require('axios');
const axiosRetry = require('axios-retry');
const RakutenAuth = require('../auth/RakutenAuth');
const { logger } = require('../../../utils/logger');
const { performanceMonitor } = require('../../../utils/performance');
const ErrorHandler = require('../utils/ErrorHandler');

class RakutenAPIClient {
  constructor(config) {
    this.config = config;
    this.auth = new RakutenAuth(config);
    this.baseURL = config.baseURL || 'https://api.rms.rakuten.co.jp';
    this.errorHandler = new ErrorHandler();
    
    // Initialize axios instance with retry mechanism
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: config.timeout || 30000,
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'ja-JP'
      }
    });

    // Configure retry mechanism
    axiosRetry(this.client, {
      retries: config.retries || 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
               error.response?.status === 429; // Rate limit
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
        // Add authentication headers
        const authHeaders = this.auth.generateAuthHeader();
        config.headers = { ...config.headers, ...authHeaders };

        // Add performance monitoring
        config.metadata = { startTime: Date.now() };

        logger.debug(`Rakuten API Request: ${config.method?.toUpperCase()} ${config.url}`);
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
        performanceMonitor.recordAPICall('rakuten', response.config.url, duration);

        logger.debug(`Rakuten API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      async (error) => {
        // Handle errors
        const handledError = await this.errorHandler.handle(error);
        
        // If error handler suggests retry
        if (handledError.shouldRetry) {
          return this.client.request(error.config);
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
      // Ensure authentication is valid
      const isAuthValid = await this.auth.validateAuth();
      if (!isAuthValid) {
        await this.refreshAuthentication();
      }

      const response = await this.client.request({
        method,
        url: path,
        ...options
      });

      return response.data;
    } catch (error) {
      logger.error(`Rakuten API request failed: ${method} ${path}`, error);
      throw error;
    }
  }

  /**
   * Refresh authentication if needed
   */
  async refreshAuthentication() {
    try {
      // Try to get a new token
      const token = await this.auth.refreshAccessToken();
      if (!token) {
        throw new Error('Failed to refresh authentication');
      }
    } catch (error) {
      logger.error('Authentication refresh failed', error);
      throw new Error('Authentication required');
    }
  }

  /**
   * GET request
   * @param {string} path - API path
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Response data
   */
  async get(path, params = {}) {
    return this.request('GET', path, { params });
  }

  /**
   * POST request
   * @param {string} path - API path
   * @param {Object} data - Request body
   * @returns {Promise<Object>} Response data
   */
  async post(path, data = {}) {
    return this.request('POST', path, { data });
  }

  /**
   * PUT request
   * @param {string} path - API path
   * @param {Object} data - Request body
   * @returns {Promise<Object>} Response data
   */
  async put(path, data = {}) {
    return this.request('PUT', path, { data });
  }

  /**
   * DELETE request
   * @param {string} path - API path
   * @returns {Promise<Object>} Response data
   */
  async delete(path) {
    return this.request('DELETE', path);
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
      const response = await this.get('/es/2.0/health');
      return response.status === 'ok';
    } catch (error) {
      logger.error('Health check failed', error);
      return false;
    }
  }
}

module.exports = RakutenAPIClient;
