/**
 * エラーハンドリングと報告サービス
 * 
 * アプリケーション全体でのエラー追跡、ログ記録、モニタリングを提供します。
 * 本番環境とステージング環境では、エラーを収集し、開発チームに報告します。
 */

import type { Environment } from '../config/environments';

// 初期化状態を追跡
let isInitialized = false;

/**
 * エラートラッキングサービスを初期化
 * @param env 現在の環境
 */
export const initializeErrorTracking = (env: Environment) => {
  if (isInitialized) return;
  
  // エラートラッキングのグローバルハンドラーを設定
  window.onerror = (message, source, lineno, colno, error) => {
    handleGlobalError({ message, source, lineno, colno, error });
    return false; // ブラウザのデフォルトエラーハンドリングを許可
  };

  // 未処理のPromiseリジェクションを追跡
  window.addEventListener('unhandledrejection', (event) => {
    handlePromiseRejection(event);
  });

  console.log(`Error tracking initialized in ${env} environment`);
  isInitialized = true;

  // 環境に応じたエラー追跡サービスを初期化
  if (env === 'production' || env === 'staging') {
    // 本番環境やステージング環境では実際のエラートラッキングサービスを使用
    setupErrorTrackingService(env);
  }
};

/**
 * グローバルエラーハンドラー
 */
const handleGlobalError = (errorDetails: {
  message?: any;
  source?: string;
  lineno?: number;
  colno?: number;
  error?: Error;
}) => {
  const { message, source, lineno, colno, error } = errorDetails;
  
  // エラー情報を整形
  const errorInfo = {
    type: 'global_error',
    message: message?.toString() || 'Unknown error',
    source,
    line: lineno,
    column: colno,
    stack: error?.stack,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
  };
  
  // エラーをコンソールに出力
  console.error('Unhandled global error:', errorInfo);
  
  // エラー追跡サービスに送信
  sendErrorToTracking(errorInfo);
};

/**
 * 未処理のPromiseリジェクションハンドラー
 */
const handlePromiseRejection = (event: PromiseRejectionEvent) => {
  const errorInfo = {
    type: 'unhandled_promise_rejection',
    message: event.reason?.message || 'Unhandled promise rejection',
    stack: event.reason?.stack,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
  };
  
  console.error('Unhandled promise rejection:', errorInfo);
  
  // エラー追跡サービスに送信
  sendErrorToTracking(errorInfo);
};

/**
 * エラー追跡サービスのセットアップ
 */
const setupErrorTrackingService = (env: Environment) => {
  // ここでは実際のエラー追跡サービス（例：Sentry）の初期化を行う
  // 実装の詳細はサービスごとに異なる
  console.log(`Error tracking service set up for ${env} environment`);
};

/**
 * エラーをトラッキングサービスに送信
 */
const sendErrorToTracking = (errorInfo: any) => {
  // 開発環境ではエラーを送信しない
  if (process.env.NODE_ENV === 'development') {
    return;
  }
  
  // ここでは、エラー情報をAPIに送信するか、
  // または外部のエラートラッキングサービスに直接送信する
  
  // 例: API経由でエラーを送信する場合
  try {
    const endpoint = process.env.REACT_APP_ERROR_TRACKING_ENDPOINT || '/api/error-tracking';
    
    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(errorInfo),
    }).catch(err => {
      console.error('Failed to send error to tracking service:', err);
    });
  } catch (err) {
    console.error('Error in sendErrorToTracking:', err);
  }
};

/**
 * 特定のエラーを手動で追跡
 * @param error エラーオブジェクト
 * @param context 追加のコンテキスト情報
 */
export const trackError = (error: Error, context: Record<string, any> = {}) => {
  const errorInfo = {
    type: 'tracked_error',
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
  };
  
  console.error('Tracked error:', errorInfo);
  
  // エラー追跡サービスに送信
  sendErrorToTracking(errorInfo);
  
  return errorInfo;
};

/**
 * コンポーネントエラーバウンダリで使用するエラーハンドラー
 */
export const handleComponentError = (error: Error, componentInfo: string) => {
  return trackError(error, { componentInfo });
};

/**
 * ネットワークエラーを追跡
 */
export const trackNetworkError = (error: any, request: Request) => {
  return trackError(
    error instanceof Error ? error : new Error(String(error)),
    {
      type: 'network_error',
      url: request.url,
      method: request.method,
      headers: Array.from(request.headers.entries()),
    }
  );
};

/**
 * エラーハンドリングユーティリティをエクスポート
 */
export default {
  initializeErrorTracking,
  trackError,
  handleComponentError,
  trackNetworkError,
};