/**
 * フォールバックシステムのテスト
 */

import { FallbackService } from '../src/services/FallbackService';
import { CircuitBreaker } from '../src/utils/CircuitBreaker';
import { CacheService } from '../src/services/CacheService';
import { IFallbackStage, FallbackResult } from '../src/interfaces/IFallbackService';

// モックステージの作成
class MockSuccessStage implements IFallbackStage {
  name = 'mock-success';
  priority = 1;
  timeout = 1000;
  retryCount = 0;

  async execute(input: any): Promise<FallbackResult> {
    return {
      success: true,
      data: { message: 'Success from mock stage', input },
      stage: this.name,
      duration: 10
    };
  }
}

class MockFailureStage implements IFallbackStage {
  name = 'mock-failure';
  priority = 2;
  timeout = 1000;
  retryCount = 0;
  failureCount = 0;

  async execute(input: any): Promise<FallbackResult> {
    this.failureCount++;
    throw new Error('Mock failure');
  }
}

class MockSlowStage implements IFallbackStage {
  name = 'mock-slow';
  priority = 3;
  timeout = 100;
  retryCount = 0;

  async execute(input: any): Promise<FallbackResult> {
    await new Promise(resolve => setTimeout(resolve, 200)); // タイムアウトを超える
    return {
      success: true,
      data: { message: 'Should timeout' },
      stage: this.name,
      duration: 200
    };
  }
}

