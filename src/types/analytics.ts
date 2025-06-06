/**
 * Analytics related type definitions
 */

export interface ChartData {
  id: string;
  title: string;
  type: 'line' | 'bar' | 'pie' | 'doughnut' | 'radar' | 'polarArea' | 'scatter' | 'bubble';
  data: ChartDataset;
  config?: ChartConfig;
}

export interface ChartDataset {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
    fill?: boolean;
    tension?: number;
  }>;
}

export interface ChartConfig {
  responsive?: boolean;
  maintainAspectRatio?: boolean;
  legend?: boolean;
  tooltips?: boolean;
  plugins?: {
    legend?: {
      display?: boolean;
      position?: 'top' | 'left' | 'bottom' | 'right';
    };
    title?: {
      display?: boolean;
      text?: string;
    };
    tooltip?: {
      enabled?: boolean;
      mode?: 'index' | 'dataset' | 'point' | 'nearest';
    };
  };
  scales?: {
    x?: {
      display?: boolean;
      grid?: {
        display?: boolean;
      };
    };
    y?: {
      display?: boolean;
      grid?: {
        display?: boolean;
      };
      beginAtZero?: boolean;
    };
  };
}

export interface AnalyticsMetric {
  id: string;
  name: string;
  value: number | string;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  unit?: string;
  icon?: string;
  color?: string;
}

export interface AnalyticsDashboard {
  id: string;
  name: string;
  description?: string;
  metrics: AnalyticsMetric[];
  charts: ChartData[];
  lastUpdated?: Date;
}

export interface TimeSeriesData {
  timestamp: Date;
  value: number;
  metadata?: Record<string, unknown>;
}

export interface AnalyticsFilter {
  dateRange?: {
    start: Date;
    end: Date;
  };
  dimensions?: Record<string, string[]>;
  metrics?: string[];
}

export interface AnalyticsQuery {
  metrics: string[];
  dimensions?: string[];
  filters?: AnalyticsFilter;
  granularity?: 'hour' | 'day' | 'week' | 'month' | 'year';
  limit?: number;
  orderBy?: {
    field: string;
    direction: 'asc' | 'desc';
  };
}

export interface AnalyticsResponse {
  query: AnalyticsQuery;
  data: Array<Record<string, unknown>>;
  metadata: {
    totalRows: number;
    executionTime: number;
    cached: boolean;
  };
}