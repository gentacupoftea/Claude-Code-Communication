import { Layout } from 'react-grid-layout';

// ウィジェットタイプ
export type WidgetType = 
  | 'line-chart' 
  | 'bar-chart' 
  | 'pie-chart' 
  | 'scatter-chart'
  | 'heatmap'
  | 'gauge'
  | 'kpi-card'
  | 'data-table'
  | 'map'
  | 'custom';

// チャート設定
export interface ChartConfig {
  type: WidgetType;
  title: string;
  dataSource: DataSource;
  dimensions: string[];
  measures: Measure[];
  filters?: Filter[];
  styling: ChartStyling;
  interactions: ChartInteractions;
}

// データソース
export interface DataSource {
  id: string;
  type: 'api' | 'csv' | 'database' | 'realtime';
  endpoint?: string;
  query?: string;
  refreshInterval?: number;
  data?: any[];
  schema?: DataSchema;
}

// データスキーマ
export interface DataSchema {
  fields: Field[];
  primaryKey?: string;
  relationships?: Relationship[];
}

export interface Field {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  format?: string;
  nullable?: boolean;
}

// メジャー（数値指標）
export interface Measure {
  field: string;
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median';
  alias?: string;
  format?: string;
}

// フィルター
export interface Filter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';
  value: any;
}

// チャートスタイリング
export interface ChartStyling {
  theme: 'light' | 'dark' | 'custom';
  colors?: string[];
  fontSize?: number;
  fontFamily?: string;
  backgroundColor?: string;
  borderRadius?: number;
  padding?: number;
  animation?: boolean;
}

// チャートインタラクション
export interface ChartInteractions {
  zoom?: boolean;
  pan?: boolean;
  brush?: boolean;
  tooltip?: boolean;
  legend?: boolean;
  drillDown?: DrillDownConfig;
  crossFilter?: boolean;
}

export interface DrillDownConfig {
  enabled: boolean;
  levels: string[];
  defaultLevel?: number;
}

// ウィジェット
export interface Widget {
  id: string;
  type: WidgetType;
  config: ChartConfig;
  layout: Layout;
  created: Date;
  updated: Date;
}

// ダッシュボード
export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  widgets: Widget[];
  layout: DashboardLayout;
  theme: DashboardTheme;
  filters: GlobalFilter[];
  created: Date;
  updated: Date;
  tags?: string[];
  isPublic?: boolean;
}

export interface DashboardLayout {
  cols: number;
  rowHeight: number;
  margin: [number, number];
  containerPadding: [number, number];
  compactType: 'vertical' | 'horizontal' | null;
}

export interface DashboardTheme {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  mode: 'light' | 'dark';
}

export interface GlobalFilter {
  id: string;
  name: string;
  field: string;
  type: 'date-range' | 'select' | 'multi-select' | 'search';
  defaultValue?: any;
  options?: FilterOption[];
}

export interface FilterOption {
  label: string;
  value: any;
}

// 自然言語クエリ
export interface NLQuery {
  text: string;
  intent: QueryIntent;
  entities: QueryEntity[];
  suggestions?: ChartSuggestion[];
}

export interface QueryIntent {
  action: 'visualize' | 'analyze' | 'compare' | 'trend' | 'forecast';
  confidence: number;
}

export interface QueryEntity {
  type: 'metric' | 'dimension' | 'time' | 'filter';
  value: string;
  field?: string;
  confidence: number;
}

export interface ChartSuggestion {
  type: WidgetType;
  reason: string;
  confidence: number;
  config: Partial<ChartConfig>;
}

// カスタマイズイベント
export interface CustomizationEvent {
  widgetId: string;
  type: 'resize' | 'move' | 'style' | 'data' | 'interaction';
  changes: any;
  timestamp: Date;
}

// Relationship型を追加
export interface Relationship {
  fromField: string;
  toTable: string;
  toField: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
}