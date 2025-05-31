/**
 * ダッシュボードウィジェットの型定義
 */

export type WidgetType = 'chart' | 'calendar' | 'table' | 'metric' | 'text' | 'image';

export interface BaseWidget {
  id: string;
  type: WidgetType;
  title: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  data?: any;
  config?: any;
}

export interface ChartWidget extends BaseWidget {
  type: 'chart';
  data: {
    chartType: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
    datasets: {
      label: string;
      data: number[];
      backgroundColor?: string;
      borderColor?: string;
    }[];
    labels: string[];
  };
  config: {
    responsive: boolean;
    legend: boolean;
    grid: boolean;
    animation: boolean;
  };
}

export interface CalendarWidget extends BaseWidget {
  type: 'calendar';
  data: {
    events: {
      id: string;
      title: string;
      date: string;
      color?: string;
    }[];
  };
  config: {
    view: 'month' | 'week' | 'day';
    locale: string;
  };
}

export interface TableWidget extends BaseWidget {
  type: 'table';
  data: {
    headers: string[];
    rows: (string | number)[][];
  };
  config: {
    sortable: boolean;
    filterable: boolean;
    pagination: boolean;
    striped: boolean;
  };
}

export interface MetricWidget extends BaseWidget {
  type: 'metric';
  data: {
    value: number;
    label: string;
    unit?: string;
    change?: number;
    changeType?: 'increase' | 'decrease';
  };
  config: {
    format: 'number' | 'currency' | 'percentage';
    showTrend: boolean;
    color: string;
  };
}

export interface TextWidget extends BaseWidget {
  type: 'text';
  data: {
    content: string;
    markdown: boolean;
  };
  config: {
    fontSize: 'small' | 'medium' | 'large';
    alignment: 'left' | 'center' | 'right';
    color: string;
  };
}

export interface ImageWidget extends BaseWidget {
  type: 'image';
  data: {
    src: string;
    alt: string;
  };
  config: {
    fit: 'cover' | 'contain' | 'fill';
    borderRadius: number;
  };
}

export type Widget = ChartWidget | CalendarWidget | TableWidget | MetricWidget | TextWidget | ImageWidget;

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  widgets: Widget[];
  layout: {
    columns: number;
    gap: number;
  };
  settings: {
    isPublic: boolean;
    shareToken?: string;
    theme: 'light' | 'dark';
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface DraggableItem {
  id: string;
  type: WidgetType;
  title: string;
  icon: string;
  preview?: any;
  defaultSize: { width: number; height: number };
}