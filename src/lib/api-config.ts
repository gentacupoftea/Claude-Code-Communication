<<<<<<< HEAD
/**
 * API設定の中央管理
 */
export const API_CONFIG = {
  // バックエンドのベースURL
  BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001',
  
  // APIエンドポイント
  ENDPOINTS: {
    // 認証関連
    AUTH: {
      LOGIN: '/api/auth/login',
      LOGOUT: '/api/auth/logout',
      REFRESH: '/api/auth/refresh',
      PROFILE: '/api/auth/profile',
    },
    
    // プロジェクト関連
    PROJECTS: {
      LIST: '/api/projects',
      CREATE: '/api/projects',
      GET: (id: string) => `/api/projects/${id}`,
      UPDATE: (id: string) => `/api/projects/${id}`,
      DELETE: (id: string) => `/api/projects/${id}`,
    },
    
    // チャット関連
    CHAT: {
      SEND_MESSAGE: '/api/chat/message',
      GET_HISTORY: '/api/chat/history',
      CREATE_SESSION: '/api/chat/session',
      DELETE_SESSION: (id: string) => `/api/chat/session/${id}`,
    },
    
    // Multi-LLM関連
    MULTILLM: {
      MODELS: '/api/multillm/models',
      GENERATE: '/api/multillm/generate',
      STREAM: '/api/multillm/stream',
    },
    
    // データ分析関連
    ANALYTICS: {
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
  },
  
  // リクエスト設定
  REQUEST_CONFIG: {
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include' as RequestCredentials,
  },
};

// APIクライアントのベースクラス
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
    const url = `${API_CONFIG.BASE_URL}${endpoint}`;
    
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

      return await response.json();
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  public async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  public async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  public async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  public async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = APIClient.getInstance();
=======
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
>>>>>>> feature/multillm-chat-integration
