/**
 * チャネル設定フォーム
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useChannels } from '../../hooks/useChannels';
import { useChannelConnection } from '../../hooks/useChannelConnection';
import { Channel, ChannelSettings, ChannelCredentials } from '../../api/channelService';
import { PermissionGate } from '../auth/PermissionGate';

// プラットフォーム固有の設定フィールド
interface PlatformSpecificFieldsProps {
  channelType: string;
  credentials: ChannelCredentials;
  onCredentialsChange: (credentials: Partial<ChannelCredentials>) => void;
}

const PlatformSpecificFields: React.FC<PlatformSpecificFieldsProps> = ({
  channelType,
  credentials,
  onCredentialsChange,
}) => {
  const handleChange = (field: string, value: string) => {
    onCredentialsChange({ [field]: value });
  };

  switch (channelType) {
    case 'shopify':
      return (
        <>
          <div>
            <label htmlFor="storeUrl" className="block text-sm font-medium text-gray-700">
              ストアURL
            </label>
            <input
              type="text"
              id="storeUrl"
              value={credentials.storeUrl || ''}
              onChange={(e) => handleChange('storeUrl', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700">
              APIキー
            </label>
            <input
              type="text"
              id="apiKey"
              value={credentials.apiKey || ''}
              onChange={(e) => handleChange('apiKey', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="apiSecret" className="block text-sm font-medium text-gray-700">
              APIシークレット
            </label>
            <input
              type="password"
              id="apiSecret"
              value={credentials.apiSecret || ''}
              onChange={(e) => handleChange('apiSecret', e.target.value)}
              placeholder="••••••••"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">変更する場合のみ入力してください</p>
          </div>
        </>
      );
    case 'rakuten':
      return (
        <>
          <div>
            <label htmlFor="shopId" className="block text-sm font-medium text-gray-700">
              ショップID
            </label>
            <input
              type="text"
              id="shopId"
              value={credentials.shopId || ''}
              onChange={(e) => handleChange('shopId', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="serviceSecret" className="block text-sm font-medium text-gray-700">
              サービスシークレット
            </label>
            <input
              type="password"
              id="serviceSecret"
              value={credentials.apiSecret || ''}
              onChange={(e) => handleChange('apiSecret', e.target.value)}
              placeholder="••••••••"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">変更する場合のみ入力してください</p>
          </div>
          <div>
            <label htmlFor="licenseKey" className="block text-sm font-medium text-gray-700">
              ライセンスキー
            </label>
            <input
              type="text"
              id="licenseKey"
              value={credentials.accessToken || ''}
              onChange={(e) => handleChange('accessToken', e.target.value)}
              placeholder="••••••••"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">変更する場合のみ入力してください</p>
          </div>
        </>
      );
    case 'amazon':
      return (
        <>
          <div>
            <label htmlFor="sellerId" className="block text-sm font-medium text-gray-700">
              セラーID
            </label>
            <input
              type="text"
              id="sellerId"
              value={credentials.shopId || ''}
              onChange={(e) => handleChange('shopId', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="accessKey" className="block text-sm font-medium text-gray-700">
              アクセスキー
            </label>
            <input
              type="text"
              id="accessKey"
              value={credentials.apiKey || ''}
              onChange={(e) => handleChange('apiKey', e.target.value)}
              placeholder="••••••••"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">変更する場合のみ入力してください</p>
          </div>
          <div>
            <label htmlFor="secretKey" className="block text-sm font-medium text-gray-700">
              シークレットキー
            </label>
            <input
              type="password"
              id="secretKey"
              value={credentials.apiSecret || ''}
              onChange={(e) => handleChange('apiSecret', e.target.value)}
              placeholder="••••••••"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">変更する場合のみ入力してください</p>
          </div>
          <div>
            <label htmlFor="region" className="block text-sm font-medium text-gray-700">
              マーケットプレイス
            </label>
            <select
              id="region"
              value={credentials.storeUrl || ''}
              onChange={(e) => handleChange('storeUrl', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">選択してください</option>
              <option value="jp">Amazon.co.jp</option>
              <option value="us">Amazon.com</option>
              <option value="uk">Amazon.co.uk</option>
            </select>
          </div>
        </>
      );
    case 'google':
      return (
        <>
          <div>
            <label htmlFor="merchantId" className="block text-sm font-medium text-gray-700">
              Merchant ID
            </label>
            <input
              type="text"
              id="merchantId"
              value={credentials.shopId || ''}
              onChange={(e) => handleChange('shopId', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="serviceAccountUpdate" className="block text-sm font-medium text-gray-700">
              サービスアカウントキーを更新
            </label>
            <textarea
              id="serviceAccountUpdate"
              value={credentials.serviceAccountKey || ''}
              onChange={(e) => handleChange('serviceAccountKey', e.target.value)}
              placeholder="新しいJSONキーの内容を貼り付け"
              rows={3}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              更新する場合のみ入力してください。Google Cloud ConsoleからダウンロードしたJSONキーファイルの内容を貼り付けます。
            </p>
          </div>
        </>
      );
    default:
      return null;
  }
};

// メインのチャネル設定フォームコンポーネント
export const ChannelSettingsForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  
  const { channels, getChannelById, loading: channelsLoading, refetch } = useChannels();
  const { 
    updateChannelSettings, 
    testConnection, 
    syncChannel,
    toggleChannelStatus,
    deleteChannel,
    error: connectionError,
    connecting,
    testing,
    syncing
  } = useChannelConnection();
  
  const [channel, setChannel] = useState<Channel | null>(null);
  const [channelName, setChannelName] = useState('');
  const [credentials, setCredentials] = useState<ChannelCredentials>({});
  const [settings, setSettings] = useState<Partial<ChannelSettings>>({
    syncFrequency: 60,
    syncEnabled: true,
    productSync: true,
    orderSync: true,
    inventorySync: true,
    analyticsEnabled: true,
    webhooksEnabled: false,
  });
  
  const [formError, setFormError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // チャネルデータの読み込み
  useEffect(() => {
    if (id && !channelsLoading) {
      const foundChannel = getChannelById(id);
      
      if (foundChannel) {
        setChannel(foundChannel);
        setChannelName(foundChannel.name);
        
        // 認証情報のセット（セキュリティのため一部情報はマスク）
        const maskedCredentials: ChannelCredentials = {};
        if (foundChannel.credentials) {
          Object.keys(foundChannel.credentials).forEach(key => {
            const value = foundChannel.credentials![key];
            if (typeof value === 'string' && key.toLowerCase().includes('key') && value.length > 0) {
              maskedCredentials[key] = '';  // パスワード系フィールドは空にする
            } else {
              maskedCredentials[key] = value;
            }
          });
        }
        setCredentials(maskedCredentials);
        
        // 設定情報のセット
        if (foundChannel.settings) {
          setSettings(foundChannel.settings);
        }
      } else {
        setFormError('指定されたチャネルが見つかりません');
      }
    }
  }, [id, channels, channelsLoading, getChannelById]);

  // 設定の更新
  const handleSettingChange = (setting: keyof ChannelSettings, value: boolean | number) => {
    setSettings(prev => ({
      ...prev,
      [setting]: value,
    }));
  };

  // 認証情報の更新
  const handleCredentialsChange = (newValues: Partial<ChannelCredentials>) => {
    setCredentials(prev => ({
      ...prev,
      ...newValues
    }));
  };

  // フォーム送信
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!id || !channel) return;
    
    setFormError(null);
    setIsSuccess(false);
    setIsSaving(true);
    
    try {
      // 空のパスワードフィールドを削除（更新なし）
      const credentialsToSubmit: ChannelCredentials = {};
      Object.keys(credentials).forEach(key => {
        if (credentials[key] !== '') {
          credentialsToSubmit[key] = credentials[key];
        }
      });
      
      // 設定の更新
      const updatedChannel = await updateChannelSettings(id, {
        ...settings,
        // その他の設定フィールド
      });
      
      setChannel(updatedChannel);
      setIsSuccess(true);
      
      // 設定更新後にリストを再取得
      await refetch();
      
      // 成功メッセージをクリア
      setTimeout(() => {
        setIsSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Update settings error:', err);
      setFormError(err instanceof Error ? err.message : '設定の更新に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  // 接続テスト
  const handleTestConnection = async () => {
    if (!id) return;
    
    setFormError(null);
    
    try {
      const result = await testConnection(id);
      if (result.success) {
        alert('接続テスト成功: ' + (result.message || '接続は正常です'));
      } else {
        alert('接続テスト失敗: ' + (result.message || '接続に問題があります'));
      }
    } catch (error) {
      console.error('Connection test error:', error);
      setFormError('接続テストに失敗しました');
    }
  };

  // 同期実行
  const handleSync = async () => {
    if (!id) return;
    
    setFormError(null);
    
    try {
      const { jobId } = await syncChannel(id, {
        syncProducts: settings.productSync,
        syncOrders: settings.orderSync,
        syncInventory: settings.inventorySync,
      });
      alert(`同期ジョブを開始しました (ジョブID: ${jobId})`);
    } catch (error) {
      console.error('Sync error:', error);
      setFormError('同期の開始に失敗しました');
    }
  };

  // 有効/無効切り替え
  const handleToggleStatus = async () => {
    if (!id || !channel) return;
    
    setFormError(null);
    
    try {
      await toggleChannelStatus(id, !channel.isActive);
      // 更新後にリストを再取得
      await refetch();
      
      // チャンネル情報を更新
      const updatedChannel = getChannelById(id);
      if (updatedChannel) {
        setChannel(updatedChannel);
      }
    } catch (error) {
      console.error('Toggle status error:', error);
      setFormError('ステータス変更に失敗しました');
    }
  };

  // チャネル削除
  const handleDelete = async () => {
    if (!id) return;
    
    if (window.confirm('このチャネルを削除してもよろしいですか？この操作は取り消せません。')) {
      setFormError(null);
      
      try {
        await deleteChannel(id);
        navigate('/channels');
      } catch (error) {
        console.error('Delete error:', error);
        setFormError('チャネル削除に失敗しました');
      }
    }
  };

  if (channelsLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!channel && !channelsLoading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">エラー</h3>
              <p className="mt-2 text-sm text-red-700">
                {formError || '指定されたチャネルが見つかりません。'}
              </p>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => navigate('/channels')}
                  className="rounded-md bg-red-50 px-2 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2"
                >
                  チャネル一覧に戻る
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">チャネル設定</h1>
          <p className="mt-1 text-sm text-gray-500">
            {channel?.name}の接続設定と同期オプションを管理します
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/channels')}
          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          <svg className="-ml-1 mr-2 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          一覧に戻る
        </button>
      </div>

      {/* ステータスバナー */}
      {channel && (
        <div className={`mt-6 rounded-md p-4 ${
          channel.status === 'connected' ? 'bg-green-50' : 
          channel.status === 'error' ? 'bg-red-50' :
          channel.status === 'pending' ? 'bg-yellow-50' : 'bg-gray-50'
        }`}>
          <div className="flex">
            <div className="flex-shrink-0">
              {channel.status === 'connected' ? (
                <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : channel.status === 'error' ? (
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              ) : channel.status === 'pending' ? (
                <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <h3 className={`text-sm font-medium ${
                channel.status === 'connected' ? 'text-green-800' : 
                channel.status === 'error' ? 'text-red-800' :
                channel.status === 'pending' ? 'text-yellow-800' : 'text-gray-800'
              }`}>
                {channel.status === 'connected' ? '接続済み' : 
                channel.status === 'error' ? '接続エラー' :
                channel.status === 'pending' ? '接続中' : '未接続'}
              </h3>
              <div className={`mt-2 text-sm ${
                channel.status === 'connected' ? 'text-green-700' : 
                channel.status === 'error' ? 'text-red-700' :
                channel.status === 'pending' ? 'text-yellow-700' : 'text-gray-700'
              }`}>
                <p>
                  {channel.status === 'connected' 
                    ? `最終同期: ${channel.lastSyncAt ? new Date(channel.lastSyncAt).toLocaleString() : '未同期'}`
                    : channel.status === 'error' 
                    ? channel.connectionError || 'チャネルとの接続中にエラーが発生しました'
                    : channel.status === 'pending'
                    ? '接続を確立中です。しばらくお待ちください'
                    : 'チャネルは現在接続されていません'
                  }
                </p>
              </div>
              {channel.status === 'error' && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testing}
                    className="inline-flex items-center rounded-md border border-transparent bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                  >
                    {testing ? (
                      <>
                        <svg className="mr-1.5 h-4 w-4 animate-spin text-red-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        テスト中...
                      </>
                    ) : (
                      '接続をテスト'
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* エラーおよび成功メッセージ */}
      {(formError || connectionError) && (
        <div className="mt-6 rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">エラー</h3>
              <p className="mt-2 text-sm text-red-700">
                {formError || connectionError?.message || 'エラーが発生しました。もう一度お試しください。'}
              </p>
            </div>
          </div>
        </div>
      )}

      {isSuccess && (
        <div className="mt-6 rounded-md bg-green-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">
                設定が正常に更新されました
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 設定フォーム */}
      <form onSubmit={handleSubmit} className="mt-6 space-y-8 divide-y divide-gray-200">
        <div className="space-y-8 divide-y divide-gray-200">
          {/* 基本情報 */}
          <div>
            <div>
              <h3 className="text-lg font-medium leading-6 text-gray-900">基本情報</h3>
              <p className="mt-1 text-sm text-gray-500">
                チャネルの基本的な情報を設定します
              </p>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-4">
                <label htmlFor="channelName" className="block text-sm font-medium text-gray-700">
                  チャネル名
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    id="channelName"
                    value={channelName}
                    onChange={(e) => setChannelName(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="channelType" className="block text-sm font-medium text-gray-700">
                  チャネルタイプ
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    id="channelType"
                    value={channel?.type ? channel.type.charAt(0).toUpperCase() + channel.type.slice(1) : ''}
                    disabled
                    className="block w-full rounded-md border-gray-300 bg-gray-50 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="connectionStatus" className="block text-sm font-medium text-gray-700">
                  接続ステータス
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    id="connectionStatus"
                    value={
                      channel?.status === 'connected' ? '接続済み' : 
                      channel?.status === 'error' ? '接続エラー' :
                      channel?.status === 'pending' ? '接続中' : '未接続'
                    }
                    disabled
                    className={`block w-full rounded-md border-gray-300 shadow-sm sm:text-sm ${
                      channel?.status === 'connected' ? 'bg-green-50 text-green-700' : 
                      channel?.status === 'error' ? 'bg-red-50 text-red-700' :
                      channel?.status === 'pending' ? 'bg-yellow-50 text-yellow-700' : 'bg-gray-50 text-gray-700'
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 接続情報 */}
          <PermissionGate permissions={['channels.edit', 'channels.credentials']}>
            <div className="pt-8">
              <div>
                <h3 className="text-lg font-medium leading-6 text-gray-900">接続情報</h3>
                <p className="mt-1 text-sm text-gray-500">
                  プラットフォームへの接続に必要な認証情報を更新します
                </p>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                {channel && (
                  <div className="sm:col-span-6">
                    <PlatformSpecificFields
                      channelType={channel.type}
                      credentials={credentials}
                      onCredentialsChange={handleCredentialsChange}
                    />
                  </div>
                )}
              </div>
            </div>
          </PermissionGate>

          {/* 同期設定 */}
          <div className="pt-8">
            <div>
              <h3 className="text-lg font-medium leading-6 text-gray-900">同期設定</h3>
              <p className="mt-1 text-sm text-gray-500">
                データの同期方法とスケジュールを設定します
              </p>
            </div>

            <div className="mt-6">
              <fieldset>
                <legend className="text-base font-medium text-gray-900">同期オプション</legend>
                <div className="mt-4 space-y-4">
                  <div className="flex items-start">
                    <div className="flex h-5 items-center">
                      <input
                        id="syncEnabled"
                        type="checkbox"
                        checked={settings.syncEnabled}
                        onChange={(e) => handleSettingChange('syncEnabled', e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor="syncEnabled" className="font-medium text-gray-700">
                        自動同期を有効にする
                      </label>
                      <p className="text-gray-500">スケジュールに従って自動的にデータを同期します</p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="flex h-5 items-center">
                      <input
                        id="productSync"
                        type="checkbox"
                        checked={settings.productSync}
                        onChange={(e) => handleSettingChange('productSync', e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor="productSync" className="font-medium text-gray-700">
                        商品データを同期
                      </label>
                      <p className="text-gray-500">商品情報、価格、説明などを同期します</p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="flex h-5 items-center">
                      <input
                        id="orderSync"
                        type="checkbox"
                        checked={settings.orderSync}
                        onChange={(e) => handleSettingChange('orderSync', e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor="orderSync" className="font-medium text-gray-700">
                        注文データを同期
                      </label>
                      <p className="text-gray-500">注文情報、顧客データ、配送情報などを同期します</p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="flex h-5 items-center">
                      <input
                        id="inventorySync"
                        type="checkbox"
                        checked={settings.inventorySync}
                        onChange={(e) => handleSettingChange('inventorySync', e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor="inventorySync" className="font-medium text-gray-700">
                        在庫データを同期
                      </label>
                      <p className="text-gray-500">在庫数、入荷予定などの情報を同期します</p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="flex h-5 items-center">
                      <input
                        id="analyticsEnabled"
                        type="checkbox"
                        checked={settings.analyticsEnabled}
                        onChange={(e) => handleSettingChange('analyticsEnabled', e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor="analyticsEnabled" className="font-medium text-gray-700">
                        分析データを取得
                      </label>
                      <p className="text-gray-500">販売分析、トラフィックデータなどを取得します</p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="flex h-5 items-center">
                      <input
                        id="webhooksEnabled"
                        type="checkbox"
                        checked={settings.webhooksEnabled}
                        onChange={(e) => handleSettingChange('webhooksEnabled', e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor="webhooksEnabled" className="font-medium text-gray-700">
                        Webhookを有効にする
                      </label>
                      <p className="text-gray-500">リアルタイムの通知を受け取ります（注文、在庫変更など）</p>
                    </div>
                  </div>
                </div>
              </fieldset>

              <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                <div className="sm:col-span-3">
                  <label htmlFor="syncFrequency" className="block text-sm font-medium text-gray-700">
                    同期頻度
                  </label>
                  <select
                    id="syncFrequency"
                    value={settings.syncFrequency}
                    onChange={(e) => handleSettingChange('syncFrequency', parseInt(e.target.value))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value={15}>15分ごと</option>
                    <option value={30}>30分ごと</option>
                    <option value={60}>1時間ごと</option>
                    <option value={180}>3時間ごと</option>
                    <option value={360}>6時間ごと</option>
                    <option value={720}>12時間ごと</option>
                    <option value={1440}>24時間ごと</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-5">
          <div className="flex justify-between">
            <div className="flex">
              <PermissionGate permissions={['channels.delete']}>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="inline-flex items-center rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  <svg className="-ml-1 mr-2 h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  チャネルを削除
                </button>
              </PermissionGate>
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                {testing ? (
                  <>
                    <svg className="mr-2 h-4 w-4 animate-spin text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    テスト中...
                  </>
                ) : (
                  <>
                    <svg className="-ml-1 mr-2 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    接続テスト
                  </>
                )}
              </button>

              <PermissionGate permissions={['channels.sync']}>
                <button
                  type="button"
                  onClick={handleSync}
                  disabled={syncing || channel?.status !== 'connected'}
                  className={`inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                    channel?.status === 'connected'
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                      : 'border-gray-300 bg-gray-100 text-gray-400'
                  }`}
                >
                  {syncing ? (
                    <>
                      <svg className="mr-2 h-4 w-4 animate-spin text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      同期中...
                    </>
                  ) : (
                    <>
                      <svg className="-ml-1 mr-2 h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                      </svg>
                      今すぐ同期
                    </>
                  )}
                </button>
              </PermissionGate>

              <PermissionGate permissions={['channels.edit']}>
                <button
                  type="button"
                  onClick={handleToggleStatus}
                  disabled={connecting}
                  className={`inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    channel?.isActive
                      ? 'border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 focus:ring-orange-500'
                      : 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100 focus:ring-green-500'
                  }`}
                >
                  {connecting ? (
                    <>
                      <svg className="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      処理中...
                    </>
                  ) : (
                    <>
                      <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                      </svg>
                      {channel?.isActive ? 'チャネルを無効化' : 'チャネルを有効化'}
                    </>
                  )}
                </button>
              </PermissionGate>

              <PermissionGate permissions={['channels.edit']}>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  {isSaving ? (
                    <>
                      <svg className="mr-2 h-4 w-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      保存中...
                    </>
                  ) : (
                    '設定を保存'
                  )}
                </button>
              </PermissionGate>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ChannelSettingsForm;