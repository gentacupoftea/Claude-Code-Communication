import api from '../services/api';

export interface CacheMetrics {
  hitRate: number;
  missRate: number;
  itemCount: number;
  sizeBytes: number;
  avgResponseTimeMs: number;
  oldestItemAge: number;
  totalRequests: number;
  totalHits: number;
  totalMisses: number;
  memoryUsagePercentage: number;
  topCachedEndpoints: Array<{
    endpoint: string;
    hits: number;
    hitRate: number;
    avgSizeBytes: number;
  }>;
  cacheEfficiencyByPlatform: Record<string, {
    hitRate: number;
    totalRequests: number;
  }>;
}

export interface CacheSettings {
  enabled: boolean;
  ttlSeconds: number;
  maxSizeBytes: number;
  compressionEnabled: boolean;
  preferCache: boolean;
  refreshInterval: number;
  endpointSettings: Record<string, {
    enabled: boolean;
    ttlSeconds: number;
  }>;
  platformSettings: Record<string, {
    enabled: boolean;
    ttlSeconds: number;
  }>;
}

/**
 * キャッシュAPI
 */
export const CacheService = {
  /**
   * キャッシュメトリクスを取得
   */
  async getMetrics(): Promise<CacheMetrics> {
    return api.get('/api/v1/cache/metrics');
  },

  /**
   * キャッシュ設定を取得
   */
  async getSettings(): Promise<CacheSettings> {
    return api.get('/api/v1/cache/settings');
  },

  /**
   * キャッシュ設定を更新
   * @param settings 更新するキャッシュ設定
   */
  async updateSettings(settings: Partial<CacheSettings>): Promise<CacheSettings> {
    return api.put('/api/v1/cache/settings', settings);
  },

  /**
   * キャッシュをクリア
   * @param options クリアオプション
   */
  async clearCache(options?: {
    platform?: string;
    endpoint?: string;
    keys?: string[];
    olderThan?: string; // ISO日付文字列
  }): Promise<{ success: boolean; clearedItems: number }> {
    return api.post('/api/v1/cache/clear', options);
  },

  /**
   * 特定のエンドポイントのキャッシュを無効化
   * @param endpoint エンドポイント
   */
  async invalidateEndpoint(endpoint: string): Promise<{ success: boolean }> {
    return api.post('/api/v1/cache/invalidate', { endpoint });
  },

  /**
   * キャッシュの詳細情報を取得
   */
  async getDetails(): Promise<{
    keyCount: number;
    keySizeDistribution: Record<string, number>;
    ageDistribution: Record<string, number>;
    platforms: Record<string, {
      keyCount: number;
      totalSizeBytes: number;
    }>;
  }> {
    return api.get('/api/v1/cache/details');
  },

  /**
   * キャッシュのパフォーマンスレポートを取得
   * @param timeRange 時間範囲 (hours)
   */
  async getPerformanceReport(timeRange: number = 24): Promise<{
    timePoints: string[];
    hitRates: number[];
    responseTimes: number[];
    sizeTrend: number[];
    requestCounts: number[];
  }> {
    return api.get('/api/v1/cache/performance', {
      params: { timeRange }
    });
  },

  /**
   * キャッシュの状態を確認
   */
  async getStatus(): Promise<{
    healthy: boolean;
    connected: boolean;
    version: string;
    uptime: number;
    errors: string[];
  }> {
    return api.get('/api/v1/cache/status');
  }
};

export default CacheService;