"use strict";
/**
 * キャッシュサービスの実装
 * メモリキャッシュとRedisキャッシュの両方をサポート
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheService = void 0;
const redis_1 = require("redis");
const logger_1 = require("../utils/logger");
class CacheService {
    memoryCache;
    redisClient;
    config;
    cacheSize = 0;
    evictionQueue = [];
    constructor(config) {
        this.config = config;
        this.memoryCache = new Map();
        // Initialize Redis if available
        this.initializeRedis();
    }
    async initializeRedis() {
        if (process.env.REDIS_URL) {
            try {
                this.redisClient = (0, redis_1.createClient)({
                    url: process.env.REDIS_URL
                });
                this.redisClient.on('error', (err) => {
                    logger_1.logger.error('Redis Client Error', err);
                });
                await this.redisClient.connect();
                logger_1.logger.info('Redis cache connected');
            }
            catch (error) {
                logger_1.logger.warn('Failed to connect to Redis, using memory cache only', error);
            }
        }
    }
    async get(key) {
        // Try memory cache first
        const memoryEntry = this.memoryCache.get(key);
        if (memoryEntry) {
            // Check TTL
            if (this.isExpired(memoryEntry)) {
                this.memoryCache.delete(key);
                this.updateEvictionQueue(key, 'remove');
            }
            else {
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
            }
            catch (error) {
                logger_1.logger.error('Redis get error', { key, error });
            }
        }
        return null;
    }
    async set(key, value) {
        // Set in memory cache
        this.setMemoryCache(key, value);
        // Set in Redis cache
        if (this.redisClient?.isOpen) {
            try {
                await this.redisClient.setEx(key, this.config.ttl, JSON.stringify(value));
            }
            catch (error) {
                logger_1.logger.error('Redis set error', { key, error });
            }
        }
    }
    setMemoryCache(key, value) {
        const entry = {
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
    evict() {
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
    evictLRU() {
        let oldestKey = null;
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
            logger_1.logger.debug('Evicted LRU cache entry', { key: oldestKey });
        }
    }
    evictLFU() {
        let leastKey = null;
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
            logger_1.logger.debug('Evicted LFU cache entry', { key: leastKey });
        }
    }
    evictFIFO() {
        if (this.evictionQueue.length > 0) {
            const key = this.evictionQueue.shift();
            this.memoryCache.delete(key);
            logger_1.logger.debug('Evicted FIFO cache entry', { key });
        }
    }
    updateEvictionQueue(key, action) {
        if (this.config.strategy === 'FIFO') {
            if (action === 'add') {
                this.evictionQueue.push(key);
            }
            else {
                const index = this.evictionQueue.indexOf(key);
                if (index > -1) {
                    this.evictionQueue.splice(index, 1);
                }
            }
        }
    }
    isExpired(entry) {
        return Date.now() - entry.timestamp > this.config.ttl * 1000;
    }
    async delete(key) {
        this.memoryCache.delete(key);
        this.updateEvictionQueue(key, 'remove');
        if (this.redisClient?.isOpen) {
            try {
                await this.redisClient.del(key);
            }
            catch (error) {
                logger_1.logger.error('Redis delete error', { key, error });
            }
        }
    }
    clear() {
        this.memoryCache.clear();
        this.evictionQueue = [];
        if (this.redisClient?.isOpen) {
            // Clear all fallback keys
            this.redisClient.keys('fallback:*').then(keys => {
                if (keys.length > 0) {
                    this.redisClient.del(keys).catch(error => {
                        logger_1.logger.error('Redis clear error', error);
                    });
                }
            });
        }
    }
    getStats() {
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
    async shutdown() {
        if (this.redisClient?.isOpen) {
            await this.redisClient.quit();
        }
        this.memoryCache.clear();
    }
}
exports.CacheService = CacheService;
