/**
 * 分析サービス
 * 
 * ユーザーの行動やアプリケーションの使用状況を追跡し、
 * データを収集するためのサービスを提供します。
 */

import type { Environment } from '../config/environments';

// 初期化状態を追跡
let isInitialized = false;

// イベントキュー（オフライン時やエラー時に使用）
const eventQueue: AnalyticsEvent[] = [];

// 分析イベントの基本インターフェース
interface AnalyticsEvent {
  type: string;
  timestamp: string;
  properties?: Record<string, any>;
  userId?: string;
  sessionId?: string;
}

// セッションID（ブラウザセッションごとに一意）
const sessionId = generateSessionId();

/**
 * ランダムなセッションIDを生成
 */
function generateSessionId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

/**
 * 分析サービスを初期化
 * @param env 現在の環境
 */
export const initializeAnalytics = (env: Environment) => {
  if (isInitialized) return;
  
  // 開発環境では分析を無効化
  if (env === 'development' && !process.env.REACT_APP_ENABLE_DEV_ANALYTICS) {
    console.log('Analytics disabled in development environment');
    return;
  }

  // ページビューの追跡を設定
  setupPageViewTracking();
  
  // ユーザーインタラクションの追跡を設定
  setupUserInteractionTracking();
  
  // パフォーマンスの追跡を設定
  setupPerformanceTracking();
  
  console.log(`Analytics initialized in ${env} environment`);
  isInitialized = true;
  
  // キューに溜まったイベントを送信
  flushEventQueue();
};

/**
 * ページビューの追跡を設定
 */
const setupPageViewTracking = () => {
  // History APIの変更をリッスン
  const originalPushState = window.history.pushState;
  window.history.pushState = function(...args) {
    // 元のメソッドを呼び出し
    originalPushState.apply(window.history, args);
    // ページビューを追跡
    trackPageView(window.location.pathname);
  };
  
  // ブラウザの戻る/進むボタンをリッスン
  window.addEventListener('popstate', () => {
    trackPageView(window.location.pathname);
  });
};

/**
 * ユーザーインタラクションの追跡を設定
 */
const setupUserInteractionTracking = () => {
  // クリックイベントの追跡
  document.addEventListener('click', (event) => {
    // data-track属性を持つ要素のクリックを追跡
    const target = event.target as HTMLElement;
    const trackingElement = target.closest('[data-track]');
    
    if (trackingElement) {
      const trackingInfo = trackingElement.getAttribute('data-track');
      if (trackingInfo) {
        try {
          const trackingData = JSON.parse(trackingInfo);
          trackEvent('ui_interaction', {
            action: 'click',
            ...trackingData,
          });
        } catch (error) {
          // JSON解析エラー
          trackEvent('ui_interaction', {
            action: 'click',
            element: trackingInfo,
          });
        }
      }
    }
  }, { passive: true });
  
  // フォーム送信の追跡
  document.addEventListener('submit', (event) => {
    const form = event.target as HTMLFormElement;
    const formId = form.id || 'unknown_form';
    
    trackEvent('form_submission', {
      form_id: formId,
      form_name: form.getAttribute('name') || formId,
    });
  }, { passive: true });
};

/**
 * パフォーマンスの追跡を設定
 */
const setupPerformanceTracking = () => {
  if ('performance' in window && 'getEntriesByType' in performance) {
    // ページロードタイミングを追跡
    window.addEventListener('load', () => {
      setTimeout(() => {
        const perfEntries = performance.getEntriesByType('navigation');
        if (perfEntries.length > 0) {
          const navigationEntry = perfEntries[0] as PerformanceNavigationTiming;
          
          trackEvent('page_performance', {
            page_load_time: navigationEntry.loadEventEnd - navigationEntry.startTime,
            dns_time: navigationEntry.domainLookupEnd - navigationEntry.domainLookupStart,
            tcp_connection_time: navigationEntry.connectEnd - navigationEntry.connectStart,
            dom_interactive_time: navigationEntry.domInteractive - navigationEntry.startTime,
            dom_complete_time: navigationEntry.domComplete - navigationEntry.startTime,
          });
        }
      }, 0);
    });
  }
};

