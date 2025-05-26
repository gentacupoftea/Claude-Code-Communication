/**
 * Shopify API Client
 * 
 * 404エラー対応版
 * - 正しいエンドポイントURL形式
 * - デバッグ用インターセプター
 * - 接続テスト機能
 */

const axios = require('axios');
const shopifyConfig = require('../config/shopify');

class ShopifyClient {
  constructor() {
    try {
      shopifyConfig.validate();
      this.config = shopifyConfig;
      this.setupAxios();
    } catch (error) {
      console.error('❌ Shopify Client initialization failed:', error.message);
      throw error;
    }
  }
  
  setupAxios() {
    this.client = axios.create({
      baseURL: this.config.apiUrl,
      headers: {
        'X-Shopify-Access-Token': this.config.accessToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000
    });
    
    // リクエストインターセプター（デバッグ用）
    this.client.interceptors.request.use(request => {
      console.log('🔄 Shopify API Request:', {
        method: request.method.toUpperCase(),
        url: `${request.baseURL}${request.url}`,
        headers: {
          ...request.headers,
          'X-Shopify-Access-Token': '[REDACTED]'
        }
      });
      return request;
    }, error => {
      console.error('❌ Request Error:', error);
      return Promise.reject(error);
    });
    
    // レスポンスインターセプター
    this.client.interceptors.response.use(
      response => {
        console.log('✅ Shopify API Response:', {
          status: response.status,
          statusText: response.statusText,
          url: response.config.url
        });
        return response;
      },
      error => {
        if (error.response) {
          console.error('❌ Shopify API Error:', {
            status: error.response.status,
            statusText: error.response.statusText,
            url: error.config?.url,
            fullUrl: `${error.config?.baseURL}${error.config?.url}`,
            data: error.response.data,
            headers: error.response.headers
          });
          
          // 404エラーの詳細情報
          if (error.response.status === 404) {
            console.error('🔍 404 Error Details:', {
              requestedUrl: `${error.config?.baseURL}${error.config?.url}`,
              storeDomain: this.config.storeDomain,
              apiVersion: this.config.apiVersion,
              hint: 'Check if SHOPIFY_STORE_DOMAIN is correct (should be just the store name without .myshopify.com)'
            });
          }
        } else if (error.request) {
          console.error('❌ No response received:', error.request);
        } else {
          console.error('❌ Request setup error:', error.message);
        }
        return Promise.reject(error);
      }
    );
  }
  
  // 接続テスト
  async testConnection() {
    try {
      console.log('🔍 Testing Shopify connection...');
      console.log('📍 Store Domain:', this.config.storeDomain);
      console.log('📍 API URL:', this.config.apiUrl);
      console.log('📍 Test URL:', this.config.buildUrl('shop'));
      
      const response = await this.client.get('/shop.json');
      
      return {
        success: true,
        shop: response.data.shop,
        message: 'Shopify connection successful',
        config: {
          storeDomain: this.config.storeDomain,
          apiVersion: this.config.apiVersion,
          apiUrl: this.config.apiUrl
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: error.response?.status,
        details: error.response?.data,
        config: {
          storeDomain: this.config.storeDomain,
          apiVersion: this.config.apiVersion,
          apiUrl: this.config.apiUrl,
          testUrl: this.config.buildUrl('shop')
        }
      };
    }
  }
  
  // 商品一覧取得
  async getProducts(params = {}) {
    try {
      const response = await this.client.get('/products.json', { params });
      return response.data.products;
    } catch (error) {
      console.error('Failed to fetch products:', error.message);
      throw error;
    }
  }
  
  // 注文一覧取得
  async getOrders(params = {}) {
    try {
      const response = await this.client.get('/orders.json', { params });
      return response.data.orders;
    } catch (error) {
      console.error('Failed to fetch orders:', error.message);
      throw error;
    }
  }
  
  // 顧客一覧取得
  async getCustomers(params = {}) {
    try {
      const response = await this.client.get('/customers.json', { params });
      return response.data.customers;
    } catch (error) {
      console.error('Failed to fetch customers:', error.message);
      throw error;
    }
  }
}

module.exports = ShopifyClient;