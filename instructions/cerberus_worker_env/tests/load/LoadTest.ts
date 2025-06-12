import { apiManager } from '../../src';
import { mockApiServer } from '../mock-apis/MockApiServer';

/**
 * 負荷テストスイート
 * システムの処理能力、スループット、レスポンス時間を測定
 */
export class LoadTest {
  private testResults: LoadTestResult[] = [];
  private startTime: number = 0;

  /**
   * 負荷テストを実行
   */
  async runLoadTests(): Promise<LoadTestSummary> {
    console.log('🚀 負荷テスト開始');
    this.startTime = Date.now();
    this.testResults = [];

    try {
      await this.setupLoadTestEnvironment();
      
      // 各負荷テストシナリオを実行
      await this.testConcurrentRequests();
      await this.testHighVolumeRequests();
      await this.testCacheUnderLoad();
      await this.testMemoryPressure();
      await this.testSustainedLoad();
      await this.testSpikePressure();
      
      return this.generateLoadSummary();
    } catch (error) {
      console.error('負荷テスト実行中にエラー:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * 負荷テスト環境のセットアップ
   */
  private async setupLoadTestEnvironment(): Promise<void> {
    console.log('📋 負荷テスト環境をセットアップ中...');

    // モックAPIサーバーの設定
    mockApiServer.setResponseDelay(10); // 高速レスポンス
    mockApiServer.setErrorRate(0.01); // 1%エラー率
    mockApiServer.resetRequestCount();

    // APIマネージャーの初期化
    await apiManager.initialize({
      shopify: {
        shopDomain: 'load-test.myshopify.com',
        accessToken: 'load-test-token',
        apiVersion: '2023-10'
      },
      pos: {
        endpoint: 'https://load-test-pos-api.com',
        apiKey: 'load-test-key',
        secretKey: 'load-test-secret'
      },
      analytics: {
        endpoint: 'https://load-test-analytics-api.com',
        apiKey: 'load-test-key',
        projectId: 'load-test-project'
      },
      weather: {
        endpoint: 'https://load-test-weather-api.com',
        apiKey: 'load-test-key'
      },
      cache: {
        cacheConfig: {
          defaultTTL: 300,
          keyPrefix: 'load-test',
          debug: false // デバッグログを無効化
        },
        enableMemoryFallback: true,
        memoryMaxEntries: 10000
      }
    });

    this.setupLoadTestFetchMock();
  }

  /**
   * 負荷テスト用fetchモック
   */
  private setupLoadTestFetchMock(): void {
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
          mockResponse = { data: 'Load test mock response' };
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
   * 並行リクエストテスト
   */
  private async testConcurrentRequests(): Promise<void> {
    console.log('⚡ 並行リクエストテスト実行中...');

    const concurrencyLevels = [10, 50, 100, 200];

    for (const concurrency of concurrencyLevels) {
      await this.runLoadTest(`並行リクエスト (${concurrency}並行)`, async () => {
        const startTime = Date.now();
        const promises: Promise<any>[] = [];

        // 指定された並行数でリクエストを実行
        for (let i = 0; i < concurrency; i++) {
          promises.push(
            apiManager.fetchShopifyData({
              resource: 'products',
              query: { limit: '10', page: (i + 1).toString() }
            })
          );
        }

        const responses = await Promise.all(promises);
        const duration = Date.now() - startTime;

        const successCount = responses.filter(r => r.success).length;
        const errorCount = responses.filter(r => !r.success).length;

        return {
          concurrency,
          duration,
          successCount,
          errorCount,
          successRate: (successCount / concurrency) * 100,
          throughput: concurrency / (duration / 1000),
          avgResponseTime: duration / concurrency
        };
      });
    }
  }

  /**
   * 大量リクエストテスト
   */
  private async testHighVolumeRequests(): Promise<void> {
    console.log('📊 大量リクエストテスト実行中...');

    await this.runLoadTest('大量リクエスト (1000件)', async () => {
      const totalRequests = 1000;
      const batchSize = 50;
      const startTime = Date.now();

      let totalSuccess = 0;
      let totalErrors = 0;
      const responseTimes: number[] = [];

      // バッチ処理で実行
      for (let i = 0; i < totalRequests; i += batchSize) {
        const batchPromises: Promise<any>[] = [];
        
        for (let j = 0; j < batchSize && (i + j) < totalRequests; j++) {
          const requestStart = Date.now();
          
          batchPromises.push(
            apiManager.fetchShopifyData({
              resource: 'products',
              query: { limit: '5', offset: (i + j).toString() }
            }).then(response => {
              const responseTime = Date.now() - requestStart;
              responseTimes.push(responseTime);
              
              if (response.success) {
                totalSuccess++;
              } else {
                totalErrors++;
              }
              
              return response;
            })
          );
        }

        await Promise.all(batchPromises);
      }

      const totalDuration = Date.now() - startTime;

      // 統計計算
      responseTimes.sort((a, b) => a - b);
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const p50 = responseTimes[Math.floor(responseTimes.length * 0.5)];
      const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)];
      const p99 = responseTimes[Math.floor(responseTimes.length * 0.99)];

      return {
        totalRequests,
        totalSuccess,
        totalErrors,
        totalDuration,
        throughput: totalRequests / (totalDuration / 1000),
        avgResponseTime,
        p50ResponseTime: p50,
        p95ResponseTime: p95,
        p99ResponseTime: p99,
        successRate: (totalSuccess / totalRequests) * 100
      };
    });
  }

  /**
   * キャッシュ負荷テスト
   */
  private async testCacheUnderLoad(): Promise<void> {
    console.log('💾 キャッシュ負荷テスト実行中...');

    await this.runLoadTest('キャッシュヒット率負荷テスト', async () => {
      await apiManager.clearCache();
      
      const cacheKeys = 100; // 100種類のキー
      const requestsPerKey = 10; // 各キーに10回アクセス
      const totalRequests = cacheKeys * requestsPerKey;

      const startTime = Date.now();
      const promises: Promise<any>[] = [];

      // 各キーに複数回アクセス
      for (let keyIndex = 0; keyIndex < cacheKeys; keyIndex++) {
        for (let requestIndex = 0; requestIndex < requestsPerKey; requestIndex++) {
          promises.push(
            apiManager.fetchShopifyData({
              resource: 'products',
              query: { 
                category: `category-${keyIndex}`,
                limit: '5'
              }
            })
          );
        }
      }

      // ランダムに並び替えて実行
      const shuffledPromises = promises.sort(() => Math.random() - 0.5);
      const responses = await Promise.all(shuffledPromises);
      
      const duration = Date.now() - startTime;
      const cacheStats = await apiManager.getCacheStats();

      const successCount = responses.filter(r => r.success).length;
      const cachedCount = responses.filter(r => r.metadata?.cached).length;

      return {
        totalRequests,
        uniqueKeys: cacheKeys,
        requestsPerKey,
        duration,
        successCount,
        cachedCount,
        cacheHitRate: (cachedCount / totalRequests) * 100,
        throughput: totalRequests / (duration / 1000),
        cacheStats: cacheStats.global
      };
    });
  }

  /**
   * メモリプレッシャーテスト
   */
  private async testMemoryPressure(): Promise<void> {
    console.log('🧠 メモリプレッシャーテスト実行中...');

    await this.runLoadTest('メモリプレッシャーテスト', async () => {
      await apiManager.clearCache();

      const largeDataSize = 1000; // 1000個の大きなオブジェクト
      const startTime = Date.now();
      
      const promises: Promise<any>[] = [];

      // 大きなデータオブジェクトを生成・キャッシュ
      for (let i = 0; i < largeDataSize; i++) {
        promises.push(
          apiManager.fetchShopifyData({
            resource: 'products',
            query: { 
              bulk_id: i.toString(),
              include_details: 'true',
              expand: 'variants,images,metafields'
            }
          })
        );
      }

      const responses = await Promise.all(promises);
      const setupDuration = Date.now() - startTime;

      // メモリ使用量チェック（近似）
      const cacheStats = await apiManager.getCacheStats();

      // 追加の読み取りテスト
      const readStartTime = Date.now();
      const readPromises = [];
      
      for (let i = 0; i < largeDataSize; i++) {
        readPromises.push(
          apiManager.fetchShopifyData({
            resource: 'products',
            query: { 
              bulk_id: i.toString(),
              include_details: 'true',
              expand: 'variants,images,metafields'
            }
          })
        );
      }

      const readResponses = await Promise.all(readPromises);
      const readDuration = Date.now() - readStartTime;

      const successCount = responses.filter(r => r.success).length;
      const cachedReadCount = readResponses.filter(r => r.metadata?.cached).length;

      return {
        largeDataSize,
        setupDuration,
        readDuration,
        successCount,
        cachedReadCount,
        memoryEfficiency: cachedReadCount / largeDataSize,
        setupThroughput: largeDataSize / (setupDuration / 1000),
        readThroughput: largeDataSize / (readDuration / 1000),
        cacheSize: cacheStats.global?.size || 0
      };
    });
  }

  /**
   * 持続負荷テスト
   */
  private async testSustainedLoad(): Promise<void> {
    console.log('🔄 持続負荷テスト実行中...');

    await this.runLoadTest('持続負荷テスト (30秒)', async () => {
      const testDuration = 30000; // 30秒
      const requestInterval = 100; // 100ms間隔
      const startTime = Date.now();

      let requestCount = 0;
      let successCount = 0;
      let errorCount = 0;
      const responseTimes: number[] = [];

      // 30秒間継続的にリクエスト
      while ((Date.now() - startTime) < testDuration) {
        const requestStart = Date.now();
        
        try {
          const response = await apiManager.fetchShopifyData({
            resource: 'products',
            query: { 
              timestamp: Date.now().toString(),
              limit: '3'
            }
          });

          const responseTime = Date.now() - requestStart;
          responseTimes.push(responseTime);
          requestCount++;

          if (response.success) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          errorCount++;
          requestCount++;
        }

        // 次のリクエストまで待機
        const elapsed = Date.now() - requestStart;
        if (elapsed < requestInterval) {
          await new Promise(resolve => setTimeout(resolve, requestInterval - elapsed));
        }
      }

      const actualDuration = Date.now() - startTime;
      
      // 統計計算
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const cacheStats = await apiManager.getCacheStats();

      return {
        plannedDuration: testDuration,
        actualDuration,
        requestCount,
        successCount,
        errorCount,
        successRate: (successCount / requestCount) * 100,
        throughput: requestCount / (actualDuration / 1000),
        avgResponseTime,
        cacheHitRate: cacheStats.global?.hitRate || 0
      };
    });
  }

  /**
   * スパイク負荷テスト
   */
  private async testSpikePressure(): Promise<void> {
    console.log('📈 スパイク負荷テスト実行中...');

    await this.runLoadTest('スパイク負荷テスト', async () => {
      // 通常負荷フェーズ
      const normalLoadRequests = 20;
      const normalStartTime = Date.now();
      
      const normalPromises = [];
      for (let i = 0; i < normalLoadRequests; i++) {
        normalPromises.push(
          apiManager.fetchShopifyData({
            resource: 'products',
            query: { phase: 'normal', index: i.toString() }
          })
        );
      }

      await Promise.all(normalPromises);
      const normalDuration = Date.now() - normalStartTime;

      // スパイク負荷フェーズ
      const spikeLoadRequests = 200;
      const spikeStartTime = Date.now();
      
      const spikePromises = [];
      for (let i = 0; i < spikeLoadRequests; i++) {
        spikePromises.push(
          apiManager.fetchShopifyData({
            resource: 'products',
            query: { phase: 'spike', index: i.toString() }
          })
        );
      }

      const spikeResponses = await Promise.all(spikePromises);
      const spikeDuration = Date.now() - spikeStartTime;

      // 回復フェーズ
      const recoveryLoadRequests = 20;
      const recoveryStartTime = Date.now();
      
      const recoveryPromises = [];
      for (let i = 0; i < recoveryLoadRequests; i++) {
        recoveryPromises.push(
          apiManager.fetchShopifyData({
            resource: 'products',
            query: { phase: 'recovery', index: i.toString() }
          })
        );
      }

      await Promise.all(recoveryPromises);
      const recoveryDuration = Date.now() - recoveryStartTime;

      const spikeSuccessCount = spikeResponses.filter(r => r.success).length;

      return {
        normalPhase: {
          requests: normalLoadRequests,
          duration: normalDuration,
          throughput: normalLoadRequests / (normalDuration / 1000)
        },
        spikePhase: {
          requests: spikeLoadRequests,
          duration: spikeDuration,
          successCount: spikeSuccessCount,
          successRate: (spikeSuccessCount / spikeLoadRequests) * 100,
          throughput: spikeLoadRequests / (spikeDuration / 1000)
        },
        recoveryPhase: {
          requests: recoveryLoadRequests,
          duration: recoveryDuration,
          throughput: recoveryLoadRequests / (recoveryDuration / 1000)
        },
        spikeMultiplier: spikeLoadRequests / normalLoadRequests
      };
    });
  }

  /**
   * 個別負荷テストの実行
   */
  private async runLoadTest(name: string, testFn: () => Promise<any>): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(`  📊 実行中: ${name}`);
      const result = await testFn();
      const duration = Date.now() - startTime;
      
      this.testResults.push({
        name,
        status: 'PASS',
        duration,
        result
      });
      
      console.log(`  ✅ ${name} - ${duration}ms`);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      this.testResults.push({
        name,
        status: 'FAIL',
        duration,
        error: error.message
      });
      
      console.log(`  ❌ ${name} - ${error.message} (${duration}ms)`);
    }
  }

