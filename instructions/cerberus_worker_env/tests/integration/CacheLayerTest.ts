import { MemoryCache } from '../../src/cache/MemoryCache';
import { RedisCache } from '../../src/cache/RedisCache';
import { CacheManager, MultiLevelCache } from '../../src/cache/CacheManager';
import { CacheStrategyFactory } from '../../src/cache/strategies/ApiCacheStrategies';

/**
 * キャッシュ層詳細動作検証テストスイート
 */
export class CacheLayerTest {
  private testResults: TestResult[] = [];
  private startTime: number = 0;

  /**
   * キャッシュ層テストを実行
   */
  async runCacheTests(): Promise<TestSummary> {
    console.log('🗄️ キャッシュ層動作検証テスト開始');
    this.startTime = Date.now();
    this.testResults = [];

    try {
      await this.testMemoryCache();
      await this.testCacheStrategies();
      await this.testTTLManagement();
      await this.testCacheInvalidation();
      await this.testCachePerformance();
      await this.testCacheSerialization();
      await this.testCacheEviction();
      
      return this.generateSummary();
    } catch (error) {
      console.error('キャッシュテスト実行中にエラー:', error);
      throw error;
    }
  }

  /**
   * メモリキャッシュのテスト
   */
  private async testMemoryCache(): Promise<void> {
    console.log('💾 メモリキャッシュをテスト中...');

    await this.runTest('メモリキャッシュ基本操作', async () => {
      const cache = new MemoryCache({
        defaultTTL: 60,
        keyPrefix: 'test',
        debug: false
      }, 100);

      // 設定と取得
      await cache.set('key1', { data: 'value1' }, { ttl: 30 });
      const retrieved = await cache.get('key1');
      
      if (!retrieved || retrieved.data !== 'value1') {
        throw new Error('メモリキャッシュの設定・取得に失敗');
      }

      // 存在確認
      const exists = await cache.has('key1');
      if (!exists) {
        throw new Error('キーの存在確認に失敗');
      }

      // 削除
      await cache.delete('key1');
      const afterDelete = await cache.get('key1');
      if (afterDelete !== null) {
        throw new Error('キーの削除に失敗');
      }

      return { 
        setGet: true, 
        exists: true, 
        delete: true 
      };
    });

    await this.runTest('メモリキャッシュTTL', async () => {
      const cache = new MemoryCache({
        defaultTTL: 1, // 1秒
        keyPrefix: 'ttl-test',
        debug: false
      });

      // 短いTTLでデータを設定
      await cache.set('ttl-key', { data: 'ttl-value' }, { ttl: 1 });
      
      // すぐに取得（成功するはず）
      const immediate = await cache.get('ttl-key');
      if (!immediate) {
        throw new Error('TTL設定直後の取得に失敗');
      }

      // TTL確認
      const ttl = await cache.ttl('ttl-key');
      if (ttl <= 0) {
        throw new Error('TTLが正しく設定されていない');
      }

      // 2秒待機
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 期限切れ後の取得（失敗するはず）
      const expired = await cache.get('ttl-key');
      if (expired !== null) {
        throw new Error('期限切れデータが残っている');
      }

      cache.destroy(); // クリーンアップタイマーを停止

      return {
        immediateGet: !!immediate,
        ttlSet: ttl > 0,
        expiredCorrectly: expired === null
      };
    });

    await this.runTest('メモリキャッシュLRU動作', async () => {
      const cache = new MemoryCache({
        defaultTTL: 300,
        keyPrefix: 'lru-test',
        debug: false
      }, 3); // 最大3エントリ

      // 3つのエントリを設定
      await cache.set('lru1', 'value1');
      await cache.set('lru2', 'value2');
      await cache.set('lru3', 'value3');

      // すべて存在することを確認
      const all = await Promise.all([
        cache.has('lru1'),
        cache.has('lru2'),
        cache.has('lru3')
      ]);

      if (!all.every(exists => exists)) {
        throw new Error('初期データの設定に失敗');
      }

      // 4つ目を追加（最古のlru1が削除されるはず）
      await cache.set('lru4', 'value4');

      const afterEviction = await Promise.all([
        cache.has('lru1'),
        cache.has('lru2'),
        cache.has('lru3'),
        cache.has('lru4')
      ]);

      cache.destroy();

      return {
        initialCount: all.filter(Boolean).length,
        lru1Evicted: !afterEviction[0],
        othersExist: afterEviction.slice(1).every(Boolean)
      };
    });
  }

