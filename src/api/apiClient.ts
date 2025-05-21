/**
 * APIクライアント
 * API呼び出しを行うための基本クラスと関数
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { API_CONFIG } from './config';
import { ApiResponse, ApiRequestOptions, ErrorCode } from './types';
import { getAccessToken, refreshAccessToken, clearAuthTokens } from './authService';

// カスタムエラークラス
export class ApiError extends Error {
  public readonly code: string;
  public readonly status: number | undefined;
  public readonly data: any;

  constructor(message: string, code: string, status?: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.data = data;
  }
}

// APIクライアントクラス
class ApiClient {
  private instance: AxiosInstance;
  private refreshPromise: Promise<void> | null = null;

  constructor() {
    // Axiosインスタンスを作成
    this.instance = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: API_CONFIG.TIMEOUT,
      headers: API_CONFIG.HEADERS.DEFAULT,
    });

    // リクエストインターセプターを設定
    this.setupRequestInterceptor();
    
    // レスポンスインターセプターを設定
    this.setupResponseInterceptor();
  }

  // リクエストインターセプター設定
  private setupRequestInterceptor(): void {
    this.instance.interceptors.request.use(
      async (config) => {
        if (config.headers && config.headers['x-skip-auth'] === 'true') {
          delete config.headers['x-skip-auth'];
          return config;
        }

        // 認証トークンをヘッダーに追加
        const token = getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        
        // リクエストIDを追加 (デバッグ・トレース用)
        config.headers['X-Request-ID'] = this.generateRequestId();
        
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
  }

  // レスポンスインターセプター設定
  private setupResponseInterceptor(): void {
    this.instance.interceptors.response.use(
      (response) => {
        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config;
        
        // トークン有効期限切れの場合、リフレッシュを試みる
        if (error.response?.status === 401 && 
            !originalRequest?.headers?.['x-skip-refresh'] && 
            originalRequest) {
          
          try {
            // 同時に複数のリクエストがリフレッシュを試みないように
            if (!this.refreshPromise) {
              this.refreshPromise = this.handleTokenRefresh();
            }
            
            // リフレッシュ処理を待つ
            await this.refreshPromise;
            
            // 新しいトークンをヘッダーに設定
            const newToken = getAccessToken();
            if (newToken && originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            
            // 元のリクエストを再試行
            return this.instance(originalRequest);
          } catch (refreshError) {
            // リフレッシュに失敗した場合はログアウト処理
            clearAuthTokens();
            return Promise.reject(error);
          } finally {
            this.refreshPromise = null;
          }
        }
        
        // APIからのエラーレスポンスを適切に処理
        return Promise.reject(this.handleApiError(error));
      }
    );
  }

  // トークンリフレッシュ処理
  private async handleTokenRefresh(): Promise<void> {
    try {
      await refreshAccessToken();
    } catch (error) {
      clearAuthTokens();
      throw error;
    }
  }

  // エラーハンドリング
  private handleApiError(error: AxiosError): ApiError {
    if (error.response) {
      // サーバーからのレスポンスがある場合
      const { data, status } = error.response;
      
      // APIからのエラーコードとメッセージを抽出
      const apiError = data as any;
      const code = apiError?.code || this.mapStatusToErrorCode(status);
      const message = apiError?.message || error.message || 'APIエラーが発生しました';
      
      return new ApiError(message, code, status, apiError);
    } else if (error.request) {
      // リクエストは送信されたがレスポンスがない場合
      if (error.code === 'ECONNABORTED') {
        return new ApiError('リクエストがタイムアウトしました', ErrorCode.TIMEOUT_ERROR);
      }
      return new ApiError('ネットワークエラーが発生しました', ErrorCode.NETWORK_ERROR);
    } else {
      // リクエスト設定時のエラー
      return new ApiError(error.message || '不明なエラーが発生しました', ErrorCode.UNKNOWN_ERROR);
    }
  }

  // HTTPステータスコードをエラーコードにマッピング
  private mapStatusToErrorCode(status: number): string {
    switch (status) {
      case 400: return ErrorCode.VALIDATION_ERROR;
      case 401: return ErrorCode.UNAUTHORIZED;
      case 403: return ErrorCode.FORBIDDEN;
      case 404: return ErrorCode.NOT_FOUND;
      case 500: case 502: case 503: case 504: return ErrorCode.SERVER_ERROR;
      default: return ErrorCode.UNKNOWN_ERROR;
    }
  }

  // 一意のリクエストID生成
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  // GETリクエスト
  public async get<T>(url: string, options: ApiRequestOptions = {}): Promise<ApiResponse<T>> {
    const config: AxiosRequestConfig = {
      params: options.params,
      headers: this.prepareHeaders(options),
      timeout: options.timeout || API_CONFIG.TIMEOUT,
      signal: options.signal,
    };
    
    try {
      const response = await this.instance.get<ApiResponse<T>>(url, config);
      return response.data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw this.handleApiError(error as AxiosError);
    }
  }

  // POSTリクエスト
  public async post<T>(url: string, data: any, options: ApiRequestOptions = {}): Promise<ApiResponse<T>> {
    const config: AxiosRequestConfig = {
      headers: this.prepareHeaders(options),
      timeout: options.timeout || API_CONFIG.TIMEOUT,
      signal: options.signal,
    };
    
    try {
      const response = await this.instance.post<ApiResponse<T>>(url, data, config);
      return response.data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw this.handleApiError(error as AxiosError);
    }
  }

  // PUTリクエスト
  public async put<T>(url: string, data: any, options: ApiRequestOptions = {}): Promise<ApiResponse<T>> {
    const config: AxiosRequestConfig = {
      headers: this.prepareHeaders(options),
      timeout: options.timeout || API_CONFIG.TIMEOUT,
      signal: options.signal,
    };
    
    try {
      const response = await this.instance.put<ApiResponse<T>>(url, data, config);
      return response.data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw this.handleApiError(error as AxiosError);
    }
  }

  // PATCHリクエスト
  public async patch<T>(url: string, data: any, options: ApiRequestOptions = {}): Promise<ApiResponse<T>> {
    const config: AxiosRequestConfig = {
      headers: this.prepareHeaders(options),
      timeout: options.timeout || API_CONFIG.TIMEOUT,
      signal: options.signal,
    };
    
    try {
      const response = await this.instance.patch<ApiResponse<T>>(url, data, config);
      return response.data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw this.handleApiError(error as AxiosError);
    }
  }

  // DELETEリクエスト
  public async delete<T>(url: string, options: ApiRequestOptions = {}): Promise<ApiResponse<T>> {
    const config: AxiosRequestConfig = {
      headers: this.prepareHeaders(options),
      timeout: options.timeout || API_CONFIG.TIMEOUT,
      signal: options.signal,
      data: options.params,
    };
    
    try {
      const response = await this.instance.delete<ApiResponse<T>>(url, config);
      return response.data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw this.handleApiError(error as AxiosError);
    }
  }

  // ヘッダー準備
  private prepareHeaders(options: ApiRequestOptions): Record<string, string> {
    const headers: Record<string, string> = {
      ...API_CONFIG.HEADERS.DEFAULT,
      ...options.headers,
    };
    
    if (options.skipAuthHeader) {
      headers['x-skip-auth'] = 'true';
    }
    
    if (options.skipRefreshToken) {
      headers['x-skip-refresh'] = 'true';
    }
    
    return headers;
  }
}

// シングルトンインスタンス
export const apiClient = new ApiClient();

// APIリクエスト用の便利な関数
export const api = {
  get: <T>(url: string, options?: ApiRequestOptions) => apiClient.get<T>(url, options),
  post: <T>(url: string, data: any, options?: ApiRequestOptions) => apiClient.post<T>(url, data, options),
  put: <T>(url: string, data: any, options?: ApiRequestOptions) => apiClient.put<T>(url, data, options),
  patch: <T>(url: string, data: any, options?: ApiRequestOptions) => apiClient.patch<T>(url, data, options),
  delete: <T>(url: string, options?: ApiRequestOptions) => apiClient.delete<T>(url, options),
};

export default api;