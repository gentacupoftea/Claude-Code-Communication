'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  RefreshCcw, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Clock,
  Wifi,
  WifiOff,
  Settings,
  Download,
  Upload,
  Database
} from 'lucide-react';
import { 
  SyncStatus, 
  APIHealthResponse, 
  BackendConfig, 
  ProjectSyncData,
  OfflineCapability,
  BackendMessage
} from '@/src/types/backend';
import { backendIntegrationService } from '@/src/services/backend-integration.service';

export const BackendSyncPanel: React.FC = () => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [healthStatus, setHealthStatus] = useState<APIHealthResponse | null>(null);
  const [backendConfig, setBackendConfig] = useState<BackendConfig | null>(null);
  const [projectSync, setProjectSync] = useState<ProjectSyncData[]>([]);
  const [offlineCapability, setOfflineCapability] = useState<OfflineCapability | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(backendIntegrationService.isOnlineMode());
  const [messages, setMessages] = useState<BackendMessage[]>([]);

  useEffect(() => {
    // 初期データロード
    loadInitialData();

    // リスナー設定
    const handleSyncUpdate = (status: SyncStatus) => setSyncStatus(status);
    const handleHealthUpdate = (health: APIHealthResponse) => setHealthStatus(health);
    const handleMessage = (message: BackendMessage) => {
      setMessages(prev => [message, ...prev.slice(0, 9)]); // 最新10件を保持
    };

    backendIntegrationService.addSyncListener(handleSyncUpdate);
    backendIntegrationService.addHealthListener(handleHealthUpdate);
    backendIntegrationService.addMessageListener(handleMessage);

    // オンライン/オフライン状態の監視
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      backendIntegrationService.removeSyncListener(handleSyncUpdate);
      backendIntegrationService.removeHealthListener(handleHealthUpdate);
      backendIntegrationService.removeMessageListener(handleMessage);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadInitialData = async () => {
    try {
      const [sync, health, config, projects, offline] = await Promise.all([
        backendIntegrationService.getSyncStatus(),
        backendIntegrationService.checkHealth(),
        backendIntegrationService.getBackendConfig(),
        backendIntegrationService.getProjectSyncData(),
        backendIntegrationService.getOfflineCapability()
      ]);

      setSyncStatus(sync);
      setHealthStatus(health);
      setBackendConfig(config);
      setProjectSync(projects);
      setOfflineCapability(offline);
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const status = await backendIntegrationService.performSync();
      setSyncStatus(status);
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const getHealthStatusIcon = (status: APIHealthResponse['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'down':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getSyncStatusColor = (status: ProjectSyncData['syncStatus']) => {
    switch (status) {
      case 'synced':
        return 'text-green-500';
      case 'pending':
        return 'text-yellow-500';
      case 'conflict':
        return 'text-orange-500';
      case 'error':
        return 'text-red-500';
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatSize = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Backend Integration</h2>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            {isOnline ? (
              <Wifi className="w-5 h-5 text-green-500" />
            ) : (
              <WifiOff className="w-5 h-5 text-red-500" />
            )}
            <span className="text-sm text-gray-400">
              {isOnline ? 'オンライン' : 'オフライン'}
            </span>
          </div>
          <button
            onClick={handleSync}
            disabled={isSyncing || !isOnline}
            className="flex items-center space-x-2 px-4 py-2 bg-[#1ABC9C] hover:bg-[#16A085] 
                       disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <RefreshCcw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? '同期中...' : '同期実行'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ヘルスステータス */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900/50 backdrop-blur-lg rounded-xl border border-white/10 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">システムヘルス</h3>
            {healthStatus && getHealthStatusIcon(healthStatus.status)}
          </div>

          {healthStatus && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400">ステータス</p>
                  <p className="text-white capitalize">{healthStatus.status}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">アップタイム</p>
                  <p className="text-white">{healthStatus.uptime.toFixed(2)}%</p>
                </div>
              </div>

              <div className="space-y-3">
                {Object.entries(healthStatus.services).map(([serviceName, service]) => {
                  const serviceData = service as { status: string; responseTime: number };
                  return (
                    <div key={serviceName} className="flex items-center justify-between">
                      <span className="text-sm text-white capitalize">{serviceName}</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-400">{serviceData.responseTime}ms</span>
                        <div className={`w-2 h-2 rounded-full ${
                          serviceData.status === 'up' ? 'bg-green-500' : 'bg-red-500'
                        }`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>

        {/* 同期ステータス */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-900/50 backdrop-blur-lg rounded-xl border border-white/10 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">同期ステータス</h3>
            <Database className="w-5 h-5 text-[#1ABC9C]" />
          </div>

          {syncStatus && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400">プロジェクト</p>
                  <p className="text-white">{syncStatus.syncedProjects}/{syncStatus.totalProjects}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">保留中の変更</p>
                  <p className="text-white">{syncStatus.pendingChanges}</p>
                </div>
              </div>
              
              <div>
                <p className="text-sm text-gray-400">最終同期</p>
                <p className="text-white text-sm">{formatTime(syncStatus.lastSync)}</p>
              </div>

              {syncStatus.conflicts.length > 0 && (
                <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                  <p className="text-sm text-orange-400 font-medium">
                    {syncStatus.conflicts.length}件の競合があります
                  </p>
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* プロジェクト同期詳細 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-900/50 backdrop-blur-lg rounded-xl border border-white/10 p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">プロジェクト同期</h3>
          
          <div className="space-y-3 max-h-48 overflow-y-auto">
            {projectSync.map((project) => (
              <div key={project.id} className="flex items-center justify-between p-3 
                                               bg-white/5 rounded-lg">
                <div>
                  <p className="text-white text-sm font-medium">{project.name}</p>
                  <p className="text-xs text-gray-400">v{project.version}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`text-xs ${getSyncStatusColor(project.syncStatus)}`}>
                    {project.syncStatus}
                  </span>
                  {project.syncStatus === 'synced' ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <Clock className="w-4 h-4 text-yellow-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* オフライン機能 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gray-900/50 backdrop-blur-lg rounded-xl border border-white/10 p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">オフライン機能</h3>
          
          {offlineCapability && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">状態</span>
                <span className={`text-sm ${offlineCapability.enabled ? 'text-green-500' : 'text-red-500'}`}>
                  {offlineCapability.enabled ? '有効' : '無効'}
                </span>
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">ストレージ使用量</span>
                  <span className="text-white">
                    {formatSize(offlineCapability.storedData)} / {formatSize(offlineCapability.storageLimit)}
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-[#1ABC9C] h-2 rounded-full"
                    style={{ 
                      width: `${(offlineCapability.storedData / offlineCapability.storageLimit) * 100}%` 
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">自動同期</span>
                <span className={`text-sm ${offlineCapability.autoSync ? 'text-green-500' : 'text-gray-500'}`}>
                  {offlineCapability.autoSync ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* メッセージログ */}
      {messages.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gray-900/50 backdrop-blur-lg rounded-xl border border-white/10 p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">システムメッセージ</h3>
          
          <div className="space-y-2 max-h-48 overflow-y-auto">
            <AnimatePresence>
              {messages.map((message, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className={`p-3 rounded-lg ${
                    message.priority === 'critical' ? 'bg-red-500/10 border border-red-500/20' :
                    message.priority === 'high' ? 'bg-orange-500/10 border border-orange-500/20' :
                    'bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white">{message.type}</span>
                    <span className="text-xs text-gray-400">{formatTime(message.timestamp)}</span>
                  </div>
                  <p className="text-xs text-gray-300 mt-1">
                    {JSON.stringify(message.data, null, 2)}
                  </p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </div>
  );
};