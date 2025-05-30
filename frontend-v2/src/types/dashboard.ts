export interface WidgetData {
  id: string;
  type: 'chart' | 'metric' | 'table' | 'custom';
  title: string;
  data?: any;
  config: WidgetConfig;
  isAIGenerated?: boolean;
}

export interface WidgetConfig {
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  chartType?: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
  size?: 'small' | 'medium' | 'large';
  refreshInterval?: number;
}

export interface DashboardLayout {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  widgets: WidgetData[];
  gridLayout: any[]; // react-grid-layoutの設定
}

export interface SavedLayout {
  id: string;
  name: string;
  thumbnail?: string;
  layout: DashboardLayout;
}