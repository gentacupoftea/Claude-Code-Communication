/**
 * Amazon SP-API Integration Tests
 * 統合テスト
 */

const AmazonAuth = require('../auth/AmazonAuth');
const AmazonAPIClient = require('../client/AmazonAPIClient');
const ProductSyncProcessor = require('../processors/ProductSyncProcessor');
const OrderSyncProcessor = require('../processors/OrderSyncProcessor');
const ReportGenerator = require('../reporting/ReportGenerator');

// Test configuration (環境変数から取得)
const testConfig = {
  refreshToken: process.env.AMAZON_REFRESH_TOKEN,
  clientId: process.env.AMAZON_CLIENT_ID,
  clientSecret: process.env.AMAZON_CLIENT_SECRET,
  roleArn: process.env.AMAZON_ROLE_ARN,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  marketplaceId: process.env.AMAZON_MARKETPLACE_ID || 'A1VC38T7YXB528'
};

describe('Amazon SP-API Integration', () => {
  let client;
  let productProcessor;
  let orderProcessor;
  let reportGenerator;

  beforeAll(() => {
    client = new AmazonAPIClient(testConfig);
    productProcessor = new ProductSyncProcessor(testConfig);
    orderProcessor = new OrderSyncProcessor(testConfig);
    reportGenerator = new ReportGenerator(testConfig);
  });

  describe('Authentication', () => {
    test('should authenticate successfully', async () => {
      const auth = new AmazonAuth(testConfig);
      const isValid = await auth.validateAuth();
      expect(isValid).toBe(true);
    });

    test('should get access token', async () => {
      const auth = new AmazonAuth(testConfig);
      const token = await auth.getAccessToken();
      expect(token).toHaveProperty('access_token');
      expect(token).toHaveProperty('expires_at');
    });

    test('should assume IAM role', async () => {
      const auth = new AmazonAuth(testConfig);
      const credentials = await auth.assumeRole();
      expect(credentials).toHaveProperty('AccessKeyId');
      expect(credentials).toHaveProperty('SecretAccessKey');
      expect(credentials).toHaveProperty('SessionToken');
    });
  });

  describe('API Client', () => {
    test('should perform health check', async () => {
      const isHealthy = await client.healthCheck();
      expect(isHealthy).toBe(true);
    });

    test('should get orders', async () => {
      const orders = await client.getOrders({
        createdAfter: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        maxResultsPerPage: 5
      });
      expect(orders).toHaveProperty('orders');
      expect(Array.isArray(orders.orders)).toBe(true);
    });

    test('should get products', async () => {
      const products = await client.getProducts({
        identifiers: ['B000000000'], // Replace with actual ASIN
        identifierType: 'ASIN'
      });
      expect(products).toHaveProperty('items');
    });
  });

  describe('Product Sync', () => {
    test('should sync products', async () => {
      const result = await productProcessor.syncAllProducts({
        maxProducts: 10
      });
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('synced');
      expect(result).toHaveProperty('failed');
    });

    test('should search products', async () => {
      const products = await productProcessor.searchProducts({
        keywords: 'test',
        pageSize: 5
      });
      expect(Array.isArray(products)).toBe(true);
    });

    test('should get product statistics', async () => {
      const stats = await productProcessor.getProductStatistics();
      expect(stats).toHaveProperty('totalProducts');
      expect(stats).toHaveProperty('byStatus');
    });
  });

  describe('Order Sync', () => {
    test('should sync orders', async () => {
      const result = await orderProcessor.syncAllOrders({
        lookbackHours: 24
      });
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('synced');
      expect(result).toHaveProperty('failed');
    });

    test('should search orders', async () => {
      const orders = await orderProcessor.searchOrders({
        createdAfter: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        maxResultsPerPage: 5
      });
      expect(Array.isArray(orders)).toBe(true);
    });

    test('should get order statistics', async () => {
      const stats = await orderProcessor.getOrderStatistics({
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString()
      });
      expect(stats).toHaveProperty('totalOrders');
      expect(stats).toHaveProperty('totalRevenue');
      expect(stats).toHaveProperty('averageOrderValue');
    });
  });

  describe('Report Generation', () => {
    test('should generate sales report', async () => {
      const report = await reportGenerator.generateIntegratedReport({
        includeSales: true,
        format: 'json',
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date()
      });
      expect(report).toHaveProperty('reportId');
      expect(report).toHaveProperty('data');
    });

    test('should generate PDF report', async () => {
      const report = await reportGenerator.generateIntegratedReport({
        includeSales: true,
        includeInventory: true,
        format: 'pdf',
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date()
      });
      expect(report).toHaveProperty('reportId');
      expect(report.data).toBeInstanceOf(Buffer);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid ASIN', async () => {
      await expect(
        client.getProducts({
          identifiers: ['INVALID_ASIN'],
          identifierType: 'ASIN'
        })
      ).rejects.toThrow();
    });

    test('should handle rate limiting', async () => {
      const requests = [];
      for (let i = 0; i < 100; i++) {
        requests.push(client.getOrders({ maxResultsPerPage: 1 }));
      }
      
      await expect(Promise.all(requests)).rejects.toThrow();
    });
  });

  describe('Multi-channel Integration', () => {
    test('should integrate with Shopify data format', async () => {
      // Sync an order
      const orders = await orderProcessor.searchOrders({
        createdAfter: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        maxResultsPerPage: 1
      });
      
      if (orders.length > 0) {
        const amazonOrder = orders[0];
        
        // Verify common format compatibility
        expect(amazonOrder).toHaveProperty('id');
        expect(amazonOrder).toHaveProperty('orderNumber');
        expect(amazonOrder).toHaveProperty('totalPrice');
        expect(amazonOrder).toHaveProperty('customer');
        expect(amazonOrder).toHaveProperty('items');
        expect(amazonOrder.metadata).toHaveProperty('platform', 'amazon');
      }
    });

    test('should integrate with Rakuten data format', async () => {
      // Sync a product
      const products = await productProcessor.searchProducts({
        keywords: 'test',
        pageSize: 1
      });
      
      if (products.length > 0) {
        const amazonProduct = products[0];
        
        // Verify common format compatibility
        expect(amazonProduct).toHaveProperty('id');
        expect(amazonProduct).toHaveProperty('title');
        expect(amazonProduct).toHaveProperty('price');
        expect(amazonProduct).toHaveProperty('images');
        expect(amazonProduct.metadata).toHaveProperty('platform', 'amazon');
      }
    });
  });
});

