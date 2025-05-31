/**
 * 接続状態表示インジケーターコンポーネント
 * リアルタイムでネットワークとAPI接続状態を表示
 */

'use client';

import React, { useState } from 'react';
import { useConnectionStatus } from '../../hooks/useConnectionStatus';

// 接続状態の色定義
const STATUS_COLORS = {
  connected: 'bg-green-500 text-green-100',
  partial: 'bg-yellow-500 text-yellow-100',
  disconnected: 'bg-red-500 text-red-100',
  offline: 'bg-gray-500 text-gray-100'
} as const;

// ドットインジケーターの色
const DOT_COLORS = {
  connected: 'bg-green-500',
  partial: 'bg-yellow-500',
  disconnected: 'bg-red-500',
  offline: 'bg-gray-500'
} as const;

/**
 * 接続状態表示コンポーネント
 */
export const ConnectionStatusIndicator: React.FC = () => {
  const {
    isOnline,
    apiStatus,
    lastChecked,
    isLoading,
    error,
    refreshStatus,
    getOverallStatus
  } = useConnectionStatus();

  const [showDetails, setShowDetails] = useState(false);
  const overallStatus = getOverallStatus();

  // ステータス文字列を日本語に変換
  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return 'すべて接続';
      case 'partial': return '一部接続';
      case 'disconnected': return '接続なし';
      case 'offline': return 'オフライン';
      default: return '不明';
    }
  };

  // API名を日本語に変換
  const getAPIDisplayName = (apiKey: string) => {
    const names = {
      shopify: 'Shopify',
      amazon: 'Amazon',
      rakuten: '楽天',
      nextengine: 'NextEngine',
      smaregi: 'スマレジ',
      google_analytics: 'Google Analytics'
    };
    return names[apiKey as keyof typeof names] || apiKey;
  };

  // 最終チェック時刻のフォーマット
  const formatLastChecked = (timestamp: string | null) => {
    if (!timestamp) return '未確認';
    
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return '不明';
    }
  };

  return (
    <div className="relative">
      {/* メインインジケーター */}
      <div 
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer
          transition-all duration-200 hover:shadow-md
          ${STATUS_COLORS[overallStatus.status as keyof typeof STATUS_COLORS]}
        `}
        onClick={() => setShowDetails(!showDetails)}
      >
        {/* ステータスドット */}
        <div className="flex items-center gap-2">
          <div 
            className={`
              w-2 h-2 rounded-full
              ${DOT_COLORS[overallStatus.status as keyof typeof DOT_COLORS]}
              ${isLoading ? 'animate-pulse' : ''}
            `}
          />
          <span className="text-sm font-medium">
            {getStatusText(overallStatus.status)}
          </span>
        </div>

        {/* 更新ボタン */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            refreshStatus();
          }}
          className="ml-2 p-1 rounded hover:bg-white/20 transition-colors"
          disabled={isLoading}
          title="接続状態を更新"
        >
          <svg 
            className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
            />
          </svg>
        </button>

        {/* 詳細表示切り替えアイコン */}
        <svg 
          className={`w-3 h-3 transition-transform ${showDetails ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* 詳細パネル */}
      {showDetails && (
        <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-4">
            {/* ヘッダー */}
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold text-gray-800">接続状態詳細</h3>
              <span className="text-xs text-gray-500">
                最終確認: {formatLastChecked(lastChecked)}
              </span>
            </div>

            {/* エラー表示 */}
            {error && (
              <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
                エラー: {error}
              </div>
            )}

            {/* ネットワーク状態 */}
            <div className="mb-3 p-2 bg-gray-50 rounded">
              <div className="flex items-center gap-2 text-xs">
                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="font-medium">ネットワーク:</span>
                <span>{isOnline ? 'オンライン' : 'オフライン'}</span>
              </div>
            </div>

            {/* API接続状態一覧 */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-gray-600">API接続状態</h4>
              {Object.entries(apiStatus).map(([apiKey, status]) => (
                <div key={apiKey} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                  <div 
                    className={`w-2 h-2 rounded-full ${
                      status.connected ? 'bg-green-500' : 'bg-red-500'
                    }`} 
                  />
                  <span className="text-xs font-medium min-w-0 flex-1">
                    {getAPIDisplayName(apiKey)}:
                  </span>
                  <span className="text-xs text-gray-600 truncate">
                    {status.message}
                  </span>
                </div>
              ))}
            </div>

            {/* 全体的な状態メッセージ */}
            <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded">
              <p className="text-xs text-blue-700">{overallStatus.message}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};