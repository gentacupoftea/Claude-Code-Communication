import api from '../services/api';

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