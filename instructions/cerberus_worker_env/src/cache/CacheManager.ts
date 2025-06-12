import { ICache, CacheConfig } from '../interfaces/ICache';
import { RedisCache } from './RedisCache';
import { MemoryCache } from './MemoryCache';

/**
 * キャッシュマネージャー
 * 複数のキャッシュプロバイダーを管理し、フォールバック機能を提供
 */
export class CacheManager {
  private primaryCache?: ICache;
  private fallbackCache?: ICache;
  private config: CacheManagerConfig;

  constructor(config: CacheManagerConfig) {
    this.config = config;
  }

  /**
   * キャッシュマネージャーの初期化
   */
  async initialize(): Promise<void> {
    // プライマリキャッシュの設定
    if (this.config.redis) {
      try {
        const redisClient = await this.createRedisClient(this.config.redis);
        this.primaryCache = new RedisCache(redisClient, this.config.cacheConfig);
        console.log('Redis cache initialized as primary');
      } catch (error) {
        console.error('Failed to initialize Redis cache:', error);
      }
    }

    // フォールバックキャッシュの設定（メモリ）
    if (this.config.enableMemoryFallback) {
      this.fallbackCache = new MemoryCache(
        this.config.cacheConfig,
        this.config.memoryMaxEntries
      );
      console.log('Memory cache initialized as fallback');
    }

    // どちらも初期化できなかった場合はメモリキャッシュを使用
    if (!this.primaryCache && !this.fallbackCache) {
      this.primaryCache = new MemoryCache(this.config.cacheConfig);
      console.log('Memory cache initialized as primary (default)');
    }
  }

  /**
   * アクティブなキャッシュを取得
   */
  getCache(): ICache | null {
    return this.primaryCache || this.fallbackCache || null;
  }

  /**
   * マルチレベルキャッシュを取得
   */
  getMultiLevelCache(): MultiLevelCache {
    return new MultiLevelCache(this.primaryCache, this.fallbackCache);
  }

  /**
   * Redisクライアントの作成（簡易実装）
   */
  private async createRedisClient(config: RedisConfig): Promise<any> {
    // 実際の実装ではredisパッケージを使用
    const mockRedisClient = {
      connected: true,
      setex: async (key: string, ttl: number, value: string) => 'OK',
      set: async (key: string, value: string) => 'OK',
      get: async (key: string) => null,
      exists: async (key: string) => 0,
      del: async (...keys: string[]) => keys.length,
      scan: async (cursor: string, ...args: any[]) => ['0', []],
      ttl: async (key: string) => -1,
      expire: async (key: string, ttl: number) => 1,
      info: async (section: string) => '',
      flushdb: async () => 'OK',
      sadd: async (key: string, ...members: string[]) => members.length,
      smembers: async (key: string) => []
    };

    return mockRedisClient;
  }
}

/**
 * マルチレベルキャッシュ
 * 複数のキャッシュ層を透過的に扱う
 */
export class MultiLevelCache implements ICache {
  private caches: ICache[];

  constructor(...caches: (ICache | undefined)[]) {
    this.caches = caches.filter((cache): cache is ICache => cache !== undefined);
  }

  /**
   * 値を設定（すべてのキャッシュに書き込み）
   */
  async set<T>(key: string, value: T, options?: any): Promise<void> {
    const promises = this.caches.map(cache => cache.set(key, value, options));
    await Promise.all(promises);
  }

  /**
   * 値を取得（最初にヒットしたキャッシュから）
   */
  async get<T>(key: string): Promise<T | null> {
    for (let i = 0; i < this.caches.length; i++) {
      const value = await this.caches[i].get<T>(key);
      if (value !== null) {
        // 上位キャッシュにも保存
        for (let j = 0; j < i; j++) {
          await this.caches[j].set(key, value);
        }
        return value;
      }
    }
    return null;
  }

  /**
   * 存在確認
   */
  async has(key: string): Promise<boolean> {
    for (const cache of this.caches) {
      if (await cache.has(key)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 削除（すべてのキャッシュから）
   */
  async delete(key: string): Promise<void> {
    const promises = this.caches.map(cache => cache.delete(key));
    await Promise.all(promises);
  }

  /**
   * パターン削除
   */
  async deletePattern(pattern: string): Promise<void> {
    const promises = this.caches.map(cache => cache.deletePattern(pattern));
    await Promise.all(promises);
  }

  /**
   * クリア
   */
  async clear(): Promise<void> {
    const promises = this.caches.map(cache => cache.clear());
    await Promise.all(promises);
  }

  /**
   * TTL取得（最初のキャッシュから）
   */
  async ttl(key: string): Promise<number> {
    for (const cache of this.caches) {
      const ttl = await cache.ttl(key);
      if (ttl > -1) return ttl;
    }
    return -1;
  }

  /**
   * TTL設定
   */
  async expire(key: string, ttl: number): Promise<void> {
    const promises = this.caches.map(cache => cache.expire(key, ttl));
    await Promise.all(promises);
  }

  /**
   * 統計取得（すべてのキャッシュから集計）
   */
  async getStats(): Promise<any> {
    const allStats = await Promise.all(
      this.caches.map(cache => cache.getStats())
    );

    // 統計を集計
    return allStats.reduce((combined, stats, index) => {
      combined[`cache_${index}`] = stats;
      combined.total_hits = (combined.total_hits || 0) + stats.hits;
      combined.total_misses = (combined.total_misses || 0) + stats.misses;
      return combined;
    }, {});
  }
}

/**
 * キャッシュマネージャー設定
 */
export interface CacheManagerConfig {
  /**
   * キャッシュ設定
   */
  cacheConfig: CacheConfig;

  /**
   * Redis設定
   */
  redis?: RedisConfig;

  /**
   * メモリキャッシュをフォールバックとして有効にするか
   */
  enableMemoryFallback?: boolean;

  /**
   * メモリキャッシュの最大エントリ数
   */
  memoryMaxEntries?: number;
}

/**
 * Redis設定
 */
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}