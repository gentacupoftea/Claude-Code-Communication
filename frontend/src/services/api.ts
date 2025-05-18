import axios, { AxiosInstance, AxiosError } from 'axios';
import { AuthTokens } from '../types/auth';

class ApiService {
  private instance: AxiosInstance;
  private refreshTokenPromise: Promise<AuthTokens> | null = null;

  constructor() {
    this.instance = axios.create({
      baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1',
      timeout: 10000,
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor to add auth token
    this.instance.interceptors.request.use(
      (config) => {
        const tokens = this.getStoredTokens();
        if (tokens?.accessToken) {
          config.headers.Authorization = `Bearer ${tokens.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle token refresh
    this.instance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && originalRequest && !originalRequest.headers['X-Retry']) {
          // Prevent infinite retry loop
          originalRequest.headers['X-Retry'] = 'true';

          try {
            // Ensure we only refresh once
            if (!this.refreshTokenPromise) {
              this.refreshTokenPromise = this.refreshAccessToken();
            }

            const newTokens = await this.refreshTokenPromise;
            this.refreshTokenPromise = null;

            // Update the original request with new token
            originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
            return this.instance(originalRequest);
          } catch (refreshError) {
            // Refresh failed, redirect to login
            this.clearTokens();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private async refreshAccessToken(): Promise<AuthTokens> {
    const tokens = this.getStoredTokens();
    if (!tokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await this.instance.post<AuthTokens>('/auth/refresh', {
      refresh_token: tokens.refreshToken,
    });

    this.storeTokens(response.data);
    return response.data;
  }

  private getStoredTokens(): AuthTokens | null {
    const tokensJson = localStorage.getItem('auth_tokens');
    return tokensJson ? JSON.parse(tokensJson) : null;
  }

  private storeTokens(tokens: AuthTokens) {
    localStorage.setItem('auth_tokens', JSON.stringify(tokens));
  }

  private clearTokens() {
    localStorage.removeItem('auth_tokens');
  }

  // Public methods
  public get(url: string, config?: any) {
    return this.instance.get(url, config);
  }

  public post(url: string, data?: any, config?: any) {
    return this.instance.post(url, data, config);
  }

  public put(url: string, data?: any, config?: any) {
    return this.instance.put(url, data, config);
  }

  public delete(url: string, config?: any) {
    return this.instance.delete(url, config);
  }
}

export default new ApiService();