/**
 * API設定の中央管理
 * 統合されたAPIクライアントとエンドポイント定義
 */

// APIベースURL設定（環境変数を統一）
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// APIエンドポイント定義（両バージョンの機能を統合）
export const API_ENDPOINTS = {
  // 認証関連
  AUTH: {
    LOGIN: '/api/auth/login',
    LOGOUT: '/api/auth/logout',
    REFRESH: '/api/auth/refresh',
    PROFILE: '/api/auth/profile',
  },

  // チャット関連（両バージョンのエンドポイントを統合）
  CHAT: {
    SESSIONS: '/api/chat/sessions',
    MESSAGES: '/api/chat/messages',
    SEND_MESSAGE: '/api/chat/message',
    SEND: '/api/chat/send',
    STREAM: '/api/chat/stream',
    GET_HISTORY: '/api/chat/history',
    CREATE_SESSION: '/api/chat/session',
    DELETE_SESSION: (id: string) => `/api/chat/session/${id}`,
  },

  // Multi-LLM関連
  MULTILLM: {
    MODELS: '/api/multillm/models',
    COMPARE: '/api/multillm/compare',
    GENERATE: '/api/multillm/generate',
    STREAM: '/api/multillm/stream',
  },

  // プロジェクト関連
  PROJECTS: {
    LIST: '/api/projects',
    CREATE: '/api/projects',
    GET: (id: string) => `/api/projects/${id}`,
    DETAIL: '/api/projects',
    UPDATE: (id: string) => `/api/projects/${id}`,
    DELETE: (id: string) => `/api/projects/${id}`,
  },

  // 分析関連
  ANALYTICS: {
    DASHBOARD: '/api/analytics/dashboard',
    USAGE: '/api/analytics/usage',
    METRICS: '/api/analytics/metrics',
    CHART_DATA: '/api/analytics/chart',
    PERSONA_GENERATE: '/api/analytics/persona',
    EXPORT: '/api/analytics/export',
  },

  // 設定関連
  SETTINGS: {
    GET: '/api/settings',
    UPDATE: '/api/settings',
    API_KEYS: '/api/settings/api-keys',
  },
} as const;

// API設定オブジェクト
export const API_CONFIG = {
  BASE_URL: API_BASE_URL,
  ENDPOINTS: API_ENDPOINTS,
  REQUEST_CONFIG: {
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include' as RequestCredentials,
    timeout: 10000,
  },
};

// 完全なURLを生成する関数
export const createApiUrl = (endpoint: string): string => {
  return `${API_BASE_URL}${endpoint}`;
};

// APIクライアントクラス（シングルトンパターン）
export class APIClient {
  private static instance: APIClient;
  private authToken: string | null = null;

  private constructor() {}

  public static getInstance(): APIClient {
    if (!APIClient.instance) {
      APIClient.instance = new APIClient();
    }
    return APIClient.instance;
  }

  public setAuthToken(token: string | null) {
    this.authToken = token;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      ...API_CONFIG.REQUEST_CONFIG.headers,
    };
    
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    
    return headers;
  }

  public async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = createApiUrl(endpoint);
    
    try {
      const response = await fetch(url, {
        ...API_CONFIG.REQUEST_CONFIG,
        ...options,
        headers: {
          ...this.getHeaders(),
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      
      return await response.text() as unknown as T;
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  public async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  public async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  public async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  public async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

// APIクライアントのインスタンス
export const apiClient = APIClient.getInstance();

// 環境設定
export const APP_CONFIG = {
  API_BASE_URL,
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  ENABLE_LOGGING: process.env.NODE_ENV === 'development',
} as const;

// 後方互換性のためのエクスポート
export const DEFAULT_API_CONFIG = API_CONFIG.REQUEST_CONFIG;