// Integration test for complete workflow
describe('Complete Workflow', () => {
  test('should complete full sync and report workflow', async () => {
    const client = new AmazonAPIClient(testConfig);
    const productProcessor = new ProductSyncProcessor(testConfig);
    const orderProcessor = new OrderSyncProcessor(testConfig);
    const reportGenerator = new ReportGenerator(testConfig);
    
    // 1. Sync products
    const productResult = await productProcessor.syncAllProducts({
      maxProducts: 5
    });
    expect(productResult.synced).toBeGreaterThanOrEqual(0);
    
    // 2. Sync orders
    const orderResult = await orderProcessor.syncAllOrders({
      lookbackHours: 48
    });
    expect(orderResult.synced).toBeGreaterThanOrEqual(0);
    
    // 3. Generate report
    const report = await reportGenerator.generateIntegratedReport({
      includeSales: true,
      includeInventory: true,
      includeFinancial: true,
      format: 'json'
    });
    expect(report).toHaveProperty('reportId');
    expect(report).toHaveProperty('data');
    
    // 4. Verify data integration
    const reportData = JSON.parse(report.data.toString());
    expect(reportData).toHaveProperty('summary');
    expect(reportData).toHaveProperty('insights');
    expect(reportData).toHaveProperty('recommendations');
  });
});

// Performance tests
describe('Performance', () => {
  test('should handle large batch operations', async () => {
    const startTime = Date.now();
    
    // Process batch of orders
    const result = await orderProcessor.syncAllOrders({
      lookbackHours: 72,
      batchSize: 50
    });
    
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(60000); // Should complete within 60 seconds
    expect(result.failed).toBeLessThan(result.total * 0.1); // Less than 10% failure rate
  });

  test('should cache frequently accessed data', async () => {
    // First request
    const start1 = Date.now();
    const orders1 = await orderProcessor.searchOrders({
      createdAfter: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    });
    const duration1 = Date.now() - start1;
    
    // Second request (should be cached)
    const start2 = Date.now();
    const orders2 = await orderProcessor.searchOrders({
      createdAfter: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    });
    const duration2 = Date.now() - start2;
    
    expect(duration2).toBeLessThan(duration1 * 0.5); // Cached request should be at least 50% faster
    expect(orders1).toEqual(orders2);
  });
});

// 使用例
async function runIntegrationExample() {
  try {
    const config = {
      refreshToken: process.env.AMAZON_REFRESH_TOKEN,
      clientId: process.env.AMAZON_CLIENT_ID,
      clientSecret: process.env.AMAZON_CLIENT_SECRET,
      roleArn: process.env.AMAZON_ROLE_ARN,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      marketplaceId: 'A1VC38T7YXB528' // Japan
    };
    
    // Initialize processors
    const productProcessor = new ProductSyncProcessor(config);
    const orderProcessor = new OrderSyncProcessor(config);
    const reportGenerator = new ReportGenerator(config);
    
    // Start periodic sync
    productProcessor.startPeriodicSync();
    orderProcessor.startPeriodicSync();
    
    // Generate daily report
    const report = await reportGenerator.generateIntegratedReport({
      includeSales: true,
      includeInventory: true,
      includeFinancial: true,
      includePerformance: true,
      format: 'pdf'
    });
    
    console.log(`Report generated: ${report.reportId}`);
    
    // Save report to file
    const fs = require('fs').promises;
    await fs.writeFile(`amazon_report_${report.reportId}.pdf`, report.data);
    
  } catch (error) {
    console.error('Integration failed:', error);
  }
}

// Export for use
module.exports = {
  testConfig,
  runIntegrationExample
};