import { api } from '../services/api';

export interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  timestamp: string;
  category: 'api' | 'sync' | 'system' | 'database' | 'cache';
  source: string;
  tags?: Record<string, string>;
}

export interface SystemAlert {
  id: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  source: string;
  timestamp: string;
  category: 'api' | 'sync' | 'system' | 'database' | 'cache';
  metadata?: Record<string, any>;
  acknowledged: boolean;
  resolvedAt?: string;
}

export interface MetricQuery {
  metrics: string[];
  startDate: string;
  endDate: string;
  interval?: string;
  aggregation?: 'avg' | 'min' | 'max' | 'sum' | 'count';
  filters?: Record<string, any>;
}

export interface TimeSeriesDataPoint {
  timestamp: string;
  value: number;
}

export interface TimeSeriesMetric {
  name: string;
  unit: string;
  category: string;
  data: TimeSeriesDataPoint[];
}

export interface PerformanceOverview {
  apiResponseTime: number;
  syncJobSuccessRate: number;
  systemCpuUsage: number;
  systemMemoryUsage: number;
  databaseQueryTime: number;
  cacheHitRate: number;
  activeAlertCount: number;
}

/**
 * API service for performance metrics and system alerts
 */
const performanceService = {
  /**
   * Get current performance overview metrics
   */
  getPerformanceOverview: async (): Promise<PerformanceOverview> => {
    const response = await api.get('/api/performance/overview');
    return response.data;
  },

  /**
   * Get time series metrics data
   */
  getTimeSeriesMetrics: async (query: MetricQuery): Promise<TimeSeriesMetric[]> => {
    const response = await api.post('/api/performance/metrics/timeseries', query);
    return response.data;
  },

  /**
   * Get the latest values for specified metrics
   */
  getLatestMetrics: async (metrics: string[]): Promise<PerformanceMetric[]> => {
    const response = await api.get('/api/performance/metrics/latest', { params: { metrics: metrics.join(',') } });
    return response.data;
  },

  /**
   * Get available metric names and metadata
   */
  getAvailableMetrics: async (): Promise<{ name: string; unit: string; category: string }[]> => {
    const response = await api.get('/api/performance/metrics/available');
    return response.data;
  },

  /**
   * Get system alerts
   */
  getAlerts: async (options?: {
    level?: 'info' | 'warning' | 'error' | 'critical';
    startDate?: string;
    endDate?: string;
    acknowledged?: boolean;
    limit?: number;
  }): Promise<SystemAlert[]> => {
    const response = await api.get('/api/performance/alerts', { params: options });
    return response.data;
  },

  /**
   * Get a specific system alert
   */
  getAlert: async (id: string): Promise<SystemAlert> => {
    const response = await api.get(`/api/performance/alerts/${id}`);
    return response.data;
  },

  /**
   * Acknowledge a system alert
   */
  acknowledgeAlert: async (id: string): Promise<SystemAlert> => {
    const response = await api.post(`/api/performance/alerts/${id}/acknowledge`);
    return response.data;
  },

  /**
   * Get sync job performance metrics
   */
  getSyncJobPerformance: async (jobId: string): Promise<{
    duration: number;
    resourceUsage: {
      cpu: number;
      memory: number;
      network: { in: number; out: number };
    };
    dataProcessed: number;
    errorRate: number;
    apiCallsMade: number;
  }> => {
    const response = await api.get(`/api/performance/sync/${jobId}`);
    return response.data;
  },

  /**
   * Get API performance metrics
   */
  getApiPerformance: async (options?: {
    endpoint?: string;
    startDate?: string;
    endDate?: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  }): Promise<{
    endpointStats: Array<{
      endpoint: string;
      method: string;
      avgResponseTime: number;
      p95ResponseTime: number;
      errorRate: number;
      requestCount: number;
    }>;
    overallStats: {
      avgResponseTime: number;
      p95ResponseTime: number;
      errorRate: number;
      totalRequests: number;
    };
  }> => {
    const response = await api.get('/api/performance/api', { params: options });
    return response.data;
  },

  /**
   * Get system resource usage metrics
   */
  getSystemResourceUsage: async (options?: {
    startDate?: string;
    endDate?: string;
    interval?: string;
  }): Promise<{
    cpu: TimeSeriesDataPoint[];
    memory: TimeSeriesDataPoint[];
    disk: TimeSeriesDataPoint[];
    network: {
      in: TimeSeriesDataPoint[];
      out: TimeSeriesDataPoint[];
    };
  }> => {
    const response = await api.get('/api/performance/system/resources', { params: options });
    return response.data;
  },

  /**
   * Get database performance metrics
   */
  getDatabasePerformance: async (options?: {
    startDate?: string;
    endDate?: string;
    interval?: string;
  }): Promise<{
    queryTime: TimeSeriesDataPoint[];
    connections: TimeSeriesDataPoint[];
    queries: {
      select: TimeSeriesDataPoint[];
      insert: TimeSeriesDataPoint[];
      update: TimeSeriesDataPoint[];
      delete: TimeSeriesDataPoint[];
    };
  }> => {
    const response = await api.get('/api/performance/database', { params: options });
    return response.data;
  }
};

export default performanceService;