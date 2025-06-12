import { BaseApiAdapter } from './BaseApiAdapter';
import { ICache, ICacheStrategy } from '../interfaces/ICache';
import { ApiResponse } from '../interfaces/IApiAdapter';

/**
 * キャッシュ機能付きAPIアダプター基底クラス
 * BaseApiAdapterを拡張してキャッシュ機能を追加
 */
export abstract class CachedApiAdapter<TConfig, TResponse> extends BaseApiAdapter<TConfig, TResponse> {
  protected cache?: ICache;
  protected cacheStrategy?: ICacheStrategy;

  /**
   * キャッシュを設定
   */
  setCache(cache: ICache, strategy: ICacheStrategy): void {
    this.cache = cache;
    this.cacheStrategy = strategy;
  }

  /**
   * キャッシュ付きデータ取得
   */
  async fetch<T extends TResponse>(params: any): Promise<ApiResponse<T>> {
    // キャッシュが設定されていない場合は通常の処理
    if (!this.cache || !this.cacheStrategy) {
      return super.fetch(params);
    }

    // キャッシュ可能かチェック
    if (!this.cacheStrategy.shouldCache(params)) {
      return super.fetch(params);
    }

    // キャッシュキーを生成
    const cacheKey = this.cacheStrategy.generateKey(params);
    
    // キャッシュから取得を試みる
    const cached = await this.cache.get<ApiResponse<T>>(cacheKey);
    if (cached) {
      // キャッシュヒット時はメタデータを更新
      return {
        ...cached,
        metadata: {
          ...cached.metadata,
          cached: true,
          cacheKey
        }
      };
    }

    // キャッシュミスの場合は通常の取得処理
    const response = await super.fetch<T>(params);

    // 成功レスポンスをキャッシュ
    if (response.success && response.data) {
      const ttl = this.cacheStrategy.determineTTL(params);
      await this.cache.set(cacheKey, response, { ttl });
    }

    return response;
  }

  /**
   * データ送信（キャッシュ無効化付き）
   */
  async send<T extends TResponse>(data: any): Promise<ApiResponse<T>> {
    const response = await super.send<T>(data);

    // 送信成功時、必要に応じてキャッシュを無効化
    if (response.success && this.cache && this.cacheStrategy) {
      if (this.cacheStrategy.shouldInvalidate(data)) {
        await this.invalidateRelatedCache(data);
      }
    }

    return response;
  }

  /**
   * 関連キャッシュの無効化
   */
  protected async invalidateRelatedCache(data: any): Promise<void> {
    if (!this.cache) return;

    // デフォルトではAPI全体のキャッシュを無効化
    // 派生クラスでより細かい制御を実装可能
    const pattern = `${this.name.toLowerCase()}:*`;
    await this.cache.deletePattern(pattern);
  }

  /**
   * 特定のキャッシュを無効化
   */
  async invalidateCache(params: any): Promise<void> {
    if (!this.cache || !this.cacheStrategy) return;

    const cacheKey = this.cacheStrategy.generateKey(params);
    await this.cache.delete(cacheKey);
  }

  /**
   * キャッシュ統計を取得
   */
  async getCacheStats(): Promise<any> {
    if (!this.cache) {
      return { enabled: false };
    }

    const stats = await this.cache.getStats();
    return {
      enabled: true,
      ...stats
    };
  }

  /**
   * キャッシュをクリア
   */
  async clearCache(): Promise<void> {
    if (!this.cache) return;

    const pattern = `${this.name.toLowerCase()}:*`;
    await this.cache.deletePattern(pattern);
  }
}