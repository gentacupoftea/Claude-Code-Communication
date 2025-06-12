/**
 * 統一APIアダプターインターフェース
 * すべてのAPIアダプターが実装すべき共通インターフェース
 */
export interface IApiAdapter<TConfig, TResponse> {
  /**
   * APIアダプターの名前
   */
  readonly name: string;

  /**
   * APIアダプターの初期化
   * @param config API固有の設定
   */
  initialize(config: TConfig): Promise<void>;

  /**
   * データの取得
   * @param params 取得パラメータ
   * @returns 統一されたレスポンス形式
   */
  fetch<T extends TResponse>(params: any): Promise<ApiResponse<T>>;

  /**
   * データの送信
   * @param data 送信データ
   * @returns 統一されたレスポンス形式
   */
  send<T extends TResponse>(data: any): Promise<ApiResponse<T>>;

  /**
   * ヘルスチェック
   * @returns APIの接続状態
   */
  healthCheck(): Promise<HealthCheckResult>;

  /**
   * リソースのクリーンアップ
   */
  disconnect(): Promise<void>;
}

/**
 * 統一APIレスポンス形式
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  metadata?: {
    timestamp: Date;
    duration: number;
    source: string;
  };
}

/**
 * 統一APIエラー形式
 */
export interface ApiError {
  code: string;
  message: string;
  details?: any;
  retryable: boolean;
}

/**
 * ヘルスチェック結果
 */
export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  timestamp: Date;
}