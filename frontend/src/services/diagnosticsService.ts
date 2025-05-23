/**
 * 診断サービス
 * アプリケーションの診断情報の収集、分析、レポート機能を提供
 */
import { v4 as uuidv4 } from 'uuid';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  module: string;
  data?: any;
  stack?: string;
}

export interface SystemInfo {
  appVersion: string;
  userAgent: string;
  platform: string;
  language: string;
  screenResolution: string;
  timeZone: string;
  storageUsage?: {
    localStorage: number;
    sessionStorage: number;
    indexedDB?: number;
  };
  memoryUsage?: {
    usedJSHeapSize?: number;
    totalJSHeapSize?: number;
    jsHeapSizeLimit?: number;
  };
}

export interface NetworkDiagnostics {
  apiLatency: Record<string, number[]>;
  failedRequests: Array<{
    url: string;
    method: string;
    status: number;
    timestamp: number;
    error?: string;
  }>;
  wsReconnects: number;
  lastNetworkChangeTime: number | null;
}

export interface PerformanceMetrics {
  pageLoads: Record<string, number[]>;
  componentRenders: Record<string, number[]>;
  apiCalls: Record<string, number[]>;
  longTasks: Array<{
    duration: number;
    startTime: number;
    name?: string;
  }>;
}

export interface ErrorReport {
  id: string;
  timestamp: number;
  error: {
    message: string;
    stack?: string;
    type?: string;
  };
  context: {
    url: string;
    component?: string;
    action?: string;
    userInput?: any;
  };
  systemInfo: SystemInfo;
  logs: LogEntry[];
}

interface DiagnosticsOptions {
  logLevels?: LogLevel[];
  logRetentionDays?: number;
  enablePerformanceMonitoring?: boolean;
  enableNetworkMonitoring?: boolean;
  errorReportingEndpoint?: string;
  maxLogEntries?: number;
}

class DiagnosticsService {
  private logs: LogEntry[] = [];
  private performanceMetrics: PerformanceMetrics = {
    pageLoads: {},
    componentRenders: {},
    apiCalls: {},
    longTasks: [],
  };
  private networkDiagnostics: NetworkDiagnostics = {
    apiLatency: {},
    failedRequests: [],
    wsReconnects: 0,
    lastNetworkChangeTime: null,
  };
  private listeners: Map<string, Function[]> = new Map();
  private longTaskObserver: any = null;
  private options: DiagnosticsOptions = {
    logLevels: ['warn', 'error'],
    logRetentionDays: 7,
    enablePerformanceMonitoring: true,
    enableNetworkMonitoring: true,
    maxLogEntries: 1000,
  };

  constructor() {
    this.initNetworkMonitoring();
    this.initPerformanceMonitoring();
  }

  /**
   * サービスの初期化
   */
  public initialize(options?: Partial<DiagnosticsOptions>): void {
    this.options = { ...this.options, ...options };
    
    // 古いログを自動的に削除
    this.cleanupOldLogs();
    
    // ウィンドウのエラーハンドリングを設定
    window.addEventListener('error', this.handleGlobalError);
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
    
    // オフラインモードの変更を監視
    window.addEventListener('online', this.handleNetworkChange);
    window.addEventListener('offline', this.handleNetworkChange);
    
    console.log('Diagnostics service initialized');
  }

