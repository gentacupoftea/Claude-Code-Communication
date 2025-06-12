/**
 * キャッシュプロバイダーインターフェース
 * すべてのキャッシュ実装が従うべき統一インターフェース
 */
export interface ICache {
  /**
   * キャッシュに値を設定
   * @param key キャッシュキー
   * @param value キャッシュする値
   * @param options キャッシュオプション
   */
  set<T>(key: string, value: T, options?: CacheSetOptions): Promise<void>;

  /**
   * キャッシュから値を取得
   * @param key キャッシュキー
   * @returns キャッシュされた値、存在しない場合はnull
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * キャッシュに値が存在するか確認
   * @param key キャッシュキー
   * @returns 存在する場合true
   */
  has(key: string): Promise<boolean>;

  /**
   * キャッシュから値を削除
   * @param key キャッシュキー
   */
  delete(key: string): Promise<void>;

  /**
   * パターンに一致するキャッシュを削除
   * @param pattern キーパターン（例: "api:shopify:*"）
   */
  deletePattern(pattern: string): Promise<void>;

  /**
   * すべてのキャッシュをクリア
   */
  clear(): Promise<void>;

  /**
   * キャッシュのTTLを取得
   * @param key キャッシュキー
   * @returns 残りTTL（秒）、TTLがない場合は-1
   */
  ttl(key: string): Promise<number>;

  /**
   * キャッシュのTTLを更新
   * @param key キャッシュキー
   * @param ttl 新しいTTL（秒）
   */
  expire(key: string, ttl: number): Promise<void>;

  /**
   * キャッシュ統計を取得
   */
  getStats(): Promise<CacheStats>;
}

/**
 * キャッシュ設定オプション
 */
export interface CacheSetOptions {
  /**
   * Time To Live（秒単位）
   */
  ttl?: number;

  /**
   * タグ（グループ削除用）
   */
  tags?: string[];

  /**
   * 圧縮を有効にするか
   */
  compress?: boolean;
}

/**
 * キャッシュ統計
 */
export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  size: number;
  hitRate: number;
}

/**
 * キャッシュ戦略インターフェース
 */
export interface ICacheStrategy {
  /**
   * キャッシュキーを生成
   * @param params キー生成パラメータ
   * @returns キャッシュキー
   */
  generateKey(params: any): string;

  /**
   * TTLを決定
   * @param params TTL決定パラメータ
   * @returns TTL（秒）
   */
  determineTTL(params: any): number;

  /**
   * キャッシュ可能かどうかを判定
   * @param params 判定パラメータ
   * @returns キャッシュ可能な場合true
   */
  shouldCache(params: any): boolean;

  /**
   * キャッシュを無効化すべきかどうかを判定
   * @param params 判定パラメータ
   * @returns 無効化すべき場合true
   */
  shouldInvalidate(params: any): boolean;
}

/**
 * キャッシュマネージャー設定
 */
export interface CacheConfig {
  /**
   * デフォルトTTL（秒）
   */
  defaultTTL: number;

  /**
   * 最大キャッシュサイズ（MB）
   */
  maxSize?: number;

  /**
   * キャッシュキーのプレフィックス
   */
  keyPrefix?: string;

  /**
   * 圧縮を有効にするか
   */
  enableCompression?: boolean;

  /**
   * デバッグモード
   */
  debug?: boolean;
}