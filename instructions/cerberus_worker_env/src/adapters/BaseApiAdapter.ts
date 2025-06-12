import { IApiAdapter, ApiResponse, ApiError, HealthCheckResult } from '../interfaces/IApiAdapter';

/**
 * APIアダプターの基底クラス
 * 共通のエラーハンドリングとロギング機能を提供
 */
export abstract class BaseApiAdapter<TConfig, TResponse> implements IApiAdapter<TConfig, TResponse> {
  protected config?: TConfig;
  protected isInitialized: boolean = false;

  constructor(public readonly name: string) {}

  /**
   * 初期化処理のラッパー
   */
  async initialize(config: TConfig): Promise<void> {
    try {
      await this.doInitialize(config);
      this.config = config;
      this.isInitialized = true;
    } catch (error) {
      throw this.handleError(error, 'INIT_ERROR');
    }
  }

  /**
   * データ取得処理のラッパー
   */
  async fetch<T extends TResponse>(params: any): Promise<ApiResponse<T>> {
    this.checkInitialized();
    const startTime = Date.now();
    
    try {
      const data = await this.doFetch<T>(params);
      return this.createSuccessResponse(data, startTime);
    } catch (error) {
      return this.createErrorResponse(error, startTime);
    }
  }

  /**
   * データ送信処理のラッパー
   */
  async send<T extends TResponse>(data: any): Promise<ApiResponse<T>> {
    this.checkInitialized();
    const startTime = Date.now();
    
    try {
      const result = await this.doSend<T>(data);
      return this.createSuccessResponse(result, startTime);
    } catch (error) {
      return this.createErrorResponse(error, startTime);
    }
  }

  /**
   * ヘルスチェック処理のラッパー
   */
  async healthCheck(): Promise<HealthCheckResult> {
    try {
      const isHealthy = await this.doHealthCheck();
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * 切断処理のラッパー
   */
  async disconnect(): Promise<void> {
    try {
      await this.doDisconnect();
      this.isInitialized = false;
    } catch (error) {
      console.error(`Failed to disconnect ${this.name}:`, error);
    }
  }

  /**
   * 派生クラスで実装すべき初期化処理
   */
  protected abstract doInitialize(config: TConfig): Promise<void>;

  /**
   * 派生クラスで実装すべきデータ取得処理
   */
  protected abstract doFetch<T extends TResponse>(params: any): Promise<T>;

  /**
   * 派生クラスで実装すべきデータ送信処理
   */
  protected abstract doSend<T extends TResponse>(data: any): Promise<T>;

  /**
   * 派生クラスで実装すべきヘルスチェック処理
   */
  protected abstract doHealthCheck(): Promise<boolean>;

  /**
   * 派生クラスで実装すべき切断処理
   */
  protected abstract doDisconnect(): Promise<void>;

  /**
   * 初期化チェック
   */
  protected checkInitialized(): void {
    if (!this.isInitialized) {
      throw new Error(`${this.name} adapter is not initialized`);
    }
  }

  /**
   * 成功レスポンスの作成
   */
  protected createSuccessResponse<T extends TResponse>(
    data: T, 
    startTime: number
  ): ApiResponse<T> {
    return {
      success: true,
      data,
      metadata: {
        timestamp: new Date(),
        duration: Date.now() - startTime,
        source: this.name
      }
    };
  }

  /**
   * エラーレスポンスの作成
   */
  protected createErrorResponse<T extends TResponse>(
    error: any, 
    startTime: number
  ): ApiResponse<T> {
    return {
      success: false,
      error: this.handleError(error),
      metadata: {
        timestamp: new Date(),
        duration: Date.now() - startTime,
        source: this.name
      }
    };
  }

  /**
   * エラーハンドリング
   */
  protected handleError(error: any, code?: string): ApiError {
    if (this.isApiError(error)) {
      return error;
    }

    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorCode = code || this.extractErrorCode(error) || 'UNKNOWN_ERROR';

    return {
      code: errorCode,
      message,
      details: error instanceof Error ? error.stack : error,
      retryable: this.isRetryableError(error)
    };
  }

  /**
   * APIエラーかどうかの判定
   */
  protected isApiError(error: any): error is ApiError {
    return error && 
           typeof error.code === 'string' && 
           typeof error.message === 'string' &&
           typeof error.retryable === 'boolean';
  }

  /**
   * エラーコードの抽出
   */
  protected extractErrorCode(error: any): string | null {
    if (error.code) return error.code;
    if (error.response?.status) return `HTTP_${error.response.status}`;
    return null;
  }

  /**
   * リトライ可能なエラーかどうかの判定
   */
  protected isRetryableError(error: any): boolean {
    // ネットワークエラー
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return true;
    }
    
    // HTTPステータスコード
    if (error.response?.status) {
      const status = error.response.status;
      return status === 429 || status === 503 || status >= 500;
    }
    
    return false;
  }
}