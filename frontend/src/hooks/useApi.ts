/**
 * APIフック
 * APIリクエストの状態管理とエラーハンドリング
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import axios, { AxiosRequestConfig, AxiosError, CancelTokenSource } from 'axios';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { APIResponse } from '../types';

interface UseApiOptions extends AxiosRequestConfig {
  manual?: boolean; // 手動実行フラグ
}

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  execute: (config?: AxiosRequestConfig) => Promise<T>;
  cancel: () => void;
}

export function useApi<T = any>(
  url: string,
  options: UseApiOptions = {}
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!options.manual);
  const [error, setError] = useState<Error | null>(null);
  
  const cancelTokenSource = useRef<CancelTokenSource | null>(null);
  const token = useSelector((state: RootState) => state.auth.token);

  const execute = useCallback(
    async (overrideConfig?: AxiosRequestConfig) => {
      setLoading(true);
      setError(null);

      // 前のリクエストをキャンセル
      if (cancelTokenSource.current) {
        cancelTokenSource.current.cancel('Request cancelled');
      }

      // 新しいキャンセルトークンを作成
      const source = axios.CancelToken.source();
      cancelTokenSource.current = source;

      try {
        const config: AxiosRequestConfig = {
          ...options,
          ...overrideConfig,
          url,
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
            ...options.headers,
            ...overrideConfig?.headers,
          },
          cancelToken: source.token,
        };

        const response = await axios.request<APIResponse<T>>(config);
        
        if (response.data.success && response.data.data) {
          setData(response.data.data);
          return response.data.data;
        } else {
          throw new Error(response.data.error?.message || 'Unknown error');
        }
      } catch (err) {
        if (!axios.isCancel(err)) {
          const axiosError = err as AxiosError<APIResponse<T>>;
          const errorMessage = 
            axiosError.response?.data?.error?.message ||
            axiosError.message ||
            'Network error';
          
          const error = new Error(errorMessage);
          setError(error);
          throw error;
        }
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [url, options, token]
  );

  const cancel = useCallback(() => {
    if (cancelTokenSource.current) {
      cancelTokenSource.current.cancel('Request cancelled by user');
    }
  }, []);

  // 自動実行
  useEffect(() => {
    if (!options.manual) {
      execute();
    }

    return () => {
      cancel();
    };
  }, [options.manual, execute, cancel]);

  return { data, loading, error, execute, cancel };
}

export default useApi;