'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Wifi, WifiOff, Server, AlertTriangle, CloudOff } from 'lucide-react';
import { useTheme } from 'next-themes';

type Position = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface ConnectionStatusIndicatorProps {
  position?: Position;
  theme?: 'light' | 'dark' | 'auto';
  refreshInterval?: number;
}

const positionClasses: Record<Position, string> = {
  'top-left': 'top-4 left-4',
  'top-right': 'top-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-right': 'bottom-4 right-4',
};

const themeClasses = {
  light: {
    bg: 'bg-white/80 backdrop-blur-sm',
    text: 'text-gray-800',
    iconOnline: 'text-green-500',
    iconOffline: 'text-red-500',
    iconChecking: 'text-yellow-500',
  },
  dark: {
    bg: 'bg-gray-800/80 backdrop-blur-sm',
    text: 'text-white/90',
    iconOnline: 'text-green-400',
    iconOffline: 'text-red-400',
    iconChecking: 'text-yellow-400',
  },
};

type Status = 'checking' | 'online' | 'offline' | 'error';

interface ApiStatus {
  name: string;
  status: Status;
  url: string;
}

const initialApis: ApiStatus[] = [
  { name: 'Backend API', status: 'checking', url: '/api/health' },
  { name: 'LLM Service', status: 'checking', url: '/api/models' },
  // 他のAPIを追加可能
];

export const ConnectionStatusIndicator: React.FC<ConnectionStatusIndicatorProps> = ({
  position = 'bottom-right',
  theme: themeProp = 'auto',
  refreshInterval = 30000,
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const [apis, setApis] = useState<ApiStatus[]>(initialApis);
  const { resolvedTheme } = useTheme();

  const checkAPIStatus = useCallback(async (api: ApiStatus): Promise<Status> => {
    try {
      const response = await fetch(api.url);
      if (response.ok) {
        return 'online';
      }
      return 'error';
    } catch (error) {
      return 'offline';
    }
  }, []);

  useEffect(() => {
    setIsMounted(true); // コンポーネントがマウントされたことを記録

    const checkAllApis = async () => {
      const newApiStatuses = await Promise.all(
        initialApis.map(async (api) => ({
          ...api,
          status: await checkAPIStatus(api),
        }))
      );
      setApis(newApiStatuses);
    };

    checkAllApis();
    const interval = setInterval(checkAllApis, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, checkAPIStatus]);


  if (!isMounted) {
    // サーバーサイドまたはハイドレーション中は何もレンダリングしない
    return null;
  }

  const overallStatus: Status = apis.every((api) => api.status === 'online')
    ? 'online'
    : apis.some((api) => api.status === 'offline')
    ? 'offline'
    : apis.some((api) => api.status === 'error')
    ? 'error'
    : 'checking';

  const currentTheme = themeProp === 'auto' ? (resolvedTheme as 'light' | 'dark') : themeProp;
  const styles = themeClasses[currentTheme || 'dark'];

  const getIcon = () => {
    switch (overallStatus) {
      case 'online':
        return <Server className={`w-4 h-4 ${styles.iconOnline}`} />;
      case 'offline':
        return <CloudOff className={`w-4 h-4 ${styles.iconOffline}`} />;
      case 'error':
        return <AlertTriangle className={`w-4 h-4 ${styles.iconOffline}`} />;
      case 'checking':
        return <Wifi className={`w-4 h-4 ${styles.iconChecking} animate-pulse`} />;
    }
  };

  const getStatusText = () => {
    switch (overallStatus) {
      case 'online':
        return '全てのAPIが正常です';
      case 'offline':
        return '一部のAPIがオフラインです';
      case 'error':
        return '一部のAPIがエラーです';
      case 'checking':
        return 'API接続を確認中...';
    }
  };

  return (
    <div className={`fixed ${positionClasses[position]} z-50`}>
      <div
        className={`
          relative flex items-center gap-2 px-3 py-2 rounded-lg
          shadow-lg transition-all duration-300
          ${styles.bg}
        `}
      >
        <div className="relative">{getIcon()}</div>
        <span className={`text-sm font-medium ${styles.text}`}>{getStatusText()}</span>
      </div>
    </div>
  );
};