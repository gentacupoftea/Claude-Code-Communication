// BigQuery関連の型定義

export interface SaveChartRequest {
  queryData: {
    userQuery: string;
    aiProvider: string;
    apiCalls: any[];
    processingTime: number;
  };
  chartData: {
    chartType: string;
    dataPoints: any[];
    chartConfig: any;
  };
  aggregatedData: {
    sourceApi: string;
    aggregationType: string;
    data: any;
    metadata: any;
  };
}

export interface SaveChartResponse {
  success: boolean;
  queryId: string;
  chartId: string;
}

export interface AddToDashboardRequest {
  dashboardId?: string;
}

export interface AddToDashboardResponse {
  success: boolean;
  dashboardId: string;
}

export interface DashboardData {
  dashboard_id: string;
  user_id: string;
  dashboard_name: string;
  chart_ids: string[];
  layout_config: any;
  auto_refresh: boolean;
  refresh_interval_seconds: number;
  charts: ChartData[];
}

export interface ChartData {
  chart_id: string;
  chart_type: string;
  chart_title: string;
  data_points: any[];
  chart_config: any;
  result_data: any;
  metadata: any;
  created_at: string;
}