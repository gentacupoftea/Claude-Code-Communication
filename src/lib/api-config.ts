// API設定ファイル
// 環境変数とAPIエンドポイントの設定

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const API_ENDPOINTS = {
  // 認証関連
  AUTH: {
    LOGIN: '/api/auth/login',
    LOGOUT: '/api/auth/logout',
    REFRESH: '/api/auth/refresh',
    PROFILE: '/api/auth/profile',
  },

  // チャット関連
  CHAT: {
    SESSIONS: '/api/chat/sessions',
    MESSAGES: '/api/chat/messages',
    SEND: '/api/chat/send',
    STREAM: '/api/chat/stream',
  },

  // Multi-LLM関連
  MULTILLM: {
    MODELS: '/api/multillm/models',
    COMPARE: '/api/multillm/compare',
    GENERATE: '/api/multillm/generate',
  },

  // プロジェクト関連
  PROJECTS: {
    LIST: '/api/projects',
    CREATE: '/api/projects',
    DETAIL: '/api/projects',
    UPDATE: '/api/projects',
    DELETE: '/api/projects',
  },

  // 分析関連
  ANALYTICS: {
    DASHBOARD: '/api/analytics/dashboard',
    USAGE: '/api/analytics/usage',
    METRICS: '/api/analytics/metrics',
  },
} as const;

// 完全なURLを生成する関数
export const createApiUrl = (endpoint: string): string => {
  return `${API_BASE_URL}${endpoint}`;
};

// APIリクエストのデフォルト設定
export const DEFAULT_API_CONFIG = {
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10秒
} as const;

// 環境設定
export const APP_CONFIG = {
  API_BASE_URL,
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  ENABLE_LOGGING: process.env.NODE_ENV === 'development',
} as const;