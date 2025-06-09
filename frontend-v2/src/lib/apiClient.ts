/**
 * API Client
 * バックエンドAPIとの通信を担当するクライアント
 */

import { 
  ChatCompletionRequest, 
  ChatCompletionResponse, 
  ApiErrorResponse,
  LocalLLMProvider,
  AddProviderRequest,
  ProvidersResponse,
  HealthCheckResponse
} from '../types/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

/**
 * APIクライアントのカスタムエラークラス
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public errorResponse: ApiErrorResponse,
    message?: string
  ) {
    super(message || errorResponse.error.message);
    this.name = 'ApiError';
  }
}

/**
 * APIクライアントクラス（シングルトンパターン）
 */
class ApiClient {
  private static instance: ApiClient;

  private constructor() {}

  public static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  /**
   * 共通のリクエストメソッド
   */
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        // APIエラーレスポンスの場合
        throw new ApiError(response.status, data);
      }

      return data;
    } catch (error) {
      // ネットワークエラーなどのfetch自体のエラー
      if (error instanceof ApiError) {
        throw error;
      }
      throw new Error(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * チャット補完APIの呼び出し
   * POST /api/v1/chat/completions
   */
  public async postChatCompletion(data: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    return this.request<ChatCompletionResponse>('/api/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * ヘルスチェックAPI
   * GET /health
   */
  public async getHealth(): Promise<{ status: string; timestamp: string }> {
    return this.request<{ status: string; timestamp: string }>('/health');
  }

  /**
   * ワーカー一覧取得API
   * GET /workers
   */
  public async getWorkers(): Promise<{ workers: string[] }> {
    return this.request<{ workers: string[] }>('/workers');
  }

  /**
   * 特定ワーカーのモデル一覧取得API
   * GET /workers/{workerType}/models
   */
  public async getWorkerModels(workerType: string): Promise<{ worker_type: string; models: string[] }> {
    return this.request<{ worker_type: string; models: string[] }>(`/workers/${workerType}/models`);
  }

  /**
   * ローカルLLMプロバイダ一覧取得API
   * GET /local-llm/providers
   */
  public async getLocalLLMProviders(): Promise<ProvidersResponse> {
    return this.request<ProvidersResponse>('/local-llm/providers');
  }

  /**
   * ローカルLLMプロバイダ追加API
   * POST /local-llm/providers
   */
  public async addLocalLLMProvider(data: AddProviderRequest): Promise<{ success: boolean; message: string; provider: LocalLLMProvider }> {
    return this.request<{ success: boolean; message: string; provider: LocalLLMProvider }>('/local-llm/providers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * ローカルLLMプロバイダヘルスチェックAPI
   * GET /local-llm/providers/health
   */
  public async checkLocalLLMProvidersHealth(): Promise<HealthCheckResponse> {
    return this.request<HealthCheckResponse>('/local-llm/providers/health');
  }
}

/**
 * シングルトンインスタンスのエクスポート
 */
export const apiClient = ApiClient.getInstance();