/**
 * 診断情報のカスタムフック
 * アプリケーションの診断情報へのアクセスとエラー報告機能を提供
 */
import { useState, useEffect, useCallback } from 'react';
import diagnosticsService, {
  LogEntry, 
  LogLevel,
  SystemInfo,
  NetworkDiagnostics,
  PerformanceMetrics,
  ErrorReport
} from '../services/diagnosticsService';

export interface UseDiagnosticsOptions {
  logLevels?: LogLevel[];
  autoSubscribe?: boolean;
}

interface DiagnosticsSummary {
  recentErrors: number;
  failedRequests: number;
  avgApiLatency: number | null;
  longTasks: number;
  wsReconnects: number;
}

export const useDiagnostics = (options: UseDiagnosticsOptions = {}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [networkDiagnostics, setNetworkDiagnostics] = useState<NetworkDiagnostics | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [summary, setSummary] = useState<DiagnosticsSummary>({
    recentErrors: 0,
    failedRequests: 0,
    avgApiLatency: null,
    longTasks: 0,
    wsReconnects: 0
  });

  // システム情報の取得
  const refreshSystemInfo = useCallback(() => {
    setSystemInfo(diagnosticsService.getSystemInfo());
  }, []);

  // 診断情報のエクスポート
  const exportDiagnostics = useCallback(() => {
    return diagnosticsService.exportDiagnostics();
  }, []);

  // エラーレポートの作成
  const createErrorReport = useCallback((
    error: Error, 
    context: { url: string; component?: string; action?: string; userInput?: any }
  ): ErrorReport => {
    return diagnosticsService.createErrorReport(error, context);
  }, []);

  // エラーのログ記録
  const logError = useCallback((module: string, message: string, data?: any): string => {
    return diagnosticsService.log('error', module, message, data);
  }, []);

  // 警告のログ記録
  const logWarning = useCallback((module: string, message: string, data?: any): string => {
    return diagnosticsService.log('warn', module, message, data);
  }, []);

  // 情報のログ記録
  const logInfo = useCallback((module: string, message: string, data?: any): string => {
    return diagnosticsService.log('info', module, message, data);
  }, []);

  // デバッグのログ記録
  const logDebug = useCallback((module: string, message: string, data?: any): string => {
    return diagnosticsService.log('debug', module, message, data);
  }, []);

  // パフォーマンス計測開始
  const measurePerformance = useCallback((operationName: string): () => number => {
    const startTime = performance.now();
    
    // 終了関数を返す
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // 操作タイプに基づいて適切なメソッドを呼び出す
      if (operationName.startsWith('api:')) {
        const endpoint = operationName.substr(4);
        diagnosticsService.recordApiCall(endpoint, duration);
      } else if (operationName.startsWith('component:')) {
        const component = operationName.substr(10);
        diagnosticsService.recordComponentRender(component, duration);
      } else if (operationName.startsWith('page:')) {
        const page = operationName.substr(5);
        diagnosticsService.recordPageLoad(page, duration);
      }
      
      return duration;
    };
  }, []);

  // ログのクリア
  const clearLogs = useCallback(() => {
    diagnosticsService.clearLogs();
  }, []);

  // パフォーマンスメトリクスのリセット
  const resetPerformanceMetrics = useCallback(() => {
    diagnosticsService.resetPerformanceMetrics();
  }, []);

  // 診断サマリーの計算
  const calculateSummary = useCallback(() => {
    const fullDiagnostics = diagnosticsService.exportDiagnostics();
    
    // 最近のエラー数（過去24時間）
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentErrors = fullDiagnostics.logs.filter(
      log => log.level === 'error' && log.timestamp > oneDayAgo
    ).length;
    
    // 失敗したリクエスト数
    const failedRequests = fullDiagnostics.networkDiagnostics.failedRequests.length;
    
    // 平均APIレイテンシー
    let totalLatency = 0;
    let latencyCount = 0;
    
    Object.values(fullDiagnostics.networkDiagnostics.apiLatency).forEach(latencies => {
      latencies.forEach(latency => {
        totalLatency += latency;
        latencyCount++;
      });
    });
    
    const avgApiLatency = latencyCount > 0 ? totalLatency / latencyCount : null;
    
    // 長時間タスクの数
    const longTasks = fullDiagnostics.performanceMetrics.longTasks.length;
    
    // WebSocket再接続回数
    const wsReconnects = fullDiagnostics.networkDiagnostics.wsReconnects;
    
    setSummary({
      recentErrors,
      failedRequests,
      avgApiLatency,
      longTasks,
      wsReconnects
    });
  }, []);

  // 全診断情報の更新
  const refreshAllDiagnostics = useCallback(() => {
    const fullDiagnostics = diagnosticsService.exportDiagnostics();
    setLogs(fullDiagnostics.logs);
    setNetworkDiagnostics(fullDiagnostics.networkDiagnostics);
    setPerformanceMetrics(fullDiagnostics.performanceMetrics);
    setSystemInfo(fullDiagnostics.systemInfo);
    calculateSummary();
  }, [calculateSummary]);

  // イベント購読の設定
  useEffect(() => {
    if (options.autoSubscribe !== false) {
      // ログ追加時
      const logSubscription = diagnosticsService.subscribe('log', (logEntry: LogEntry) => {
        setLogs(prevLogs => {
          // フィルタリング（指定されたレベルのみ）
          if (options.logLevels && !options.logLevels.includes(logEntry.level)) {
            return prevLogs;
          }
          
          // 最大1000件まで保持
          const newLogs = [...prevLogs, logEntry];
          if (newLogs.length > 1000) {
            return newLogs.slice(-1000);
          }
          return newLogs;
        });
        
        // エラーログの場合はサマリーを更新
        if (logEntry.level === 'error') {
          calculateSummary();
        }
      });
      
      // ログクリア時
      const logsClearedSubscription = diagnosticsService.subscribe('logsCleared', () => {
        setLogs([]);
        calculateSummary();
      });
      
      // ネットワークステータス変更時
      const networkSubscription = diagnosticsService.subscribe('networkStatusChange', (online: boolean) => {
        setIsOnline(online);
        refreshAllDiagnostics();
      });
      
      return () => {
        logSubscription();
        logsClearedSubscription();
        networkSubscription();
      };
    }
    
    return undefined;
  }, [options.autoSubscribe, options.logLevels, calculateSummary, refreshAllDiagnostics]);

  // 初期データの取得
  useEffect(() => {
    refreshAllDiagnostics();
  }, [refreshAllDiagnostics]);

  // 定期的な更新
  useEffect(() => {
    const intervalId = setInterval(() => {
      calculateSummary();
    }, 60000); // 1分ごとに更新
    
    return () => clearInterval(intervalId);
  }, [calculateSummary]);

  return {
    logs,
    systemInfo,
    networkDiagnostics,
    performanceMetrics,
    summary,
    isOnline,
    
    // 操作
    refreshSystemInfo,
    refreshAllDiagnostics,
    exportDiagnostics,
    createErrorReport,
    clearLogs,
    resetPerformanceMetrics,
    
    // ログ関数
    logError,
    logWarning,
    logInfo,
    logDebug,
    
    // パフォーマンス計測
    measurePerformance
  };
};