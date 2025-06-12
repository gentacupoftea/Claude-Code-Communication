import { ICacheStrategy } from '../../interfaces/ICache';
import * as crypto from 'crypto';

/**
 * 基本的なキャッシュ戦略の実装
 */
abstract class BaseCacheStrategy implements ICacheStrategy {
  protected readonly apiName: string;

  constructor(apiName: string) {
    this.apiName = apiName;
  }

  /**
   * オブジェクトからハッシュを生成
   */
  protected generateHash(obj: any): string {
    const str = JSON.stringify(this.sortObject(obj));
    return crypto.createHash('md5').update(str).digest('hex');
  }

  /**
   * オブジェクトのキーをソート（一貫したハッシュのため）
   */
  private sortObject(obj: any): any {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this.sortObject(item));
    
    const sorted: any = {};
    Object.keys(obj).sort().forEach(key => {
      sorted[key] = this.sortObject(obj[key]);
    });
    return sorted;
  }

  abstract generateKey(params: any): string;
  abstract determineTTL(params: any): number;
  abstract shouldCache(params: any): boolean;
  abstract shouldInvalidate(params: any): boolean;
}

/**
 * Shopify API用キャッシュ戦略
 */
export class ShopifyCacheStrategy extends BaseCacheStrategy {
  constructor() {
    super('shopify');
  }

  generateKey(params: any): string {
    const parts = [this.apiName];
    
    if (params.resource) parts.push(params.resource);
    if (params.id) parts.push(params.id);
    
    // クエリパラメータがある場合はハッシュ化
    if (params.query) {
      parts.push(this.generateHash(params.query));
    }
    
    return parts.join(':');
  }

  determineTTL(params: any): number {
    // リソースタイプによってTTLを変更
    switch (params.resource) {
      case 'products':
        return 3600; // 1時間
      case 'orders':
        return 300; // 5分（頻繁に変更される）
      case 'customers':
        return 1800; // 30分
      case 'inventory':
        return 60; // 1分（在庫は頻繁に変わる）
      default:
        return 600; // デフォルト10分
    }
  }

  shouldCache(params: any): boolean {
    // GETリクエストのみキャッシュ
    if (params.method && params.method !== 'GET') return false;
    
    // 特定のリソースはキャッシュしない
    const nonCacheableResources = ['webhooks', 'events'];
    if (nonCacheableResources.includes(params.resource)) return false;
    
    return true;
  }

  shouldInvalidate(params: any): boolean {
    // 更新系の操作後は関連キャッシュを無効化
    return params.method && ['POST', 'PUT', 'DELETE'].includes(params.method);
  }
}

/**
 * POS API用キャッシュ戦略
 */
export class PosCacheStrategy extends BaseCacheStrategy {
  constructor() {
    super('pos');
  }

  generateKey(params: any): string {
    const parts = [this.apiName, params.type];
    
    if (params.id) parts.push(params.id);
    
    // フィルターがある場合はハッシュ化
    if (params.filters) {
      parts.push(this.generateHash(params.filters));
    }
    
    return parts.join(':');
  }

  determineTTL(params: any): number {
    // POSデータは頻繁に更新されるため、短めのTTL
    switch (params.type) {
      case 'transactions':
        return 120; // 2分
      case 'products':
        return 300; // 5分
      case 'inventory':
        return 30; // 30秒（リアルタイム性重視）
      default:
        return 180; // デフォルト3分
    }
  }

  shouldCache(params: any): boolean {
    // リアルタイム取引データはキャッシュしない
    if (params.type === 'transactions' && params.realtime) return false;
    
    // 集計データのみキャッシュ
    if (params.type === 'transactions' && !params.filters?.aggregated) return false;
    
    return true;
  }

  shouldInvalidate(params: any): boolean {
    // 新しい取引が記録されたら関連キャッシュを無効化
    return params.type === 'transactions' && params.method === 'POST';
  }
}

