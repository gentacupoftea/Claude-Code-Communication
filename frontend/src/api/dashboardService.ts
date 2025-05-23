import api from '../services/api';

// Empty data for mock mode
const emptyDashboardData: DashboardSummaryData = {
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
};

const isMockMode = process.env.REACT_APP_USE_MOCK_AUTH === 'true';

export interface DashboardSummaryData {
  totalSales: number;
  totalOrders: number;
  averageOrderValue: number;
  conversionRate: number;
  pendingOrders: number;
  newCustomers: number;
  topProducts: Array<{
    id: string;
    name: string;
    sales: number;
    quantity: number;
  }>;
  recentActivity: Array<{
    id: string;
    type: 'order' | 'customer' | 'product' | 'inventory';
    description: string;
    timestamp: string;
  }>;
  salesByPlatform: Array<{
    platform: string;
    value: number;
    percentage: number;
  }>;
  periodComparison: {
    sales: { current: number; previous: number; change: number };
    orders: { current: number; previous: number; change: number };
    customers: { current: number; previous: number; change: number };
  };
}

export interface DashboardRequestParams {
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  platforms?: string[];
  storeIds?: string[];
  currency?: string;
  refreshCache?: boolean;
}

/**
 * ダッシュボード概要データを取得するAPI
 */
export const DashboardService = {
  /**
   * ダッシュボード概要データを取得
   * @param params リクエストパラメータ
   */
  async getSummary(params: DashboardRequestParams = {}): Promise<DashboardSummaryData> {
    if (isMockMode) {
      return Promise.resolve(emptyDashboardData);
    }
    return api.get('/api/v1/dashboard/summary', { params });
  },

  /**
   * ダッシュボード日次データを取得
   * @param params リクエストパラメータ
   */
  async getDailyStats(params: DashboardRequestParams = {}): Promise<{
    dates: string[];
    sales: number[];
    orders: number[];
  }> {
    if (isMockMode) {
      // Return empty daily stats for mock mode
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
      
      return Promise.resolve({ dates, sales, orders });
    }
    return api.get('/api/v1/dashboard/daily-stats', { params });
  },

  /**
   * ダッシュボードのプラットフォーム別データを取得
   * @param params リクエストパラメータ
   */
  async getPlatformStats(params: DashboardRequestParams = {}): Promise<{
    platforms: string[];
    data: Array<{
      platform: string;
      sales: number;
      orders: number;
      percentage: number;
    }>;
  }> {
    return api.get('/api/v1/dashboard/platform-stats', { params });
  },

  /**
   * トップ製品データを取得
   * @param params リクエストパラメータ
   * @param limit 取得する製品数
   */
  async getTopProducts(params: DashboardRequestParams = {}, limit: number = 5): Promise<Array<{
    id: string;
    name: string;
    sales: number;
    quantity: number;
    platform: string;
  }>> {
    if (isMockMode) {
      return Promise.resolve([]);
    }
    return api.get('/api/v1/dashboard/top-products', { 
      params: { ...params, limit } 
    });
  },

  /**
   * 最近のアクティビティを取得
   * @param params リクエストパラメータ
   * @param limit 取得するアクティビティ数
   */
  async getRecentActivity(params: DashboardRequestParams = {}, limit: number = 10): Promise<Array<{
    id: string;
    type: 'order' | 'customer' | 'product' | 'inventory';
    description: string;
    timestamp: string;
    platform: string;
  }>> {
    return api.get('/api/v1/dashboard/recent-activity', { 
      params: { ...params, limit } 
    });
  },

  /**
   * カスタムメトリクスデータを取得
   * @param metricIds 取得するメトリクスID
   * @param params リクエストパラメータ
   */
  async getCustomMetrics(
    metricIds: string[], 
    params: DashboardRequestParams = {}
  ): Promise<Record<string, any>> {
    return api.post('/api/v1/dashboard/custom-metrics', {
      metricIds,
      ...params
    });
  }
};

export default DashboardService;