import axios, { AxiosInstance, AxiosError } from 'axios';
import { AuthTokens } from '../types/auth';

class ApiService {
  private instance: AxiosInstance;
  private refreshTokenPromise: Promise<AuthTokens> | null = null;
  private isMockMode: boolean;

  constructor() {
    const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    console.log('API baseURL:', baseURL);
    
    this.isMockMode = process.env.REACT_APP_USE_MOCK_AUTH === 'true';
    
    this.instance = axios.create({
      baseURL,
      timeout: 10000,
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor to add auth token
    this.instance.interceptors.request.use(
      (config) => {
        const tokens = this.getStoredTokens();
        if (tokens?.access_token) {
          config.headers.Authorization = `Bearer ${tokens.access_token}`;
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
            originalRequest.headers.Authorization = `Bearer ${newTokens.access_token}`;
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
    if (!tokens?.refresh_token) {
      throw new Error('No refresh token available');
    }

    const response = await this.instance.post<AuthTokens>('/api/v1/auth/refresh', {
      refresh_token: tokens.refresh_token,
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

  // Mock data handlers
  private getMockData<T>(url: string): T | null {
    // Handle different API endpoints with empty data in mock mode
    if (url.includes('/dashboard/summary')) {
      return {
        totalSales: 0,
        totalOrders: 0,
        averageOrderValue: 0,
        conversionRate: 0,
        pendingOrders: 0,
        newCustomers: 0,
        topProducts: [],
        recentActivity: [],
        salesByPlatform: [],
        periodComparison: {
          sales: { current: 0, previous: 0, change: 0 },
          orders: { current: 0, previous: 0, change: 0 },
          customers: { current: 0, previous: 0, change: 0 },
        },
      } as any;
    }
    
    if (url.includes('/shopify/stores')) {
      return [] as any; // Return empty stores in mock mode
    }
    
    return null;
  }

  // Public methods
  public async get<T = any>(url: string, config?: any): Promise<T> {
    if (this.isMockMode) {
      const mockData = this.getMockData<T>(url);
      if (mockData !== null) {
        return Promise.resolve(mockData);
      }
    }
    
    const response = await this.instance.get<T>(url, config);
    return response.data;
  }

  public async post<T = any>(url: string, data?: any, config?: any): Promise<T> {
    if (this.isMockMode) {
      // Return mock responses for POST requests
      if (url.includes('/auth/refresh')) {
        return {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
        } as any;
      }
      
      // Default mock success response
      return { success: true, message: 'Mock operation successful' } as any;
    }
    
    const response = await this.instance.post<T>(url, data, config);
    return response.data;
  }

  public async put<T = any>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.instance.put<T>(url, data, config);
    return response.data;
  }

  public async delete<T = any>(url: string, config?: any): Promise<T> {
    const response = await this.instance.delete<T>(url, config);
    return response.data;
  }

  public async patch<T = any>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.instance.patch<T>(url, data, config);
    return response.data;
  }
}

const api = new ApiService();
export default api;
export { api };