/**
 * チャネル接続フォーム
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChannelConnection } from '../../hooks/useChannelConnection';
import { ConnectChannelParams, ChannelCredentials, ChannelSettings } from '../../api/channelService';
import { PermissionGate } from '../auth/PermissionGate';

type ChannelType = 'shopify' | 'rakuten' | 'amazon' | 'google';

// チャネルタイプのデータ
const channelTypes = [
  {
    id: 'shopify',
    name: 'Shopify',
    description: 'Shopifyストアに接続し、商品・注文・在庫データを同期します',
    icon: (
      <svg className="h-10 w-10" viewBox="0 0 24 24" fill="#95BF47" xmlns="http://www.w3.org/2000/svg">
        <path d="M15.5 7.5L14.5 7C14 5.5 13 4.5 11.5 4L12 2.5C13.5 3 14.5 4 15.5 7.5Z" />
        <path d="M12 4C11 4 9.5 4.5 8.5 6L5 5C5.5 4 6.5 2.5 9 2L9.5 3.5C8 3.5 7 4.5 7 4.5C7 4.5 8.5 4.5 12 4Z" />
        <path d="M9 11.5V19.5L11.5 18.5V10.5L9 11.5Z" />
        <path d="M13 10V18L15.5 19V11L13 10Z" />
        <path d="M11.5 10.5L9 11.5L6 10.5V4.5L8.5 6C9 8 10 9 12 9C14 9 14.5 8 15 7.5L16 8.5V16.5L15.5 18L13 16.5V10L11.5 10.5Z" />
      </svg>
    ),
  },
  {
    id: 'rakuten',
    name: '楽天市場',
    description: '楽天市場に接続し、商品・注文・在庫データを同期します',
    icon: (
      <svg className="h-10 w-10" viewBox="0 0 24 24" fill="#BF0000" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 3L4 6V17L12 21L20 17V6L12 3ZM12 19.5L6 16.5V7.5L12 5L18 7.5V16.5L12 19.5Z" />
        <path d="M12 7L9 8V13L12 14.5L15 13V8L12 7ZM12 13L10 12V9L12 8L14 9V12L12 13Z" />
      </svg>
    ),
  },
  {
    id: 'amazon',
    name: 'Amazon',
    description: 'Amazonの出品やAmazon MCFを利用して販売・出荷管理を統合します',
    icon: (
      <svg className="h-10 w-10" viewBox="0 0 24 24" fill="#FF9900" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 4C9.5 4 7.5 5 6 7C5.5 8 5 9.5 5 11C5 13.5 6 15.5 8 17C10 18.5 14 18.5 16 17C18 15.5 19 13.5 19 11C19 9.5 18.5 8 18 7C16.5 5 14.5 4 12 4Z" />
        <path d="M16.5 14C14.5 15.5 9.5 15.5 7.5 14C5.5 12.5 4.5 10.5 4.5 8C4.5 6.5 5 5 6 3.5C4 5 3 7 3 9.5C3 12 4 14 6 15.5C8 17 11.5 18 15 17C16.5 16.5 17.5 16 18.5 15C17.5 15 17 14.5 16.5 14Z" />
      </svg>
    ),
  },
  {
    id: 'google',
    name: 'Google Merchant Center',
    description: 'Google ショッピング広告やフリーリスティングに商品情報を配信します',
    icon: (
      <svg className="h-10 w-10" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 4.5C14.5 4.5 16.5 5.5 18 7L21 4C18.5 1.5 15.5 0 12 0C7.5 0 3.5 2.5 1.5 6.5L5 9C6 6.5 8.5 4.5 12 4.5Z" fill="#EA4335" />
        <path d="M4.5 12C4.5 10.5 5 9.5 5 9L1.5 6.5C0.5 8 0 10 0 12C0 14 0.5 16 1.5 17.5L5 15C5 14.5 4.5 13.5 4.5 12Z" fill="#FBBC05" />
        <path d="M12 19.5C8.5 19.5 6 17.5 5 15L1.5 17.5C3.5 21.5 7.5 24 12 24C15.5 24 18.5 22.5 20.5 20L17 17.5C15.5 19 14 19.5 12 19.5Z" fill="#34A853" />
        <path d="M19.5 12C19.5 11.5 19.5 11 19.5 10.5H12V15H16.5C16 16.5 15 17.5 13.5 18C14 18.5 15 19 16 19.5C18 17.5 19.5 15 19.5 12Z" fill="#4285F4" />
      </svg>
    ),
  },
];

// 接続方法
enum ConnectionMethod {
  API_KEY = 'api_key',
  OAUTH = 'oauth',
}

// チャネル選択
interface ChannelTypeSelectionProps {
  onTypeSelect: (type: ChannelType) => void;
}

const ChannelTypeSelection: React.FC<ChannelTypeSelectionProps> = ({ onTypeSelect }) => {
  return (
    <div>
      <h2 className="text-lg font-medium text-gray-900">接続するチャネルを選択</h2>
      <p className="mt-1 text-sm text-gray-500">
        データを同期するeコマースプラットフォームを選択してください
      </p>
      
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {channelTypes.map((channel) => (
          <button
            key={channel.id}
            type="button"
            onClick={() => onTypeSelect(channel.id as ChannelType)}
            className="relative flex cursor-pointer flex-col rounded-lg border border-gray-300 bg-white p-4 shadow-sm hover:border-indigo-500 focus:outline-none"
          >
            <div className="flex items-center">
              <div className="mr-4 flex h-12 w-12 items-center justify-center rounded-full bg-white">
                {channel.icon}
              </div>
              <div className="text-left">
                <span className="block text-sm font-medium text-gray-900">{channel.name}</span>
                <span className="mt-1 block text-xs text-gray-500">{channel.description}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

// APIキー接続フォーム
interface ApiKeyFormProps {
  channelType: ChannelType;
  onSubmit: (credentials: ChannelCredentials, settings: Partial<ChannelSettings>) => void;
  isSubmitting: boolean;
}

const ApiKeyForm: React.FC<ApiKeyFormProps> = ({ channelType, onSubmit, isSubmitting }) => {
  const [name, setName] = useState<string>('');
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

  // チャネルタイプに応じたフォームフィールドを生成
  const renderCredentialFields = () => {
    switch (channelType) {
      case 'shopify':
        return (
          <>
            <div>
              <label htmlFor="storeUrl" className="block text-sm font-medium text-gray-700">
                ストアURL <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="storeUrl"
                name="storeUrl"
                value={credentials.storeUrl || ''}
                onChange={(e) => setCredentials({ ...credentials, storeUrl: e.target.value })}
                placeholder="mystore.myshopify.com"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">例: mystore.myshopify.com（.myshopify.comを含む）</p>
            </div>
            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700">
                APIキー <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="apiKey"
                name="apiKey"
                value={credentials.apiKey || ''}
                onChange={(e) => setCredentials({ ...credentials, apiKey: e.target.value })}
                placeholder="API Key"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="apiSecret" className="block text-sm font-medium text-gray-700">
                APIシークレット <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                id="apiSecret"
                name="apiSecret"
                value={credentials.apiSecret || ''}
                onChange={(e) => setCredentials({ ...credentials, apiSecret: e.target.value })}
                placeholder="API Secret"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </>
        );
      case 'rakuten':
        return (
          <>
            <div>
              <label htmlFor="shopId" className="block text-sm font-medium text-gray-700">
                ショップID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="shopId"
                name="shopId"
                value={credentials.shopId || ''}
                onChange={(e) => setCredentials({ ...credentials, shopId: e.target.value })}
                placeholder="Shop ID"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="serviceSecret" className="block text-sm font-medium text-gray-700">
                サービスシークレット <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                id="serviceSecret"
                name="serviceSecret"
                value={credentials.apiSecret || ''}
                onChange={(e) => setCredentials({ ...credentials, apiSecret: e.target.value })}
                placeholder="Service Secret"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="licenseKey" className="block text-sm font-medium text-gray-700">
                ライセンスキー <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="licenseKey"
                name="licenseKey"
                value={credentials.accessToken || ''}
                onChange={(e) => setCredentials({ ...credentials, accessToken: e.target.value })}
                placeholder="License Key"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </>
        );
      case 'amazon':
        return (
          <>
            <div>
              <label htmlFor="sellerId" className="block text-sm font-medium text-gray-700">
                セラーID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="sellerId"
                name="sellerId"
                value={credentials.shopId || ''}
                onChange={(e) => setCredentials({ ...credentials, shopId: e.target.value })}
                placeholder="Seller ID"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="accessKey" className="block text-sm font-medium text-gray-700">
                アクセスキー <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="accessKey"
                name="accessKey"
                value={credentials.apiKey || ''}
                onChange={(e) => setCredentials({ ...credentials, apiKey: e.target.value })}
                placeholder="Access Key"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="secretKey" className="block text-sm font-medium text-gray-700">
                シークレットキー <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                id="secretKey"
                name="secretKey"
                value={credentials.apiSecret || ''}
                onChange={(e) => setCredentials({ ...credentials, apiSecret: e.target.value })}
                placeholder="Secret Key"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="region" className="block text-sm font-medium text-gray-700">
                マーケットプレイス <span className="text-red-500">*</span>
              </label>
              <select
                id="region"
                name="region"
                value={credentials.storeUrl || ''}
                onChange={(e) => setCredentials({ ...credentials, storeUrl: e.target.value })}
                required
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
                Merchant ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="merchantId"
                name="merchantId"
                value={credentials.shopId || ''}
                onChange={(e) => setCredentials({ ...credentials, shopId: e.target.value })}
                placeholder="Merchant ID"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="serviceAccount" className="block text-sm font-medium text-gray-700">
                サービスアカウントキー <span className="text-red-500">*</span>
              </label>
              <textarea
                id="serviceAccount"
                name="serviceAccount"
                value={credentials.serviceAccountKey || ''}
                onChange={(e) => setCredentials({ ...credentials, serviceAccountKey: e.target.value })}
                placeholder="JSONキーの内容を貼り付け"
                required
                rows={4}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                Google Cloud ConsoleからダウンロードしたJSONキーファイルの内容を貼り付けてください
              </p>
            </div>
          </>
        );
      default:
        return null;
    }
  };

  // チャネル名をデフォルト値として設定
  useEffect(() => {
    // チャネルタイプに基づいて名前のデフォルト値を設定
    const channelInfo = channelTypes.find(c => c.id === channelType);
    if (channelInfo) {
      setName(channelInfo.name);
    }
  }, [channelType]);

  // フォーム送信
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(credentials, settings);
  };

  // 同期設定の変更
  const handleSettingChange = (setting: keyof ChannelSettings, value: boolean | number) => {
    setSettings({
      ...settings,
      [setting]: value,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-gray-900">チャネル情報</h2>
        <p className="mt-1 text-sm text-gray-500">
          このチャネルを識別するための情報を入力してください
        </p>

        <div className="mt-4">
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            チャネル名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: マイShopifyストア"
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-medium text-gray-900">認証情報</h2>
        <p className="mt-1 text-sm text-gray-500">
          {channelType === 'shopify' ? 'Shopify管理画面から取得したAPI認証情報を入力してください' : 
          channelType === 'rakuten' ? '楽天RMSの管理画面から取得した認証情報を入力してください' :
          channelType === 'amazon' ? 'Amazon Seller Centralから取得した認証情報を入力してください' :
          'Google Merchant Centerの認証情報を入力してください'}
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {renderCredentialFields()}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-medium text-gray-900">同期設定</h2>
        <p className="mt-1 text-sm text-gray-500">
          データの同期頻度と同期するデータタイプを選択してください
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="syncFrequency" className="block text-sm font-medium text-gray-700">
              同期頻度（分）
            </label>
            <select
              id="syncFrequency"
              name="syncFrequency"
              value={settings.syncFrequency}
              onChange={(e) => handleSettingChange('syncFrequency', parseInt(e.target.value))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="15">15分ごと</option>
              <option value="30">30分ごと</option>
              <option value="60">1時間ごと</option>
              <option value="180">3時間ごと</option>
              <option value="360">6時間ごと</option>
              <option value="720">12時間ごと</option>
              <option value="1440">24時間ごと</option>
            </select>
          </div>

          <div className="flex items-center">
            <input
              id="syncEnabled"
              name="syncEnabled"
              type="checkbox"
              checked={settings.syncEnabled}
              onChange={(e) => handleSettingChange('syncEnabled', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="syncEnabled" className="ml-2 block text-sm text-gray-700">
              自動同期を有効にする
            </label>
          </div>

          <div className="flex items-center">
            <input
              id="productSync"
              name="productSync"
              type="checkbox"
              checked={settings.productSync}
              onChange={(e) => handleSettingChange('productSync', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="productSync" className="ml-2 block text-sm text-gray-700">
              商品データを同期する
            </label>
          </div>

          <div className="flex items-center">
            <input
              id="orderSync"
              name="orderSync"
              type="checkbox"
              checked={settings.orderSync}
              onChange={(e) => handleSettingChange('orderSync', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="orderSync" className="ml-2 block text-sm text-gray-700">
              注文データを同期する
            </label>
          </div>

          <div className="flex items-center">
            <input
              id="inventorySync"
              name="inventorySync"
              type="checkbox"
              checked={settings.inventorySync}
              onChange={(e) => handleSettingChange('inventorySync', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="inventorySync" className="ml-2 block text-sm text-gray-700">
              在庫データを同期する
            </label>
          </div>

          <div className="flex items-center">
            <input
              id="analyticsEnabled"
              name="analyticsEnabled"
              type="checkbox"
              checked={settings.analyticsEnabled}
              onChange={(e) => handleSettingChange('analyticsEnabled', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="analyticsEnabled" className="ml-2 block text-sm text-gray-700">
              分析データを取得する
            </label>
          </div>

          <div className="flex items-center">
            <input
              id="webhooksEnabled"
              name="webhooksEnabled"
              type="checkbox"
              checked={settings.webhooksEnabled}
              onChange={(e) => handleSettingChange('webhooksEnabled', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="webhooksEnabled" className="ml-2 block text-sm text-gray-700">
              Webhookを有効にする（リアルタイム通知）
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-70"
        >
          {isSubmitting ? (
            <>
              <svg className="mr-2 h-4 w-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              接続中...
            </>
          ) : (
            <>接続</>
          )}
        </button>
      </div>
    </form>
  );
};

// OAuth認証接続フォーム
interface OAuthConnectionProps {
  channelType: ChannelType;
  onOAuthConnect: () => void;
  isConnecting: boolean;
}

const OAuthConnection: React.FC<OAuthConnectionProps> = ({
  channelType,
  onOAuthConnect,
  isConnecting,
}) => {
  // チャネルタイプに応じた説明文
  const getOAuthDescription = () => {
    switch (channelType) {
      case 'shopify':
        return 'Shopifyアカウントでログインし、必要な権限を許可することでストアに接続します。';
      case 'rakuten':
        return '楽天アカウントでログインし、必要な権限を許可することでRMSに接続します。';
      case 'amazon':
        return 'Amazonセラーアカウントでログインし、必要な権限を許可することでSeller Centralに接続します。';
      case 'google':
        return 'Googleアカウントでログインし、必要な権限を許可することでMerchant Centerに接続します。';
      default:
        return 'アカウントでログインし、必要な権限を許可してチャネルに接続します。';
    }
  };

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="flex items-center space-x-4">
        {channelTypes.find(c => c.id === channelType)?.icon}
        <div>
          <h3 className="text-lg font-medium text-gray-900">
            {channelTypes.find(c => c.id === channelType)?.name}に接続
          </h3>
          <p className="text-sm text-gray-500">{getOAuthDescription()}</p>
        </div>
      </div>

      <div className="mt-6 border-t border-gray-200 pt-6">
        <div className="space-y-4 text-sm">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="ml-2 text-gray-700">
              安全な認証: API認証情報を直接入力する必要はありません
            </p>
          </div>
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="ml-2 text-gray-700">
              簡単設定: ワンクリックで接続し、必要なアクセス権を許可するだけ
            </p>
          </div>
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="ml-2 text-gray-700">
              自動更新: 認証情報は自動的に更新され、長期間の接続を維持します
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <button
          type="button"
          onClick={onOAuthConnect}
          disabled={isConnecting}
          className={`flex w-full items-center justify-center rounded-md px-4 py-2 text-base font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            channelType === 'shopify'
              ? 'bg-[#95BF47] hover:bg-[#7ea73c] focus:ring-[#95BF47]'
              : channelType === 'rakuten'
              ? 'bg-[#BF0000] hover:bg-[#a00000] focus:ring-[#BF0000]'
              : channelType === 'amazon'
              ? 'bg-[#FF9900] hover:bg-[#e68a00] focus:ring-[#FF9900]'
              : 'bg-[#4285F4] hover:bg-[#3367d6] focus:ring-[#4285F4]'
          }`}
        >
          {isConnecting ? (
            <>
              <svg className="mr-2 h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              リダイレクト中...
            </>
          ) : (
            <>
              {channelType === 'shopify'
                ? 'Shopifyで接続'
                : channelType === 'rakuten'
                ? '楽天IDで接続'
                : channelType === 'amazon'
                ? 'Amazonで接続'
                : 'Googleで接続'}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// メインのチャネル接続フォームコンポーネント
export const ChannelConnectForm: React.FC = () => {
  const navigate = useNavigate();
  const { connectChannel, getOAuthUrl, error, connecting } = useChannelConnection();

  const [selectedChannelType, setSelectedChannelType] = useState<ChannelType | null>(null);
  const [connectionMethod, setConnectionMethod] = useState<ConnectionMethod | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // APIキーによる接続
  const handleApiConnect = async (credentials: ChannelCredentials, settings: Partial<ChannelSettings>) => {
    if (!selectedChannelType) return;

    setFormError(null);
    
    try {
      const channelName = channelTypes.find(c => c.id === selectedChannelType)?.name || selectedChannelType;
      
      const params: ConnectChannelParams = {
        type: selectedChannelType,
        name: channelName,
        credentials,
        settings,
      };
      
      const channel = await connectChannel(params);
      alert(`${channel.name}を正常に接続しました！`);
      navigate('/channels');
    } catch (err) {
      console.error('Connection error:', err);
      setFormError(err instanceof Error ? err.message : '接続に失敗しました。入力情報を確認してください。');
    }
  };

  // OAuth認証による接続
  const handleOAuthConnect = async () => {
    if (!selectedChannelType) return;

    setFormError(null);
    
    try {
      // OAuthリダイレクトURLを取得
      const redirectUri = `${window.location.origin}/oauth/callback`;
      const authUrl = await getOAuthUrl({
        channelType: selectedChannelType,
        redirectUri,
        state: JSON.stringify({
          channelType: selectedChannelType,
          returnTo: '/channels',
        }),
      });
      
      // 認証ページへリダイレクト
      window.location.href = authUrl;
    } catch (err) {
      console.error('OAuth error:', err);
      setFormError(err instanceof Error ? err.message : 'OAuth認証の開始に失敗しました。');
    }
  };

  // ステップ表示を制御
  const renderCurrentStep = () => {
    // チャネルタイプ選択
    if (!selectedChannelType) {
      return (
        <div className="mx-auto max-w-3xl">
          <ChannelTypeSelection onTypeSelect={setSelectedChannelType} />
        </div>
      );
    }

    // 接続方法選択
    if (!connectionMethod) {
      return (
        <div className="mx-auto max-w-2xl">
          <div className="text-center">
            <button
              type="button"
              onClick={() => setSelectedChannelType(null)}
              className="mb-6 inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              <svg className="mr-1 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
              戻る
            </button>
            <h2 className="text-lg font-medium text-gray-900">接続方法を選択</h2>
            <p className="mt-1 text-sm text-gray-500">
              {selectedChannelType === 'shopify'
                ? 'Shopifyストアに接続する方法を選択してください'
                : selectedChannelType === 'rakuten'
                ? '楽天市場に接続する方法を選択してください'
                : selectedChannelType === 'amazon'
                ? 'Amazonに接続する方法を選択してください'
                : 'Google Merchant Centerに接続する方法を選択してください'}
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PermissionGate permissions={['channels.connect', 'channels.oauth']}>
              <button
                type="button"
                onClick={() => setConnectionMethod(ConnectionMethod.OAUTH)}
                className="flex flex-col rounded-lg border border-gray-300 bg-white p-4 text-left shadow-sm hover:border-indigo-500 focus:outline-none"
              >
                <div className="flex items-center">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-700">
                    <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium">OAuth認証で接続</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      セキュアな方法でアカウントに接続し、APIキーを管理する必要がありません
                    </p>
                  </div>
                </div>
              </button>
            </PermissionGate>

            <PermissionGate permissions={['channels.connect', 'channels.create']}>
              <button
                type="button"
                onClick={() => setConnectionMethod(ConnectionMethod.API_KEY)}
                className="flex flex-col rounded-lg border border-gray-300 bg-white p-4 text-left shadow-sm hover:border-indigo-500 focus:outline-none"
              >
                <div className="flex items-center">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-700">
                    <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium">APIキーで接続</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      管理画面から取得したAPIキーを入力して接続します
                    </p>
                  </div>
                </div>
              </button>
            </PermissionGate>
          </div>
        </div>
      );
    }

    // 接続方法に応じたフォーム表示
    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setConnectionMethod(null)}
            className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500"
          >
            <svg className="mr-1 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            戻る
          </button>
        </div>

        {/* エラーメッセージ */}
        {(formError || error) && (
          <div className="mb-6 rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">
                  {formError || (error?.message || 'エラーが発生しました。もう一度お試しください。')}
                </p>
              </div>
            </div>
          </div>
        )}

        {connectionMethod === ConnectionMethod.API_KEY ? (
          <ApiKeyForm
            channelType={selectedChannelType}
            onSubmit={handleApiConnect}
            isSubmitting={connecting}
          />
        ) : (
          <OAuthConnection
            channelType={selectedChannelType}
            onOAuthConnect={handleOAuthConnect}
            isConnecting={connecting}
          />
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">チャネル接続</h1>
        <p className="mt-1 text-sm text-gray-500">
          外部サービスやeコマースプラットフォームをConeaに接続します
        </p>
      </div>

      {renderCurrentStep()}
    </div>
  );
};

export default ChannelConnectForm;