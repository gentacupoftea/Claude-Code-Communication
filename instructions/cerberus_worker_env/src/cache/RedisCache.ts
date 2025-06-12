import { ICache, CacheSetOptions, CacheStats, CacheConfig } from '../interfaces/ICache';

/**
 * Redisキャッシュプロバイダー
 * Redis用のICache実装
 */
export class RedisCache implements ICache {
  private client: any; // 実際の実装ではRedisクライアントの型を使用
  private stats: CacheStats;
  private config: CacheConfig;

  constructor(client: any, config: CacheConfig) {
    this.client = client;
    this.config = config;
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
   * キャッシュに値を設定
   */
  async set<T>(key: string, value: T, options?: CacheSetOptions): Promise<void> {
    const fullKey = this.buildKey(key);
    const ttl = options?.ttl || this.config.defaultTTL;
    
    try {
      const serialized = this.serialize(value);
      const compressed = options?.compress || this.config.enableCompression
        ? await this.compress(serialized)
        : serialized;

      if (ttl > 0) {
        await this.client.setex(fullKey, ttl, compressed);
      } else {
        await this.client.set(fullKey, compressed);
      }

      // タグの処理
      if (options?.tags && options.tags.length > 0) {
        await this.addTags(fullKey, options.tags);
      }

      this.stats.sets++;
      this.log('SET', fullKey, ttl);
    } catch (error) {
      throw new Error(`Failed to set cache key ${key}: ${error}`);
    }
  }

  /**
   * キャッシュから値を取得
   */
  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.buildKey(key);
    
    try {
      const compressed = await this.client.get(fullKey);
      
      if (!compressed) {
        this.stats.misses++;
        this.log('MISS', fullKey);
        return null;
      }

      const serialized = this.config.enableCompression
        ? await this.decompress(compressed)
        : compressed;
      
      const value = this.deserialize<T>(serialized);
      this.stats.hits++;
      this.updateHitRate();
      this.log('HIT', fullKey);
      
      return value;
    } catch (error) {
      console.error(`Failed to get cache key ${key}:`, error);
      return null;
    }
  }

  /**
   * キャッシュに値が存在するか確認
   */
  async has(key: string): Promise<boolean> {
    const fullKey = this.buildKey(key);
    const exists = await this.client.exists(fullKey);
    return exists === 1;
  }

  /**
   * キャッシュから値を削除
   */
  async delete(key: string): Promise<void> {
    const fullKey = this.buildKey(key);
    await this.client.del(fullKey);
    this.stats.deletes++;
    this.log('DELETE', fullKey);
  }

  /**
   * パターンに一致するキャッシュを削除
   */
  async deletePattern(pattern: string): Promise<void> {
    const fullPattern = this.buildKey(pattern);
    let cursor = '0';
    let count = 0;

    do {
      const [newCursor, keys] = await this.client.scan(
        cursor,
        'MATCH',
        fullPattern,
        'COUNT',
        100
      );
      
      cursor = newCursor;
      
      if (keys.length > 0) {
        await this.client.del(...keys);
        count += keys.length;
        this.stats.deletes += keys.length;
      }
    } while (cursor !== '0');

    this.log('DELETE_PATTERN', fullPattern, count);
  }

  /**
   * すべてのキャッシュをクリア
   */
  async clear(): Promise<void> {
    if (this.config.keyPrefix) {
      // プレフィックスがある場合はパターン削除
      await this.deletePattern('*');
    } else {
      // プレフィックスがない場合は全削除（危険！）
      console.warn('Clearing all Redis keys without prefix!');
      await this.client.flushdb();
    }
    
    this.resetStats();
    this.log('CLEAR');
  }

  /**
   * キャッシュのTTLを取得
   */
  async ttl(key: string): Promise<number> {
    const fullKey = this.buildKey(key);
    const ttl = await this.client.ttl(fullKey);
    return ttl;
  }

  /**
   * キャッシュのTTLを更新
   */
  async expire(key: string, ttl: number): Promise<void> {
    const fullKey = this.buildKey(key);
    await this.client.expire(fullKey, ttl);
    this.log('EXPIRE', fullKey, ttl);
  }

  /**
   * キャッシュ統計を取得
   */
  async getStats(): Promise<CacheStats> {
    // Redisの情報を取得してサイズを更新
    const info = await this.client.info('memory');
    const usedMemory = this.parseRedisInfo(info, 'used_memory');
    this.stats.size = usedMemory ? parseInt(usedMemory) : 0;
    
    return { ...this.stats };
  }

  /**
   * タグを追加
   */
  private async addTags(key: string, tags: string[]): Promise<void> {
    const promises = tags.map(tag => {
      const tagKey = `${this.config.keyPrefix || ''}tag:${tag}`;
      return this.client.sadd(tagKey, key);
    });
    await Promise.all(promises);
  }

  /**
   * タグからキーを取得して削除
   */
  async deleteByTag(tag: string): Promise<void> {
    const tagKey = `${this.config.keyPrefix || ''}tag:${tag}`;
    const keys = await this.client.smembers(tagKey);
    
    if (keys.length > 0) {
      await this.client.del(...keys);
      await this.client.del(tagKey);
      this.stats.deletes += keys.length;
    }
  }

  /**
   * キーの構築
   */
  private buildKey(key: string): string {
    return this.config.keyPrefix ? `${this.config.keyPrefix}:${key}` : key;
  }

  /**
   * シリアライズ
   */
  private serialize<T>(value: T): string {
    return JSON.stringify(value);
  }

  /**
   * デシリアライズ
   */
  private deserialize<T>(value: string): T {
    return JSON.parse(value);
  }

  /**
   * 圧縮（簡易実装）
   */
  private async compress(value: string): Promise<string> {
    // 実際の実装ではzlibやbrotliを使用
    return Buffer.from(value).toString('base64');
  }

  /**
   * 解凍（簡易実装）
   */
  private async decompress(value: string): Promise<string> {
    // 実際の実装ではzlibやbrotliを使用
    return Buffer.from(value, 'base64').toString();
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
   * Redis情報のパース
   */
  private parseRedisInfo(info: string, key: string): string | null {
    const match = info.match(new RegExp(`${key}:(\\d+)`));
    return match ? match[1] : null;
  }

  /**
   * デバッグログ
   */
  private log(operation: string, key: string, extra?: any): void {
    if (this.config.debug) {
      console.log(`[RedisCache] ${operation}: ${key}`, extra || '');
    }
  }
}