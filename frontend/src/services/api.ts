import axios, { AxiosInstance, AxiosError } from 'axios';
import { AuthTokens } from '../types/auth';

class ApiService {
  private instance: AxiosInstance;
  private refreshTokenPromise: Promise<AuthTokens> | null = null;
  private isMockMode: boolean;

  constructor() {
    const baseURL = process.env.REACT_APP_API_URL || 'https://shopify-mcp-server-259335331171.asia-northeast1.run.app';
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
        totalRevenue: 0,
        totalOrders: 0,
        newCustomers: 0,
        conversionRate: 0,
        totalSales: 0,
        averageOrderValue: 0,
        pendingOrders: 0,
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
    
    if (url.includes('/dashboard/daily-stats')) {
      const dates: string[] = [];
      const sales: number[] = [];
      const orders: number[] = [];
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dates.push(date.toISOString().split('T')[0]);
        sales.push(0);
        orders.push(0);
      }
      
      return { dates, sales, orders } as any;
    }
    
    if (url.includes('/dashboard/platform-stats')) {
      return {
        platforms: [],
        data: []
      } as any;
    }
    
    if (url.includes('/dashboard/top-products')) {
      return [] as any;
    }
    
    if (url.includes('/dashboard/recent-activity')) {
      return [] as any;
    }
    
    // Performance metrics endpoints
    if (url.includes('/performance/overview')) {
      return {
        apiResponseTime: 0,
        syncJobSuccessRate: 0,
        systemCpuUsage: 0,
        systemMemoryUsage: 0,
        activeConnections: 0,
        errorRate: 0,
        cacheHitRate: 0,
        databaseResponseTime: 0,
      } as any;
    }
    
    if (url.includes('/performance/metrics/time-series')) {
      return [] as any;
    }
    
    if (url.includes('/performance/metrics/latest')) {
      return [] as any;
    }
    
    if (url.includes('/performance/metrics/available')) {
      return [] as any;
    }
    
    if (url.includes('/performance/alerts')) {
      return [] as any;
    }
    
    if (url.includes('/performance/sync/')) {
      return {
        duration: 0,
        resourceUsage: { cpu: 0, memory: 0, network: { in: 0, out: 0 } },
        dataProcessed: 0,
        errorRate: 0,
        apiCallsMade: 0,
      } as any;
    }
    
    if (url.includes('/performance/api')) {
      return {
        endpointStats: [],
        overallStats: {
          avgResponseTime: 0,
          p95ResponseTime: 0,
          errorRate: 0,
          totalRequests: 0,
        },
      } as any;
    }
    
    if (url.includes('/performance/system/resources')) {
      return {
        cpu: [],
        memory: [],
        disk: [],
        network: { in: [], out: [] },
      } as any;
    }
    
    // Cache endpoints
    if (url.includes('/cache/metrics')) {
      return {
        hitRate: 0,
        missRate: 0,
        itemCount: 0,
        sizeBytes: 0,
        avgResponseTimeMs: 0,
        oldestItemAge: 0,
        totalRequests: 0,
        totalHits: 0,
        totalMisses: 0,
        memoryUsagePercentage: 0,
        topCachedEndpoints: [],
        cacheEfficiencyByPlatform: {},
      } as any;
    }
    
    if (url.includes('/cache/settings')) {
      return {
        enabled: true,
        ttlSeconds: 3600,
        maxSizeBytes: 1073741824,
        compressionEnabled: true,
        preferCache: true,
        refreshInterval: 300,
        endpointSettings: {},
        platformSettings: {},
      } as any;
    }
    
    if (url.includes('/cache/details')) {
      return {
        keyCount: 0,
        keySizeDistribution: {},
        ageDistribution: {},
        platforms: {},
      } as any;
    }
    
    if (url.includes('/cache/history')) {
      return [] as any;
    }
    
    // Channel endpoints
    if (url.includes('/channels')) {
      return [] as any; // Return empty channels in mock mode
    }
    
    if (url.includes('/oauth/initiate')) {
      return {
        authUrl: 'https://mock-auth-url.com',
        state: 'mock-state',
      } as any;
    }
    
    // Environment endpoints
    if (url.includes('/environment/categories')) {
      return [] as any;
    }
    
    if (url.includes('/environment')) {
      return [] as any; // Return empty environment variables in mock mode
    }
    
    // Sync endpoints
    if (url.includes('/sync/jobs')) {
      return [] as any;
    }
    
    if (url.includes('/sync/stats')) {
      return {
        totalJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
        averageJobDuration: 0,
        totalDataProcessed: 0,
        latestJobStatus: 'none',
      } as any;
    }
    
    if (url.includes('/sync/schedules')) {
      return [] as any;
    }
    
    // Report endpoints
    if (url.includes('/reports')) {
      return [] as any;
    }
    
    // Widget endpoints
    if (url.includes('/widgets')) {
      return [] as any;
    }
    
