import { IApiAdapter, ApiResponse } from '../interfaces/IApiAdapter';
import { ShopifyAdapter } from '../adapters/ShopifyAdapter';
import { PosAdapter } from '../adapters/PosAdapter';
import { AnalyticsAdapter } from '../adapters/AnalyticsAdapter';
import { WeatherAdapter } from '../adapters/WeatherAdapter';
import { ShopifyConfig, PosConfig, AnalyticsConfig, WeatherConfig } from '../types/api-configs';
import { CacheManager } from '../cache/CacheManager';
import { CacheStrategyFactory } from '../cache/strategies/ApiCacheStrategies';
import { CachedApiAdapter } from '../adapters/CachedApiAdapter';

/**
 * APIマネージャー
 * すべてのAPIアダプターを統合管理し、既存コードからの利用を簡素化
 */
export class ApiManager {
  private adapters: Map<string, IApiAdapter<any, any>> = new Map();
  private initialized: boolean = false;
  private cacheManager?: CacheManager;

  /**
   * APIマネージャーの初期化
   */
  async initialize(config: ApiManagerConfig): Promise<void> {
    try {
      // キャッシュマネージャーの初期化
      if (config.cache) {
        this.cacheManager = new CacheManager(config.cache);
        await this.cacheManager.initialize();
      }
      // 各アダプターの初期化
      const initPromises: Promise<void>[] = [];

      if (config.shopify) {
        const shopifyAdapter = new ShopifyAdapter();
        this.setupCacheForAdapter(shopifyAdapter, 'shopify');
        initPromises.push(
          shopifyAdapter.initialize(config.shopify)
            .then(() => this.adapters.set('shopify', shopifyAdapter))
        );
      }

      if (config.pos) {
        const posAdapter = new PosAdapter();
        this.setupCacheForAdapter(posAdapter, 'pos');
        initPromises.push(
          posAdapter.initialize(config.pos)
            .then(() => this.adapters.set('pos', posAdapter))
        );
      }

      if (config.analytics) {
        const analyticsAdapter = new AnalyticsAdapter();
        this.setupCacheForAdapter(analyticsAdapter, 'analytics');
        initPromises.push(
          analyticsAdapter.initialize(config.analytics)
            .then(() => this.adapters.set('analytics', analyticsAdapter))
        );
      }

      if (config.weather) {
        const weatherAdapter = new WeatherAdapter();
        this.setupCacheForAdapter(weatherAdapter, 'weather');
        initPromises.push(
          weatherAdapter.initialize(config.weather)
            .then(() => this.adapters.set('weather', weatherAdapter))
        );
      }

      await Promise.all(initPromises);
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize API Manager:', error);
      throw error;
    }
  }

  /**
   * 特定のアダプターを取得
   */
  getAdapter<T extends IApiAdapter<any, any>>(name: string): T {
    if (!this.initialized) {
      throw new Error('API Manager is not initialized');
    }

    const adapter = this.adapters.get(name.toLowerCase());
    if (!adapter) {
      throw new Error(`Adapter '${name}' not found`);
    }

    return adapter as T;
  }

  /**
   * Shopify専用メソッド
   */
  async fetchShopifyData(params: any): Promise<ApiResponse<any>> {
    const adapter = this.getAdapter<ShopifyAdapter>('shopify');
    return adapter.fetch(params);
  }

  /**
   * POS専用メソッド
   */
  async fetchPosData(params: any): Promise<ApiResponse<any>> {
    const adapter = this.getAdapter<PosAdapter>('pos');
    return adapter.fetch(params);
  }

  /**
   * Analytics専用メソッド
   */
  async fetchAnalyticsData(params: any): Promise<ApiResponse<any>> {
    const adapter = this.getAdapter<AnalyticsAdapter>('analytics');
    return adapter.fetch(params);
  }

  /**
   * Weather専用メソッド
   */
  async fetchWeatherData(params: any): Promise<ApiResponse<any>> {
    const adapter = this.getAdapter<WeatherAdapter>('weather');
    return adapter.fetch(params);
  }

  /**
   * 汎用的なデータ取得メソッド
   */
  async fetch(adapterName: string, params: any): Promise<ApiResponse<any>> {
    const adapter = this.getAdapter(adapterName);
    return adapter.fetch(params);
  }

  /**
   * 汎用的なデータ送信メソッド
   */
  async send(adapterName: string, data: any): Promise<ApiResponse<any>> {
    const adapter = this.getAdapter(adapterName);
    return adapter.send(data);
  }

  /**
   * すべてのアダプターのヘルスチェック
   */
  async healthCheckAll(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const [name, adapter] of this.adapters) {
      try {
        const health = await adapter.healthCheck();
        results[name] = health.status === 'healthy';
      } catch (error) {
        results[name] = false;
      }
    }

    return results;
  }

  /**
   * すべてのアダプターを切断
   */
  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.adapters.values())
      .map(adapter => adapter.disconnect());

    await Promise.all(disconnectPromises);
    this.adapters.clear();
    this.initialized = false;
  }

  /**
   * アダプターの一覧を取得
   */
  getAdapterNames(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * 初期化状態を確認
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * アダプターにキャッシュを設定
   */
  private setupCacheForAdapter(adapter: any, apiName: string): void {
    if (!this.cacheManager) return;

    const cache = this.cacheManager.getCache();
    if (!cache) return;

    // アダプターがキャッシュ対応かチェック
    if (adapter instanceof CachedApiAdapter) {
      const strategy = CacheStrategyFactory.getStrategy(apiName);
      adapter.setCache(cache, strategy);
    }
  }

  /**
   * キャッシュ統計を取得
   */
  async getCacheStats(): Promise<any> {
    if (!this.cacheManager) {
      return { cacheEnabled: false };
    }

    const cache = this.cacheManager.getCache();
    if (!cache) {
      return { cacheEnabled: false };
    }

    const stats = await cache.getStats();
    const adapterStats: Record<string, any> = {};

    // 各アダプターのキャッシュ統計も取得
    for (const [name, adapter] of this.adapters) {
      if (adapter instanceof CachedApiAdapter) {
        adapterStats[name] = await adapter.getCacheStats();
      }
    }

    return {
      cacheEnabled: true,
      global: stats,
      adapters: adapterStats
    };
  }

  /**
   * キャッシュをクリア
   */
  async clearCache(adapterName?: string): Promise<void> {
    if (adapterName) {
      // 特定のアダプターのキャッシュをクリア
      const adapter = this.getAdapter(adapterName);
      if (adapter instanceof CachedApiAdapter) {
        await adapter.clearCache();
      }
    } else {
      // すべてのキャッシュをクリア
      if (this.cacheManager) {
        const cache = this.cacheManager.getCache();
        if (cache) {
          await cache.clear();
        }
      }
    }
  }
}

/**
 * APIマネージャー設定
 */
export interface ApiManagerConfig {
  shopify?: ShopifyConfig;
  pos?: PosConfig;
  analytics?: AnalyticsConfig;
  weather?: WeatherConfig;
  cache?: import('../cache/CacheManager').CacheManagerConfig;
}

/**
 * シングルトンインスタンスのエクスポート
 */
export const apiManager = new ApiManager();