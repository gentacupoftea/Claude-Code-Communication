/**
 * Empty data utility for mock mode
 * All data should be empty/zero when REACT_APP_USE_MOCK_AUTH=true
 */

export const emptyDashboardMetrics = {
  totalSales: 0,
  totalOrders: 0,
  averageOrderValue: 0,
  conversionRate: 0,
  customerCount: 0,
  productCount: 0,
};

export const emptyChartData = {
  salesChart: [],
  categoryChart: [],
};

export const emptyOrders: any[] = [];

export const emptyCustomers: any[] = [];

export const emptyProducts: any[] = [];

export const emptyNotifications: any[] = [];

export const emptyAnalyticsData = {
  traffic: {
    visitors: 0,
    pageViews: 0,
    bounceRate: 0,
    avgSessionDuration: 0,
  },
  conversion: {
    rate: 0,
    transactions: 0,
    revenue: 0,
    avgOrderValue: 0,
  },
  topPages: [],
  topProducts: [],
};

export const emptyReports: any[] = [];

export const emptyChatMessages: any[] = [];

export default {
  dashboard: {
    metrics: emptyDashboardMetrics,
    chartData: emptyChartData,
  },
  orders: emptyOrders,
  customers: emptyCustomers,
  products: emptyProducts,
  notifications: emptyNotifications,
  analytics: emptyAnalyticsData,
  reports: emptyReports,
  chat: emptyChatMessages,
};