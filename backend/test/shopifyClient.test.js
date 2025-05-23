/**
 * Shopify Client Unit Tests
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const ShopifyClient = require('../src/services/shopifyClient');

describe('ShopifyClient', () => {
  const originalEnv = process.env;
  
  beforeEach(() => {
    // Reset environment variables
    process.env = { ...originalEnv };
  });
  
  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });
  
  describe('Configuration Validation', () => {
    it('should throw error when SHOPIFY_STORE_DOMAIN is missing', () => {
      delete process.env.SHOPIFY_STORE_DOMAIN;
      delete process.env.SHOPIFY_SHOP_NAME;
      process.env.SHOPIFY_ACCESS_TOKEN = 'test-token';
      
      expect(() => new ShopifyClient()).toThrow('SHOPIFY_STORE_DOMAIN or SHOPIFY_SHOP_NAME is required');
    });
    
    it('should throw error when SHOPIFY_ACCESS_TOKEN is missing', () => {
      process.env.SHOPIFY_STORE_DOMAIN = 'test-store';
      delete process.env.SHOPIFY_ACCESS_TOKEN;
      
      expect(() => new ShopifyClient()).toThrow('SHOPIFY_ACCESS_TOKEN is required');
    });
    
    it('should accept SHOPIFY_SHOP_NAME as fallback', () => {
      delete process.env.SHOPIFY_STORE_DOMAIN;
      process.env.SHOPIFY_SHOP_NAME = 'test-store';
      process.env.SHOPIFY_ACCESS_TOKEN = 'test-token';
      
      const client = new ShopifyClient();
      expect(client.config.storeDomain).toBe('test-store');
    });
    
    it('should remove .myshopify.com from domain if present', () => {
      process.env.SHOPIFY_STORE_DOMAIN = 'test-store.myshopify.com';
      process.env.SHOPIFY_ACCESS_TOKEN = 'test-token';
      
      const client = new ShopifyClient();
      expect(client.config.apiUrl).toBe('https://test-store.myshopify.com/admin/api/2024-01');
    });
    
    it('should use custom API version when provided', () => {
      process.env.SHOPIFY_STORE_DOMAIN = 'test-store';
      process.env.SHOPIFY_ACCESS_TOKEN = 'test-token';
      process.env.SHOPIFY_API_VERSION = '2025-01';
      
      const client = new ShopifyClient();
      expect(client.config.apiVersion).toBe('2025-01');
      expect(client.config.apiUrl).toContain('2025-01');
    });
  });
  
  describe('URL Building', () => {
    let client;
    
    beforeEach(() => {
      process.env.SHOPIFY_STORE_DOMAIN = 'test-store';
      process.env.SHOPIFY_ACCESS_TOKEN = 'test-token';
      client = new ShopifyClient();
    });
    
    it('should build correct URL for endpoints', () => {
      const url = client.config.buildUrl('products');
      expect(url).toBe('https://test-store.myshopify.com/admin/api/2024-01/products.json');
    });
    
    it('should handle endpoints with leading slash', () => {
      const url = client.config.buildUrl('/products');
      expect(url).toBe('https://test-store.myshopify.com/admin/api/2024-01/products.json');
    });
    
    it('should not double .json extension', () => {
      const url = client.config.buildUrl('products.json');
      expect(url).toBe('https://test-store.myshopify.com/admin/api/2024-01/products.json');
    });
  });
});