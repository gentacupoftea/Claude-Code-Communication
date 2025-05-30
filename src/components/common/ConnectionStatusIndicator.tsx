/**
 * 接続状態インジケーターコンポーネント
 * Conea Platformの接続状態をリアルタイムで表示
 */

import React, { useState } from 'react';
import { 
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useConnectionStatus } from '../../hooks/useConnectionStatus';

// 接続状態の型定義
type ConnectionState = 'connected' | 'partial' | 'disconnected' | 'offline';

// APIの表示名マッピング
const API_DISPLAY_NAMES: Record<string, string> = {
  shopify: 'Shopify',
  amazon: 'Amazon',
  rakuten: '楽天',
  nextengine: 'NextEngine',
  smaregi: 'スマレジ',
  google_analytics: 'Google Analytics'
};

interface ConnectionStatusIndicatorProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  defaultExpanded?: boolean;
  refreshInterval?: number;
  className?: string;
  theme?: 'light' | 'dark' | 'auto';
}

export const ConnectionStatusIndicator: React.FC<ConnectionStatusIndicatorProps> = ({
  position = 'top-right',
  defaultExpanded = false,
  className = '',
  theme = 'auto'
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const { 
    isOnline, 
    apiStatus, 
    lastChecked, 
    isLoading, 
    error, 
    refreshStatus, 
    getOverallStatus 
  } = useConnectionStatus();

  const overall = getOverallStatus();

  // 状態に応じたアイコンとスタイルを取得
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'connected':
        return {
          icon: CheckCircle,
          color: 'text-emerald-400',
          bgColor: 'bg-emerald-500/10',
          borderColor: 'border-emerald-500/20'
        };
      case 'partial':
        return {
          icon: AlertTriangle,
          color: 'text-amber-400',
          bgColor: 'bg-amber-500/10',
          borderColor: 'border-amber-500/20'
        };
      case 'disconnected':
        return {
          icon: WifiOff,
          color: 'text-red-400',
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/20'
        };
      case 'offline':
      default:
        return {
          icon: WifiOff,
          color: 'text-gray-400',
          bgColor: 'bg-gray-500/10',
          borderColor: 'border-gray-500/20'
        };
    }
  };

  const statusDisplay = getStatusDisplay(overall.status);
  const StatusIcon = statusDisplay.icon;

  // ポジションに応じたスタイル
  const positionStyles = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4'
  };

  return (
    <div className={`fixed ${positionStyles[position]} z-50 ${className}`}>
      {/* メインインジケーター */}
      <div 
        className={`
          relative flex items-center gap-2 px-3 py-2 rounded-lg
          backdrop-blur-md border transition-all duration-200
          cursor-pointer hover:scale-105
          ${statusDisplay.bgColor} 
          ${statusDisplay.borderColor}
          ${isExpanded ? 'rounded-b-none' : ''}
        `}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* ステータスアイコン */}
        <div className="relative">
          <StatusIcon 
            className={`w-4 h-4 ${statusDisplay.color} ${
              isLoading ? 'animate-pulse' : ''
            }`} 
          />
          {/* 接続中の点滅ドット */}
          {overall.status === 'connected' && (
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          )}
        </div>

        {/* ステータステキスト */}
        <span className="text-sm font-medium text-white/90">
          {overall.message}
        </span>

        {/* 展開アイコン */}
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-white/70" />
        ) : (
          <ChevronDown className="w-4 h-4 text-white/70" />
        )}

        {/* 更新ボタン */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            refreshStatus();
          }}
          className="p-1 rounded hover:bg-white/10 transition-colors"
          disabled={isLoading}
        >
          <RefreshCw 
            className={`w-3 h-3 text-white/70 ${
              isLoading ? 'animate-spin' : ''
            }`} 
          />
        </button>
      </div>

      {/* 詳細パネル */}
      {isExpanded && (
        <div className={`
          absolute top-full left-0 right-0 mt-0
          backdrop-blur-md border border-t-0 rounded-b-lg
          ${statusDisplay.bgColor} 
          ${statusDisplay.borderColor}
          max-h-96 overflow-y-auto
        `}>
          {/* エラー表示 */}
          {error && (
            <div className="p-3 border-b border-red-500/20 bg-red-500/10">
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-medium">エラー</span>
              </div>
              <p className="text-xs text-red-300 mt-1">{error}</p>
            </div>
          )}

          {/* ネットワーク状態 */}
          <div className="p-3 border-b border-white/10">
            <div className="flex items-center gap-2 mb-2">
              {isOnline ? (
                <Wifi className="w-4 h-4 text-emerald-400" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-400" />
              )}
              <span className="text-sm font-medium text-white/90">
                ネットワーク状態
              </span>
            </div>
            <p className="text-xs text-white/70">
              {isOnline ? 'オンライン' : 'オフライン'}
            </p>
          </div>

          {/* API接続状態 */}
          <div className="p-3">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-white/70" />
              <span className="text-sm font-medium text-white/90">
                API接続状態
              </span>
            </div>

            <div className="space-y-2">
              {Object.entries(apiStatus).map(([apiName, status]) => (
                <div 
                  key={apiName} 
                  className="flex items-center justify-between p-2 rounded bg-white/5"
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      status.connected ? 'bg-emerald-400' : 'bg-red-400'
                    }`} />
                    <span className="text-sm text-white/90">
                      {API_DISPLAY_NAMES[apiName] || apiName}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs ${
                      status.connected ? 'text-emerald-300' : 'text-red-300'
                    }`}>
                      {status.message}
                    </span>
                    {status.responseTime && (
                      <div className="text-xs text-white/50">
                        {status.responseTime}ms
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* 最終チェック時刻 */}
            {lastChecked && (
              <div className="mt-3 pt-2 border-t border-white/10">
                <p className="text-xs text-white/50">
                  最終確認: {new Date(lastChecked).toLocaleTimeString('ja-JP')}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectionStatusIndicator;