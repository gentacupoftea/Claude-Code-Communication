import { apiManager } from '../../src';
import { mockApiServer } from '../mock-apis/MockApiServer';
import { MemoryCache } from '../../src/cache/MemoryCache';

/**
 * APIアダプター統合テストスイート
 */
export class ApiIntegrationTest {
  private testResults: TestResult[] = [];
  private startTime: number = 0;

  /**
   * 統合テストを実行
   */
  async runIntegrationTests(): Promise<TestSummary> {
    console.log('🚀 APIアダプター統合テスト開始');
    this.startTime = Date.now();
    this.testResults = [];

    try {
      // テスト環境の初期化
      await this.setupTestEnvironment();

      // 各テストケースを実行
      await this.testBasicApiOperations();
      await this.testCacheIntegration();
      await this.testCacheStrategies();
      await this.testConcurrentRequests();
      await this.testApiManager();
      
      return this.generateSummary();
    } catch (error) {
      console.error('統合テスト実行中にエラーが発生:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * テスト環境のセットアップ
   */
  private async setupTestEnvironment(): Promise<void> {
    console.log('📋 テスト環境をセットアップ中...');

    // モックAPIサーバーの設定
    mockApiServer.setResponseDelay(50);
    mockApiServer.setErrorRate(0);
    mockApiServer.resetRequestCount();

    // APIマネージャーの初期化（キャッシュ付き）
    await apiManager.initialize({
      shopify: {
        shopDomain: 'test.myshopify.com',
        accessToken: 'test-token',
        apiVersion: '2023-10'
      },
      pos: {
        endpoint: 'https://test-pos-api.com',
        apiKey: 'test-key',
        secretKey: 'test-secret'
      },
      analytics: {
        endpoint: 'https://test-analytics-api.com',
        apiKey: 'test-key',
        projectId: 'test-project'
      },
      weather: {
        endpoint: 'https://test-weather-api.com',
        apiKey: 'test-key'
      },
      cache: {
        cacheConfig: {
          defaultTTL: 300,
          keyPrefix: 'test',
          debug: true
        },
        enableMemoryFallback: true,
        memoryMaxEntries: 1000
      }
    });

    // fetchのモック化
    this.setupFetchMock();
  }

  /**
   * fetchのモック化
   */
  private setupFetchMock(): void {
    const originalFetch = global.fetch;
    
    global.fetch = async (url: string, options?: RequestInit): Promise<Response> => {
      const method = options?.method || 'GET';
      const urlStr = url.toString();

      let mockResponse: any;

      try {
        if (urlStr.includes('myshopify.com')) {
          mockResponse = await mockApiServer.mockShopifyApi(urlStr, method, options?.body);
        } else if (urlStr.includes('pos-api')) {
          mockResponse = await mockApiServer.mockPosApi(urlStr, method, options?.body);
        } else if (urlStr.includes('analytics-api')) {
          mockResponse = await mockApiServer.mockAnalyticsApi(urlStr, method, options?.body);
        } else if (urlStr.includes('weather-api')) {
          mockResponse = await mockApiServer.mockWeatherApi(urlStr, method, options?.body);
        } else {
          mockResponse = { data: 'Mock response' };
        }

        return new Response(JSON.stringify(mockResponse), {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error: any) {
        const status = error.response?.status || 500;
        return new Response(JSON.stringify({ error: error.message }), {
          status,
          statusText: error.message
        });
      }
    };
  }

  /**
   * 基本的なAPI操作のテスト
   */
  private async testBasicApiOperations(): Promise<void> {
    console.log('🔍 基本的なAPI操作をテスト中...');

    // Shopify商品取得テスト
    await this.runTest('Shopify商品取得', async () => {
      const response = await apiManager.fetchShopifyData({
        resource: 'products',
        query: { limit: '10' }
      });
      
      if (!response.success || !response.data) {
        throw new Error('Shopify商品取得に失敗');
      }
      
      return { products: response.data.length || 0 };
    });

    // POS取引取得テスト
    await this.runTest('POS取引取得', async () => {
      const response = await apiManager.fetchPosData({
        type: 'transactions',
        filters: { date_from: '2024-01-01' }
      });
      
      if (!response.success || !response.data) {
        throw new Error('POS取引取得に失敗');
      }
      
      return { transactions: response.data.length || 0 };
    });

    // Analytics データ取得テスト
    await this.runTest('Analytics データ取得', async () => {
      const response = await apiManager.fetchAnalyticsData({
        reportType: 'standard',
        metrics: ['pageviews', 'users'],
        dateRange: {
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        }
      });
      
      if (!response.success || !response.data) {
        throw new Error('Analytics データ取得に失敗');
      }
      
      return { metrics: Object.keys(response.data.metrics).length };
    });

    // Weather データ取得テスト
    await this.runTest('Weather データ取得', async () => {
      const response = await apiManager.fetchWeatherData({
        type: 'current',
        location: { city: 'Tokyo' }
      });
      
      if (!response.success || !response.data) {
        throw new Error('Weather データ取得に失敗');
      }
      
      return { location: response.data.location.name };
    });
  }

  /**
   * キャッシュ統合のテスト
   */
  private async testCacheIntegration(): Promise<void> {
    console.log('💾 キャッシュ統合をテスト中...');

    const testParams = {
      resource: 'products',
      query: { limit: '5', status: 'active' }
    };

    // キャッシュクリア
    await apiManager.clearCache();

    // 初回リクエスト（API呼び出し）
    await this.runTest('キャッシュミス', async () => {
      const startTime = Date.now();
      const response = await apiManager.fetchShopifyData(testParams);
      const duration = Date.now() - startTime;
      
      if (!response.success) {
        throw new Error('初回リクエストに失敗');
      }
      
      // キャッシュされていないことを確認
      if (response.metadata?.cached) {
        throw new Error('初回リクエストがキャッシュされていた');
      }
      
      return { duration, cached: false };
    });

    // 2回目リクエスト（キャッシュヒット）
    await this.runTest('キャッシュヒット', async () => {
      const startTime = Date.now();
      const response = await apiManager.fetchShopifyData(testParams);
      const duration = Date.now() - startTime;
      
      if (!response.success) {
        throw new Error('キャッシュからの取得に失敗');
      }
      
      // キャッシュされていることを確認
      if (!response.metadata?.cached) {
        throw new Error('キャッシュされたデータが取得できなかった');
      }
      
      // レスポンス時間が短いことを確認
      if (duration > 10) { // キャッシュなら10ms以下であるべき
        console.warn(`キャッシュヒットにしては遅い: ${duration}ms`);
      }
      
      return { duration, cached: true };
    });

    // キャッシュ統計の確認
    await this.runTest('キャッシュ統計', async () => {
      const stats = await apiManager.getCacheStats();
      
      if (!stats.cacheEnabled) {
        throw new Error('キャッシュが有効になっていない');
      }
      
      if (stats.global.hits === 0) {
        throw new Error('キャッシュヒットが記録されていない');
      }
      
      return {
        hits: stats.global.hits,
        misses: stats.global.misses,
        hitRate: stats.global.hitRate
      };
    });
  }

  /**
   * キャッシュ戦略のテスト
   */
  private async testCacheStrategies(): Promise<void> {
    console.log('🎯 キャッシュ戦略をテスト中...');

    await apiManager.clearCache();

    // 異なるAPI種別でのキャッシュ動作確認
    const tests = [
      {
        name: 'Shopify商品キャッシュ',
        api: 'shopify',
        params: { resource: 'products', query: { limit: '3' } },
        expectedTTL: 3600 // 1時間
      },
      {
        name: 'POS取引キャッシュ',
        api: 'pos',
        params: { type: 'transactions', filters: {} },
        expectedTTL: 120 // 2分
      },
      {
        name: 'Weather現在キャッシュ',
        api: 'weather',
        params: { type: 'current', location: { city: 'Tokyo' } },
        expectedTTL: 600 // 10分
      }
    ];

    for (const test of tests) {
      await this.runTest(test.name, async () => {
        let response: any;
        
        if (test.api === 'shopify') {
          response = await apiManager.fetchShopifyData(test.params);
        } else if (test.api === 'pos') {
          response = await apiManager.fetchPosData(test.params);
        } else if (test.api === 'weather') {
          response = await apiManager.fetchWeatherData(test.params);
        }
        
        if (!response.success) {
          throw new Error(`${test.api} API呼び出しに失敗`);
        }
        
        return { api: test.api, cached: response.metadata?.cached || false };
      });
    }
  }

  /**
   * 並行リクエストのテスト
   */
  private async testConcurrentRequests(): Promise<void> {
    console.log('⚡ 並行リクエストをテスト中...');

    await apiManager.clearCache();

    await this.runTest('並行リクエスト処理', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => 
        apiManager.fetchShopifyData({
          resource: 'products',
          query: { limit: '5', page: (i + 1).toString() }
        })
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const duration = Date.now() - startTime;

      const successCount = responses.filter(r => r.success).length;
      
      if (successCount !== 10) {
        throw new Error(`並行リクエストの一部が失敗: ${successCount}/10`);
      }

      return { 
        totalRequests: 10,
        successCount,
        duration,
        avgDuration: duration / 10
      };
    });
  }

  /**
   * APIマネージャーのテスト
   */
  private async testApiManager(): Promise<void> {
    console.log('🎛️ APIマネージャーをテスト中...');

    // アダプター一覧の確認
    await this.runTest('アダプター一覧', async () => {
      const adapters = apiManager.getAdapterNames();
      const expectedAdapters = ['shopify', 'pos', 'analytics', 'weather'];
      
      for (const expected of expectedAdapters) {
        if (!adapters.includes(expected)) {
          throw new Error(`アダプター ${expected} が見つからない`);
        }
      }
      
      return { adapters };
    });

    // ヘルスチェック
    await this.runTest('ヘルスチェック', async () => {
      const health = await apiManager.healthCheckAll();
      const healthyCount = Object.values(health).filter(h => h).length;
      
      if (healthyCount === 0) {
        throw new Error('すべてのAPIが不健全状態');
      }
      
      return { 
        total: Object.keys(health).length,
        healthy: healthyCount,
        health
      };
    });

    // 汎用fetch機能
    await this.runTest('汎用fetch機能', async () => {
      const response = await apiManager.fetch('shopify', {
        resource: 'orders',
        query: { limit: '3' }
      });
      
      if (!response.success) {
        throw new Error('汎用fetch機能が失敗');
      }
      
      return { success: true };
    });
  }

  /**
   * 個別テストの実行
   */
  private async runTest(name: string, testFn: () => Promise<any>): Promise<void> {
    const startTime = Date.now();
    
    try {
      const result = await testFn();
      const duration = Date.now() - startTime;
      
      this.testResults.push({
        name,
        status: 'PASS',
        duration,
        result
      });
      
      console.log(`✅ ${name} - ${duration}ms`);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      this.testResults.push({
        name,
        status: 'FAIL',
        duration,
        error: error.message
      });
      
      console.log(`❌ ${name} - ${error.message} (${duration}ms)`);
    }
  }

  /**
   * テスト結果のサマリー生成
   */
  private generateSummary(): TestSummary {
    const totalDuration = Date.now() - this.startTime;
    const passCount = this.testResults.filter(r => r.status === 'PASS').length;
    const failCount = this.testResults.filter(r => r.status === 'FAIL').length;
    
    return {
      totalTests: this.testResults.length,
      passCount,
      failCount,
      successRate: (passCount / this.testResults.length) * 100,
      totalDuration,
      results: this.testResults,
      summary: {
        requestStats: mockApiServer.getRequestStats(),
        cacheStats: undefined // 後で取得
      }
    };
  }

  /**
   * クリーンアップ
   */
  private async cleanup(): Promise<void> {
    console.log('🧹 テスト環境をクリーンアップ中...');
    
    try {
      await apiManager.disconnectAll();
      mockApiServer.resetRequestCount();
    } catch (error) {
      console.error('クリーンアップエラー:', error);
    }
  }
}

/**
 * テスト結果の型定義
 */
interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL';
  duration: number;
  result?: any;
  error?: string;
}

interface TestSummary {
  totalTests: number;
  passCount: number;
  failCount: number;
  successRate: number;
  totalDuration: number;
  results: TestResult[];
  summary: {
    requestStats: Record<string, number>;
    cacheStats?: any;
  };
}

// テスト実行関数のエクスポート
export async function runApiIntegrationTests(): Promise<TestSummary> {
  const tester = new ApiIntegrationTest();
  return await tester.runIntegrationTests();
}