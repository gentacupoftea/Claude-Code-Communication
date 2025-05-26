/**
 * Axios Interceptors for unified error handling
 * API通信の統一エラーハンドリング
 */
import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import errorService from './errorService';

export interface RetryConfig {
  retries: number;
  retryDelay: number;
  retryCondition?: (error: AxiosError) => boolean;
}

export interface ApiInterceptorConfig {
  enableErrorReporting: boolean;
  enableRetry: boolean;
  retryConfig: RetryConfig;
  enableLogging: boolean;
}

class ApiInterceptorService {
  private config: ApiInterceptorConfig = {
    enableErrorReporting: true,
    enableRetry: true,
    retryConfig: {
      retries: 3,
      retryDelay: 1000,
      retryCondition: (error) => {
        return !error.response || 
               error.response.status >= 500 || 
               error.code === 'ECONNABORTED' ||
               error.code === 'NETWORK_ERROR';
      }
    },
    enableLogging: process.env.NODE_ENV === 'development'
  };

  private requestRetryCount = new WeakMap<AxiosRequestConfig, number>();

  /**
   * リクエストインターセプターの設定
   */
  setupRequestInterceptor(axiosInstance = axios) {
    axiosInstance.interceptors.request.use(
      (config) => {
        // リクエストログ
        if (this.config.enableLogging) {
          console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`, {
            headers: config.headers,
            params: config.params,
            data: config.data
          });
        }

        // タイムスタンプを追加
        (config as any).metadata = {
          ...(config as any).metadata,
          startTime: Date.now()
        };

        // リトライカウントの初期化
        if (!this.requestRetryCount.has(config)) {
          this.requestRetryCount.set(config, 0);
        }

        return config;
      },
      (error) => {
        if (this.config.enableErrorReporting) {
          errorService.trackError(error as any, {
            component: 'ApiInterceptor',
            action: 'request_setup'
          });
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * レスポンスインターセプターの設定
   */
  setupResponseInterceptor(axiosInstance = axios) {
    axiosInstance.interceptors.response.use(
      (response) => {
        // 成功レスポンスのログ
        if (this.config.enableLogging) {
          const duration = Date.now() - ((response.config as any).metadata?.startTime || 0);
          console.log(`✅ API Response: ${response.status} ${response.config.url} (${duration}ms)`, {
            data: response.data,
            headers: response.headers
          });
        }

        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config;
        
        if (!originalRequest) {
          return Promise.reject(error);
        }

        // エラーログ
        if (this.config.enableLogging) {
          const duration = Date.now() - ((originalRequest as any).metadata?.startTime || 0);
          console.error(`❌ API Error: ${error.response?.status || 'Network'} ${originalRequest.url} (${duration}ms)`, {
            error: error.message,
            response: error.response?.data,
            config: originalRequest
          });
        }

        // エラーレポート
        if (this.config.enableErrorReporting) {
          errorService.trackError(error as any, {
            endpoint: originalRequest.url,
            method: originalRequest.method?.toUpperCase(),
            data: originalRequest.data
          });
        }

        // リトライ処理
        if (this.config.enableRetry && this.shouldRetry(error, originalRequest)) {
          return this.retryRequest(error, originalRequest);
        }

        return Promise.reject(this.enhanceError(error));
      }
    );
  }

  /**
   * リトライ判定
   */
  private shouldRetry(error: AxiosError, config: AxiosRequestConfig): boolean {
    const retryCount = this.requestRetryCount.get(config) || 0;
    const maxRetries = this.config.retryConfig.retries;
    
    // 最大リトライ回数チェック
    if (retryCount >= maxRetries) {
      return false;
    }

    // カスタムリトライ条件
    if (this.config.retryConfig.retryCondition) {
      return this.config.retryConfig.retryCondition(error);
    }

    // デフォルトリトライ条件
    return !error.response || 
           error.response.status >= 500 || 
           error.code === 'ECONNABORTED' ||
           error.code === 'NETWORK_ERROR';
  }

  /**
   * リクエストリトライ実行
   */
  private async retryRequest(error: AxiosError, config: AxiosRequestConfig): Promise<AxiosResponse> {
    const retryCount = this.requestRetryCount.get(config) || 0;
    const newRetryCount = retryCount + 1;
    
    this.requestRetryCount.set(config, newRetryCount);

    // 指数バックオフ遅延
    const delay = this.config.retryConfig.retryDelay * Math.pow(2, retryCount);
    
    if (this.config.enableLogging) {
      console.warn(`🔄 Retrying API request (${newRetryCount}/${this.config.retryConfig.retries}): ${config.url}`, {
        delay,
        reason: error.message
      });
    }

    await this.delay(delay);
    
    return axios(config);
  }

  /**
   * エラーオブジェクトの拡張
   */
  private enhanceError(error: AxiosError): AxiosError {
    // ユーザーフレンドリーなメッセージを追加
    const enhancedError = error as AxiosError & { 
      userMessage?: string; 
      retryable?: boolean;
      errorId?: string;
    };

    // エラータイプ別のメッセージ設定
    if (!error.response) {
      enhancedError.userMessage = 'ネットワーク接続エラーです。インターネット接続を確認してください。';
      enhancedError.retryable = true;
    } else {
      const status = error.response.status;
      switch (true) {
        case status >= 500:
          enhancedError.userMessage = 'サーバーエラーが発生しました。しばらく後に再試行してください。';
          enhancedError.retryable = true;
          break;
        case status === 401:
          enhancedError.userMessage = '認証が必要です。再度ログインしてください。';
          enhancedError.retryable = false;
          break;
        case status === 403:
          enhancedError.userMessage = 'アクセス権限がありません。';
          enhancedError.retryable = false;
          break;
        case status === 404:
          enhancedError.userMessage = '要求されたリソースが見つかりません。';
          enhancedError.retryable = false;
          break;
        case status === 429:
          enhancedError.userMessage = 'リクエストが多すぎます。しばらく待ってから再試行してください。';
          enhancedError.retryable = true;
          break;
        case status >= 400:
          enhancedError.userMessage = (error.response.data as any)?.message || '入力内容を確認してください。';
          enhancedError.retryable = false;
          break;
        default:
          enhancedError.userMessage = '予期しないエラーが発生しました。';
          enhancedError.retryable = false;
      }
    }

    // エラーIDの追加
    enhancedError.errorId = `api_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    return enhancedError;
  }

  /**
   * 遅延ユーティリティ
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 設定更新
   */
  updateConfig(newConfig: Partial<ApiInterceptorConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 統計情報取得
   */
  getStats() {
    return {
      config: this.config
    };
  }
}

export const apiInterceptorService = new ApiInterceptorService();
export default apiInterceptorService;