describe('FallbackService', () => {
  let fallbackService: FallbackService;

  beforeEach(() => {
    // テスト用の設定
    const config = {
      stages: [
        new MockFailureStage(),
        new MockSlowStage(),
        new MockSuccessStage()
      ],
      circuitBreakerThreshold: 3,
      circuitBreakerTimeout: 1000,
      cacheConfig: {
        ttl: 60,
        maxSize: 100,
        strategy: 'LRU' as const
      },
      metrics: {
        enabled: true,
        sampleRate: 1.0,
        exportInterval: 0 // テストでは自動エクスポートを無効化
      }
    };

    fallbackService = new FallbackService(config);
  });

  afterEach(async () => {
    await fallbackService.shutdown();
  });

  test('正常なステージが成功を返す', async () => {
    const result = await fallbackService.execute({ test: 'data' });
    
    expect(result.success).toBe(true);
    expect(result.stage).toBe('mock-success');
    expect(result.data).toEqual({
      message: 'Success from mock stage',
      input: { test: 'data' }
    });
  });

  test('失敗ステージをスキップして次のステージに進む', async () => {
    const stages = [
      new MockFailureStage(),
      new MockSuccessStage()
    ];

    const service = new FallbackService({
      stages,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 1000,
      cacheConfig: { ttl: 60, maxSize: 100, strategy: 'LRU' },
      metrics: { enabled: true, sampleRate: 1.0, exportInterval: 0 }
    });

    const result = await service.execute({ test: 'data' });
    
    expect(result.success).toBe(true);
    expect(result.stage).toBe('mock-success');
    
    await service.shutdown();
  });

  test('キャッシュが機能する', async () => {
    const firstResult = await fallbackService.execute({ test: 'cache-test' });
    expect(firstResult.success).toBe(true);
    expect(firstResult.metadata?.cacheHit).toBeUndefined();

    // 同じ入力で再度実行
    const secondResult = await fallbackService.execute({ test: 'cache-test' });
    expect(secondResult.success).toBe(true);
    expect(secondResult.metadata?.cacheHit).toBe(true);
    expect(secondResult.stage).toBe('cache');
  });

  test('サーキットブレーカーが動作する', async () => {
    const failStage = new MockFailureStage();
    const service = new FallbackService({
      stages: [failStage, new MockSuccessStage()],
      circuitBreakerThreshold: 2, // 2回で開く
      circuitBreakerTimeout: 100,
      cacheConfig: { ttl: 60, maxSize: 100, strategy: 'LRU' },
      metrics: { enabled: true, sampleRate: 1.0, exportInterval: 0 }
    });

    // 複数回実行して失敗を記録
    await service.execute({ test: 1 });
    await service.execute({ test: 2 });
    
    expect(failStage.failureCount).toBe(2);

    // 次の実行ではスキップされるはず
    await service.execute({ test: 3 });
    expect(failStage.failureCount).toBe(2); // 増えていない

    await service.shutdown();
  });

  test('タイムアウトが機能する', async () => {
    const service = new FallbackService({
      stages: [new MockSlowStage(), new MockSuccessStage()],
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 1000,
      cacheConfig: { ttl: 60, maxSize: 100, strategy: 'LRU' },
      metrics: { enabled: true, sampleRate: 1.0, exportInterval: 0 }
    });

    const result = await service.execute({ test: 'timeout' });
    
    expect(result.success).toBe(true);
    expect(result.stage).toBe('mock-success'); // スローステージはタイムアウトでスキップ
    
    await service.shutdown();
  });

  test('すべてのステージが失敗した場合', async () => {
    const service = new FallbackService({
      stages: [new MockFailureStage()],
      circuitBreakerThreshold: 10,
      circuitBreakerTimeout: 1000,
      cacheConfig: { ttl: 60, maxSize: 100, strategy: 'LRU' },
      metrics: { enabled: true, sampleRate: 1.0, exportInterval: 0 }
    });

    const result = await service.execute({ test: 'all-fail' });
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.stage).toBe('none');
    
    await service.shutdown();
  });

  test('メトリクスが正しく記録される', async () => {
    await fallbackService.execute({ test: 1 });
    await fallbackService.execute({ test: 2 });
    
    const metrics = fallbackService.getMetrics();
    
    expect(metrics.totalRequests).toBe(2);
    expect(metrics.successfulRequests).toBe(2);
    expect(metrics.failedRequests).toBe(0);
  });

  test('ヘルスステータスが正しく報告される', async () => {
    const health = fallbackService.getHealthStatus();
    
    expect(health.overall).toBeDefined();
    expect(health.stages).toBeInstanceOf(Array);
    expect(health.stages.length).toBeGreaterThan(0);
    expect(health.lastCheck).toBeInstanceOf(Date);
  });
});

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      threshold: 3,
      timeout: 100,
      resetTimeout: 500,
      halfOpenRetries: 2
    });
  });

  test('閾値に達するとオープン状態になる', () => {
    expect(circuitBreaker.canExecute()).toBe(true);
    
    // 失敗を記録
    circuitBreaker.recordFailure();
    circuitBreaker.recordFailure();
    circuitBreaker.recordFailure();
    
    expect(circuitBreaker.getState().state).toBe('OPEN');
    expect(circuitBreaker.canExecute()).toBe(false);
  });

  test('リセットタイムアウト後にハーフオープン状態になる', async () => {
    // オープン状態にする
    circuitBreaker.recordFailure();
    circuitBreaker.recordFailure();
    circuitBreaker.recordFailure();
    
    expect(circuitBreaker.getState().state).toBe('OPEN');
    
    // タイムアウトを待つ
    await new Promise(resolve => setTimeout(resolve, 600));
    
    expect(circuitBreaker.canExecute()).toBe(true);
    expect(circuitBreaker.getState().state).toBe('HALF_OPEN');
  });

  test('ハーフオープン状態で成功するとクローズ状態に戻る', () => {
    // ハーフオープン状態を作る
    circuitBreaker.recordFailure();
    circuitBreaker.recordFailure();
    circuitBreaker.recordFailure();
    
    // 手動でハーフオープンに移行
    const state = circuitBreaker.getState();
    state.state = 'HALF_OPEN';
    
    // 成功を記録
    circuitBreaker.recordSuccess();
    circuitBreaker.recordSuccess();
    
    expect(circuitBreaker.getState().state).toBe('CLOSED');
  });
});

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    cacheService = new CacheService({
      ttl: 5, // 5秒
      maxSize: 3,
      strategy: 'LRU'
    });
  });

  afterEach(async () => {
    await cacheService.shutdown();
  });

  test('値を保存して取得できる', async () => {
    await cacheService.set('key1', { data: 'value1' });
    const value = await cacheService.get('key1');
    
    expect(value).toEqual({ data: 'value1' });
  });

  test('TTLが機能する', async () => {
    await cacheService.set('key1', { data: 'value1' });
    
    // TTL内では取得できる
    let value = await cacheService.get('key1');
    expect(value).toEqual({ data: 'value1' });
    
    // TTL後は取得できない
    await new Promise(resolve => setTimeout(resolve, 6000));
    value = await cacheService.get('key1');
    expect(value).toBeNull();
  });

  test('LRU evictionが機能する', async () => {
    // キャッシュサイズを超える数のアイテムを追加
    await cacheService.set('key1', 'value1');
    await cacheService.set('key2', 'value2');
    await cacheService.set('key3', 'value3');
    
    // key1にアクセスして最近使用にする
    await cacheService.get('key1');
    
    // 新しいアイテムを追加（key2が削除されるはず）
    await cacheService.set('key4', 'value4');
    
    expect(await cacheService.get('key1')).toBe('value1');
    expect(await cacheService.get('key2')).toBeNull(); // 削除された
    expect(await cacheService.get('key3')).toBe('value3');
    expect(await cacheService.get('key4')).toBe('value4');
  });
});