  /**
   * ネットワーク監視の初期化
   */
  private initNetworkMonitoring(): void {
    if (!this.options.enableNetworkMonitoring) return;
    
    // Fetch APIのインターセプト
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const startTime = performance.now();
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
      
      try {
        const response = await originalFetch(input, init);
        
        // レイテンシーの計測
        const endTime = performance.now();
        const latency = endTime - startTime;
        this.recordApiLatency(url, latency);
        
        // ステータスコードが400以上の場合は失敗として記録
        if (!response.ok) {
          this.recordFailedRequest(url, init?.method || 'GET', response.status);
        }
        
        return response;
      } catch (error) {
        const endTime = performance.now();
        this.recordFailedRequest(
          url, 
          init?.method || 'GET', 
          0, 
          error instanceof Error ? error.message : String(error)
        );
        throw error;
      }
    };
  }

  /**
   * パフォーマンス監視の初期化
   */
  private initPerformanceMonitoring(): void {
    if (!this.options.enablePerformanceMonitoring) return;
    
    // ページナビゲーションのパフォーマンス計測
    if ('PerformanceObserver' in window) {
      // 長時間タスクの監視
      try {
        this.longTaskObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry: any) => {
            this.performanceMetrics.longTasks.push({
              duration: entry.duration,
              startTime: entry.startTime,
              name: entry.name
            });
          });
        });
        this.longTaskObserver.observe({ entryTypes: ['longtask'] });
      } catch (e) {
        this.logInternal('error', 'diagnostics', 'Failed to observe long tasks', { error: e });
      }
      
      // ナビゲーションタイミングの監視
      try {
        const navObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry: any) => {
            if (entry.entryType === 'navigation') {
              this.recordPageLoad(window.location.pathname, entry.duration);
            }
          });
        });
        navObserver.observe({ entryTypes: ['navigation'] });
      } catch (e) {
        this.logInternal('error', 'diagnostics', 'Failed to observe navigation timing', { error: e });
      }
    }
  }

  /**
   * ネットワーク状態の変更ハンドラ
   */
  private handleNetworkChange = (): void => {
    this.networkDiagnostics.lastNetworkChangeTime = Date.now();
    this.logInternal('info', 'network', `Network status changed: ${navigator.onLine ? 'online' : 'offline'}`);
    this.emit('networkStatusChange', navigator.onLine);
  };

  /**
   * グローバルエラーハンドラ
   */
  private handleGlobalError = (event: ErrorEvent): void => {
    this.logInternal('error', 'global', event.message, { 
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack
    });
    
    this.emit('error', {
      message: event.message,
      stack: event.error?.stack,
      location: `${event.filename}:${event.lineno}:${event.colno}`
    });
  };

  /**
   * 未処理のPromise拒否ハンドラ
   */
  private handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    
    this.logInternal('error', 'promise', `Unhandled Promise Rejection: ${message}`, {
      reason,
      stack
    });
    
    this.emit('unhandledRejection', {
      message,
      stack,
      reason
    });
  };

  /**
   * ログエントリを記録
   */
  public log(level: LogLevel, module: string, message: string, data?: any): string {
    if (!this.options.logLevels?.includes(level)) return '';
    
    return this.logInternal(level, module, message, data);
  }

  /**
   * 内部ログ記録（レベルフィルタなし）
   */
  private logInternal(level: LogLevel, module: string, message: string, data?: any): string {
    const entry: LogEntry = {
      id: uuidv4(),
      timestamp: Date.now(),
      level,
      message,
      module,
      data
    };
    
    if (level === 'error' && data?.stack) {
      entry.stack = data.stack;
    }
    
    // 最大ログ数を超えたら古いものを削除
    if (this.logs.length >= (this.options.maxLogEntries || 1000)) {
      this.logs.shift();
    }
    
    this.logs.push(entry);
    this.emit('log', entry);
    
    // コンソールにも出力（開発環境のみの場合はここで条件分岐を追加できます）
    if (process.env.NODE_ENV === 'development') {
      const consoleMethod = level === 'debug' ? 'debug' :
                           level === 'info' ? 'info' :
                           level === 'warn' ? 'warn' : 'error';
      console[consoleMethod](`[${module}] ${message}`, data);
    }
    
    return entry.id;
  }

  /**
   * APIレイテンシーを記録
   */
  public recordApiLatency(endpoint: string, latency: number): void {
    const simplifiedEndpoint = this.simplifyUrl(endpoint);
    
    if (!this.networkDiagnostics.apiLatency[simplifiedEndpoint]) {
      this.networkDiagnostics.apiLatency[simplifiedEndpoint] = [];
    }
    
    this.networkDiagnostics.apiLatency[simplifiedEndpoint].push(latency);
    
    // 最大100件まで保存
    if (this.networkDiagnostics.apiLatency[simplifiedEndpoint].length > 100) {
      this.networkDiagnostics.apiLatency[simplifiedEndpoint].shift();
    }
  }

  /**
   * 失敗したリクエストを記録
   */
  public recordFailedRequest(url: string, method: string, status: number, error?: string): void {
    this.networkDiagnostics.failedRequests.push({
      url: this.simplifyUrl(url),
      method,
      status,
      timestamp: Date.now(),
      error
    });
    
    // 最大100件まで保存
    if (this.networkDiagnostics.failedRequests.length > 100) {
      this.networkDiagnostics.failedRequests.shift();
    }
    
    this.logInternal('warn', 'network', `API request failed: ${method} ${url}`, { status, error });
  }

  /**
   * WebSocket再接続回数をインクリメント
   */
  public recordWsReconnect(): void {
    this.networkDiagnostics.wsReconnects++;
    this.logInternal('info', 'websocket', 'WebSocket attempting to reconnect', { 
      reconnectCount: this.networkDiagnostics.wsReconnects 
    });
  }

  /**
   * ページロード時間を記録
   */
  public recordPageLoad(page: string, loadTime: number): void {
    if (!this.performanceMetrics.pageLoads[page]) {
      this.performanceMetrics.pageLoads[page] = [];
    }
    
    this.performanceMetrics.pageLoads[page].push(loadTime);
    
    // 最大50件まで保存
    if (this.performanceMetrics.pageLoads[page].length > 50) {
      this.performanceMetrics.pageLoads[page].shift();
    }
  }

  /**
   * コンポーネントのレンダリング時間を記録
   */
  public recordComponentRender(component: string, renderTime: number): void {
    if (!this.performanceMetrics.componentRenders[component]) {
      this.performanceMetrics.componentRenders[component] = [];
    }
    
    this.performanceMetrics.componentRenders[component].push(renderTime);
    
    // 最大50件まで保存
    if (this.performanceMetrics.componentRenders[component].length > 50) {
      this.performanceMetrics.componentRenders[component].shift();
    }
  }

  /**
   * API呼び出し時間を記録
   */
  public recordApiCall(endpoint: string, duration: number): void {
    const simplifiedEndpoint = this.simplifyUrl(endpoint);
    
    if (!this.performanceMetrics.apiCalls[simplifiedEndpoint]) {
      this.performanceMetrics.apiCalls[simplifiedEndpoint] = [];
    }
    
    this.performanceMetrics.apiCalls[simplifiedEndpoint].push(duration);
    
    // 最大50件まで保存
    if (this.performanceMetrics.apiCalls[simplifiedEndpoint].length > 50) {
      this.performanceMetrics.apiCalls[simplifiedEndpoint].shift();
    }
  }

  /**
   * システム情報を取得
   */
  public getSystemInfo(): SystemInfo {
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    
    // メモリ使用量の取得（Chrome/Edge/Operaのみ対応）
    let memoryUsage = undefined;
    const performance = window.performance as any;
    if (performance && performance.memory) {
      memoryUsage = {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
      };
    }
    
    // ストレージ使用量の取得
    const storageUsage = {
      localStorage: this.estimateStorageSize('localStorage'),
      sessionStorage: this.estimateStorageSize('sessionStorage')
    };
    
    return {
      appVersion: process.env.REACT_APP_VERSION || 'unknown',
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${screenWidth}x${screenHeight}`,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      storageUsage,
      memoryUsage
    };
  }

  /**
   * エラーレポートを作成
   */
  public createErrorReport(error: Error, context: {
    url: string;
    component?: string;
    action?: string;
    userInput?: any;
  }): ErrorReport {
    // 最近のログを取得（最大100件）
    const recentLogs = this.logs.slice(-100);
    
    const report: ErrorReport = {
      id: uuidv4(),
      timestamp: Date.now(),
      error: {
        message: error.message,
        stack: error.stack,
        type: error.name
      },
      context,
      systemInfo: this.getSystemInfo(),
      logs: recentLogs
    };
    
    return report;
  }

  /**
   * 診断情報をフルエクスポート
   */
  public exportDiagnostics(): {
    logs: LogEntry[];
    performanceMetrics: PerformanceMetrics;
    networkDiagnostics: NetworkDiagnostics;
    systemInfo: SystemInfo;
  } {
    return {
      logs: this.logs,
      performanceMetrics: this.performanceMetrics,
      networkDiagnostics: this.networkDiagnostics,
      systemInfo: this.getSystemInfo()
    };
  }

  /**
   * ログをクリア
   */
  public clearLogs(): void {
    this.logs = [];
    this.emit('logsCleared', null);
  }

  /**
   * パフォーマンスメトリクスをリセット
   */
  public resetPerformanceMetrics(): void {
    this.performanceMetrics = {
      pageLoads: {},
      componentRenders: {},
      apiCalls: {},
      longTasks: []
    };
  }

  /**
   * イベントリスナーを登録
   */
  public subscribe(event: string, callback: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    
    this.listeners.get(event)!.push(callback);
    
    // アンサブスクライブ関数を返す
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index !== -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  /**
   * サービスのクリーンアップ
   */
  public dispose(): void {
    window.removeEventListener('error', this.handleGlobalError);
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
    window.removeEventListener('online', this.handleNetworkChange);
    window.removeEventListener('offline', this.handleNetworkChange);
    
    if (this.longTaskObserver) {
      this.longTaskObserver.disconnect();
      this.longTaskObserver = null;
    }
    
    this.listeners.clear();
  }

  // ヘルパーメソッド
  
  /**
   * イベント発行
   */
  private emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (e) {
          console.error(`Error in diagnostics listener for event ${event}:`, e);
        }
      });
    }
  }

  /**
   * 古いログをクリーンアップ
   */
  private cleanupOldLogs(): void {
    const cutoffTime = Date.now() - (this.options.logRetentionDays || 7) * 24 * 60 * 60 * 1000;
    this.logs = this.logs.filter(log => log.timestamp >= cutoffTime);
  }

  /**
   * URLを単純化（パラメータを削除）
   */
  private simplifyUrl(url: string): string {
    try {
      const parsedUrl = new URL(url);
      // URLからパスのみを返す（クエリパラメータとハッシュを削除）
      return parsedUrl.pathname;
    } catch {
      // 相対URLの場合など、パース失敗時は元のURLを返す
      return url;
    }
  }

  /**
   * ストレージのサイズを推定
   */
  private estimateStorageSize(storageType: 'localStorage' | 'sessionStorage'): number {
    try {
      const storage = window[storageType];
      let totalSize = 0;
      
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i) || '';
        const value = storage.getItem(key) || '';
        totalSize += key.length + value.length;
      }
      
      // UTF-16文字列サイズ（バイト単位で概算）
      return totalSize * 2;
    } catch (e) {
      console.error(`Failed to estimate ${storageType} size:`, e);
      return 0;
    }
  }
}

// シングルトンインスタンスをエクスポート
const diagnosticsService = new DiagnosticsService();
export default diagnosticsService;