import { apiManager } from '../src';

/**
 * キャッシュ機能付きAPIアダプターの使用例
 */
async function cacheUsageExample() {
  try {
    // 1. キャッシュ設定付きでAPIマネージャーを初期化
    await apiManager.initialize({
      // API設定
      shopify: {
        shopDomain: 'your-shop.myshopify.com',
        accessToken: 'your-access-token',
        apiVersion: '2023-10'
      },
      pos: {
        endpoint: 'https://pos-api.example.com',
        apiKey: 'your-api-key',
        secretKey: 'your-secret-key'
      },
      analytics: {
        endpoint: 'https://analytics-api.example.com',
        apiKey: 'your-api-key',
        projectId: 'your-project-id'
      },
      weather: {
        endpoint: 'https://api.openweathermap.org/data/2.5',
        apiKey: 'your-api-key'
      },
      
      // キャッシュ設定
      cache: {
        cacheConfig: {
          defaultTTL: 600,        // デフォルト10分
          keyPrefix: 'api',       // すべてのキーに"api:"プレフィックス
          enableCompression: true, // 圧縮を有効化
          debug: true             // デバッグログを出力
        },
        redis: {
          host: 'localhost',
          port: 6379,
          // password: 'your-redis-password',
          db: 0,
          keyPrefix: 'myapp'
        },
        enableMemoryFallback: true,  // Redisが使えない場合はメモリキャッシュ
        memoryMaxEntries: 5000       // メモリキャッシュの最大エントリ数
      }
    });

    console.log('API Manager with cache initialized');

    // 2. キャッシュ付きでデータを取得（初回はAPI呼び出し）
    console.time('First request');
    const firstResponse = await apiManager.fetchShopifyData({
      resource: 'products',
      query: { limit: '10' }
    });
    console.timeEnd('First request');
    console.log('First request cached:', firstResponse.metadata?.cached || false);

    // 3. 同じリクエスト（キャッシュから取得）
    console.time('Cached request');
    const cachedResponse = await apiManager.fetchShopifyData({
      resource: 'products',
      query: { limit: '10' }
    });
    console.timeEnd('Cached request');
    console.log('Second request cached:', cachedResponse.metadata?.cached || true);

    // 4. 天気データを取得（TTLが短い）
    const weatherParams = {
      type: 'current',
      location: { city: 'Tokyo' }
    };

    const weather1 = await apiManager.fetchWeatherData(weatherParams);
    console.log('Weather fetched, will expire in 10 minutes');

    // 5. POS取引データ（条件によってはキャッシュされない）
    const posParams = {
      type: 'transactions',
      realtime: true  // リアルタイムデータはキャッシュされない
    };

    const posData = await apiManager.fetchPosData(posParams);
    console.log('POS realtime data (not cached)');

    // 6. 分析データ（過去のデータは長くキャッシュ）
    const analyticsParams = {
      reportType: 'standard',
      metrics: ['pageviews', 'users'],
      dateRange: {
        startDate: '2023-01-01',
        endDate: '2023-01-31'
      }
    };

    const analytics = await apiManager.fetchAnalyticsData(analyticsParams);
    console.log('Historical analytics data (cached for 24 hours)');

    // 7. キャッシュ統計を確認
    const cacheStats = await apiManager.getCacheStats();
    console.log('Cache statistics:', JSON.stringify(cacheStats, null, 2));

    // 8. データ更新後のキャッシュ無効化
    await apiManager.send('shopify', {
      resource: 'product',
      method: 'POST',
      data: {
        title: 'New Product',
        vendor: 'Test Vendor'
      }
    });
    console.log('Product created, related cache invalidated');

    // 9. 特定のAPIのキャッシュをクリア
    await apiManager.clearCache('shopify');
    console.log('Shopify cache cleared');

    // 10. キャッシュキーのカスタマイズ例
    const customParams = {
      resource: 'orders',
      query: {
        status: 'fulfilled',
        created_at_min: '2024-01-01',
        limit: '50'
      }
    };

    // 同じパラメータは同じキャッシュキーを生成
    const order1 = await apiManager.fetchShopifyData(customParams);
    const order2 = await apiManager.fetchShopifyData(customParams);
    console.log('Same parameters generate same cache key');

  } catch (error) {
    console.error('Cache usage example failed:', error);
  } finally {
    await apiManager.disconnectAll();
  }
}

// キャッシュ戦略のカスタマイズ例
async function customCacheStrategyExample() {
  // カスタムキャッシュ戦略を登録することも可能
  // CacheStrategyFactory.registerStrategy('custom', new CustomCacheStrategy());
  
  console.log('Cache strategies can be customized per API');
}

// パフォーマンス比較
async function performanceComparison() {
  await apiManager.initialize({
    shopify: {
      shopDomain: 'your-shop.myshopify.com',
      accessToken: 'your-access-token',
      apiVersion: '2023-10'
    },
    cache: {
      cacheConfig: {
        defaultTTL: 3600,
        keyPrefix: 'perf-test'
      }
    }
  });

  const iterations = 100;
  const params = { resource: 'products', query: { limit: '100' } };

  // キャッシュなしのテスト
  await apiManager.clearCache();
  console.time('Without cache');
  for (let i = 0; i < iterations; i++) {
    await apiManager.fetchShopifyData(params);
  }
  console.timeEnd('Without cache');

  // キャッシュありのテスト（初回のみAPI呼び出し）
  await apiManager.clearCache();
  console.time('With cache');
  for (let i = 0; i < iterations; i++) {
    await apiManager.fetchShopifyData(params);
  }
  console.timeEnd('With cache');

  const stats = await apiManager.getCacheStats();
  console.log(`Cache hit rate: ${(stats.global.hitRate * 100).toFixed(2)}%`);
}

// 実行
if (require.main === module) {
  cacheUsageExample()
    .then(() => performanceComparison())
    .catch(console.error);
}