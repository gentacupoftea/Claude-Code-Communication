/**
 * API設定ファイル
 * APIクライアントの基本設定を定義
 */

// 環境変数から設定値を取得するか、デフォルト値を使用
export const API_CONFIG = {
  // APIのベースURL
  BASE_URL: process.env.REACT_APP_API_BASE_URL || 'https://api.conea.shopify-mcp.com',
  
  // API呼び出しのタイムアウト (ミリ秒)
  TIMEOUT: Number(process.env.REACT_APP_API_TIMEOUT) || 30000,
  
  // リトライ設定
  RETRY: {
    // リトライ回数
    MAX_ATTEMPTS: Number(process.env.REACT_APP_API_RETRY_ATTEMPTS) || 3,
    // リトライ間隔 (ミリ秒)
    DELAY: Number(process.env.REACT_APP_API_RETRY_DELAY) || 1000,
    // バックオフ係数 (各リトライで遅延が増加する倍率)
    BACKOFF_FACTOR: Number(process.env.REACT_APP_API_RETRY_BACKOFF) || 2,
  },
  
  // 認証関連の設定
  AUTH: {
    // トークンを保存するローカルストレージのキー
    TOKEN_STORAGE_KEY: 'conea_auth_token',
    // リフレッシュトークンを保存するローカルストレージのキー
    REFRESH_TOKEN_STORAGE_KEY: 'conea_refresh_token',
    // ユーザー情報を保存するローカルストレージのキー
    USER_STORAGE_KEY: 'conea_user',
    // トークンの有効期限を保存するローカルストレージのキー
    TOKEN_EXPIRY_KEY: 'conea_token_expiry',
    // トークンの更新を試みる前の残り時間 (秒)
    REFRESH_THRESHOLD: Number(process.env.REACT_APP_AUTH_REFRESH_THRESHOLD) || 300,
  },
  
  // エンドポイント設定
  ENDPOINTS: {
    // 認証関連
    AUTH: {
      LOGIN: '/auth/login',
      LOGOUT: '/auth/logout',
      REFRESH: '/auth/refresh',
      REGISTER: '/auth/register',
      PROFILE: '/auth/profile',
    },
    // Shopify関連
    SHOPIFY: {
      STORES: '/shopify/stores',
      SYNC: '/shopify/sync',
      PRODUCTS: '/shopify/products',
      ORDERS: '/shopify/orders',
      CUSTOMERS: '/shopify/customers',
    },
    // 分析関連
    ANALYTICS: {
      DASHBOARD: '/analytics/dashboard',
      REPORTS: '/analytics/reports',
      EXPORT: '/analytics/export',
    },
  },
  
  // ヘッダー設定
  HEADERS: {
    DEFAULT: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  },
};

export default API_CONFIG;