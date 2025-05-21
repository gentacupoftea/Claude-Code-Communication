import { useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';

export type ModifyMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type ModifyStatus = 'idle' | 'loading' | 'success' | 'error';

interface UseModifyDataOptions {
  url: string;
  method?: ModifyMethod;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
  invalidateCache?: string[];
  enableAuth?: boolean;
}

interface UseModifyDataResult<T = any> {
  modify: (data?: any) => Promise<T | undefined>;
  status: ModifyStatus;
  data: T | undefined;
  error: Error | null;
  loading: boolean;
  reset: () => void;
}

/**
 * Custom hook for modifying data through API
 */
function useModifyData<T = any>({
  url,
  method = 'POST',
  onSuccess,
  onError,
  invalidateCache = [],
  enableAuth = true,
}: UseModifyDataOptions): UseModifyDataResult<T> {
  const [status, setStatus] = useState<ModifyStatus>('idle');
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const { isAuthenticated } = useAuth();

  /**
   * Reset hook state
   */
  const reset = useCallback(() => {
    setStatus('idle');
    setData(undefined);
    setError(null);
  }, []);

  /**
   * Modify data through API
   */
  const modify = useCallback(
    async (payload?: any): Promise<T | undefined> => {
      // Don't proceed if auth is required but user is not authenticated
      if (enableAuth && !isAuthenticated) {
        const authError = new Error('Authentication required');
        setError(authError);
        setStatus('error');
        onError?.(authError);
        return undefined;
      }

      setStatus('loading');
      setError(null);

      try {
        let result: T;

        // Make API call based on method
        switch (method) {
          case 'POST':
            result = await apiService.post<T>(url, payload);
            break;
          case 'PUT':
            result = await apiService.put<T>(url, payload);
            break;
          case 'PATCH':
            result = await apiService.patch<T>(url, payload);
            break;
          case 'DELETE':
            result = await apiService.delete<T>(url);
            break;
        }

        // Update state
        setData(result);
        setStatus('success');

        // Invalidate caches if specified
        if (invalidateCache.length > 0) {
          invalidateCache.forEach((cacheKey) => {
            localStorage.removeItem(`data_cache_${cacheKey}`);
          });
        }

        // Call success callback
        onSuccess?.(result);

        return result;
      } catch (err) {
        const modifyError = err instanceof Error ? err : new Error(String(err));
        setError(modifyError);
        setStatus('error');

        // Call error callback
        onError?.(modifyError);

        return undefined;
      }
    },
    [url, method, enableAuth, isAuthenticated, onSuccess, onError, invalidateCache]
  );

  return {
    modify,
    status,
    data,
    error,
    loading: status === 'loading',
    reset,
  };
}

export default useModifyData;