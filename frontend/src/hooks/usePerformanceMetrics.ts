import { useState, useEffect, useCallback } from 'react';
import performanceService, { 
  PerformanceMetric, 
  TimeSeriesMetric, 
  MetricQuery, 
  PerformanceOverview,
  SystemAlert 
} from '../api/performanceService';
import websocketService from '../services/websocketService';

interface UsePerformanceMetricsResult {
  overview: PerformanceOverview | null;
  timeSeriesData: TimeSeriesMetric[];
  latestMetrics: PerformanceMetric[];
  alerts: SystemAlert[];
  isLoading: boolean;
  error: Error | null;
  fetchTimeSeriesMetrics: (query: MetricQuery) => Promise<TimeSeriesMetric[]>;
  fetchLatestMetrics: (metrics: string[]) => Promise<PerformanceMetric[]>;
  fetchSystemAlerts: (options?: {
    level?: 'info' | 'warning' | 'error' | 'critical';
    startDate?: string;
    endDate?: string;
    acknowledged?: boolean;
    limit?: number;
  }) => Promise<SystemAlert[]>;
  acknowledgeAlert: (id: string) => Promise<boolean>;
  refreshOverview: () => Promise<void>;
}

/**
 * Hook for retrieving and analyzing performance metrics
 */
export function usePerformanceMetrics(
  initialMetricNames: string[] = [],
  initialAlertOptions?: {
    level?: 'info' | 'warning' | 'error' | 'critical';
    limit?: number;
  },
  enableRealtime = true
): UsePerformanceMetricsResult {
  const [overview, setOverview] = useState<PerformanceOverview | null>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesMetric[]>([]);
  const [latestMetrics, setLatestMetrics] = useState<PerformanceMetric[]>([]);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch performance overview
  const refreshOverview = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await performanceService.getPerformanceOverview();
      setOverview(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch performance overview'));
      console.error('Error fetching performance overview:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch time series metrics
  const fetchTimeSeriesMetrics = useCallback(async (query: MetricQuery): Promise<TimeSeriesMetric[]> => {
    try {
      const data = await performanceService.getTimeSeriesMetrics(query);
      setTimeSeriesData(data);
      return data;
    } catch (err) {
      console.error('Error fetching time series metrics:', err);
      return [];
    }
  }, []);

  // Fetch latest metric values
  const fetchLatestMetrics = useCallback(async (metrics: string[]): Promise<PerformanceMetric[]> => {
    try {
      const data = await performanceService.getLatestMetrics(metrics);
      setLatestMetrics(data);
      return data;
    } catch (err) {
      console.error('Error fetching latest metrics:', err);
      return [];
    }
  }, []);

  // Fetch system alerts
  const fetchSystemAlerts = useCallback(async (options?: {
    level?: 'info' | 'warning' | 'error' | 'critical';
    startDate?: string;
    endDate?: string;
    acknowledged?: boolean;
    limit?: number;
  }): Promise<SystemAlert[]> => {
    try {
      const data = await performanceService.getAlerts(options);
      setAlerts(data);
      return data;
    } catch (err) {
      console.error('Error fetching system alerts:', err);
      return [];
    }
  }, []);

  // Acknowledge an alert
  const acknowledgeAlert = useCallback(async (id: string): Promise<boolean> => {
    try {
      const updatedAlert = await performanceService.acknowledgeAlert(id);
      setAlerts(prev => 
        prev.map(alert => alert.id === id ? updatedAlert : alert)
      );
      return true;
    } catch (err) {
      console.error(`Error acknowledging alert ${id}:`, err);
      return false;
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    // Fetch performance overview
    refreshOverview();
    
    // Fetch latest metrics if initialMetricNames are provided
    if (initialMetricNames.length > 0) {
      fetchLatestMetrics(initialMetricNames);
    }
    
    // Fetch alerts with initial options
    fetchSystemAlerts(initialAlertOptions);
    
  }, [refreshOverview, fetchLatestMetrics, fetchSystemAlerts, initialMetricNames, initialAlertOptions]);

  // WebSocket real-time updates
  useEffect(() => {
    if (!enableRealtime) return;

    // Subscribe to performance overview updates
    const unsubscribeOverviewUpdate = websocketService.subscribe('performance:overview:updated', (updatedOverview: PerformanceOverview) => {
      setOverview(updatedOverview);
    });

    // Subscribe to metric updates
    const unsubscribeMetricUpdate = websocketService.subscribe('performance:metric:updated', (updatedMetric: PerformanceMetric) => {
      setLatestMetrics(prev => {
        const exists = prev.some(m => m.id === updatedMetric.id);
        if (exists) {
          return prev.map(m => m.id === updatedMetric.id ? updatedMetric : m);
        } else {
          return [...prev, updatedMetric];
        }
      });
    });

    // Subscribe to new alert notifications
    const unsubscribeAlertCreated = websocketService.subscribe('performance:alert:created', (newAlert: SystemAlert) => {
      setAlerts(prev => [newAlert, ...prev]);
    });

    // Subscribe to alert updates
    const unsubscribeAlertUpdated = websocketService.subscribe('performance:alert:updated', (updatedAlert: SystemAlert) => {
      setAlerts(prev => 
        prev.map(alert => alert.id === updatedAlert.id ? updatedAlert : alert)
      );
    });

    return () => {
      unsubscribeOverviewUpdate();
      unsubscribeMetricUpdate();
      unsubscribeAlertCreated();
      unsubscribeAlertUpdated();
    };
  }, [enableRealtime]);

  return {
    overview,
    timeSeriesData,
    latestMetrics,
    alerts,
    isLoading,
    error,
    fetchTimeSeriesMetrics,
    fetchLatestMetrics,
    fetchSystemAlerts,
    acknowledgeAlert,
    refreshOverview
  };
}

export default usePerformanceMetrics;