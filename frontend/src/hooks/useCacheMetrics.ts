import { useState, useEffect, useCallback } from 'react';
import { CacheService, CacheMetrics } from '../api/cacheService';
import { useAuth } from './useAuth';

interface UseCacheMetricsResult {
  metrics: CacheMetrics | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  refreshInterval: number;
  setRefreshInterval: (interval: number) => void;
}

/**
 * キャッシュメトリクスを取得するカスタムフック
 * @param initialRefreshInterval 自動更新間隔（秒）。0の場合は自動更新しない
 */
export function useCacheMetrics(initialRefreshInterval: number = 0): UseCacheMetricsResult {
  const [metrics, setMetrics] = useState<CacheMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshInterval, setRefreshIntervalState] = useState<number>(initialRefreshInterval);
  const { user, hasPermission } = useAuth();

  const fetchMetrics = useCallback(async () => {
    if (!user || !hasPermission('view:cache')) {
      setError(new Error('アクセス権限がありません'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const cacheMetrics = await CacheService.getMetrics();
      setMetrics(cacheMetrics);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('キャッシュメトリクスの取得に失敗しました'));
      console.error('キャッシュメトリクス取得エラー:', err);
    } finally {
      setLoading(false);
    }
  }, [user, hasPermission]);

  // 初回ロードと自動更新のセットアップ
  useEffect(() => {
    fetchMetrics();

    // refreshIntervalが0より大きい場合は自動更新をセットアップ
    let intervalId: NodeJS.Timeout | null = null;
    if (refreshInterval > 0) {
      intervalId = setInterval(fetchMetrics, refreshInterval * 1000);
    }

    // クリーンアップ関数
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [fetchMetrics, refreshInterval]);

  const refresh = useCallback(async () => {
    await fetchMetrics();
  }, [fetchMetrics]);

  const setRefreshInterval = useCallback((interval: number) => {
    setRefreshIntervalState(interval);
  }, []);

  return {
    metrics,
    loading,
    error,
    refresh,
    refreshInterval,
    setRefreshInterval
  };
}

export default useCacheMetrics;