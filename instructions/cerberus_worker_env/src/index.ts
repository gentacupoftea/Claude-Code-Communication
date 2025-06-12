// インターフェースのエクスポート
export * from './interfaces/IApiAdapter';
export * from './interfaces/ICache';

// アダプターのエクスポート
export { BaseApiAdapter } from './adapters/BaseApiAdapter';
export { CachedApiAdapter } from './adapters/CachedApiAdapter';
export { ShopifyAdapter } from './adapters/ShopifyAdapter';
export { PosAdapter } from './adapters/PosAdapter';
export { AnalyticsAdapter } from './adapters/AnalyticsAdapter';
export { WeatherAdapter } from './adapters/WeatherAdapter';

// キャッシュのエクスポート
export { RedisCache } from './cache/RedisCache';
export { MemoryCache } from './cache/MemoryCache';
export { CacheManager, MultiLevelCache } from './cache/CacheManager';
export * from './cache/strategies/ApiCacheStrategies';

// 型定義のエクスポート
export * from './types/api-configs';
export * from './types/api-responses';

// サービスのエクスポート
export { ApiManager, apiManager } from './services/ApiManager';

// パラメータ型のエクスポート
export type { ShopifyFetchParams, ShopifySendData } from './adapters/ShopifyAdapter';
export type { PosFetchParams, PosSendData } from './adapters/PosAdapter';
export type { AnalyticsFetchParams, AnalyticsSendData } from './adapters/AnalyticsAdapter';
export type { WeatherFetchParams, WeatherFetchType } from './adapters/WeatherAdapter';