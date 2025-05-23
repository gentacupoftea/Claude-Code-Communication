import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

interface SyncEvent {
  id: string;
  type: string;
  source: string;
  data: any;
  priority: 'critical' | 'high' | 'medium' | 'low';
  created_at: string;
  memory?: {
    content?: string;
    metadata?: {
      priority?: string;
      timestamp?: string;
    };
  };
}

interface SyncStatus {
  queue_size: number;
  redis_connected: boolean;
  socket_clients: number;
  last_processed: string | null;
}

const SyncMonitor: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [recentEvents, setRecentEvents] = useState<SyncEvent[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    // Socket.IO接続
    const newSocket = io('http://localhost:8000');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setConnected(true);
      console.log('Socket.IO接続成功');
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
      console.log('Socket.IO切断');
    });

    newSocket.on('memory_updated', (data) => {
      console.log('Memory更新通知:', data);
      setRecentEvents(prev => [data, ...prev.slice(0, 9)]);
    });

    // 同期ステータスを定期取得
    const statusInterval = setInterval(fetchSyncStatus, 5000);

    return () => {
      newSocket.close();
      clearInterval(statusInterval);
    };
  }, []);

  const fetchSyncStatus = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/sync/status');
      const status = await response.json();
      setSyncStatus(status);
    } catch (error) {
      console.error('同期ステータス取得エラー:', error);
    }
  };

  const subscribeToUpdates = () => {
    if (socket && connected) {
      socket.emit('subscribe_memory_updates', 'mourigenta');
      setIsSubscribed(true);
    }
  };

  const testManualSync = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/sync/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'test_event',
          source: 'admin_dashboard',
          data: {
            user_id: 'mourigenta',
            content: 'テスト同期イベント',
            description: 'Admin Dashboardからの手動テスト'
          },
          priority: 'medium'
        })
      });
      
      const result = await response.json();
      alert(`同期テスト完了: ${result.message}`);
    } catch (error) {
      alert('同期テストに失敗しました');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-blue-600 bg-blue-100';
      case 'low': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          🔄 OpenMemory同期モニター
        </h2>
        <div className="flex items-center space-x-3">
          <div className={`px-3 py-1 rounded-full text-sm ${
            connected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {connected ? '🟢 接続中' : '🔴 未接続'}
          </div>
          {!isSubscribed && connected && (
            <button
              onClick={subscribeToUpdates}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
            >
              更新通知を開始
            </button>
          )}
        </div>
      </div>

      {/* 同期ステータス */}
      {syncStatus && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-blue-800 mb-1">キューサイズ</h3>
            <p className="text-2xl font-bold text-blue-900">{syncStatus.queue_size}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-green-800 mb-1">Redis接続</h3>
            <p className="text-2xl font-bold text-green-900">
              {syncStatus.redis_connected ? '✅' : '❌'}
            </p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-purple-800 mb-1">Socket.IOクライアント</h3>
            <p className="text-2xl font-bold text-purple-900">{syncStatus.socket_clients}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-800 mb-1">最終処理</h3>
            <p className="text-sm text-gray-900">
              {syncStatus.last_processed ? 
                new Date(syncStatus.last_processed).toLocaleString('ja-JP') : 
                '未処理'
              }
            </p>
          </div>
        </div>
      )}

      {/* 手動テスト */}
      <div className="mb-6">
        <button
          onClick={testManualSync}
          className="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600"
        >
          🧪 手動同期テスト
        </button>
      </div>

      {/* 最近のイベント */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">📡 最近の同期イベント</h3>
        {recentEvents.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            同期イベントはまだありません。Slackでアプリをメンションしてテストしてください。
          </p>
        ) : (
          <div className="space-y-3">
            {recentEvents.map((event, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-800">{event.source}</span>
                    <span className="text-gray-500">→</span>
                    <span className="text-gray-600">{event.type}</span>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    getPriorityColor(event.memory?.metadata?.priority || 'medium')
                  }`}>
                    {event.memory?.metadata?.priority || 'medium'}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mb-2">
                  {event.memory?.content || JSON.stringify(event.data).substring(0, 100)}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(event.memory?.metadata?.timestamp || event.created_at).toLocaleString('ja-JP')}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SyncMonitor;