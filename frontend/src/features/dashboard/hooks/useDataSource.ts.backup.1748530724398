import { useState, useEffect } from 'react';
import { DataSource } from '../types';
import { DataSourceService } from '../services/DataSourceService';

export function useDataSource(dataSource: DataSource) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const service = new DataSourceService();

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await service.connectToDataSource(dataSource);
        if (!cancelled) {
          setData(result.data || result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'データ取得エラー');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    // リアルタイムデータの場合は定期更新
    let interval: NodeJS.Timeout;
    if (dataSource.refreshInterval) {
      interval = setInterval(fetchData, dataSource.refreshInterval * 1000);
    }

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [dataSource]);

  return { data, loading, error };
}