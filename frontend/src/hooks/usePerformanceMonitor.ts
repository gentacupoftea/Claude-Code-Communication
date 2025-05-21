/**
 * パフォーマンス計測のためのカスタムフック
 * コンポーネントのレンダリング時間を自動的に計測する
 */
import { useEffect, useRef } from 'react';
import diagnosticsService from '../services/diagnosticsService';

interface UsePerformanceMonitorProps {
  componentName: string;
  trackMounts?: boolean;
  trackUpdates?: boolean;
  trackRenders?: boolean;
  disabled?: boolean;
}

export const usePerformanceMonitor = ({
  componentName,
  trackMounts = true,
  trackUpdates = true,
  trackRenders = true,
  disabled = false
}: UsePerformanceMonitorProps) => {
  const startTimeRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(false);
  const renderCountRef = useRef<number>(0);
  
  // コンポーネントのマウント時とアンマウント時の計測
  useEffect(() => {
    if (disabled) return;
    
    if (trackMounts) {
      const mountStartTime = performance.now();
      
      // マウント完了時
      const mountEndTime = performance.now();
      const mountDuration = mountEndTime - mountStartTime;
      
      diagnosticsService.recordComponentRender(
        `${componentName}:mount`,
        mountDuration
      );
      
      diagnosticsService.log('debug', 'performance', `Component mounted: ${componentName}`, {
        duration: mountDuration,
        component: componentName
      });
    }
    
    isMountedRef.current = true;
    
    // アンマウント時
    return () => {
      if (trackMounts) {
        diagnosticsService.log('debug', 'performance', `Component unmounted: ${componentName}`, {
          component: componentName,
          totalRenders: renderCountRef.current
        });
      }
    };
  }, [componentName, trackMounts, disabled]);
  
  // レンダリング開始時に時間を記録
  const trackRenderStart = () => {
    if (disabled || !trackRenders) return;
    
    startTimeRef.current = performance.now();
  };
  
  // レンダリング完了時に時間を計測
  const trackRenderEnd = () => {
    if (disabled || !trackRenders || startTimeRef.current === 0) return;
    
    const endTime = performance.now();
    const duration = endTime - startTimeRef.current;
    renderCountRef.current += 1;
    
    // 初回レンダリングとそれ以降で分ける
    const phase = renderCountRef.current === 1 ? 'initial' : 'update';
    
    diagnosticsService.recordComponentRender(
      `${componentName}:${phase}`,
      duration
    );
    
    // 更新の場合のみログに記録（オプション）
    if (phase === 'update' && trackUpdates) {
      diagnosticsService.log('debug', 'performance', `Component updated: ${componentName}`, {
        duration,
        component: componentName,
        renderCount: renderCountRef.current
      });
    }
    
    startTimeRef.current = 0;
  };
  
  // 特定の操作のパフォーマンスを計測
  const measureOperation = (operationName: string) => {
    if (disabled) return () => 0;
    
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      diagnosticsService.log('debug', 'performance', `Operation executed: ${operationName}`, {
        duration,
        component: componentName,
        operation: operationName
      });
      
      return duration;
    };
  };
  
  // 関数実行時間を計測するラッパー
  const withPerformanceMeasure = <T extends (...args: any[]) => any>(
    fn: T,
    operationName: string
  ): ((...args: Parameters<T>) => ReturnType<T>) => {
    if (disabled) return fn;
    
    return (...args: Parameters<T>): ReturnType<T> => {
      const startTime = performance.now();
      const result = fn(...args);
      
      // Promiseの場合は完了時に計測
      if (result instanceof Promise) {
        result.finally(() => {
          const endTime = performance.now();
          const duration = endTime - startTime;
          
          diagnosticsService.log('debug', 'performance', `Async operation executed: ${operationName}`, {
            duration,
            component: componentName,
            operation: operationName
          });
        });
      } else {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        diagnosticsService.log('debug', 'performance', `Operation executed: ${operationName}`, {
          duration,
          component: componentName,
          operation: operationName
        });
      }
      
      return result;
    };
  };
  
  return {
    trackRenderStart,
    trackRenderEnd,
    measureOperation,
    withPerformanceMeasure
  };
};