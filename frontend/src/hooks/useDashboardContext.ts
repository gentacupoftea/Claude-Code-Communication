import { useState, useCallback, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface DateRange {
  startDate: string;
  endDate: string;
}

interface DashboardContext {
  dateRange: DateRange;
  filters: Record<string, any>;
  refreshInterval: number;
}

export const useDashboardContext = (dashboardId: string) => {
  const [context, setContext] = useState<DashboardContext>({
    dateRange: { startDate: '', endDate: '' },
    filters: {},
    refreshInterval: 300000
  });
  const [loading, setLoading] = useState(false);

  // コンテキストを読み込み
  const loadContext = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/dashboards/${dashboardId}`, {
        headers: {
          'x-user-id': localStorage.getItem('userId') || 'demo-user'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.context) {
          setContext(result.context);
        }
      }
    } catch (error) {
      console.error('Failed to load dashboard context:', error);
    }
  }, [dashboardId]);

  // 日付範囲付きでクエリを実行
  const executeQuery = useCallback(async (query: string, chartType: string = 'bar') => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/dashboards/${dashboardId}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': localStorage.getItem('userId') || 'demo-user'
        },
        body: JSON.stringify({
          query,
          chartType
        })
      });

      if (!response.ok) {
        throw new Error('Query failed');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Query execution error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [dashboardId]);

  // 日付範囲変更時のハンドラー
  const onDateRangeChange = useCallback((startDate: string, endDate: string) => {
    setContext(prev => ({
      ...prev,
      dateRange: { startDate, endDate }
    }));
  }, []);

  // 初期化
  useEffect(() => {
    loadContext();
  }, [loadContext]);

  return {
    context,
    loading,
    executeQuery,
    onDateRangeChange,
    loadContext
  };
};