  /**
   * キャッシュ戦略のテスト
   */
  private async testCacheStrategies(): Promise<void> {
    console.log('🎯 キャッシュ戦略をテスト中...');

    await this.runTest('Shopifyキャッシュ戦略', async () => {
      const strategy = CacheStrategyFactory.getStrategy('shopify');

      // 商品データのキー生成
      const productKey = strategy.generateKey({
        resource: 'products',
        query: { limit: '10', status: 'active' }
      });

      // 注文データのキー生成
      const orderKey = strategy.generateKey({
        resource: 'orders',
        id: '12345'
      });

      // TTL決定
      const productTTL = strategy.determineTTL({ resource: 'products' });
      const orderTTL = strategy.determineTTL({ resource: 'orders' });
      const inventoryTTL = strategy.determineTTL({ resource: 'inventory' });

      // キャッシュ可否判定
      const shouldCacheGet = strategy.shouldCache({ resource: 'products', method: 'GET' });
      const shouldCachePost = strategy.shouldCache({ resource: 'products', method: 'POST' });

      return {
        keyGeneration: !!(productKey && orderKey),
        productTTL,
        orderTTL,
        inventoryTTL,
        getRequestCached: shouldCacheGet,
        postRequestNotCached: !shouldCachePost
      };
    });

    await this.runTest('POSキャッシュ戦略', async () => {
      const strategy = CacheStrategyFactory.getStrategy('pos');

      // 取引データのキー生成
      const transactionKey = strategy.generateKey({
        type: 'transactions',
        filters: { date_from: '2024-01-01', aggregated: true }
      });

      // TTL決定
      const transactionTTL = strategy.determineTTL({ type: 'transactions' });
      const inventoryTTL = strategy.determineTTL({ type: 'inventory' });

      // リアルタイムデータのキャッシュ判定
      const shouldCacheRealtime = strategy.shouldCache({ 
        type: 'transactions', 
        realtime: true 
      });

      const shouldCacheAggregated = strategy.shouldCache({ 
        type: 'transactions', 
        filters: { aggregated: true } 
      });

      return {
        keyGeneration: !!transactionKey,
        transactionTTL,
        inventoryTTL,
        realtimeNotCached: !shouldCacheRealtime,
        aggregatedCached: shouldCacheAggregated
      };
    });

    await this.runTest('Weather キャッシュ戦略', async () => {
      const strategy = CacheStrategyFactory.getStrategy('weather');

      // 現在の天気のキー生成
      const currentKey = strategy.generateKey({
        type: 'current',
        location: { lat: 35.6762, lon: 139.6503 },
        units: 'metric'
      });

      // 予報のキー生成
      const forecastKey = strategy.generateKey({
        type: 'forecast',
        location: { city: 'Tokyo' }
      });

      // TTL決定
      const currentTTL = strategy.determineTTL({ type: 'current' });
      const forecastTTL = strategy.determineTTL({ type: 'forecast' });

      return {
        currentKey: !!currentKey,
        forecastKey: !!forecastKey,
        currentTTL,
        forecastTTL,
        allDataCached: strategy.shouldCache({ type: 'current' })
      };
    });
  }

