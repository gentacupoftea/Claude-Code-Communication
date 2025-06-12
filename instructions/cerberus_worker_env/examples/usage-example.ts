import { apiManager } from '../src';
import type { ShopifyFetchParams } from '../src';

/**
 * APIアダプターパターンの使用例
 */
async function exampleUsage() {
  try {
    // 1. APIマネージャーの初期化
    await apiManager.initialize({
      shopify: {
        shopDomain: 'your-shop.myshopify.com',
        accessToken: 'your-access-token',
        apiVersion: '2023-10',
        timeout: 10000
      },
      pos: {
        endpoint: 'https://pos-api.example.com',
        apiKey: 'your-api-key',
        secretKey: 'your-secret-key',
        timeout: 5000
      },
      analytics: {
        endpoint: 'https://analytics-api.example.com',
        apiKey: 'your-api-key',
        projectId: 'your-project-id',
        timeout: 8000
      },
      weather: {
        endpoint: 'https://api.openweathermap.org/data/2.5',
        apiKey: 'your-api-key',
        defaultLocation: {
          lat: 35.6762,
          lon: 139.6503
        },
        timeout: 3000
      }
    });

    console.log('API Manager initialized successfully');

    // 2. Shopifyから商品データを取得
    const shopifyParams: ShopifyFetchParams = {
      resource: 'products',
      query: {
        limit: '10',
        status: 'active'
      }
    };

    const shopifyResponse = await apiManager.fetchShopifyData(shopifyParams);
    if (shopifyResponse.success) {
      console.log('Shopify products:', shopifyResponse.data);
    } else {
      console.error('Shopify error:', shopifyResponse.error);
    }

    // 3. POSから取引データを取得
    const posResponse = await apiManager.fetchPosData({
      type: 'transactions',
      filters: {
        date_from: '2024-01-01',
        date_to: '2024-01-31'
      }
    });

    if (posResponse.success) {
      console.log('POS transactions:', posResponse.data);
    }

    // 4. 分析データを取得
    const analyticsResponse = await apiManager.fetchAnalyticsData({
      reportType: 'standard',
      metrics: ['pageviews', 'users', 'bounceRate'],
      dimensions: ['date', 'source'],
      dateRange: {
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      }
    });

    if (analyticsResponse.success) {
      console.log('Analytics data:', analyticsResponse.data);
    }

    // 5. 天気データを取得
    const weatherResponse = await apiManager.fetchWeatherData({
      type: 'forecast',
      location: { city: 'Tokyo' },
      units: 'metric',
      cnt: 5
    });

    if (weatherResponse.success) {
      console.log('Weather forecast:', weatherResponse.data);
    }

    // 6. ヘルスチェック
    const healthStatus = await apiManager.healthCheckAll();
    console.log('Health check results:', healthStatus);

    // 7. 汎用的なアダプター使用
    const adapter = apiManager.getAdapter('shopify');
    const directResponse = await adapter.fetch({
      resource: 'orders',
      query: { status: 'any' }
    });

    // 8. エラーハンドリングの例
    try {
      await apiManager.send('shopify', {
        resource: 'product',
        data: {
          title: 'New Product',
          vendor: 'Example Vendor'
        }
      });
    } catch (error) {
      console.error('Failed to create product:', error);
    }

  } catch (error) {
    console.error('Example usage failed:', error);
  } finally {
    // クリーンアップ
    await apiManager.disconnectAll();
    console.log('All connections closed');
  }
}

// 既存コードからの移行例
async function migrationExample() {
  // 従来のコード:
  // const shopifyApi = new ShopifyAPI(config);
  // const products = await shopifyApi.getProducts();

  // 新しいコード:
  await apiManager.initialize({
    shopify: {
      shopDomain: 'your-shop.myshopify.com',
      accessToken: 'your-access-token',
      apiVersion: '2023-10'
    }
  });

  const response = await apiManager.fetchShopifyData({
    resource: 'products'
  });

  if (response.success) {
    const products = response.data;
    // 既存のビジネスロジックをそのまま使用
    console.log('Products:', products);
  }
}

// 実行
if (require.main === module) {
  exampleUsage().catch(console.error);
}