  /**
   * 負荷テスト結果のサマリー生成
   */
  private generateLoadSummary(): LoadTestSummary {
    const totalDuration = Date.now() - this.startTime;
    const passCount = this.testResults.filter(r => r.status === 'PASS').length;
    const failCount = this.testResults.filter(r => r.status === 'FAIL').length;
    
    // パフォーマンス統計の計算
    const throughputs = this.testResults
      .filter(r => r.result?.throughput)
      .map(r => r.result.throughput);
    
    const responseTimes = this.testResults
      .filter(r => r.result?.avgResponseTime)
      .map(r => r.result.avgResponseTime);

    return {
      totalTests: this.testResults.length,
      passCount,
      failCount,
      successRate: (passCount / this.testResults.length) * 100,
      totalDuration,
      results: this.testResults,
      performanceMetrics: {
        maxThroughput: Math.max(...throughputs),
        avgThroughput: throughputs.reduce((a, b) => a + b, 0) / throughputs.length,
        minResponseTime: Math.min(...responseTimes),
        maxResponseTime: Math.max(...responseTimes),
        avgResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      },
      summary: {
        requestStats: mockApiServer.getRequestStats(),
        loadTestCompleted: true
      }
    };
  }

  /**
   * クリーンアップ
   */
  private async cleanup(): Promise<void> {
    console.log('🧹 負荷テスト環境をクリーンアップ中...');
    
    try {
      await apiManager.disconnectAll();
      mockApiServer.resetRequestCount();
    } catch (error) {
      console.error('負荷テストクリーンアップエラー:', error);
    }
  }
}

/**
 * 負荷テスト結果の型定義
 */
interface LoadTestResult {
  name: string;
  status: 'PASS' | 'FAIL';
  duration: number;
  result?: any;
  error?: string;
}

interface LoadTestSummary {
  totalTests: number;
  passCount: number;
  failCount: number;
  successRate: number;
  totalDuration: number;
  results: LoadTestResult[];
  performanceMetrics: {
    maxThroughput: number;
    avgThroughput: number;
    minResponseTime: number;
    maxResponseTime: number;
    avgResponseTime: number;
  };
  summary: {
    requestStats: Record<string, number>;
    loadTestCompleted: boolean;
  };
}

// 負荷テスト実行関数のエクスポート
export async function runLoadTests(): Promise<LoadTestSummary> {
  const tester = new LoadTest();
  return await tester.runLoadTests();
}