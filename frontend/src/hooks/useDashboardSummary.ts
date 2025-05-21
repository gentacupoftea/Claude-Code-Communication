import { useState, useEffect, useCallback } from 'react';
import { DashboardService, DashboardSummaryData, DashboardRequestParams } from '../api/dashboardService';
import { useAuth } from './useAuth';

interface UseDashboardSummaryResult {
  data: DashboardSummaryData | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  updateParams: (newParams: Partial<DashboardRequestParams>) => void;
}

/**
 * ダッシュボード概要データを取得するカスタムフック
 */
export function useDashboardSummary(initialParams: DashboardRequestParams = {}): UseDashboardSummaryResult {
  const [data, setData] = useState<DashboardSummaryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [params, setParams] = useState<DashboardRequestParams>(initialParams);
  const { user, hasPermission } = useAuth();

  const fetchData = useCallback(async () => {
    if (!user || !hasPermission('view:dashboard')) {
      setError(new Error('アクセス権限がありません'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const summaryData = await DashboardService.getSummary(params);
      setData(summaryData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('ダッシュボードデータの取得に失敗しました'));
      console.error('ダッシュボードデータ取得エラー:', err);
    } finally {
      setLoading(false);
    }
  }, [params, user, hasPermission]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refresh = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  const updateParams = useCallback((newParams: Partial<DashboardRequestParams>) => {
    setParams(prev => ({ ...prev, ...newParams }));
  }, []);

  return {
    data,
    loading,
    error,
    refresh,
    updateParams
  };
}

export default useDashboardSummary;