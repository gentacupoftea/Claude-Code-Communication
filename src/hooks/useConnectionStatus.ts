/**
 * 接続状態Hook
 * ネットワーク接続とAPI接続状態をリアルタイムで監視
 */

import { useState, useEffect, useCallback } from 'react';

// API接続状態の型定義
interface APIStatus {
  connected: boolean;
  message: string;
  lastChecked?: string;
  responseTime?: number;
  errorCode?: string;
}

interface APIConnectionStatus {
  shopify: APIStatus;
  amazon: APIStatus;
  rakuten: APIStatus;
  nextengine: APIStatus;
  smaregi: APIStatus;
  google_analytics: APIStatus;
}

interface ConnectionStatus {
  isOnline: boolean;
  apiStatus: APIConnectionStatus;
  lastChecked: string | null;
  isLoading: boolean;
  error: string | null;
}

interface OverallStatus {
  status: 'connected' | 'partial' | 'disconnected' | 'offline';
  message: string;
  connectedCount: number;
  totalCount: number;
}

/**
 * 接続状態を監視するカスタムHook
 */
export const useConnectionStatus = () => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isOnline: navigator.onLine,
    apiStatus: {
      shopify: { connected: false, message: '未確認' },
      amazon: { connected: false, message: '未確認' },
      rakuten: { connected: false, message: '未確認' },
      nextengine: { connected: false, message: '未確認' },
      smaregi: { connected: false, message: '未確認' },
      google_analytics: { connected: false, message: '未確認' }
    },
    lastChecked: null,
    isLoading: false,
    error: null
  });

  /**
   * APIヘルスチェックを実行
   */
  const checkAPIStatus = useCallback(async () => {
    setConnectionStatus(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/health', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // キャッシュを無効にしてリアルタイムデータを取得
        cache: 'no-cache'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const healthData = await response.json();

      setConnectionStatus(prev => ({
        ...prev,
        apiStatus: healthData.apis || prev.apiStatus,
        lastChecked: healthData.timestamp || new Date().toISOString(),
        isLoading: false,
        error: null
      }));

    } catch (error) {
      console.error('API接続チェックエラー:', error);
      setConnectionStatus(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : '不明なエラー'
      }));
    }
  }, []);

  /**
   * ネットワーク接続状態の変化を監視
   */
  useEffect(() => {
    const handleOnline = () => {
      setConnectionStatus(prev => ({ ...prev, isOnline: true }));
      // オンラインになったらAPIステータスもチェック
      checkAPIStatus();
    };

    const handleOffline = () => {
      setConnectionStatus(prev => ({ ...prev, isOnline: false }));
    };

    // イベントリスナーを登録
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 初回ロード時にAPIステータスをチェック
    if (navigator.onLine) {
      checkAPIStatus();
    }

    // クリーンアップ
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkAPIStatus]);

  /**
   * 定期的なAPIステータスチェック（30秒間隔）
   */
  useEffect(() => {
    if (!navigator.onLine) return;

    const interval = setInterval(() => {
      checkAPIStatus();
    }, 30000); // 30秒間隔

    return () => clearInterval(interval);
  }, [checkAPIStatus]);

  /**
   * 手動でAPIステータスを更新
   */
  const refreshStatus = useCallback(() => {
    if (navigator.onLine) {
      checkAPIStatus();
    }
  }, [checkAPIStatus]);

  /**
   * 特定のAPIの接続状態を取得
   */
  const getAPIStatus = useCallback((apiName: keyof APIConnectionStatus) => {
    return connectionStatus.apiStatus[apiName];
  }, [connectionStatus.apiStatus]);

  /**
   * 全体的な接続状態を取得
   */
  const getOverallStatus = useCallback((): OverallStatus => {
    if (!connectionStatus.isOnline) {
      return { 
        status: 'offline', 
        message: 'インターネット接続がありません',
        connectedCount: 0,
        totalCount: Object.keys(connectionStatus.apiStatus).length
      };
    }

    const connectedAPIs = Object.values(connectionStatus.apiStatus).filter(api => api.connected);
    const totalAPIs = Object.keys(connectionStatus.apiStatus).length;

    if (connectedAPIs.length === 0) {
      return { 
        status: 'disconnected', 
        message: 'すべてのAPIが接続されていません',
        connectedCount: 0,
        totalCount: totalAPIs
      };
    } else if (connectedAPIs.length === totalAPIs) {
      return { 
        status: 'connected', 
        message: 'すべてのAPIが正常に接続されています',
        connectedCount: connectedAPIs.length,
        totalCount: totalAPIs
      };
    } else {
      return { 
        status: 'partial', 
        message: `${connectedAPIs.length}/${totalAPIs} のAPIが接続されています`,
        connectedCount: connectedAPIs.length,
        totalCount: totalAPIs
      };
    }
  }, [connectionStatus]);

  return {
    isOnline: connectionStatus.isOnline,
    apiStatus: connectionStatus.apiStatus,
    lastChecked: connectionStatus.lastChecked,
    isLoading: connectionStatus.isLoading,
    error: connectionStatus.error,
    refreshStatus,
    getAPIStatus,
    getOverallStatus
  };
};