    if (url.includes('/analytics/orders/summary')) {
      return {
        totalOrders: 125,
        totalRevenue: 112400,
        averageOrderValue: 899.20,
        conversionRate: 3.2,
        topSellingProducts: [
          { name: 'Premium Shirt', quantity: 45, revenue: 22500 },
          { name: 'Designer Shoes', quantity: 32, revenue: 38400 },
          { name: 'Accessories Pack', quantity: 78, revenue: 15600 },
        ],
        ordersByStatus: {
          completed: 98,
          pending: 15,
          cancelled: 12,
        },
      } as any;
    }
    
    if (url.includes('/orders')) {
      return {
        orders: [
          {
            id: '1',
            name: '10234',
            orderNumber: '10234',
            customer: { email: 'sarah.johnson@example.com' },
            email: 'sarah.johnson@example.com',
            totalPrice: 12900,
            totalAmount: 12900,
            financialStatus: 'Paid',
            fulfillmentStatus: 'Fulfilled',
            createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          },
          {
            id: '2',
            name: '10233',
            orderNumber: '10233',
            customer: { email: 'yamada.hanako@example.com' },
            email: 'yamada.hanako@example.com',
            totalPrice: 8500,
            totalAmount: 8500,
            financialStatus: 'Paid',
            fulfillmentStatus: 'Unfulfilled',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
          },
          {
            id: '3',
            name: '10232',
            orderNumber: '10232',
            customer: { email: 'michael.chen@example.com' },
            email: 'michael.chen@example.com',
            totalPrice: 23500,
            totalAmount: 23500,
            financialStatus: 'Pending',
            fulfillmentStatus: 'Unfulfilled',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
          },
          {
            id: '4',
            name: '10231',
            orderNumber: '10231',
            customer: { email: 'lisa.park@example.com' },
            email: 'lisa.park@example.com',
            totalPrice: 45000,
            totalAmount: 45000,
            financialStatus: 'Paid',
            fulfillmentStatus: 'Fulfilled',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
          },
          {
            id: '5',
            name: '10230',
            orderNumber: '10230',
            customer: { email: 'john.smith@example.com' },
            email: 'john.smith@example.com',
            totalPrice: 15600,
            totalAmount: 15600,
            financialStatus: 'Paid',
            fulfillmentStatus: 'Fulfilled',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
          },
        ],
        total: 5,
        totalPages: 1,
      } as any;
    }
    
    // Catch-all for any other endpoints - return empty data
    console.warn(`Mock data not configured for endpoint: ${url}`);
    return {} as any;
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
      
      if (url.includes('/dashboard/custom-metrics')) {
        return {} as any;
      }
      
      if (url.includes('/cache/clear')) {
        return { success: true, clearedItems: 0 } as any;
      }
      
      if (url.includes('/cache/invalidate')) {
        return { success: true } as any;
      }
      
      if (url.includes('/sync/jobs') && url.includes('/cancel')) {
        return { success: true, message: 'Job cancelled' } as any;
      }
      
      if (url.includes('/sync/jobs') && url.includes('/retry')) {
        return {
          id: 'job-retry',
          type: 'shopify',
          status: 'pending',
          progress: 0,
          startedAt: new Date().toISOString(),
        } as any;
      }
      
      if (url.includes('/sync/jobs')) {
        return {
          id: 'new-job',
          type: data?.type || 'shopify',
          status: 'pending',
          progress: 0,
          startedAt: new Date().toISOString(),
        } as any;
      }
      
      if (url.includes('/performance/alerts') && url.includes('/acknowledge')) {
        return {
          id: url.split('/').pop()?.replace('/acknowledge', ''),
          acknowledged: true,
        } as any;
      }
      
      // Default mock success response
      return { success: true, message: 'Mock operation successful' } as any;
    }
    
    const response = await this.instance.post<T>(url, data, config);
    return response.data;
  }

  public async put<T = any>(url: string, data?: any, config?: any): Promise<T> {
    if (this.isMockMode) {
      // Return mock responses for PUT requests
      if (url.includes('/cache/settings')) {
        return {
          enabled: true,
          ttlSeconds: 3600,
          maxSizeBytes: 1073741824,
          compressionEnabled: true,
          preferCache: true,
          refreshInterval: 300,
          endpointSettings: {},
          platformSettings: {},
          ...data,
        } as any;
      }
      
      // Default mock success response
      return { success: true, message: 'Mock update successful', ...data } as any;
    }
    
    const response = await this.instance.put<T>(url, data, config);
    return response.data;
  }

  public async delete<T = any>(url: string, config?: any): Promise<T> {
    if (this.isMockMode) {
      // Return mock success response for DELETE requests
      return { success: true, message: 'Mock delete successful' } as any;
    }
    
    const response = await this.instance.delete<T>(url, config);
    return response.data;
  }

  public async patch<T = any>(url: string, data?: any, config?: any): Promise<T> {
    if (this.isMockMode) {
      // Return mock success response for PATCH requests
      return { success: true, message: 'Mock patch successful', ...data } as any;
    }
    
    const response = await this.instance.patch<T>(url, data, config);
    return response.data;
  }
}

const api = new ApiService();
export default api;
export { api };