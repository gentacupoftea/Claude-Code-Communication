import { ICache, CacheSetOptions, CacheStats, CacheConfig } from '../interfaces/ICache';

/**
 * メモリキャッシュエントリ
 */
interface CacheEntry<T> {
  value: T;
  expireAt?: number;
  tags?: string[];
}

/**
 * メモリキャッシュプロバイダー
 * インメモリでのICache実装（LRU方式）
 */
export class MemoryCache implements ICache {
  private cache: Map<string, CacheEntry<any>>;
  private stats: CacheStats;
  private config: CacheConfig;
  private accessOrder: string[];
  private maxEntries: number;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: CacheConfig, maxEntries: number = 10000) {
    this.cache = new Map();
    this.config = config;
    this.maxEntries = maxEntries;
    this.accessOrder = [];
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      size: 0,
      hitRate: 0
    };

    // 定期的な期限切れエントリのクリーンアップ
    this.startCleanupTimer();
  }

  /**
   * キャッシュに値を設定
   */
  async set<T>(key: string, value: T, options?: CacheSetOptions): Promise<void> {
    const fullKey = this.buildKey(key);
    const ttl = options?.ttl || this.config.defaultTTL;
    
    const entry: CacheEntry<T> = {
      value: this.deepClone(value), // ディープコピーで参照を切る
      expireAt: ttl > 0 ? Date.now() + (ttl * 1000) : undefined,
      tags: options?.tags
    };

    // LRU: 既存のキーがある場合は削除
    if (this.cache.has(fullKey)) {
      this.removeFromAccessOrder(fullKey);
    }

    // 最大エントリ数を超える場合は最も古いものを削除
    if (this.cache.size >= this.maxEntries) {
      this.evictLRU();
    }

    this.cache.set(fullKey, entry);
    this.accessOrder.push(fullKey);
    this.stats.sets++;
    this.updateSize();
    this.log('SET', fullKey, ttl);
  }

  /**
   * キャッシュから値を取得
   */
  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.buildKey(key);
    const entry = this.cache.get(fullKey);

    if (!entry) {
      this.stats.misses++;
      this.log('MISS', fullKey);
      return null;
    }

    // 有効期限チェック
    if (entry.expireAt && Date.now() > entry.expireAt) {
      await this.delete(key);
      this.stats.misses++;
      this.log('EXPIRED', fullKey);
      return null;
    }

    // LRU: アクセス順を更新
    this.updateAccessOrder(fullKey);

    this.stats.hits++;
    this.updateHitRate();
    this.log('HIT', fullKey);

    return this.deepClone(entry.value);
  }

  /**
   * キャッシュに値が存在するか確認
   */
  async has(key: string): Promise<boolean> {
    const fullKey = this.buildKey(key);
    const entry = this.cache.get(fullKey);

    if (!entry) {
      return false;
    }

    // 有効期限チェック
    if (entry.expireAt && Date.now() > entry.expireAt) {
      await this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * キャッシュから値を削除
   */
  async delete(key: string): Promise<void> {
    const fullKey = this.buildKey(key);
    
    if (this.cache.delete(fullKey)) {
      this.removeFromAccessOrder(fullKey);
      this.stats.deletes++;
      this.updateSize();
      this.log('DELETE', fullKey);
    }
  }

  /**
   * パターンに一致するキャッシュを削除
   */
  async deletePattern(pattern: string): Promise<void> {
    const fullPattern = this.buildKey(pattern);
    const regex = this.patternToRegex(fullPattern);
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.stats.deletes++;
    }

    this.updateSize();
    this.log('DELETE_PATTERN', fullPattern, keysToDelete.length);
  }

  /**
   * すべてのキャッシュをクリア
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.accessOrder = [];
    this.resetStats();
    this.log('CLEAR');
  }

  /**
   * キャッシュのTTLを取得
   */
  async ttl(key: string): Promise<number> {
    const fullKey = this.buildKey(key);
    const entry = this.cache.get(fullKey);

    if (!entry || !entry.expireAt) {
      return -1;
    }

    const remaining = Math.floor((entry.expireAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : -1;
  }

  /**
   * キャッシュのTTLを更新
   */
  async expire(key: string, ttl: number): Promise<void> {
    const fullKey = this.buildKey(key);
    const entry = this.cache.get(fullKey);

    if (entry) {
      entry.expireAt = ttl > 0 ? Date.now() + (ttl * 1000) : undefined;
      this.log('EXPIRE', fullKey, ttl);
    }
  }

  /**
   * キャッシュ統計を取得
   */
  async getStats(): Promise<CacheStats> {
    return { ...this.stats };
  }

  /**
   * タグによる削除
   */
  async deleteByTag(tag: string): Promise<void> {
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags && entry.tags.includes(tag)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.stats.deletes++;
    }

    this.updateSize();
    this.log('DELETE_BY_TAG', tag, keysToDelete.length);
  }

  /**
   * クリーンアップを停止
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * LRU: 最も古いエントリを削除
   */
  private evictLRU(): void {
    if (this.accessOrder.length > 0) {
      const oldestKey = this.accessOrder.shift()!;
      this.cache.delete(oldestKey);
      this.stats.deletes++;
      this.log('EVICT_LRU', oldestKey);
    }
  }

  /**
   * アクセス順の更新
   */
  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  /**
   * アクセス順から削除
   */
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * 期限切れエントリのクリーンアップタイマー
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 60000); // 1分ごと
  }

  /**
   * 期限切れエントリのクリーンアップ
   */
  private cleanupExpired(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expireAt && now > entry.expireAt) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.stats.deletes++;
    }

    if (expiredKeys.length > 0) {
      this.updateSize();
      this.log('CLEANUP', `Removed ${expiredKeys.length} expired entries`);
    }
  }

  /**
   * キーの構築
   */
  private buildKey(key: string): string {
    return this.config.keyPrefix ? `${this.config.keyPrefix}:${key}` : key;
  }

  /**
   * パターンを正規表現に変換
   */
  private patternToRegex(pattern: string): RegExp {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regexPattern = escaped.replace(/\\\*/g, '.*');
    return new RegExp(`^${regexPattern}$`);
  }

  /**
   * ディープクローン
   */
  private deepClone<T>(value: T): T {
    if (value === null || typeof value !== 'object') {
      return value;
    }

    if (value instanceof Date) {
      return new Date(value.getTime()) as any;
    }

    if (value instanceof Array) {
      return value.map(item => this.deepClone(item)) as any;
    }

    if (value instanceof Object) {
      const cloned = {} as any;
      for (const key in value) {
        if (value.hasOwnProperty(key)) {
          cloned[key] = this.deepClone(value[key]);
        }
      }
      return cloned;
    }

    return value;
  }

  /**
   * サイズの更新
   */
  private updateSize(): void {
    // 簡易的なサイズ計算（実際はより正確な計算が必要）
    this.stats.size = this.cache.size * 1024; // 1エントリあたり1KBと仮定
  }

  /**
   * ヒット率の更新
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * 統計のリセット
   */
  private resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      size: 0,
      hitRate: 0
    };
  }

  /**
   * デバッグログ
   */
  private log(operation: string, key: string, extra?: any): void {
    if (this.config.debug) {
      console.log(`[MemoryCache] ${operation}: ${key}`, extra || '');
    }
  }
}