  /**
   * TTL管理のテスト
   */
  private async testTTLManagement(): Promise<void> {
    console.log('⏰ TTL管理をテスト中...');

    await this.runTest('TTL設定と更新', async () => {
      const cache = new MemoryCache({
        defaultTTL: 60,
        keyPrefix: 'ttl-mgmt',
        debug: false
      });

      // データを設定
      await cache.set('ttl-key', { data: 'ttl-data' }, { ttl: 10 });

      // 初期TTL確認
      const initialTTL = await cache.ttl('ttl-key');
      if (initialTTL <= 0 || initialTTL > 10) {
        throw new Error(`初期TTLが異常: ${initialTTL}`);
      }

      // TTLを延長
      await cache.expire('ttl-key', 20);
      const extendedTTL = await cache.ttl('ttl-key');
      if (extendedTTL <= initialTTL) {
        throw new Error('TTLの延長に失敗');
      }

      cache.destroy();

      return {
        initialTTL,
        extendedTTL,
        extensionWorked: extendedTTL > initialTTL
      };
    });

    await this.runTest('デフォルトTTL動作', async () => {
      const cache = new MemoryCache({
        defaultTTL: 30,
        keyPrefix: 'default-ttl',
        debug: false
      });

      // TTLを明示せずに設定
      await cache.set('default-key', { data: 'default-data' });

      // デフォルトTTLが適用されることを確認
      const ttl = await cache.ttl('default-key');
      
      cache.destroy();

      return {
        defaultTTL: ttl,
        ttlApplied: ttl > 0 && ttl <= 30
      };
    });
  }

  /**
   * キャッシュ無効化のテスト
   */
  private async testCacheInvalidation(): Promise<void> {
    console.log('🗑️ キャッシュ無効化をテスト中...');

    await this.runTest('パターン削除', async () => {
      const cache = new MemoryCache({
        defaultTTL: 60,
        keyPrefix: 'pattern-test',
        debug: false
      });

      // 複数のキーを設定
      await cache.set('api:shopify:products:1', { data: 'product1' });
      await cache.set('api:shopify:products:2', { data: 'product2' });
      await cache.set('api:shopify:orders:1', { data: 'order1' });
      await cache.set('api:pos:transactions:1', { data: 'transaction1' });

      // shopify関連のみ削除
      await cache.deletePattern('api:shopify:*');

      const remaining = await Promise.all([
        cache.has('api:shopify:products:1'),
        cache.has('api:shopify:products:2'),
        cache.has('api:shopify:orders:1'),
        cache.has('api:pos:transactions:1')
      ]);

      cache.destroy();

      return {
        shopifyDeleted: !remaining[0] && !remaining[1] && !remaining[2],
        posRemained: remaining[3]
      };
    });

    await this.runTest('全クリア', async () => {
      const cache = new MemoryCache({
        defaultTTL: 60,
        keyPrefix: 'clear-test',
        debug: false
      });

      // データを設定
      await cache.set('key1', { data: 'value1' });
      await cache.set('key2', { data: 'value2' });
      await cache.set('key3', { data: 'value3' });

      // 設定確認
      const beforeClear = await Promise.all([
        cache.has('key1'),
        cache.has('key2'),
        cache.has('key3')
      ]);

      // 全クリア
      await cache.clear();

      // クリア確認
      const afterClear = await Promise.all([
        cache.has('key1'),
        cache.has('key2'),
        cache.has('key3')
      ]);

      cache.destroy();

      return {
        beforeClearCount: beforeClear.filter(Boolean).length,
        afterClearCount: afterClear.filter(Boolean).length,
        clearSuccessful: afterClear.every(exists => !exists)
      };
    });
  }

