/**
 * キャッシュサービスの実装
 * メモリキャッシュとRedisキャッシュの両方をサポート
 */

import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';
import { CacheConfig } from '../interfaces/IFallbackService';

interface CacheEntry {
  value: any;
  timestamp: number;
  accessCount: number;
  lastAccess: number;
}

export class CacheService {
  private memoryCache: Map<string, CacheEntry>;
  private redisClient?: RedisClientType;
  private config: CacheConfig;
  private cacheSize: number = 0;
  private evictionQueue: string[] = [];

  constructor(config: CacheConfig) {
    this.config = config;
    this.memoryCache = new Map();

    // Initialize Redis if available
    this.initializeRedis();
  }

  private async initializeRedis(): Promise<void> {
    if (process.env.REDIS_URL) {
      try {
        this.redisClient = createClient({
          url: process.env.REDIS_URL
        });

        this.redisClient.on('error', (err) => {
          logger.error('Redis Client Error', err);
        });

        await this.redisClient.connect();
        logger.info('Redis cache connected');
      } catch (error) {
        logger.warn('Failed to connect to Redis, using memory cache only', error);
      }
    }
  }

  async get(key: string): Promise<any> {
    // Try memory cache first
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry) {
      // Check TTL
      if (this.isExpired(memoryEntry)) {
        this.memoryCache.delete(key);
        this.updateEvictionQueue(key, 'remove');
      } else {
        // Update access stats
        memoryEntry.accessCount++;
        memoryEntry.lastAccess = Date.now();
        return memoryEntry.value;
      }
    }

    // Try Redis cache
    if (this.redisClient?.isOpen) {
      try {
        const redisValue = await this.redisClient.get(key);
        if (redisValue) {
          const value = JSON.parse(redisValue);
          
          // Store in memory cache for faster access
          this.setMemoryCache(key, value);
          
          return value;
        }
      } catch (error) {
        logger.error('Redis get error', { key, error });
      }
    }

    return null;
  }

  async set(key: string, value: any): Promise<void> {
    // Set in memory cache
    this.setMemoryCache(key, value);

    // Set in Redis cache
    if (this.redisClient?.isOpen) {
      try {
        await this.redisClient.setEx(
          key,
          this.config.ttl,
          JSON.stringify(value)
        );
      } catch (error) {
        logger.error('Redis set error', { key, error });
      }
    }
  }

  private setMemoryCache(key: string, value: any): void {
    const entry: CacheEntry = {
      value,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccess: Date.now()
    };

    // Check if we need to evict
    if (this.memoryCache.size >= this.config.maxSize) {
      this.evict();
    }

    this.memoryCache.set(key, entry);
    this.updateEvictionQueue(key, 'add');
  }

  private evict(): void {
    switch (this.config.strategy) {
      case 'LRU':
        this.evictLRU();
        break;
      case 'LFU':
        this.evictLFU();
        break;
      case 'FIFO':
        this.evictFIFO();
        break;
    }
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Infinity;

    for (const [key, entry] of this.memoryCache) {
      if (entry.lastAccess < oldestAccess) {
        oldestAccess = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
      this.updateEvictionQueue(oldestKey, 'remove');
      logger.debug('Evicted LRU cache entry', { key: oldestKey });
    }
  }

  private evictLFU(): void {
    let leastKey: string | null = null;
    let leastCount = Infinity;

    for (const [key, entry] of this.memoryCache) {
      if (entry.accessCount < leastCount) {
        leastCount = entry.accessCount;
        leastKey = key;
      }
    }

    if (leastKey) {
      this.memoryCache.delete(leastKey);
      this.updateEvictionQueue(leastKey, 'remove');
      logger.debug('Evicted LFU cache entry', { key: leastKey });
    }
  }

  private evictFIFO(): void {
    if (this.evictionQueue.length > 0) {
      const key = this.evictionQueue.shift()!;
      this.memoryCache.delete(key);
      logger.debug('Evicted FIFO cache entry', { key });
    }
  }

  private updateEvictionQueue(key: string, action: 'add' | 'remove'): void {
    if (this.config.strategy === 'FIFO') {
      if (action === 'add') {
        this.evictionQueue.push(key);
      } else {
        const index = this.evictionQueue.indexOf(key);
        if (index > -1) {
          this.evictionQueue.splice(index, 1);
        }
      }
    }
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > this.config.ttl * 1000;
  }

  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);
    this.updateEvictionQueue(key, 'remove');

    if (this.redisClient?.isOpen) {
      try {
        await this.redisClient.del(key);
      } catch (error) {
        logger.error('Redis delete error', { key, error });
      }
    }
  }

  clear(): void {
    this.memoryCache.clear();
    this.evictionQueue = [];

    if (this.redisClient?.isOpen) {
      // Clear all fallback keys
      this.redisClient.keys('fallback:*').then(keys => {
        if (keys.length > 0) {
          this.redisClient!.del(keys).catch(error => {
            logger.error('Redis clear error', error);
          });
        }
      });
    }
  }

  getStats(): {
    size: number;
    hits: number;
    misses: number;
    evictions: number;
  } {
    let hits = 0;
    let totalAccess = 0;

    for (const entry of this.memoryCache.values()) {
      totalAccess += entry.accessCount;
      if (entry.accessCount > 1) {
        hits += entry.accessCount - 1;
      }
    }

    return {
      size: this.memoryCache.size,
      hits,
      misses: totalAccess - hits,
      evictions: 0 // Would need to track this separately
    };
  }

  async shutdown(): Promise<void> {
    if (this.redisClient?.isOpen) {
      await this.redisClient.quit();
    }
    this.memoryCache.clear();
  }
}