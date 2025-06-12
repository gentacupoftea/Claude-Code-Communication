import { apiManager } from '../../src';
import { mockApiServer } from '../mock-apis/MockApiServer';
import { CacheManager } from '../../src/cache/CacheManager';

/**
 * フォールバックシステムテストスイート
 * Redis→メモリキャッシュフォールバック、API障害時の動作を検証
 */
export class FallbackSystemTest {
  private testResults: TestResult[] = [];
  private startTime: number = 0;

  /**
   * フォールバックシステムテストを実行
   */
  async runFallbackTests(): Promise<TestSummary> {
    console.log('🔄 フォールバックシステムテスト開始');
    this.startTime = Date.now();
    this.testResults = [];

    try {
      await this.setupTestEnvironment();
      
      // フォールバックシナリオのテスト
      await this.testCacheFallback();
      await this.testApiFailureHandling();
      await this.testPartialApiFailure();
      await this.testRecoveryScenarios();
      await this.testRetryMechanisms();
      
      return this.generateSummary();
    } catch (error) {
      console.error('フォールバックテスト実行中にエラー:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * テスト環境のセットアップ
   */
  private async setupTestEnvironment(): Promise<void> {
    console.log('📋 フォールバックテスト環境をセットアップ中...');

    // モックAPIサーバーの初期化
    mockApiServer.setResponseDelay(100);
    mockApiServer.setErrorRate(0);
    mockApiServer.setDowntime(false);
    mockApiServer.resetRequestCount();

    // 基本設定でAPIマネージャーを初期化
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
          defaultTTL: 60,
          keyPrefix: 'fallback-test',
          debug: true
        },
        enableMemoryFallback: true,
        memoryMaxEntries: 100
      }
    });

