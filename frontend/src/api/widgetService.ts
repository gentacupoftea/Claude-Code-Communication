/**
 * Widget API Service
 * Handles widget data fetching for dashboards
 */
import axios from 'axios';
import { API_BASE_URL } from './environment';

const API_URL = `${API_BASE_URL}/api/widgets`;

export interface WidgetData {
  widgetId: string;
  type: 'chart' | 'table' | 'metric' | 'text';
  data: any;
  lastUpdated: Date;
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
  }[];
}

export interface TableData {
  columns: {
    id: string;
    label: string;
    type: 'string' | 'number' | 'date' | 'boolean';
  }[];
  rows: any[];
  totalCount?: number;
}

export interface MetricData {
  value: number | string;
  label: string;
  unit?: string;
  change?: {
    value: number;
    percentage: number;
    direction: 'up' | 'down' | 'neutral';
  };
  previousValue?: number | string;
}

class WidgetService {
  /**
   * Get widget data
   */
  async getWidgetData(widgetConfig: {
    type: string;
    dataSource: string;
    platform?: string;
    dateRange?: { start: Date; end: Date };
    metric?: string;
    chartType?: string;
  }): Promise<WidgetData> {
    try {
      const response = await axios.post(`${API_URL}/data`, widgetConfig);
      return {
        ...response.data,
        lastUpdated: new Date(response.data.lastUpdated),
      };
    } catch (error) {
      console.error('Failed to fetch widget data:', error);
      throw error;
    }
  }

  /**
   * Get chart data
   */
  async getChartData(config: {
    dataSource: string;
    chartType: 'line' | 'bar' | 'pie' | 'area';
    platform?: string;
    dateRange?: { start: Date; end: Date };
    groupBy?: 'day' | 'week' | 'month';
  }): Promise<ChartData> {
    try {
      const response = await axios.post(`${API_URL}/chart`, config);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch chart data:', error);
      throw error;
    }
  }

  /**
   * Get table data
   */
  async getTableData(config: {
    dataSource: string;
    platform?: string;
    dateRange?: { start: Date; end: Date };
    columns?: string[];
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
  }): Promise<TableData> {
    try {
      const response = await axios.post(`${API_URL}/table`, config);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch table data:', error);
      throw error;
    }
  }

  /**
   * Get metric data
   */
  async getMetricData(config: {
    metric: string;
    dataSource: string;
    platform?: string;
    dateRange?: { start: Date; end: Date };
    compareWith?: 'previousPeriod' | 'previousYear';
  }): Promise<MetricData> {
    try {
      const response = await axios.post(`${API_URL}/metric`, config);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch metric data:', error);
      throw error;
    }
  }

  /**
   * Get available data sources
   */
  async getDataSources(): Promise<Array<{ value: string; label: string; description?: string }>> {
    try {
      const response = await axios.get(`${API_URL}/data-sources`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch data sources:', error);
      throw error;
    }
  }

  /**
   * Get available metrics for a data source
   */
  async getMetrics(dataSource: string): Promise<Array<{ value: string; label: string; unit?: string }>> {
    try {
      const response = await axios.get(`${API_URL}/metrics/${dataSource}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
      throw error;
    }
  }

  /**
   * Generate mock data for development/preview
   */
  generateMockData(type: string, config: any): any {
    switch (type) {
      case 'chart':
        return this.generateMockChartData(config);
      case 'table':
        return this.generateMockTableData(config);
      case 'metric':
        return this.generateMockMetricData(config);
      default:
        return null;
    }
  }

  private generateMockChartData(config: any): ChartData {
    const labels = ['1月', '2月', '3月', '4月', '5月', '6月'];
    const datasets = [{
      label: '売上',
      data: labels.map(() => Math.floor(Math.random() * 1000000) + 500000),
      backgroundColor: 'rgba(54, 162, 235, 0.5)',
      borderColor: 'rgba(54, 162, 235, 1)',
    }];

    if (config.chartType === 'pie') {
      return {
        labels: ['商品A', '商品B', '商品C', '商品D', '商品E'],
        datasets: [{
          label: '売上構成',
          data: [30, 25, 20, 15, 10],
          backgroundColor: [
            'rgba(255, 99, 132, 0.5)',
            'rgba(54, 162, 235, 0.5)',
            'rgba(255, 206, 86, 0.5)',
            'rgba(75, 192, 192, 0.5)',
            'rgba(153, 102, 255, 0.5)',
          ],
        }],
      };
    }

    return { labels, datasets };
  }

  private generateMockTableData(config: any): TableData {
    const columns = [
      { id: 'id', label: '注文ID', type: 'string' as const },
      { id: 'date', label: '日付', type: 'date' as const },
      { id: 'customer', label: '顧客名', type: 'string' as const },
      { id: 'total', label: '合計', type: 'number' as const },
      { id: 'status', label: 'ステータス', type: 'string' as const },
    ];

    const rows = Array.from({ length: 10 }, (_, i) => ({
      id: `#${1000 + i}`,
      date: new Date(Date.now() - i * 86400000),
      customer: `顧客${i + 1}`,
      total: Math.floor(Math.random() * 50000) + 10000,
      status: ['完了', '処理中', '保留'][Math.floor(Math.random() * 3)],
    }));

    return { columns, rows, totalCount: 100 };
  }

  private generateMockMetricData(config: any): MetricData {
    const metrics: Record<string, MetricData> = {
      total_sales: {
        value: Math.floor(Math.random() * 10000000),
        label: '総売上',
        unit: '円',
        change: {
          value: Math.random() * 30 - 15,
          percentage: Math.random() * 30 - 15,
          direction: Math.random() > 0.5 ? 'up' : 'down',
        },
      },
      order_count: {
        value: Math.floor(Math.random() * 1000) + 100,
        label: '注文数',
        change: {
          value: Math.floor(Math.random() * 100 - 50),
          percentage: Math.random() * 20 - 10,
          direction: Math.random() > 0.5 ? 'up' : 'down',
        },
      },
      average_order_value: {
        value: Math.floor(Math.random() * 5000) + 3000,
        label: '平均注文額',
        unit: '円',
        change: {
          value: Math.floor(Math.random() * 1000 - 500),
          percentage: Math.random() * 15 - 7.5,
          direction: Math.random() > 0.5 ? 'up' : 'down',
        },
      },
      conversion_rate: {
        value: (Math.random() * 5 + 1).toFixed(1),
        label: 'コンバージョン率',
        unit: '%',
        change: {
          value: Math.random() * 2 - 1,
          percentage: Math.random() * 20 - 10,
          direction: Math.random() > 0.5 ? 'up' : 'down',
        },
      },
      customer_count: {
        value: Math.floor(Math.random() * 5000) + 1000,
        label: '顧客数',
        change: {
          value: Math.floor(Math.random() * 500 - 250),
          percentage: Math.random() * 15 - 7.5,
          direction: Math.random() > 0.5 ? 'up' : 'down',
        },
      },
    };

    return metrics[config.metric] || metrics.total_sales;
  }
}

export const widgetService = new WidgetService();