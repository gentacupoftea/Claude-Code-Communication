import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';

/**
 * Fetch states
 */
export type FetchStatus = 'idle' | 'loading' | 'success' | 'error';

interface UseFetchDataOptions<T> {
  url: string;
  initialData?: T;
  skip?: boolean;
  dependencies?: any[];
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  transform?: (data: any) => T;
  refreshInterval?: number;
  cacheKey?: string;
  enableAuth?: boolean;
}

interface UseFetchDataResult<T> {
  data: T | undefined;
  status: FetchStatus;
  error: Error | null;
  loading: boolean;
  refetch: () => Promise<void>;
  resetData: () => void;
}

/**
 * Custom hook for fetching data from API
 */
function useFetchData<T = any>({
  url,
  initialData,
  skip = false,
  dependencies = [],
  onSuccess,
  onError,
  transform,
  refreshInterval,
  cacheKey,
  enableAuth = true,
}: UseFetchDataOptions<T>): UseFetchDataResult<T> {
  const [data, setData] = useState<T | undefined>(initialData);
  const [status, setStatus] = useState<FetchStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const { isAuthenticated, token } = useAuth();

  /**
   * Reset data to initial state
   */
  const resetData = useCallback(() => {
    setData(initialData);
    setStatus('idle');
    setError(null);
  }, [initialData]);

  /**
   * Fetch data from API
   */
  const fetchData = useCallback(async () => {
    // Don't fetch if skip is true
    if (skip) return;

    // Don't fetch if auth is required but user is not authenticated
    if (enableAuth && !isAuthenticated) return;

    setStatus('loading');
    setError(null);

    // Try to get from cache first if cacheKey is provided
    if (cacheKey) {
      const cachedData = localStorage.getItem(`data_cache_${cacheKey}`);
      if (cachedData) {
        try {
          const { data: cacheData, expiry } = JSON.parse(cachedData);
          
          // Check if cache is still valid
          if (expiry > Date.now()) {
            setData(transform ? transform(cacheData) : cacheData);
            setStatus('success');
            onSuccess?.(transform ? transform(cacheData) : cacheData);
            return; // Exit early if valid cache exists
          }
        } catch (e) {
          // Invalid cache format, proceed with fetch
          console.warn('Invalid cache format:', e);
        }
      }
    }

    try {
      // Make API call
      const result = await apiService.get<T>(url);
      
      // Transform data if transformer is provided
      const transformedData = transform ? transform(result) : result;
      
      // Update state
      setData(transformedData);
      setStatus('success');
      
      // Cache the result if cacheKey is provided
      if (cacheKey) {
        const cacheExpiry = Date.now() + (refreshInterval || 5 * 60 * 1000); // 5 min default
        localStorage.setItem(
          `data_cache_${cacheKey}`,
          JSON.stringify({
            data: result,
            expiry: cacheExpiry,
          })
        );
      }
      
      // Call success callback
      onSuccess?.(transformedData);
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error(String(err));
      setError(fetchError);
      setStatus('error');
      
      // Call error callback
      onError?.(fetchError);
    }
  }, [
    url,
    skip,
    enableAuth,
    isAuthenticated,
    transform,
    onSuccess,
    onError,
    cacheKey,
    refreshInterval,
  ]);

  /**
   * Fetch data on mount and when dependencies change
   */
  useEffect(() => {
    fetchData();

    // Set up refresh interval if specified
    let intervalId: number | undefined;
    if (refreshInterval && !skip) {
      intervalId = window.setInterval(fetchData, refreshInterval);
    }

    // Clean up
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [fetchData, refreshInterval, skip, ...dependencies]);

  return {
    data,
    status,
    error,
    loading: status === 'loading',
    refetch: fetchData,
    resetData,
  };
}

export default useFetchData;