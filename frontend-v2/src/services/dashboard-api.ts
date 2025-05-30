import { apiClient } from '@/lib/api-client';
import { DashboardLayout, WidgetData } from '@/types/dashboard';

// ダッシュボードAPI サービス
export const dashboardApi = {
  // ダッシュボードレイアウトを取得
  async getLayouts(): Promise<DashboardLayout[]> {
    return apiClient.get<DashboardLayout[]>('/dashboards');
  },

  // 特定のレイアウトを取得
  async getLayout(id: string): Promise<DashboardLayout> {
    return apiClient.get<DashboardLayout>(`/dashboards/${id}`);
  },

  // レイアウトを保存
  async saveLayout(layout: DashboardLayout): Promise<DashboardLayout> {
    if (layout.id && layout.id !== 'default') {
      return apiClient.put<DashboardLayout>(`/dashboards/${layout.id}`, layout);
    }
    return apiClient.post<DashboardLayout>('/dashboards', layout);
  },

  // レイアウトを削除
  async deleteLayout(id: string): Promise<void> {
    return apiClient.delete<void>(`/dashboards/${id}`);
  },

  // ウィジェットデータを取得
  async getWidgetData(widgetId: string): Promise<any> {
    return apiClient.get<any>(`/widgets/${widgetId}/data`);
  },

  // AI生成ウィジェット
  async generateWidget(prompt: string): Promise<WidgetData> {
    return apiClient.post<WidgetData>('/widgets/generate', { prompt });
  },

  // ビジネスメトリクスを取得
  async getMetrics(): Promise<any> {
    return apiClient.get<any>('/metrics');
  },

  // チャートデータを取得
  async getChartData(chartType: string, params?: any): Promise<any> {
    const queryString = params ? `?${new URLSearchParams(params).toString()}` : '';
    return apiClient.get<any>(`/charts/${chartType}${queryString}`);
  },
};

// モックデータ（開発用）
export const mockDashboardApi = {
  async getLayouts(): Promise<DashboardLayout[]> {
    return [
      {
        id: 'default',
        name: '売上ダッシュボード',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date(),
        widgets: [
          {
            id: 'revenue-metric',
            type: 'metric',
            title: '今月の売上',
            data: { value: 52340000, currency: 'JPY', change: 15.2 },
            config: { backgroundColor: '#10b981', textColor: '#ffffff' },
          },
          {
            id: 'sales-chart',
            type: 'chart',
            title: '売上推移',
            data: {
              labels: ['1月', '2月', '3月', '4月', '5月', '6月'],
              datasets: [{
                label: '売上',
                data: [42000000, 45000000, 43000000, 48000000, 50000000, 52340000],
              }],
            },
            config: { chartType: 'line' },
          },
        ],
        gridLayout: [
          { i: 'revenue-metric', x: 0, y: 0, w: 3, h: 2 },
          { i: 'sales-chart', x: 3, y: 0, w: 6, h: 4 },
        ],
      },
    ];
  },

  async getLayout(id: string): Promise<DashboardLayout> {
    const layouts = await this.getLayouts();
    const layout = layouts.find(l => l.id === id);
    if (!layout) throw new Error('Layout not found');
    return layout;
  },

  async saveLayout(layout: DashboardLayout): Promise<DashboardLayout> {
    // モック実装：実際のAPIではサーバーに保存
    console.log('Saving layout:', layout);
    return { ...layout, updatedAt: new Date() };
  },

  async deleteLayout(id: string): Promise<void> {
    console.log('Deleting layout:', id);
  },

  async getWidgetData(widgetId: string): Promise<any> {
    // モックデータを返す
    const mockData: Record<string, any> = {
      'revenue-metric': { value: 52340000, currency: 'JPY', change: 15.2 },
      'orders-metric': { value: 1234, change: 8.5 },
      'customers-metric': { value: 5678, change: 12.3 },
    };
    return mockData[widgetId] || {};
  },

  async generateWidget(prompt: string): Promise<WidgetData> {
    // AI生成のシミュレーション
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return {
      id: `ai-widget-${Date.now()}`,
      type: 'chart',
      title: prompt,
      isAIGenerated: true,
      data: {
        labels: ['月', '火', '水', '木', '金', '土', '日'],
        datasets: [{
          label: 'データ',
          data: [65, 59, 80, 81, 56, 55, 40].map(v => Math.floor(Math.random() * 100)),
        }],
      },
      config: {
        chartType: prompt.includes('円') ? 'pie' : prompt.includes('棒') ? 'bar' : 'line',
        backgroundColor: '#f0fdf4',
        borderColor: '#10b981',
      },
    };
  },

  async getMetrics(): Promise<any> {
    return {
      revenue: { value: 52340000, currency: 'JPY', change: 15.2 },
      orders: { value: 1234, change: 8.5 },
      customers: { value: 5678, change: 12.3 },
      conversionRate: { value: 3.4, unit: '%', change: 0.5 },
    };
  },

  async getChartData(chartType: string, params?: any): Promise<any> {
    const baseData = {
      labels: ['1月', '2月', '3月', '4月', '5月', '6月'],
      datasets: [{
        label: 'データ',
        data: [65, 59, 80, 81, 56, 55],
      }],
    };

    return baseData;
  },
};