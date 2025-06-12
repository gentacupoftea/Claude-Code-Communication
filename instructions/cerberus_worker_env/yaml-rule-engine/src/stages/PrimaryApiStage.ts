/**
 * Stage 1: プライマリAPI
 * 最も信頼性が高く、最新のデータを提供
 */

import axios, { AxiosInstance } from 'axios';
import { IFallbackStage, FallbackResult } from '../interfaces/IFallbackService';
import { logger } from '../utils/logger';

export interface PrimaryApiConfig {
  baseUrl: string;
  apiKey?: string;
  headers?: Record<string, string>;
  timeout?: number;
}

export class PrimaryApiStage implements IFallbackStage {
  name = 'primary-api';
  priority = 1;
  timeout: number;
  retryCount = 2;
  
  private client: AxiosInstance;

  constructor(config: PrimaryApiConfig) {
    this.timeout = config.timeout || 5000;
    
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` }),
        ...config.headers
      }
    });

    // インターセプターの設定
    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // リクエストインターセプター
    this.client.interceptors.request.use(
      (config) => {
        config.metadata = { startTime: Date.now() };
        logger.debug('Primary API request', {
          method: config.method,
          url: config.url,
          params: config.params
        });
        return config;
      },
      (error) => {
        logger.error('Primary API request error', error);
        return Promise.reject(error);
      }
    );

    // レスポンスインターセプター
    this.client.interceptors.response.use(
      (response) => {
        const duration = Date.now() - response.config.metadata.startTime;
        logger.debug('Primary API response', {
          status: response.status,
          duration,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        if (error.config?.metadata) {
          const duration = Date.now() - error.config.metadata.startTime;
          logger.error('Primary API response error', {
            status: error.response?.status,
            duration,
            url: error.config.url,
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
      // inputに基づいてAPIエンドポイントとパラメータを決定
      const { endpoint, method = 'GET', data, params } = this.parseInput(input);

      const response = await this.client.request({
        url: endpoint,
        method,
        data,
        params
      });

      return {
        success: true,
        data: response.data,
        stage: this.name,
        duration: Date.now() - startTime,
        metadata: {
          source: 'primary-api',
          statusCode: response.status,
          headers: response.headers
        }
      };
    } catch (error) {
      const axiosError = error as any;
      
      // エラーレスポンスの詳細を記録
      const errorDetails = {
        message: axiosError.message,
        code: axiosError.code,
        status: axiosError.response?.status,
        data: axiosError.response?.data
      };

      logger.error('Primary API execution failed', errorDetails);

      return {
        success: false,
        error: new Error(`Primary API failed: ${axiosError.message}`),
        stage: this.name,
        duration: Date.now() - startTime,
        metadata: {
          source: 'primary-api',
          errorDetails
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
    // inputが文字列の場合はエンドポイントとして扱う
    if (typeof input === 'string') {
      return { endpoint: input };
    }

    // オブジェクトの場合は構造化されたリクエストとして扱う
    if (typeof input === 'object' && input !== null) {
      return {
        endpoint: input.endpoint || '/',
        method: input.method,
        data: input.data,
        params: input.params
      };
    }

    // デフォルト
    return { endpoint: '/' };
  }

  // ヘルスチェック用メソッド
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health', {
        timeout: 2000
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}