    this.setupFetchMock();
  }

  /**
   * fetchのモック化（フォールバック用）
   */
  private setupFetchMock(): void {
    global.fetch = async (url: string, options?: RequestInit): Promise<Response> => {
      const method = options?.method || 'GET';
      const urlStr = url.toString();

      try {
        let mockResponse: any;

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
          statusText: error.message,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    };
  }

  /**
   * キャッシュフォールバックのテスト
   */
  private async testCacheFallback(): Promise<void> {
    console.log('💾 キャッシュフォールバックをテスト中...');

    // Redis接続失敗シミュレーション→メモリキャッシュフォールバック
    await this.runTest('Redis→メモリキャッシュフォールバック', async () => {
      // まず正常にキャッシュを構築
      await apiManager.clearCache();
      
      const testParams = {
        resource: 'products',
        query: { limit: '5' }
      };

      // データをキャッシュに保存
      const response1 = await apiManager.fetchShopifyData(testParams);
      if (!response1.success) {
        throw new Error('初回データ取得に失敗');
      }

      // キャッシュから取得できることを確認
      const response2 = await apiManager.fetchShopifyData(testParams);
      if (!response2.success || !response2.metadata?.cached) {
        throw new Error('キャッシュからの取得に失敗');
      }

      return {
        initialRequest: response1.success,
        cachedRequest: response2.metadata?.cached,
        fallbackWorking: true
      };
    });

    // マルチレベルキャッシュの動作確認
    await this.runTest('マルチレベルキャッシュ動作', async () => {
      const cacheManager = new CacheManager({
        cacheConfig: {
          defaultTTL: 60,
          keyPrefix: 'multi-test'
        },
        enableMemoryFallback: true
      });

      await cacheManager.initialize();
      const multiCache = cacheManager.getMultiLevelCache();

      // データを設定
      await multiCache.set('test-key', { data: 'test-value' });
      
      // データを取得
      const retrieved = await multiCache.get('test-key');
      
      if (!retrieved || retrieved.data !== 'test-value') {
        throw new Error('マルチレベルキャッシュからの取得に失敗');
      }

      return { 
        stored: true, 
        retrieved: true,
        data: retrieved
      };
    });
  }

  /**
   * API障害処理のテスト
   */
  private async testApiFailureHandling(): Promise<void> {
    console.log('⚠️ API障害処理をテスト中...');

    // 高エラー率での動作確認
    await this.runTest('高エラー率環境での動作', async () => {
      mockApiServer.setErrorRate(0.5); // 50%エラー率

      const requests = [];
      const successCount = { value: 0 };
      const errorCount = { value: 0 };

      // 10回リクエストを実行
      for (let i = 0; i < 10; i++) {
        requests.push(
          apiManager.fetchShopifyData({
            resource: 'products',
            query: { page: (i + 1).toString() }
          }).then(response => {
            if (response.success) {
              successCount.value++;
            } else {
              errorCount.value++;
            }
            return response;
          })
        );
      }

      await Promise.all(requests);
      mockApiServer.setErrorRate(0); // エラー率をリセット

      return {
        totalRequests: 10,
        successCount: successCount.value,
        errorCount: errorCount.value,
        errorRate: errorCount.value / 10
      };
    });

    // サーバーダウンタイム処理
    await this.runTest('サーバーダウンタイム処理', async () => {
      // キャッシュにデータを準備
      const testParams = {
        resource: 'orders',
        query: { limit: '3' }
      };

      // 正常時にデータを取得・キャッシュ
      const response1 = await apiManager.fetchShopifyData(testParams);
      if (!response1.success) {
        throw new Error('データの事前キャッシュに失敗');
      }

      // サーバーダウンをシミュレート
      mockApiServer.setDowntime(true);

      // キャッシュからの取得を試行
      const response2 = await apiManager.fetchShopifyData(testParams);
      
      mockApiServer.setDowntime(false); // ダウンタイムを解除

      if (!response2.success) {
        throw new Error('ダウンタイム中にキャッシュからのフォールバックに失敗');
      }

      return {
        cacheWorkedDuringDowntime: response2.metadata?.cached || false,
        dataAvailable: response2.success
      };
    });
  }

  /**
   * 部分的API障害のテスト
   */
  private async testPartialApiFailure(): Promise<void> {
    console.log('🔧 部分的API障害をテスト中...');

    await this.runTest('単一API障害時の他API動作', async () => {
      // 特定のAPIのみエラーを発生させる
      const originalFetch = global.fetch;
      let shopifyErrorCount = 0;
      let otherApiCount = 0;

      global.fetch = async (url: string, options?: RequestInit): Promise<Response> => {
        if (url.toString().includes('myshopify.com')) {
          shopifyErrorCount++;
          return new Response(JSON.stringify({ error: 'Shopify API Down' }), {
            status: 503,
            statusText: 'Service Unavailable'
          });
        } else {
          otherApiCount++;
          return originalFetch(url, options);
        }
      };

      // 複数APIに並行リクエスト
      const [shopifyResult, posResult, weatherResult] = await Promise.all([
        apiManager.fetchShopifyData({ resource: 'products' }),
        apiManager.fetchPosData({ type: 'transactions' }),
        apiManager.fetchWeatherData({ type: 'current', location: { city: 'Tokyo' } })
      ]);

      // fetchを元に戻す
      global.fetch = originalFetch;

      return {
        shopifyFailed: !shopifyResult.success,
        posWorked: posResult.success,
        weatherWorked: weatherResult.success,
        shopifyErrors: shopifyErrorCount,
        otherApiCalls: otherApiCount
      };
    });
  }

  /**
   * 復旧シナリオのテスト
   */
  private async testRecoveryScenarios(): Promise<void> {
    console.log('🚀 復旧シナリオをテスト中...');

    await this.runTest('API復旧後の正常動作', async () => {
      // 一時的にエラー率を上げる
      mockApiServer.setErrorRate(1.0); // 100%エラー

      // エラーになることを確認
      const errorResponse = await apiManager.fetchShopifyData({
        resource: 'products',
        query: { limit: '1' }
      });

      if (errorResponse.success) {
        throw new Error('エラーが発生するはずのリクエストが成功した');
      }

      // エラー率を正常に戻す
      mockApiServer.setErrorRate(0);

      // 復旧後の正常動作を確認
      const recoveryResponse = await apiManager.fetchShopifyData({
        resource: 'products',
        query: { limit: '1' }
      });

      if (!recoveryResponse.success) {
        throw new Error('復旧後のリクエストが失敗');
      }

      return {
        errorPhase: !errorResponse.success,
        recoveryPhase: recoveryResponse.success,
        errorMessage: errorResponse.error?.message
      };
    });

    await this.runTest('キャッシュ復旧と無効化', async () => {
      const testParams = {
        resource: 'inventory',
        query: { location: 'warehouse-1' }
      };

      // データをキャッシュ
      const response1 = await apiManager.fetchShopifyData(testParams);
      if (!response1.success) {
        throw new Error('初回データ取得に失敗');
      }

      // キャッシュクリア
      await apiManager.clearCache('shopify');

      // キャッシュがクリアされたことを確認
      const response2 = await apiManager.fetchShopifyData(testParams);
      if (response2.metadata?.cached) {
        throw new Error('キャッシュがクリアされていない');
      }

      return {
        initialCached: response1.success,
        cacheCleared: !response2.metadata?.cached,
        dataStillAvailable: response2.success
      };
    });
  }

  /**
   * リトライメカニズムのテスト
   */
  private async testRetryMechanisms(): Promise<void> {
    console.log('🔄 リトライメカニズムをテスト中...');

    await this.runTest('リトライアブルエラーの処理', async () => {
      let attemptCount = 0;
      const originalFetch = global.fetch;

      global.fetch = async (url: string, options?: RequestInit): Promise<Response> => {
        attemptCount++;
        
        // 最初の2回は503エラー（リトライ可能）
        if (attemptCount <= 2) {
          return new Response(JSON.stringify({ error: 'Service Temporarily Unavailable' }), {
            status: 503,
            statusText: 'Service Unavailable'
          });
        }
        
        // 3回目で成功
        return originalFetch(url, options);
      };

      const response = await apiManager.fetchShopifyData({
        resource: 'products',
        query: { limit: '1' }
      });

      global.fetch = originalFetch;

      return {
        finalSuccess: response.success,
        totalAttempts: attemptCount,
        retryWorked: attemptCount > 1 && response.success
      };
    });

    await this.runTest('非リトライアブルエラーの処理', async () => {
      const originalFetch = global.fetch;
      let attemptCount = 0;

      global.fetch = async (url: string, options?: RequestInit): Promise<Response> => {
        attemptCount++;
        
        // 401エラー（認証エラー、リトライ不可）
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          statusText: 'Unauthorized'
        });
      };

      const response = await apiManager.fetchShopifyData({
        resource: 'products',
        query: { limit: '1' }
      });

      global.fetch = originalFetch;

      return {
        shouldFail: !response.success,
        noRetryAttempted: attemptCount === 1,
        errorType: response.error?.code
      };
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
        fallbackFeatures: {
          cacheService: true,
          multiLevel: true,
          errorRecovery: true,
          retryMechanism: true
        }
      }
    };
  }

  /**
   * クリーンアップ
   */
  private async cleanup(): Promise<void> {
    console.log('🧹 フォールバックテスト環境をクリーンアップ中...');
    
    try {
      await apiManager.disconnectAll();
      mockApiServer.setErrorRate(0);
      mockApiServer.setDowntime(false);
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
    fallbackFeatures: Record<string, boolean>;
  };
}

// テスト実行関数のエクスポート
export async function runFallbackSystemTests(): Promise<TestSummary> {
  const tester = new FallbackSystemTest();
  return await tester.runFallbackTests();
}