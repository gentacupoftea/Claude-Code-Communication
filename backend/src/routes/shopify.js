/**
 * Shopify API Routes
 * 
 * 接続テストとデバッグ用エンドポイント
 */

const express = require('express');
const router = express.Router();
const ShopifyClient = require('../services/shopifyClient');

// 接続テストエンドポイント
router.get('/test-connection', async (req, res) => {
  try {
    const client = new ShopifyClient();
    const result = await client.testConnection();
    
    if (result.success) {
      res.json({
        status: 'connected',
        shop: result.shop,
        apiVersion: result.config.apiVersion,
        endpoint: result.config.apiUrl,
        message: 'Shopify API connection successful'
      });
    } else {
      res.status(500).json({
        status: 'error',
        error: result.error,
        statusCode: result.status,
        details: result.details,
        config: result.config,
        troubleshooting: {
          checkStoreDomain: 'Ensure SHOPIFY_STORE_DOMAIN is just the store name without .myshopify.com',
          checkAccessToken: 'Verify SHOPIFY_ACCESS_TOKEN is valid and has necessary scopes',
          checkApiVersion: 'Confirm API version is supported (2024-01 recommended)',
          exampleDomain: 'If your store URL is mystore.myshopify.com, SHOPIFY_STORE_DOMAIN should be "mystore"'
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      config: {
        storeDomain: process.env.SHOPIFY_STORE_DOMAIN || process.env.SHOPIFY_SHOP_NAME || 'Not set',
        accessToken: process.env.SHOPIFY_ACCESS_TOKEN ? 'Set' : 'Not set',
        apiVersion: process.env.SHOPIFY_API_VERSION || 'Default: 2024-01'
      },
      hint: 'Check server logs for detailed error information'
    });
  }
});

// 環境変数確認エンドポイント（デバッグ用）
router.get('/debug/config', async (req, res) => {
  const config = {
    storeDomain: process.env.SHOPIFY_STORE_DOMAIN || process.env.SHOPIFY_SHOP_NAME || 'Not set',
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN ? 'Set (hidden)' : 'Not set',
    apiVersion: process.env.SHOPIFY_API_VERSION || 'Default: 2024-01',
    nodeEnv: process.env.NODE_ENV || 'Not set'
  };
  
  // 設定から生成されるURL
  const storeName = (config.storeDomain !== 'Not set') ? config.storeDomain.replace('.myshopify.com', '') : 'undefined';
  const expectedUrl = `https://${storeName}.myshopify.com/admin/api/${config.apiVersion}/shop.json`;
  
  res.json({
    environment: config,
    expectedApiUrl: expectedUrl,
    tips: [
      'SHOPIFY_STORE_DOMAIN should be just the store name (e.g., "mystore")',
      'Do NOT include .myshopify.com in SHOPIFY_STORE_DOMAIN',
      'SHOPIFY_ACCESS_TOKEN must be a valid Private App token',
      'Use SHOPIFY_API_VERSION=2024-01 for latest stable version'
    ]
  });
});

// 商品一覧取得
router.get('/products', async (req, res) => {
  try {
    const client = new ShopifyClient();
    const products = await client.getProducts(req.query);
    res.json({
      success: true,
      count: products.length,
      products
    });
  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.message,
      status: error.response?.status
    });
  }
});

// 注文一覧取得
router.get('/orders', async (req, res) => {
  try {
    const client = new ShopifyClient();
    const orders = await client.getOrders(req.query);
    res.json({
      success: true,
      count: orders.length,
      orders
    });
  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.message,
      status: error.response?.status
    });
  }
});

// 顧客一覧取得
router.get('/customers', async (req, res) => {
  try {
    const client = new ShopifyClient();
    const customers = await client.getCustomers(req.query);
    res.json({
      success: true,
      count: customers.length,
      customers
    });
  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.message,
      status: error.response?.status
    });
  }
});

module.exports = router;