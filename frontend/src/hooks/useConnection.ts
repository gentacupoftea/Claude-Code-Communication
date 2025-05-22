import { useState, useEffect, useCallback } from 'react';

/**
 * ネットワーク接続状態を管理するカスタムフック
 */
const useConnection = () => {
  // オンライン状態
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  
  // 接続タイプ（WiFi、モバイル、不明）
  const [connectionType, setConnectionType] = useState<string>('unknown');
  
  // 現在接続しているAPIエンドポイント
  const [apiEndpoint, setApiEndpoint] = useState<string | null>(null);
  
  // 接続品質（good, fair, poor, unknown）
  const [connectionQuality, setConnectionQuality] = useState<string>('unknown');
  
  // 最終接続チェック時間
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // オンライン/オフラインステータスの変更を監視
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastChecked(new Date());
      checkConnectionType();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setConnectionType('none');
      setLastChecked(new Date());
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // 初期接続タイプをチェック
    checkConnectionType();
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 接続タイプを確認（WiFi、モバイルなど）
  const checkConnectionType = useCallback(() => {
    // @ts-ignore - Navigator Network Information API
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    if (connection) {
      setConnectionType(connection.type || 'unknown');
      
      // 接続品質を推定
      const effectiveType = connection.effectiveType || 'unknown';
      switch (effectiveType) {
        case '4g':
          setConnectionQuality('good');
          break;
        case '3g':
          setConnectionQuality('fair');
          break;
        case '2g':
        case 'slow-2g':
          setConnectionQuality('poor');
          break;
        default:
          setConnectionQuality('unknown');
      }
      
      // 接続変更イベントの監視
      const handleConnectionChange = () => {
        setConnectionType(connection.type || 'unknown');
        setLastChecked(new Date());
      };
      
      connection.addEventListener('change', handleConnectionChange);
      return () => connection.removeEventListener('change', handleConnectionChange);
    }
    
    return undefined;
  }, []);

  // 接続状態を手動で確認
  const checkConnection = useCallback(async () => {
    try {
      // APIエンドポイントに接続テストを実行
      const apiUrl = process.env.REACT_APP_API_URL || '/api';
      const response = await fetch(`${apiUrl}/health`, { 
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
        mode: 'cors',
        credentials: 'same-origin',
      });
      
      const online = response.ok;
      setIsOnline(online);
      setApiEndpoint(apiUrl);
      setLastChecked(new Date());
      
      return online;
    } catch (error) {
      console.error('接続チェック中にエラーが発生しました', error);
      setIsOnline(false);
      setLastChecked(new Date());
      return false;
    }
  }, []);

  // 接続品質をテスト（レイテンシー測定）
  const testConnectionQuality = useCallback(async () => {
    if (!isOnline) {
      setConnectionQuality('none');
      return 'none';
    }
    
    try {
      const start = Date.now();
      
      // APIエンドポイントに接続テストを実行
      const apiUrl = process.env.REACT_APP_API_URL || '/api';
      await fetch(`${apiUrl}/health`, { 
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
        mode: 'cors',
        credentials: 'same-origin',
      });
      
      const latency = Date.now() - start;
      
      // レイテンシーに基づいて品質を判定
      let quality = 'unknown';
      if (latency < 100) {
        quality = 'good';
      } else if (latency < 300) {
        quality = 'fair';
      } else {
        quality = 'poor';
      }
      
      setConnectionQuality(quality);
      setLastChecked(new Date());
      
      return quality;
    } catch (error) {
      console.error('接続品質テスト中にエラーが発生しました', error);
      setConnectionQuality('unknown');
      return 'unknown';
    }
  }, [isOnline]);

  return {
    isOnline,
    connectionType,
    connectionQuality,
    apiEndpoint,
    lastChecked,
    checkConnection,
    testConnectionQuality
  };
};

export default useConnection;
export { useConnection };