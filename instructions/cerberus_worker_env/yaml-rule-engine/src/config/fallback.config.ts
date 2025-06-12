/**
 * フォールバックシステムの設定ファイル
 */

import { FallbackConfig } from '../interfaces/IFallbackService';

export const defaultFallbackConfig: FallbackConfig = {
  stages: [], // 実装時に動的に追加
  circuitBreakerThreshold: 5, // 5回失敗でオープン
  circuitBreakerTimeout: 60000, // 1分後に再試行
  cacheConfig: {
    ttl: 300, // 5分間キャッシュ
    maxSize: 1000, // 最大1000エントリ
    strategy: 'LRU' // Least Recently Used
  },
  metrics: {
    enabled: true,
    sampleRate: 1.0, // 100%サンプリング
    exportInterval: 60000 // 1分ごとにエクスポート
  }
};

// 環境別設定
export const getEnvironmentConfig = (): Partial<FallbackConfig> => {
  const env = process.env.NODE_ENV || 'development';

  switch (env) {
    case 'production':
      return {
        circuitBreakerThreshold: 10,
        circuitBreakerTimeout: 120000, // 2分
        cacheConfig: {
          ttl: 600, // 10分
          maxSize: 5000,
          strategy: 'LFU' // Least Frequently Used
        },
        metrics: {
          enabled: true,
          sampleRate: 0.1, // 10%サンプリング
          exportInterval: 300000 // 5分
        }
      };

    case 'staging':
      return {
        circuitBreakerThreshold: 7,
        circuitBreakerTimeout: 90000,
        cacheConfig: {
          ttl: 450,
          maxSize: 2000,
          strategy: 'LRU'
        },
        metrics: {
          enabled: true,
          sampleRate: 0.5,
          exportInterval: 120000
        }
      };

    default: // development
      return {
        circuitBreakerThreshold: 3,
        circuitBreakerTimeout: 30000,
        cacheConfig: {
          ttl: 60, // 1分
          maxSize: 100,
          strategy: 'FIFO'
        },
        metrics: {
          enabled: true,
          sampleRate: 1.0,
          exportInterval: 30000
        }
      };
  }
};

// API設定
export const apiConfigs = {
  primary: {
    baseUrl: process.env.PRIMARY_API_URL || 'https://api.primary.com',
    apiKey: process.env.PRIMARY_API_KEY,
    timeout: 5000,
    headers: {
      'X-Client-ID': process.env.CLIENT_ID || 'fallback-system'
    }
  },
  secondary: {
    baseUrl: process.env.SECONDARY_API_URL || 'https://api.secondary.com',
    apiKey: process.env.SECONDARY_API_KEY,
    timeout: 8000,
    headers: {
      'X-Client-ID': process.env.CLIENT_ID || 'fallback-system'
    }
  }
};

// LLM設定
export const llmConfig = {
  provider: (process.env.LLM_PROVIDER || 'ollama') as 'openai' | 'anthropic' | 'ollama',
  apiKey: process.env.LLM_API_KEY,
  model: process.env.LLM_MODEL,
  baseURL: process.env.LLM_BASE_URL || 'http://localhost:11434/v1',
  temperature: 0.3,
  maxTokens: 1000,
  systemPrompt: `You are a fallback data provider. When primary data sources are unavailable, 
    generate realistic and consistent data based on the context provided. 
    Always maintain data integrity and follow the requested format.`
};

// 静的デフォルト設定
export const staticDefaultConfig = {
  defaults: {
    status: 'fallback',
    message: 'Operating in fallback mode',
    timestamp: null, // スマートデフォルトで生成
    data: {},
    error: null
  },
  fallbackFile: process.env.FALLBACK_FILE_PATH,
  useSmartDefaults: true
};

// 統合設定を生成
export const createFallbackConfig = (): FallbackConfig => {
  const baseConfig = { ...defaultFallbackConfig };
  const envConfig = getEnvironmentConfig();

  // 環境設定をマージ
  return {
    ...baseConfig,
    ...envConfig,
    cacheConfig: {
      ...baseConfig.cacheConfig,
      ...envConfig.cacheConfig
    },
    metrics: {
      ...baseConfig.metrics,
      ...envConfig.metrics
    }
  };
};