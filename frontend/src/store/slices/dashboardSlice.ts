/**
 * ダッシュボード状態管理スライス
 */
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Widget, ChartData } from '../../types';

interface DashboardState {
  widgets: Widget[];
  metrics: {
    totalSales: number;
    totalOrders: number;
    averageOrderValue: number;
    conversionRate: number;
  };
  chartData: {
    salesChart: ChartData | null;
    ordersChart: ChartData | null;
    trafficChart: ChartData | null;
  };
  dateRange: {
    start: Date;
    end: Date;
  };
  loading: boolean;
  error: string | null;
}

const initialState: DashboardState = {
  widgets: [],
  metrics: {
    totalSales: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    conversionRate: 0,
  },
  chartData: {
    salesChart: null,
    ordersChart: null,
    trafficChart: null,
  },
  dateRange: {
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30日前
    end: new Date(),
  },
  loading: false,
  error: null,
};

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    setWidgets: (state, action: PayloadAction<Widget[]>) => {
      state.widgets = action.payload;
    },
    addWidget: (state, action: PayloadAction<Widget>) => {
      state.widgets.push(action.payload);
    },
    removeWidget: (state, action: PayloadAction<string>) => {
      state.widgets = state.widgets.filter(
        (widget) => widget.id !== action.payload
      );
    },
    updateWidget: (state, action: PayloadAction<Widget>) => {
      const index = state.widgets.findIndex(
        (widget) => widget.id === action.payload.id
      );
      if (index !== -1) {
        state.widgets[index] = action.payload;
      }
    },
    setMetrics: (state, action: PayloadAction<Partial<DashboardState['metrics']>>) => {
      state.metrics = { ...state.metrics, ...action.payload };
    },
    setChartData: (
      state,
      action: PayloadAction<{
        type: keyof DashboardState['chartData'];
        data: ChartData;
      }>
    ) => {
      state.chartData[action.payload.type] = action.payload.data;
    },
    setDateRange: (
      state,
      action: PayloadAction<{ start: Date; end: Date }>
    ) => {
      state.dateRange = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const {
  setWidgets,
  addWidget,
  removeWidget,
  updateWidget,
  setMetrics,
  setChartData,
  setDateRange,
  setLoading,
  setError,
} = dashboardSlice.actions;
export default dashboardSlice.reducer;