/**
 * 分析API用キャッシュ戦略
 */
export class AnalyticsCacheStrategy extends BaseCacheStrategy {
  constructor() {
    super('analytics');
  }

  generateKey(params: any): string {
    const parts = [this.apiName, params.reportType];
    
    // メトリクスとディメンションをキーに含める
    if (params.metrics) parts.push(params.metrics.sort().join(','));
    if (params.dimensions) parts.push(params.dimensions.sort().join(','));
    
    // 日付範囲をキーに含める
    if (params.dateRange) {
      parts.push(`${params.dateRange.startDate}_${params.dateRange.endDate}`);
    }
    
    // フィルターがある場合はハッシュ化
    if (params.filters) {
      parts.push(this.generateHash(params.filters));
    }
    
    return parts.join(':');
  }

  determineTTL(params: any): number {
    // レポートタイプと日付範囲によってTTLを決定
    const now = new Date();
    const endDate = new Date(params.dateRange?.endDate || now);
    
    // 過去のデータは長くキャッシュ
    if (endDate < new Date(now.getTime() - 24 * 60 * 60 * 1000)) {
      return 86400; // 24時間
    }
    
    // リアルタイムデータは短め
    if (params.reportType === 'realtime') {
      return 60; // 1分
    }
    
    // 今日のデータは中程度
    return 3600; // 1時間
  }

  shouldCache(params: any): boolean {
    // すべての分析データはキャッシュ可能
    return true;
  }

  shouldInvalidate(params: any): boolean {
    // 分析データは基本的に無効化しない（TTLで管理）
    return false;
  }
}

/**
 * 天気API用キャッシュ戦略
 */
export class WeatherCacheStrategy extends BaseCacheStrategy {
  constructor() {
    super('weather');
  }

  generateKey(params: any): string {
    const parts = [this.apiName, params.type];
    
    // 場所情報をキーに含める
    if (params.location) {
      if ('lat' in params.location) {
        // 緯度経度は小数点2桁で丸める（精度と効率のバランス）
        const lat = Math.round(params.location.lat * 100) / 100;
        const lon = Math.round(params.location.lon * 100) / 100;
        parts.push(`${lat},${lon}`);
      } else if ('city' in params.location) {
        parts.push(params.location.city.toLowerCase());
      } else if ('zip' in params.location) {
        parts.push(params.location.zip);
      }
    }
    
    // 単位系
    if (params.units) parts.push(params.units);
    
    return parts.join(':');
  }

  determineTTL(params: any): number {
    // 天気データのタイプによってTTLを決定
    switch (params.type) {
      case 'current':
        return 600; // 10分（現在の天気）
      case 'forecast':
        return 3600; // 1時間（予報）
      case 'hourly':
        return 1800; // 30分（時間別予報）
      default:
        return 900; // デフォルト15分
    }
  }

  shouldCache(params: any): boolean {
    // すべての天気データはキャッシュ可能
    return true;
  }

  shouldInvalidate(params: any): boolean {
    // 天気データは外部APIなので無効化しない
    return false;
  }
}

/**
 * キャッシュ戦略ファクトリー
 */
export class CacheStrategyFactory {
  private static strategies = new Map<string, ICacheStrategy>([
    ['shopify', new ShopifyCacheStrategy()],
    ['pos', new PosCacheStrategy()],
    ['analytics', new AnalyticsCacheStrategy()],
    ['weather', new WeatherCacheStrategy()]
  ]);

  /**
   * API名から適切な戦略を取得
   */
  static getStrategy(apiName: string): ICacheStrategy {
    const strategy = this.strategies.get(apiName.toLowerCase());
    if (!strategy) {
      throw new Error(`No cache strategy found for API: ${apiName}`);
    }
    return strategy;
  }

  /**
   * カスタム戦略を登録
   */
  static registerStrategy(apiName: string, strategy: ICacheStrategy): void {
    this.strategies.set(apiName.toLowerCase(), strategy);
  }
}