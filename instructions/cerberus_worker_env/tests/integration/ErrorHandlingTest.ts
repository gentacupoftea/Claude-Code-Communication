import { apiManager } from '../../src';
import { mockApiServer } from '../mock-apis/MockApiServer';

/**
 * エラー処理検証テストスイート
 * 様々なエラーシナリオでの適切な処理を検証
 */
export class ErrorHandlingTest {
  private testResults: TestResult[] = [];
  private startTime: number = 0;

  /**
   * エラー処理テストを実行
   */
  async runErrorHandlingTests(): Promise<TestSummary> {
    console.log('🚨 エラー処理検証テスト開始');
    this.startTime = Date.now();
    this.testResults = [];

    try {
      await this.setupErrorTestEnvironment();
      
      // 各エラーシナリオのテスト
      await this.testNetworkErrors();
      await this.testHttpStatusErrors();
      await this.testTimeoutErrors();
      await this.testAuthenticationErrors();
      await this.testValidationErrors();
      await this.testCacheErrors();
      await this.testRetryMechanisms();
      await this.testGracefulDegradation();
      
      return this.generateSummary();
    } catch (error) {
      console.error('エラー処理テスト実行中にエラー:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * エラーテスト環境のセットアップ
   */
  private async setupErrorTestEnvironment(): Promise<void> {
    console.log('📋 エラーテスト環境をセットアップ中...');

    // モックAPIサーバーの初期化
    mockApiServer.setResponseDelay(50);
    mockApiServer.setErrorRate(0);
    mockApiServer.setDowntime(false);
    mockApiServer.resetRequestCount();

    // APIマネージャーの初期化
    await apiManager.initialize({
      shopify: {
        shopDomain: 'error-test.myshopify.com',
        accessToken: 'error-test-token',
        apiVersion: '2023-10',
        timeout: 5000
      },
      pos: {
        endpoint: 'https://error-test-pos-api.com',
        apiKey: 'error-test-key',
        secretKey: 'error-test-secret',
        timeout: 3000
      },
      analytics: {
        endpoint: 'https://error-test-analytics-api.com',
        apiKey: 'error-test-key',
        projectId: 'error-test-project',
        timeout: 8000
      },
      weather: {
        endpoint: 'https://error-test-weather-api.com',
        apiKey: 'error-test-key',
        timeout: 2000
      },
      cache: {
        cacheConfig: {
          defaultTTL: 60,
          keyPrefix: 'error-test',
          debug: true
        },
        enableMemoryFallback: true
      }
    });
  }

  /**
   * ネットワークエラーのテスト
   */
  private async testNetworkErrors(): Promise<void> {
    console.log('🌐 ネットワークエラーをテスト中...');

    await this.runTest('接続拒否エラー', async () => {
      const originalFetch = global.fetch;
      
      global.fetch = async (): Promise<Response> => {
        const error = new Error('connect ECONNREFUSED 127.0.0.1:3000');
        (error as any).code = 'ECONNREFUSED';
        throw error;
      };

      const response = await apiManager.fetchShopifyData({
        resource: 'products',
        query: { limit: '5' }
      });

      global.fetch = originalFetch;

      return {
        success: response.success,
        errorCode: response.error?.code,
        retryable: response.error?.retryable,
        hasError: !!response.error
      };
    });

    await this.runTest('タイムアウトエラー', async () => {
      const originalFetch = global.fetch;
      
      global.fetch = async (): Promise<Response> => {
        const error = new Error('Request timeout');
        (error as any).code = 'ETIMEDOUT';
        throw error;
      };

      const response = await apiManager.fetchShopifyData({
        resource: 'orders',
        query: { limit: '5' }
      });

      global.fetch = originalFetch;

      return {
        success: response.success,
        errorCode: response.error?.code,
        retryable: response.error?.retryable,
        message: response.error?.message
      };
    });

    await this.runTest('DNS解決エラー', async () => {
      const originalFetch = global.fetch;
      
      global.fetch = async (): Promise<Response> => {
        const error = new Error('getaddrinfo ENOTFOUND invalid-domain.com');
        (error as any).code = 'ENOTFOUND';
        throw error;
      };

      const response = await apiManager.fetchWeatherData({
        type: 'current',
        location: { city: 'Tokyo' }
      });

      global.fetch = originalFetch;

      return {
        success: response.success,
        errorHandled: !response.success,
        networkError: true
      };
    });
  }

  /**
   * HTTPステータスエラーのテスト
   */
  private async testHttpStatusErrors(): Promise<void> {
    console.log('📡 HTTPステータスエラーをテスト中...');

    const statusCodes = [400, 401, 403, 404, 429, 500, 502, 503, 504];

    for (const statusCode of statusCodes) {
      await this.runTest(`HTTP ${statusCode}エラー`, async () => {
        const originalFetch = global.fetch;
        
        global.fetch = async (): Promise<Response> => {
          return new Response(
            JSON.stringify({ 
              error: `HTTP ${statusCode} Error`,
              code: statusCode.toString()
            }),
            {
              status: statusCode,
              statusText: this.getStatusText(statusCode)
            }
          );
        };

        const response = await apiManager.fetchShopifyData({
          resource: 'products',
          query: { test_status: statusCode.toString() }
        });

        global.fetch = originalFetch;

        const isRetryable = [429, 500, 502, 503, 504].includes(statusCode);

        return {
          statusCode,
          success: response.success,
          errorHandled: !response.success,
          retryable: response.error?.retryable,
          expectedRetryable: isRetryable,
          retryableCorrect: response.error?.retryable === isRetryable
        };
      });
    }
  }

  /**
   * タイムアウトエラーのテスト
   */
  private async testTimeoutErrors(): Promise<void> {
    console.log('⏱️ タイムアウトエラーをテスト中...');

    await this.runTest('APIタイムアウト', async () => {
      const originalFetch = global.fetch;
      
      global.fetch = async (): Promise<Response> => {
        // 10秒待機（設定されたタイムアウトより長い）
        await new Promise(resolve => setTimeout(resolve, 10000));
        return new Response('Should not reach here');
      };

      const startTime = Date.now();
      const response = await apiManager.fetchShopifyData({
        resource: 'products'
      });
      const duration = Date.now() - startTime;

      global.fetch = originalFetch;

      return {
        success: response.success,
        duration,
        timeoutOccurred: duration < 8000, // タイムアウト時間以下
        errorHandled: !response.success
      };
    });

    await this.runTest('個別APIタイムアウト設定', async () => {
      const originalFetch = global.fetch;
      let callCount = 0;
      
      global.fetch = async (): Promise<Response> => {
        callCount++;
        // Weather API (2秒タイムアウト) vs Analytics API (8秒タイムアウト)
        await new Promise(resolve => setTimeout(resolve, 4000)); // 4秒待機
        return new Response(JSON.stringify({ data: 'slow response' }));
      };

      // Weather API (2秒タイムアウト) - タイムアウトするはず
      const weatherResponse = await apiManager.fetchWeatherData({
        type: 'current',
        location: { city: 'Tokyo' }
      });

      // Analytics API (8秒タイムアウト) - 成功するはず
      const analyticsResponse = await apiManager.fetchAnalyticsData({
        reportType: 'standard',
        metrics: ['pageviews'],
        dateRange: { startDate: '2024-01-01', endDate: '2024-01-02' }
      });

      global.fetch = originalFetch;

      return {
        weatherTimedOut: !weatherResponse.success,
        analyticsSucceeded: analyticsResponse.success,
        timeoutConfigurationWorking: !weatherResponse.success && analyticsResponse.success
      };
    });
  }

  /**
   * 認証エラーのテスト
   */
  private async testAuthenticationErrors(): Promise<void> {
    console.log('🔐 認証エラーをテスト中...');

    await this.runTest('無効な認証トークン', async () => {
      const originalFetch = global.fetch;
      
      global.fetch = async (): Promise<Response> => {
        return new Response(
          JSON.stringify({ 
            error: 'Invalid access token',
            error_description: 'The access token provided is invalid'
          }),
          {
            status: 401,
            statusText: 'Unauthorized'
          }
        );
      };

      const response = await apiManager.fetchShopifyData({
        resource: 'products'
      });

      global.fetch = originalFetch;

      return {
        success: response.success,
        isAuthError: response.error?.code === 'HTTP_401',
        notRetryable: response.error?.retryable === false,
        properErrorHandling: !response.success && !response.error?.retryable
      };
    });

    await this.runTest('期限切れトークン', async () => {
      const originalFetch = global.fetch;
      
      global.fetch = async (): Promise<Response> => {
        return new Response(
          JSON.stringify({ 
            error: 'Token expired',
            code: 'TOKEN_EXPIRED'
          }),
          {
            status: 401,
            statusText: 'Unauthorized'
          }
        );
      };

      const response = await apiManager.fetchPosData({
        type: 'transactions'
      });

      global.fetch = originalFetch;

      return {
        errorDetected: !response.success,
        authErrorHandled: response.error?.code === 'HTTP_401'
      };
    });
  }

  /**
   * バリデーションエラーのテスト
   */
  private async testValidationErrors(): Promise<void> {
    console.log('✅ バリデーションエラーをテスト中...');

    await this.runTest('不正なパラメータ', async () => {
      const originalFetch = global.fetch;
      
      global.fetch = async (): Promise<Response> => {
        return new Response(
          JSON.stringify({ 
            error: 'Invalid parameter',
            details: { field: 'limit', message: 'must be a positive integer' }
          }),
          {
            status: 400,
            statusText: 'Bad Request'
          }
        );
      };

      const response = await apiManager.fetchShopifyData({
        resource: 'products',
        query: { limit: 'invalid' }
      });

      global.fetch = originalFetch;

      return {
        validationErrorDetected: !response.success,
        errorCode: response.error?.code,
        notRetryable: response.error?.retryable === false
      };
    });

    await this.runTest('必須フィールド不足', async () => {
      const originalFetch = global.fetch;
      
      global.fetch = async (): Promise<Response> => {
        return new Response(
          JSON.stringify({ 
            error: 'Missing required fields',
            missing_fields: ['metrics', 'date_range']
          }),
          {
            status: 422,
            statusText: 'Unprocessable Entity'
          }
        );
      };

      const response = await apiManager.fetchAnalyticsData({
        reportType: 'standard'
        // metrics と dateRange が不足
      } as any);

      global.fetch = originalFetch;

      return {
        validationError: !response.success,
        hasErrorDetails: !!response.error?.details
      };
    });
  }

  /**
   * キャッシュエラーのテスト
   */
  private async testCacheErrors(): Promise<void> {
    console.log('💾 キャッシュエラーをテスト中...');

    await this.runTest('キャッシュ障害時のフォールバック', async () => {
      // キャッシュエラーをシミュレート
      const adapter = apiManager.getAdapter('shopify');
      
      // キャッシュをクリアしてからテスト
      await apiManager.clearCache();

      // 正常なAPIレスポンスは保持
      this.setupErrorTestFetchMock();

      const response = await apiManager.fetchShopifyData({
        resource: 'products',
        query: { cache_test: 'true' }
      });

      return {
        apiStillWorks: response.success,
        dataReceived: !!response.data,
        fallbackSuccessful: response.success
      };
    });
  }

  /**
   * リトライメカニズムのテスト
   */
  private async testRetryMechanisms(): Promise<void> {
    console.log('🔄 リトライメカニズムをテスト中...');

    await this.runTest('リトライ可能エラーの自動リトライ', async () => {
      const originalFetch = global.fetch;
      let attemptCount = 0;
      
      global.fetch = async (): Promise<Response> => {
        attemptCount++;
        
        if (attemptCount <= 2) {
          // 最初の2回は503エラー
          return new Response(
            JSON.stringify({ error: 'Service Temporarily Unavailable' }),
            { status: 503, statusText: 'Service Unavailable' }
          );
        }
        
        // 3回目で成功
        return new Response(
          JSON.stringify({ products: [{ id: 1, title: 'Test Product' }] }),
          { status: 200, statusText: 'OK' }
        );
      };

      const response = await apiManager.fetchShopifyData({
        resource: 'products'
      });

      global.fetch = originalFetch;

      return {
        finalSuccess: response.success,
        retryAttempts: attemptCount,
        retryWorked: attemptCount > 1 && response.success
      };
    });

    await this.runTest('非リトライアブルエラーの即座失敗', async () => {
      const originalFetch = global.fetch;
      let attemptCount = 0;
      
      global.fetch = async (): Promise<Response> => {
        attemptCount++;
        
        // 404エラー（リトライ不可）
        return new Response(
          JSON.stringify({ error: 'Not Found' }),
          { status: 404, statusText: 'Not Found' }
        );
      };

      const response = await apiManager.fetchShopifyData({
        resource: 'nonexistent'
      });

      global.fetch = originalFetch;

      return {
        failedCorrectly: !response.success,
        noRetryAttempted: attemptCount === 1,
        errorCode: response.error?.code
      };
    });
  }

  /**
   * グレースフル・デグラデーションのテスト
   */
  private async testGracefulDegradation(): Promise<void> {
    console.log('🛡️ グレースフル・デグラデーションをテスト中...');

    await this.runTest('部分的サービス障害での動作継続', async () => {
      const originalFetch = global.fetch;
      
      global.fetch = async (url: string): Promise<Response> => {
        // Shopify APIのみ障害
        if (url.includes('myshopify.com')) {
          return new Response(
            JSON.stringify({ error: 'Service Down' }),
            { status: 503, statusText: 'Service Unavailable' }
          );
        }
        
        // 他のAPIは正常
        return new Response(
          JSON.stringify({ data: 'Working API response' }),
          { status: 200, statusText: 'OK' }
        );
      };

      const [shopifyResult, posResult, weatherResult] = await Promise.all([
        apiManager.fetchShopifyData({ resource: 'products' }),
        apiManager.fetchPosData({ type: 'transactions' }),
        apiManager.fetchWeatherData({ type: 'current', location: { city: 'Tokyo' } })
      ]);

      global.fetch = originalFetch;

      return {
        shopifyFailed: !shopifyResult.success,
        posWorked: posResult.success,
        weatherWorked: weatherResult.success,
        partialDegradation: !shopifyResult.success && posResult.success && weatherResult.success
      };
    });

    await this.runTest('キャッシュからのデータ提供（API障害時）', async () => {
      // 事前にデータをキャッシュ
      this.setupErrorTestFetchMock();
      const testParams = { resource: 'products', query: { limit: '5' } };
      
      const cacheResponse = await apiManager.fetchShopifyData(testParams);
      if (!cacheResponse.success) {
        throw new Error('キャッシュデータの準備に失敗');
      }

      // API障害をシミュレート
      const originalFetch = global.fetch;
      global.fetch = async (): Promise<Response> => {
        return new Response(
          JSON.stringify({ error: 'API Down' }),
          { status: 503, statusText: 'Service Unavailable' }
        );
      };

      // キャッシュからデータを取得できるか確認
      const cachedResponse = await apiManager.fetchShopifyData(testParams);

      global.fetch = originalFetch;

      return {
        cachePreparation: cacheResponse.success,
        cachedDataAvailable: cachedResponse.success,
        dataFromCache: cachedResponse.metadata?.cached,
        gracefulDegradation: cachedResponse.success && cachedResponse.metadata?.cached
      };
    });
  }

  /**
   * エラーテスト用fetchモック
   */
  private setupErrorTestFetchMock(): void {
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
          mockResponse = { data: 'Error test mock response' };
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
   * HTTPステータステキストを取得
   */
  private getStatusText(statusCode: number): string {
    const statusTexts: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      504: 'Gateway Timeout'
    };
    
    return statusTexts[statusCode] || 'Unknown Status';
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
        errorCategories: {
          networkErrors: this.countTestsWithPrefix('接続拒否|タイムアウト|DNS解決'),
          httpStatusErrors: this.countTestsWithPrefix('HTTP \\d+'),
          authenticationErrors: this.countTestsWithPrefix('認証|トークン'),
          validationErrors: this.countTestsWithPrefix('バリデーション|必須フィールド'),
          cacheErrors: this.countTestsWithPrefix('キャッシュ'),
          retryMechanisms: this.countTestsWithPrefix('リトライ'),
          gracefulDegradation: this.countTestsWithPrefix('グレースフル|部分的|障害時')
        },
        requestStats: mockApiServer.getRequestStats()
      }
    };
  }

  /**
   * 特定のプレフィックスを持つテスト数をカウント
   */
  private countTestsWithPrefix(pattern: string): number {
    const regex = new RegExp(pattern, 'i');
    return this.testResults.filter(test => regex.test(test.name)).length;
  }

  /**
   * クリーンアップ
   */
  private async cleanup(): Promise<void> {
    console.log('🧹 エラーテスト環境をクリーンアップ中...');
    
    try {
      await apiManager.disconnectAll();
      mockApiServer.setErrorRate(0);
      mockApiServer.setDowntime(false);
      mockApiServer.resetRequestCount();
    } catch (error) {
      console.error('エラーテストクリーンアップエラー:', error);
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
    errorCategories: Record<string, number>;
    requestStats: Record<string, number>;
  };
}

// エラー処理テスト実行関数のエクスポート
export async function runErrorHandlingTests(): Promise<TestSummary> {
  const tester = new ErrorHandlingTest();
  return await tester.runErrorHandlingTests();
}