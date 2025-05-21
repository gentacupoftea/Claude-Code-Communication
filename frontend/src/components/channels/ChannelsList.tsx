/**
 * チャネル一覧表示
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChannels } from '../../hooks/useChannels';
import { useChannelConnection } from '../../hooks/useChannelConnection';
import { Channel } from '../../api/channelService';
import { PermissionGate } from '../auth/PermissionGate';

interface ChannelCardProps {
  channel: Channel;
  onTestConnection: (id: string) => Promise<void>;
  onToggleStatus: (id: string, isActive: boolean) => Promise<void>;
  onSync: (id: string) => Promise<void>;
  onEdit: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
}

// チャネルカードコンポーネント
const ChannelCard: React.FC<ChannelCardProps> = ({
  channel,
  onTestConnection,
  onToggleStatus,
  onSync,
  onEdit,
  onDelete
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);

  // チャネルタイプに応じたアイコンを取得
  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'shopify':
        return (
          <svg className="h-8 w-8" viewBox="0 0 24 24" fill="#95BF47" xmlns="http://www.w3.org/2000/svg">
            <path d="M15.5 7.5L14.5 7C14 5.5 13 4.5 11.5 4L12 2.5C13.5 3 14.5 4 15.5 7.5Z" />
            <path d="M12 4C11 4 9.5 4.5 8.5 6L5 5C5.5 4 6.5 2.5 9 2L9.5 3.5C8 3.5 7 4.5 7 4.5C7 4.5 8.5 4.5 12 4Z" />
            <path d="M9 11.5V19.5L11.5 18.5V10.5L9 11.5Z" />
            <path d="M13 10V18L15.5 19V11L13 10Z" />
            <path d="M11.5 10.5L9 11.5L6 10.5V4.5L8.5 6C9 8 10 9 12 9C14 9 14.5 8 15 7.5L16 8.5V16.5L15.5 18L13 16.5V10L11.5 10.5Z" />
          </svg>
        );
      case 'rakuten':
        return (
          <svg className="h-8 w-8" viewBox="0 0 24 24" fill="#BF0000" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 3L4 6V17L12 21L20 17V6L12 3ZM12 19.5L6 16.5V7.5L12 5L18 7.5V16.5L12 19.5Z" />
            <path d="M12 7L9 8V13L12 14.5L15 13V8L12 7ZM12 13L10 12V9L12 8L14 9V12L12 13Z" />
          </svg>
        );
      case 'amazon':
        return (
          <svg className="h-8 w-8" viewBox="0 0 24 24" fill="#FF9900" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4C9.5 4 7.5 5 6 7C5.5 8 5 9.5 5 11C5 13.5 6 15.5 8 17C10 18.5 14 18.5 16 17C18 15.5 19 13.5 19 11C19 9.5 18.5 8 18 7C16.5 5 14.5 4 12 4Z" />
            <path d="M16.5 14C14.5 15.5 9.5 15.5 7.5 14C5.5 12.5 4.5 10.5 4.5 8C4.5 6.5 5 5 6 3.5C4 5 3 7 3 9.5C3 12 4 14 6 15.5C8 17 11.5 18 15 17C16.5 16.5 17.5 16 18.5 15C17.5 15 17 14.5 16.5 14Z" />
          </svg>
        );
      case 'google':
        return (
          <svg className="h-8 w-8" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4.5C14.5 4.5 16.5 5.5 18 7L21 4C18.5 1.5 15.5 0 12 0C7.5 0 3.5 2.5 1.5 6.5L5 9C6 6.5 8.5 4.5 12 4.5Z" fill="#EA4335" />
            <path d="M4.5 12C4.5 10.5 5 9.5 5 9L1.5 6.5C0.5 8 0 10 0 12C0 14 0.5 16 1.5 17.5L5 15C5 14.5 4.5 13.5 4.5 12Z" fill="#FBBC05" />
            <path d="M12 19.5C8.5 19.5 6 17.5 5 15L1.5 17.5C3.5 21.5 7.5 24 12 24C15.5 24 18.5 22.5 20.5 20L17 17.5C15.5 19 14 19.5 12 19.5Z" fill="#34A853" />
            <path d="M19.5 12C19.5 11.5 19.5 11 19.5 10.5H12V15H16.5C16 16.5 15 17.5 13.5 18C14 18.5 15 19 16 19.5C18 17.5 19.5 15 19.5 12Z" fill="#4285F4" />
          </svg>
        );
      default:
        return (
          <svg className="h-8 w-8" viewBox="0 0 24 24" fill="#6B7280" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z" />
            <path d="M12 17C14.7614 17 17 14.7614 17 12C17 9.23858 14.7614 7 12 7C9.23858 7 7 9.23858 7 12C7 14.7614 9.23858 17 12 17Z" />
          </svg>
        );
    }
  };

  // ステータスに応じた色とラベルを取得
  const getStatusBadge = () => {
    switch (channel.status) {
      case 'connected':
        return (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
            <svg className="-ml-0.5 mr-1.5 h-2 w-2 text-green-400" fill="currentColor" viewBox="0 0 8 8">
              <circle cx="4" cy="4" r="3" />
            </svg>
            接続済み
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
            <svg className="-ml-0.5 mr-1.5 h-2 w-2 text-red-400" fill="currentColor" viewBox="0 0 8 8">
              <circle cx="4" cy="4" r="3" />
            </svg>
            エラー
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
            <svg className="-ml-0.5 mr-1.5 h-2 w-2 text-yellow-400" fill="currentColor" viewBox="0 0 8 8">
              <circle cx="4" cy="4" r="3" />
            </svg>
            接続中
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
            <svg className="-ml-0.5 mr-1.5 h-2 w-2 text-gray-400" fill="currentColor" viewBox="0 0 8 8">
              <circle cx="4" cy="4" r="3" />
            </svg>
            未接続
          </span>
        );
    }
  };

  // アクション処理（ローディング状態を管理）
  const handleAction = async (action: () => Promise<void>, actionName: string) => {
    setIsActionLoading(actionName);
    try {
      await action();
    } catch (error) {
      console.error(`Error during ${actionName}:`, error);
    } finally {
      setIsActionLoading(null);
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {getChannelIcon(channel.type)}
            <div>
              <h3 className="text-lg font-medium text-gray-900">{channel.name}</h3>
              <div className="mt-1 flex items-center space-x-2 text-sm text-gray-500">
                <span className="capitalize">{channel.type}</span>
                <span>&middot;</span>
                {getStatusBadge()}
              </div>
            </div>
          </div>
          <div className="flex">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <svg className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
        
        {isExpanded && (
          <div className="mt-4 border-t border-gray-200 pt-4">
            <div className="mb-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="block text-gray-500">最終同期</span>
                <span className="font-medium">{channel.lastSyncAt ? new Date(channel.lastSyncAt).toLocaleString() : '未同期'}</span>
              </div>
              <div>
                <span className="block text-gray-500">ステータス</span>
                <span className="font-medium capitalize">{channel.isActive ? '有効' : '無効'}</span>
              </div>
              <div>
                <span className="block text-gray-500">作成日</span>
                <span className="font-medium">{new Date(channel.createdAt).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="block text-gray-500">更新日</span>
                <span className="font-medium">{new Date(channel.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>

            {channel.connectionError && (
              <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
                <p className="font-medium">接続エラー</p>
                <p>{channel.connectionError}</p>
              </div>
            )}
            
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <PermissionGate permissions={['channels.connect', 'channels.edit']}>
                <button
                  type="button"
                  onClick={() => handleAction(() => onTestConnection(channel.id), 'test')}
                  disabled={isActionLoading !== null}
                  className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  {isActionLoading === 'test' ? (
                    <svg className="mr-1.5 h-4 w-4 animate-spin text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="mr-1.5 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  )}
                  接続テスト
                </button>
              </PermissionGate>

              <PermissionGate permissions={['channels.sync']}>
                <button
                  type="button"
                  onClick={() => handleAction(() => onSync(channel.id), 'sync')}
                  disabled={isActionLoading !== null || channel.status !== 'connected'}
                  className={`inline-flex items-center rounded-md border ${
                    channel.status === 'connected' 
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100' 
                      : 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'
                  } px-3 py-1.5 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
                >
                  {isActionLoading === 'sync' ? (
                    <svg className="mr-1.5 h-4 w-4 animate-spin text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="mr-1.5 h-4 w-4 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  今すぐ同期
                </button>
              </PermissionGate>

              <PermissionGate permissions={['channels.edit']}>
                <button
                  type="button"
                  onClick={() => onEdit(channel.id)}
                  className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  <svg className="mr-1.5 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  設定
                </button>
              </PermissionGate>

              <PermissionGate permissions={['channels.edit']}>
                <button
                  type="button"
                  onClick={() => handleAction(() => onToggleStatus(channel.id, !channel.isActive), 'toggle')}
                  disabled={isActionLoading !== null}
                  className={`inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    channel.isActive 
                      ? 'border border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100' 
                      : 'border border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
                  }`}
                >
                  {isActionLoading === 'toggle' ? (
                    <svg className="mr-1.5 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="mr-1.5 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  )}
                  {channel.isActive ? '無効化' : '有効化'}
                </button>
              </PermissionGate>

              <PermissionGate permissions={['channels.delete']}>
                <button
                  type="button"
                  onClick={() => handleAction(() => onDelete(channel.id), 'delete')}
                  disabled={isActionLoading !== null}
                  className="inline-flex items-center rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 shadow-sm hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  {isActionLoading === 'delete' ? (
                    <svg className="mr-1.5 h-4 w-4 animate-spin text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="mr-1.5 h-4 w-4 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                  削除
                </button>
              </PermissionGate>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// チャネルタイプ選択用フィルター
interface ChannelTypeFilterProps {
  selectedType: string | null;
  onTypeChange: (type: string | null) => void;
}

const ChannelTypeFilter: React.FC<ChannelTypeFilterProps> = ({ selectedType, onTypeChange }) => {
  const types = [
    { id: null, name: 'すべて' },
    { id: 'shopify', name: 'Shopify' },
    { id: 'rakuten', name: '楽天' },
    { id: 'amazon', name: 'Amazon' },
    { id: 'google', name: 'Google' },
  ];
  
  return (
    <div className="mb-6 flex space-x-2">
      {types.map((type) => (
        <button
          key={type.id || 'all'}
          type="button"
          onClick={() => onTypeChange(type.id)}
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${
            selectedType === type.id
              ? 'bg-indigo-100 text-indigo-800'
              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
          }`}
        >
          {type.name}
        </button>
      ))}
    </div>
  );
};

// メインのチャネル一覧コンポーネント
export const ChannelsList: React.FC = () => {
  const navigate = useNavigate();
  const { channels, loading, error, refetch } = useChannels();
  const { 
    testConnection, 
    toggleChannelStatus, 
    syncChannel, 
    deleteChannel,
    error: connectionError
  } = useChannelConnection();
  
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // チャネルリストをフィルタリング
  const filteredChannels = channels.filter((channel) => {
    // タイプによるフィルター
    const typeMatch = selectedType ? channel.type === selectedType : true;
    
    // 検索クエリによるフィルター
    const searchMatch = searchQuery.trim() === '' || 
      channel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      channel.type.toLowerCase().includes(searchQuery.toLowerCase());
    
    return typeMatch && searchMatch;
  });

  // チャネル接続テスト
  const handleTestConnection = async (id: string) => {
    try {
      const result = await testConnection(id);
      if (result.success) {
        alert('接続テスト成功: ' + (result.message || '接続は正常です'));
      } else {
        alert('接続テスト失敗: ' + (result.message || '接続に問題があります'));
      }
      await refetch();
    } catch (error) {
      console.error('Connection test error:', error);
      alert('接続テストに失敗しました');
    }
  };

  // ステータス切り替え
  const handleToggleStatus = async (id: string, isActive: boolean) => {
    try {
      await toggleChannelStatus(id, isActive);
      await refetch();
    } catch (error) {
      console.error('Toggle status error:', error);
      alert('ステータス変更に失敗しました');
    }
  };

  // 同期開始
  const handleSync = async (id: string) => {
    try {
      const { jobId } = await syncChannel(id);
      alert(`同期ジョブを開始しました (ジョブID: ${jobId})`);
      await refetch();
    } catch (error) {
      console.error('Sync error:', error);
      alert('同期の開始に失敗しました');
    }
  };

  // 設定編集へ移動
  const handleEdit = (id: string) => {
    navigate(`/channels/${id}/settings`);
  };

  // チャネル削除
  const handleDelete = async (id: string) => {
    if (window.confirm('このチャネルを削除してもよろしいですか？この操作は取り消せません。')) {
      try {
        await deleteChannel(id);
        await refetch();
      } catch (error) {
        console.error('Delete error:', error);
        alert('チャネル削除に失敗しました');
      }
    }
  };

  // 新規チャネル接続へ移動
  const handleAddChannel = () => {
    navigate('/channels/connect');
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-8 sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">チャネル管理</h1>
          <p className="mt-1 text-sm text-gray-500">
            接続済みの外部サービスとプラットフォームを管理します
          </p>
        </div>
        <PermissionGate permissions={['channels.create', 'channels.connect']}>
          <div className="mt-4 sm:mt-0">
            <button
              type="button"
              onClick={handleAddChannel}
              className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              チャネル接続
            </button>
          </div>
        </PermissionGate>
      </div>

      {/* 検索フィルター */}
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <div className="relative col-span-3 rounded-md shadow-sm">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full rounded-md border-gray-300 pl-10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="チャネル名で検索..."
          />
        </div>
        <div className="text-right">
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <svg className="-ml-1 mr-2 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            更新
          </button>
        </div>
      </div>

      {/* タイプフィルター */}
      <ChannelTypeFilter 
        selectedType={selectedType} 
        onTypeChange={setSelectedType} 
      />

      {/* エラー表示 */}
      {(error || connectionError) && (
        <div className="mb-4 rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">エラーが発生しました</h3>
              <p className="mt-2 text-sm text-red-700">
                {error?.message || connectionError?.message || 'データの取得に失敗しました。再度お試しください。'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ローディング表示 */}
      {loading && (
        <div className="flex h-40 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600"></div>
        </div>
      )}

      {/* チャネル一覧 */}
      {!loading && filteredChannels.length === 0 ? (
        <div className="mt-6 rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">チャネルがありません</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchQuery || selectedType 
              ? '検索条件に一致するチャネルが見つかりませんでした。' 
              : 'チャネルがまだ接続されていません。「チャネル接続」ボタンをクリックして始めましょう。'}
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={handleAddChannel}
              className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              チャネル接続
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredChannels.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              onTestConnection={handleTestConnection}
              onToggleStatus={handleToggleStatus}
              onSync={handleSync}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ChannelsList;