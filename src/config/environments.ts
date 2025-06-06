/**
 * 環境設定ファイル
 * 
 * このファイルは各実行環境（開発、ステージング、本番）に応じた設定をエクスポートします。
 * 環境変数から適切な値を取得し、アプリケーション全体で利用可能な設定オブジェクトを提供します。
 */

// 利用可能な環境のタイプを定義
export type Environment = 'development' | 'staging' | 'production' | 'test';

// 環境設定の共通インターフェース
export interface EnvironmentConfig {
  // アプリケーション設定
  env: Environment;
  apiUrl: string;
  websocketUrl: string;
  oauthCallbackUrl: string;
  
  // デバッグ設定
  debug: boolean;
  performanceMonitoring: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  
  // 機能フラグ
  features: {
    enableAnalytics: boolean;
    enableCacheOptimization: boolean;
    enableAdvancedCharts: boolean;
    enableBatchProcessing: boolean;
  };
  
  // API接続設定
  api: {
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
    batchSize: number;
  };
  
  // 認証設定
  auth: {
    tokenExpiryTime: number; // ミリ秒
    refreshTokenEnabled: boolean;
  };
}

// 開発環境設定
const development: EnvironmentConfig = {
  env: 'development',
  apiUrl: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  websocketUrl: process.env.REACT_APP_WEBSOCKET_URL || 'ws://localhost:8000/ws',
  oauthCallbackUrl: process.env.REACT_APP_OAUTH_CALLBACK_URL || 'http://localhost:3000/oauth/callback',
  debug: true,
  performanceMonitoring: false,
  logLevel: 'debug',
  features: {
    enableAnalytics: false,
    enableCacheOptimization: true,
    enableAdvancedCharts: true,
    enableBatchProcessing: true,
  },
  api: {
    timeout: 10000,
    retryAttempts: 3,
    retryDelay: 1000,
    batchSize: 50,
  },
  auth: {
    tokenExpiryTime: 8 * 60 * 60 * 1000, // 8時間
    refreshTokenEnabled: true,
  },
};

// ステージング環境設定
const staging: EnvironmentConfig = {
  env: 'staging',
  apiUrl: process.env.REACT_APP_API_URL || 'https://staging-api.conea.shopify-mcp.com',
  websocketUrl: process.env.REACT_APP_WEBSOCKET_URL || 'wss://staging-api.conea.shopify-mcp.com/ws',
  oauthCallbackUrl: process.env.REACT_APP_OAUTH_CALLBACK_URL || 'https://staging.conea.shopify-mcp.com/oauth/callback',
  debug: process.env.REACT_APP_ENABLE_DEBUG === 'true',
  performanceMonitoring: process.env.REACT_APP_PERFORMANCE_MONITORING === 'true',
  logLevel: (process.env.REACT_APP_LOG_LEVEL?.toLowerCase() as 'debug' | 'info' | 'warn' | 'error') || 'info',
  features: {
    enableAnalytics: true,
    enableCacheOptimization: true,
    enableAdvancedCharts: true,
    enableBatchProcessing: true,
  },
  api: {
    timeout: 15000,
    retryAttempts: 3,
    retryDelay: 2000,
    batchSize: 100,
  },
  auth: {
    tokenExpiryTime: 8 * 60 * 60 * 1000, // 8時間
    refreshTokenEnabled: true,
  },
};

// 本番環境設定
const production: EnvironmentConfig = {
  env: 'production',
  apiUrl: process.env.REACT_APP_API_URL || 'https://api.conea.shopify-mcp.com',
  websocketUrl: process.env.REACT_APP_WEBSOCKET_URL || 'wss://api.conea.shopify-mcp.com/ws',
  oauthCallbackUrl: process.env.REACT_APP_OAUTH_CALLBACK_URL || 'https://conea.shopify-mcp.com/oauth/callback',
  debug: false,
  performanceMonitoring: true,
  logLevel: 'error',
  features: {
    enableAnalytics: true,
    enableCacheOptimization: true,
    enableAdvancedCharts: true,
    enableBatchProcessing: true,
  },
  api: {
    timeout: 20000,
    retryAttempts: 5,
    retryDelay: 3000,
    batchSize: 200,
  },
  auth: {
    tokenExpiryTime: 4 * 60 * 60 * 1000, // 4時間
    refreshTokenEnabled: true,
  },
};

// テスト環境設定
const test: EnvironmentConfig = {
  env: 'test',
  apiUrl: 'http://localhost:8000',
  websocketUrl: 'ws://localhost:8000/ws',
  oauthCallbackUrl: 'http://localhost:3000/oauth/callback',
  debug: true,
  performanceMonitoring: false,
  logLevel: 'debug',
  features: {
    enableAnalytics: false,
    enableCacheOptimization: false,
    enableAdvancedCharts: false,
    enableBatchProcessing: false,
  },
  api: {
    timeout: 5000,
    retryAttempts: 0,
    retryDelay: 0,
    batchSize: 10,
  },
  auth: {
    tokenExpiryTime: 1 * 60 * 60 * 1000, // 1時間
    refreshTokenEnabled: false,
  },
};

// 環境に応じた設定を取得する関数
export const getEnvironment = (): EnvironmentConfig => {
  const env = (process.env.NODE_ENV || 'development') as Environment;
  
  switch (env) {
    case 'production':
      return production;
    case 'staging':
      return staging;
    case 'test':
      return test;
    case 'development':
    default:
      return development;
  }
};

// 現在の環境設定をエクスポート
export const currentEnvironment = getEnvironment();

// エクスポート
const environments = {
  development,
  staging,
  production,
  test,
  current: currentEnvironment,
};

export default environments;