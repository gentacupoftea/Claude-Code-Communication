/**
 * キャッシュサービスの実装
 * メモリキャッシュとRedisキャッシュの両方をサポート
 */
import { CacheConfig } from '../interfaces/IFallbackService';
export declare class CacheService {
    private memoryCache;
    private redisClient?;
    private config;
    private cacheSize;
    private evictionQueue;
    constructor(config: CacheConfig);
    private initializeRedis;
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<void>;
    private setMemoryCache;
    private evict;
    private evictLRU;
    private evictLFU;
    private evictFIFO;
    private updateEvictionQueue;
    private isExpired;
    delete(key: string): Promise<void>;
    clear(): void;
    getStats(): {
        size: number;
        hits: number;
        misses: number;
        evictions: number;
    };
    shutdown(): Promise<void>;
}
//# sourceMappingURL=CacheService.d.ts.map