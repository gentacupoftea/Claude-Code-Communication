/**
 * エラーハンドリング用カスタムフック
 * 統一されたエラー処理とユーザー通知
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { AxiosError } from 'axios';
import errorService from '../services/errorService';
import { useNotification } from './useNotification';

export interface ErrorState {
  error: any | null;
  isError: boolean;
  errorMessage: string;
  errorId?: string;
  retryable: boolean;
  retryCount: number;
}

export interface UseErrorHandlerOptions {
  enableNotification?: boolean;
  enableRetry?: boolean;
  maxRetries?: number;
  autoRetryDelay?: number;
  component?: string;
}

export interface ErrorHandler {
  handleError: (error: any, context?: any) => void;
  handleAsyncError: (asyncFn: () => Promise<any>, context?: any) => Promise<any>;
  clearError: () => void;
  retry: () => Promise<void>;
  state: ErrorState;
}

export function useErrorHandler(options: UseErrorHandlerOptions = {}): ErrorHandler {
  const {
    enableNotification = true,
    enableRetry = true,
    maxRetries = 3,
    autoRetryDelay = 1000,
    component
  } = options;

  const { showNotification } = useNotification();
  const lastOperation = useRef<(() => Promise<any>) | null>(null);
  
  const [state, setState] = useState<ErrorState>({
    error: null,
    isError: false,
    errorMessage: '',
    retryable: false,
    retryCount: 0
  });

  /**
   * エラーハンドラー
   */
  const handleError = useCallback((error: any, context?: any) => {
    const errorDetails = errorService.trackError(error, {
      component,
      ...context
    });

    const userMessage = error.message || 'An error occurred';
    const isRetryable = enableRetry && state.retryCount < maxRetries;

    setState(prevState => ({
      error,
      isError: true,
      errorMessage: userMessage,
      errorId: Date.now().toString(),
      retryable: isRetryable,
      retryCount: prevState.retryCount
    }));

    // 通知表示
    if (enableNotification) {
      showNotification({
        type: 'error',
        title: 'エラーが発生しました',
        message: userMessage,
        duration: 5000,
        actions: isRetryable ? [{
          label: '再試行',
          onClick: () => retry()
        }] : undefined
      });
    }
  }, [component, enableNotification, enableRetry, maxRetries, state.retryCount, showNotification]);

  /**
   * 非同期処理のエラーハンドリング
   */
  const handleAsyncError = useCallback(async (
    asyncFn: () => Promise<any>, 
    context?: any
  ): Promise<any> => {
    lastOperation.current = asyncFn;
    
    try {
      const result = await asyncFn();
      // 成功時はエラー状態をクリア
      if (state.isError) {
        clearError();
      }
      return result;
    } catch (error) {
      handleError(error, context);
      throw error;
    }
  }, [handleError, state.isError]);

  /**
   * エラー状態のクリア
   */
  const clearError = useCallback(() => {
    setState({
      error: null,
      isError: false,
      errorMessage: '',
      retryable: false,
      retryCount: 0
    });
    lastOperation.current = null;
  }, []);

  /**
   * リトライ処理
   */
  const retry = useCallback(async (): Promise<void> => {
    if (!lastOperation.current || !state.retryable || state.retryCount >= maxRetries) {
      return;
    }

    const newRetryCount = state.retryCount + 1;
    
    setState(prevState => ({
      ...prevState,
      retryCount: newRetryCount,
      isError: false // リトライ中はエラー状態を一時的にクリア
    }));

    // 指数バックオフ遅延
    const delay = autoRetryDelay * Math.pow(2, state.retryCount);
    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      await lastOperation.current();
      clearError();
      
      if (enableNotification) {
        showNotification({
          type: 'success',
          title: '復旧しました',
          message: '操作が正常に完了しました。',
          duration: 3000
        });
      }
    } catch (error) {
      setState(prevState => ({
        ...prevState,
        isError: true,
        retryCount: newRetryCount,
        retryable: newRetryCount < maxRetries
      }));
      
      if (enableNotification) {
        showNotification({
          type: 'error',
          title: `再試行に失敗しました (${newRetryCount}/${maxRetries})`,
          message: newRetryCount >= maxRetries 
            ? '最大再試行回数に達しました。サポートまでご連絡ください。'
            : '再度試行することができます。',
          duration: 5000
        });
      }
    }
  }, [
    state.retryable, 
    state.retryCount, 
    maxRetries, 
    autoRetryDelay, 
    enableNotification, 
    showNotification, 
    clearError
  ]);

  return {
    handleError,
    handleAsyncError,
    clearError,
    retry,
    state
  };
}

/**
 * API呼び出し専用のエラーハンドラー
 */
export function useApiErrorHandler(options: UseErrorHandlerOptions = {}) {
  const errorHandler = useErrorHandler(options);

  const handleApiError = useCallback((error: AxiosError, context?: any) => {
    const apiErrorDetails = errorService.trackError(error as any, context);
    errorHandler.handleError(error, { ...context, apiError: true });
  }, [errorHandler]);

  const handleApiCall = useCallback(async <T>(
    apiCall: () => Promise<T>,
    context?: any
  ): Promise<T> => {
    try {
      return await errorHandler.handleAsyncError(apiCall, context);
    } catch (error) {
      if ((error as any).isAxiosError) {
        handleApiError(error as AxiosError, context);
      }
      throw error;
    }
  }, [errorHandler, handleApiError]);

  return {
    ...errorHandler,
    handleApiError,
    handleApiCall
  };
}

/**
 * AI処理専用のエラーハンドラー
 */
export function useAIErrorHandler(options: UseErrorHandlerOptions = {}) {
  const errorHandler = useErrorHandler(options);
  const [fallbackData, setFallbackData] = useState<any>(null);

  const handleAIError = useCallback((error: any, context?: any) => {
    const aiErrorDetails = errorService.trackError(error, context);
    
    // AI処理の場合はフォールバック戦略を提供
    if (error.code === 'AI_CONFIDENCE_LOW' || error.code === 'AI_SERVICE_UNAVAILABLE') {
      // フォールバックデータの設定
      setFallbackData(context?.fallbackData || null);
    }
    
    errorHandler.handleError(error, { ...context, aiError: true });
  }, [errorHandler]);

  const handleAICall = useCallback(async <T>(
    aiCall: () => Promise<T>,
    context?: { fallbackData?: T; operation?: string; model?: string }
  ): Promise<T> => {
    try {
      const result = await errorHandler.handleAsyncError(aiCall, context);
      setFallbackData(null); // 成功時はフォールバックデータをクリア
      return result;
    } catch (error) {
      handleAIError(error, context);
      
      // フォールバックデータがある場合は返す
      if (fallbackData !== null) {
        return fallbackData;
      }
      
      throw error;
    }
  }, [errorHandler, handleAIError, fallbackData]);

  return {
    ...errorHandler,
    handleAIError,
    handleAICall,
    fallbackData,
    clearFallback: () => setFallbackData(null)
  };
}

export default useErrorHandler;