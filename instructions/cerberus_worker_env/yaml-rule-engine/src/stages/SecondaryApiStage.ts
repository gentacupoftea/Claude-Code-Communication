/**
 * Stage 2: セカンダリAPI
 * バックアップAPIサービス
 */

import axios, { AxiosInstance } from 'axios';
import { IFallbackStage, FallbackResult } from '../interfaces/IFallbackService';
import { logger } from '../utils/logger';

export interface SecondaryApiConfig {
  baseUrl: string;
  apiKey?: string;
  headers?: Record<string, string>;
  timeout?: number;
  transformResponse?: (data: any) => any;
}

export class SecondaryApiStage implements IFallbackStage {
  name = 'secondary-api';
  priority = 2;
  timeout: number;
  retryCount = 1;
  
  private client: AxiosInstance;
  private transformResponse?: (data: any) => any;

  constructor(config: SecondaryApiConfig) {
    this.timeout = config.timeout || 8000; // プライマリより長めのタイムアウト
    this.transformResponse = config.transformResponse;
    
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { 'X-API-Key': config.apiKey }),
        ...config.headers
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      (config) => {
        config.metadata = { startTime: Date.now() };
        logger.debug('Secondary API request', {
          method: config.method,
          url: config.url
        });
        return config;
      },
      (error) => {
        logger.error('Secondary API request error', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        const duration = Date.now() - response.config.metadata.startTime;
        logger.debug('Secondary API response', {
          status: response.status,
          duration
        });

        // レスポンス変換が設定されている場合
        if (this.transformResponse && response.data) {
          try {
            response.data = this.transformResponse(response.data);
          } catch (error) {
            logger.error('Response transformation failed', error);
          }
        }

        return response;
      },
      (error) => {
        if (error.config?.metadata) {
          const duration = Date.now() - error.config.metadata.startTime;
          logger.error('Secondary API response error', {
            status: error.response?.status,
            duration,
            error: error.message
          });
        }
        return Promise.reject(error);
      }
    );
  }

  async execute(input: any): Promise<FallbackResult> {
    const startTime = Date.now();

    try {
      const { endpoint, method = 'GET', data, params } = this.parseInput(input);

      // セカンダリAPIは異なるエンドポイント構造を持つ可能性がある
      const secondaryEndpoint = this.mapToSecondaryEndpoint(endpoint);

      const response = await this.client.request({
        url: secondaryEndpoint,
        method,
        data: this.transformRequestData(data),
        params
      });

      return {
        success: true,
        data: response.data,
        stage: this.name,
        duration: Date.now() - startTime,
        metadata: {
          source: 'secondary-api',
          statusCode: response.status,
          transformed: !!this.transformResponse
        }
      };
    } catch (error) {
      const axiosError = error as any;

      logger.error('Secondary API execution failed', {
        message: axiosError.message,
        code: axiosError.code,
        status: axiosError.response?.status
      });

      return {
        success: false,
        error: new Error(`Secondary API failed: ${axiosError.message}`),
        stage: this.name,
        duration: Date.now() - startTime,
        metadata: {
          source: 'secondary-api',
          error: axiosError.message
        }
      };
    }
  }

  private parseInput(input: any): {
    endpoint: string;
    method?: string;
    data?: any;
    params?: any;
  } {
    if (typeof input === 'string') {
      return { endpoint: input };
    }

    if (typeof input === 'object' && input !== null) {
      return {
        endpoint: input.endpoint || '/',
        method: input.method,
        data: input.data,
        params: input.params
      };
    }

    return { endpoint: '/' };
  }

  private mapToSecondaryEndpoint(primaryEndpoint: string): string {
    // エンドポイントマッピングのロジック
    // 例: /users -> /api/v2/accounts
    const endpointMap: Record<string, string> = {
      '/users': '/api/v2/accounts',
      '/products': '/api/v2/items',
      '/orders': '/api/v2/purchases'
    };

    return endpointMap[primaryEndpoint] || primaryEndpoint;
  }

  private transformRequestData(data: any): any {
    if (!data) return data;

    // セカンダリAPIの形式に合わせてデータを変換
    // 例: { name: 'John' } -> { userName: 'John' }
    const transformed = { ...data };

    // フィールドマッピング
    const fieldMap: Record<string, string> = {
      'name': 'userName',
      'email': 'emailAddress',
      'phone': 'phoneNumber'
    };

    for (const [oldField, newField] of Object.entries(fieldMap)) {
      if (oldField in transformed) {
        transformed[newField] = transformed[oldField];
        delete transformed[oldField];
      }
    }

    return transformed;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/status', {
        timeout: 3000
      });
      return response.status === 200 || response.status === 204;
    } catch (error) {
      return false;
    }
  }
}