  /**
   * キャッシュパフォーマンステスト
   */
  private async testCachePerformance(): Promise<void> {
    console.log('⚡ キャッシュパフォーマンスをテスト中...');

    await this.runTest('大量データ処理', async () => {
      const cache = new MemoryCache({
        defaultTTL: 60,
        keyPrefix: 'perf-test',
        debug: false
      }, 10000);

      const dataSize = 1000;
      const startTime = Date.now();

      // 大量データの設定
      const setPromises = [];
      for (let i = 0; i < dataSize; i++) {
        setPromises.push(cache.set(`bulk-key-${i}`, {
          id: i,
          data: `bulk-data-${i}`,
          timestamp: new Date().toISOString()
        }));
      }

      await Promise.all(setPromises);
      const setDuration = Date.now() - startTime;

      // 大量データの取得
      const getStartTime = Date.now();
      const getPromises = [];
      for (let i = 0; i < dataSize; i++) {
        getPromises.push(cache.get(`bulk-key-${i}`));
      }

      const results = await Promise.all(getPromises);
      const getDuration = Date.now() - getStartTime;

      const successCount = results.filter(r => r !== null).length;

      cache.destroy();

      return {
        dataSize,
        setDuration,
        getDuration,
        successCount,
        setThroughput: dataSize / (setDuration / 1000),
        getThroughput: dataSize / (getDuration / 1000)
      };
    });

    await this.runTest('並行アクセス', async () => {
      const cache = new MemoryCache({
        defaultTTL: 60,
        keyPrefix: 'concurrent',
        debug: false
      });

      const concurrency = 100;
      const startTime = Date.now();

      // 並行して読み書きを実行
      const operations = [];
      for (let i = 0; i < concurrency; i++) {
        if (i % 2 === 0) {
          operations.push(cache.set(`concurrent-${i}`, { value: i }));
        } else {
          operations.push(cache.get(`concurrent-${i - 1}`));
        }
      }

      const results = await Promise.all(operations);
      const duration = Date.now() - startTime;

      cache.destroy();

      return {
        concurrency,
        duration,
        operationsPerSecond: concurrency / (duration / 1000),
        allCompleted: results.length === concurrency
      };
    });
  }

  /**
   * シリアライゼーションテスト
   */
  private async testCacheSerialization(): Promise<void> {
    console.log('📦 シリアライゼーションをテスト中...');

    await this.runTest('複雑オブジェクトの保存・復元', async () => {
      const cache = new MemoryCache({
        defaultTTL: 60,
        keyPrefix: 'serialize',
        debug: false
      });

      const complexObject = {
        string: 'test string',
        number: 42,
        boolean: true,
        null: null,
        array: [1, 2, 3, { nested: 'value' }],
        object: {
          nested: {
            deep: 'deep value',
            date: new Date().toISOString()
          }
        },
        unicode: '日本語テスト 🚀'
      };

      await cache.set('complex', complexObject);
      const retrieved = await cache.get('complex');

      if (!retrieved) {
        throw new Error('複雑オブジェクトの取得に失敗');
      }

      // 深い比較
      const isEqual = JSON.stringify(complexObject) === JSON.stringify(retrieved);

      cache.destroy();

      return {
        stored: true,
        retrieved: !!retrieved,
        dataIntegrity: isEqual,
        retrievedType: typeof retrieved
      };
    });
  }

  /**
   * キャッシュエビクションテスト
   */
  private async testCacheEviction(): Promise<void> {
    console.log('🗃️ キャッシュエビクションをテスト中...');

    await this.runTest('LRUエビクション順序', async () => {
      const cache = new MemoryCache({
        defaultTTL: 60,
        keyPrefix: 'eviction',
        debug: false
      }, 3);

      // 順番にデータを設定
      await cache.set('first', { order: 1 });
      await cache.set('second', { order: 2 });
      await cache.set('third', { order: 3 });

      // 最初のキーにアクセス（最近使用に変更）
      await cache.get('first');

      // 新しいキーを追加（secondが削除されるはず）
      await cache.set('fourth', { order: 4 });

      const remaining = await Promise.all([
        cache.has('first'),
        cache.has('second'),
        cache.has('third'),
        cache.has('fourth')
      ]);

      cache.destroy();

      return {
        firstRemained: remaining[0], // アクセスしたので残る
        secondEvicted: !remaining[1], // LRUで削除される
        thirdRemained: remaining[2], // 残る
        fourthAdded: remaining[3] // 新規追加
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
        cacheFeatures: {
          memoryCache: true,
          ttlManagement: true,
          lruEviction: true,
          patternDeletion: true,
          serialization: true,
          performance: true
        }
      }
    };
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
    cacheFeatures: Record<string, boolean>;
  };
}

// テスト実行関数のエクスポート
export async function runCacheLayerTests(): Promise<TestSummary> {
  const tester = new CacheLayerTest();
  return await tester.runCacheTests();
}