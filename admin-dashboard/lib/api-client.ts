import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

// カスタムエラータイプ
export interface ApiError {
  message: string;
  statusCode?: number;
  details?: any;
}

// APIクライアントのインスタンス作成
const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// リクエストインターセプター
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // ローカルストレージからトークンを取得
    const token = localStorage.getItem('authToken');
    
    if (token) {
      // Authorizationヘッダーにトークンを設定
      config.headers.Authorization = `Bearer ${token}`;
    }

    // リクエストログ（開発環境のみ）
    if (process.env.NODE_ENV === 'development') {
      console.log('API Request:', {
        method: config.method,
        url: config.url,
        data: config.data,
        headers: config.headers,
      });
    }

    return config;
  },
  (error: AxiosError) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// レスポンスインターセプター
apiClient.interceptors.response.use(
  (response) => {
    // レスポンスログ（開発環境のみ）
    if (process.env.NODE_ENV === 'development') {
      console.log('API Response:', {
        status: response.status,
        data: response.data,
        headers: response.headers,
      });
    }

    return response;
  },
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // 401エラー（認証エラー）の処理
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // トークンリフレッシュロジック
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`, {
            refreshToken,
          });

          const { token, refreshToken: newRefreshToken } = response.data;

          // 新しいトークンを保存
          localStorage.setItem('authToken', token);
          if (newRefreshToken) {
            localStorage.setItem('refreshToken', newRefreshToken);
          }

          // 元のリクエストを新しいトークンで再実行
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // リフレッシュも失敗した場合はログイン画面へ
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    // 403エラー（権限エラー）の処理
    if (error.response?.status === 403) {
      console.error('Permission denied:', error.response.data);
      // 権限エラーの通知を表示（トースト通知など）
    }

    // エラーログ
    console.error('API Error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });

    // エラーを整形して返す
    const apiError: ApiError = {
      message: error.response?.data?.message || error.message || 'エラーが発生しました',
      statusCode: error.response?.status,
      details: error.response?.data,
    };

    return Promise.reject(apiError);
  }
);

// ヘルパー関数
export const setAuthToken = (token: string) => {
  localStorage.setItem('authToken', token);
  apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
};

export const removeAuthToken = () => {
  localStorage.removeItem('authToken');
  delete apiClient.defaults.headers.common['Authorization'];
};

// API呼び出し関数
export const api = {
  get: <T = any>(url: string, config?: any) => 
    apiClient.get<T>(url, config).then(res => res.data),
  
  post: <T = any>(url: string, data?: any, config?: any) => 
    apiClient.post<T>(url, data, config).then(res => res.data),
  
  put: <T = any>(url: string, data?: any, config?: any) => 
    apiClient.put<T>(url, data, config).then(res => res.data),
  
  patch: <T = any>(url: string, data?: any, config?: any) => 
    apiClient.patch<T>(url, data, config).then(res => res.data),
  
  delete: <T = any>(url: string, config?: any) => 
    apiClient.delete<T>(url, config).then(res => res.data),
};

export default apiClient;