/**
 * ページビューを追跡
 * @param path ページパス
 * @param title ページタイトル（省略可能）
 */
export const trackPageView = (path: string, title?: string) => {
  if (!isInitialized) return;
  
  const properties = {
    path,
    title: title || document.title,
    referrer: document.referrer || '',
    url: window.location.href,
  };
  
  trackEvent('page_view', properties);
};

/**
 * カスタムイベントを追跡
 * @param type イベントタイプ
 * @param properties イベントプロパティ
 */
export const trackEvent = (type: string, properties: Record<string, any> = {}) => {
  const event: AnalyticsEvent = {
    type,
    timestamp: new Date().toISOString(),
    properties,
    sessionId,
    userId: getUserId(),
  };
  
  // 開発環境ではコンソールに出力
  if (process.env.NODE_ENV === 'development') {
    console.log('[Analytics]', event);
  }
  
  // イベントをキューに追加
  eventQueue.push(event);
  
  // キューのイベントを処理（ディボウンス処理）
  debounceFlushQueue();
};

/**
 * ユーザーIDを取得
 */
const getUserId = (): string | undefined => {
  // ユーザーが認証されている場合、そのIDを使用
  // この例では localStorage から取得しているが、実際にはReduxストアなどから取得する
  try {
    const authData = localStorage.getItem('authData');
    if (authData) {
      const userData = JSON.parse(authData);
      return userData.userId;
    }
  } catch (error) {
    console.error('Error getting user ID for analytics:', error);
  }
  
  return undefined;
};

// ディボウンスタイマー
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * イベントキューのフラッシュをディボウンス処理
 */
const debounceFlushQueue = () => {
  if (flushTimer) {
    clearTimeout(flushTimer);
  }
  
  flushTimer = setTimeout(() => {
    flushEventQueue();
  }, 2000); // 2秒後にフラッシュ
};

/**
 * イベントキューをフラッシュし、サーバーに送信
 */
const flushEventQueue = async () => {
  if (!isInitialized || eventQueue.length === 0) return;
  
  const events = [...eventQueue];
  eventQueue.length = 0; // キューをクリア
  
  try {
    const endpoint = process.env.REACT_APP_ANALYTICS_ENDPOINT || '/api/analytics/collect';
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ events }),
    });
    
    if (!response.ok) {
      throw new Error(`Analytics API error: ${response.status}`);
    }
  } catch (error) {
    console.error('Failed to send analytics events:', error);
    // 失敗したイベントをキューに戻す
    eventQueue.push(...events);
  }
};

/**
 * アプリケーションのエラーを追跡
 * @param error エラーオブジェクト
 * @param context エラーコンテキスト
 */
export const trackError = (error: Error, context: Record<string, any> = {}) => {
  trackEvent('error', {
    error_message: error.message,
    error_stack: error.stack,
    ...context,
  });
};

/**
 * 特定のアクションの開始を追跡
 * @param actionName アクション名
 * @param properties 追加プロパティ
 * @returns アクションID（終了時に使用）
 */
export const trackActionStart = (actionName: string, properties: Record<string, any> = {}) => {
  const actionId = `${actionName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  trackEvent('action_start', {
    action_name: actionName,
    action_id: actionId,
    ...properties,
  });
  
  return actionId;
};

/**
 * 特定のアクションの終了を追跡
 * @param actionId アクションID（開始時に生成されたもの）
 * @param actionName アクション名
 * @param properties 追加プロパティ
 */
export const trackActionEnd = (actionId: string, actionName: string, properties: Record<string, any> = {}) => {
  trackEvent('action_end', {
    action_name: actionName,
    action_id: actionId,
    ...properties,
  });
};

/**
 * 分析サービスをエクスポート
 */
export default {
  initializeAnalytics,
  trackPageView,
  trackEvent,
  trackError,
  trackActionStart,
  trackActionEnd,
};