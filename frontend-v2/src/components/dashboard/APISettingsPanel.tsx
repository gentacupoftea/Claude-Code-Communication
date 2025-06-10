'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Save, 
  RotateCcw, 
  Eye, 
  EyeOff,
  ShoppingCart,
  Store,
  Package,
  Settings,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { APISettings, defaultAPISettings } from '@/src/types/api-settings';
import { backendAPI } from '@/src/lib/backend-api';

interface APISettingsPanelProps {
  apiSettings?: APISettings;
  onSettingsChange?: (settings: APISettings) => void;
}

export const APISettingsPanel: React.FC<APISettingsPanelProps> = ({ 
  apiSettings = defaultAPISettings, 
  onSettingsChange 
}) => {
  const [activeTab, setActiveTab] = useState('amazon');
  const [localSettings, setLocalSettings] = useState<APISettings>(apiSettings);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, 'success' | 'error' | 'testing' | null>>({});
  const [isAutoSave, setIsAutoSave] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // コンポーネントマウント時にAPI設定を読み込み
  useEffect(() => {
    const loadAPISettings = async () => {
      setIsLoading(true);
      try {
        const settings = await backendAPI.getAPISettings();
        setLocalSettings(settings);
      } catch (error) {
        console.error('Failed to load API settings:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadAPISettings();
  }, []);

  const tabs = [
    { id: 'amazon', label: 'Amazon', icon: Package, color: '#FF9900' },
    { id: 'rakuten', label: '楽天', icon: Store, color: '#BF0000' },
    { id: 'shopify', label: 'Shopify', icon: ShoppingCart, color: '#95BF47' },
    { id: 'nextengine', label: 'NextEngine', icon: Settings, color: '#0066CC' }
  ];

  // 設定変更時の処理
  const handleSettingChange = async (api: keyof APISettings, key: string, value: string) => {
    const newSettings = {
      ...localSettings,
      [api]: {
        ...localSettings[api],
        [key]: value
      }
    };
    setLocalSettings(newSettings);
    
    if (isAutoSave) {
      try {
        await backendAPI.saveAPISettings(newSettings);
        onSettingsChange?.(newSettings);
      } catch (error) {
        console.error('Failed to save API settings:', error);
      }
    } else {
      onSettingsChange?.(newSettings);
    }
  };

  // 手動保存
  const handleSave = async () => {
    try {
      await backendAPI.saveAPISettings(localSettings);
      onSettingsChange?.(localSettings);
    } catch (error) {
      console.error('Failed to save API settings:', error);
    }
  };

  // リセット
  const handleReset = () => {
    setLocalSettings(defaultAPISettings);
    if (onSettingsChange) {
      onSettingsChange(defaultAPISettings);
    }
  };

  // API接続テスト
  const testAPIConnection = async (api: keyof APISettings) => {
    setTestResults(prev => ({ ...prev, [api]: 'testing' }));
    
    try {
      const isConnected = await backendAPI.testAPIConnection(api);
      setTestResults(prev => ({ 
        ...prev, 
        [api]: isConnected ? 'success' : 'error' 
      }));
    } catch (error) {
      console.error(`API connection test failed for ${api}:`, error);
      setTestResults(prev => ({ ...prev, [api]: 'error' }));
    }
  };

  // 秘匿情報の表示切り替え
  const toggleSecretVisibility = (fieldId: string) => {
    setShowSecrets(prev => ({ ...prev, [fieldId]: !prev[fieldId] }));
  };

  // 入力フィールドのレンダリング
  const renderField = (
    api: keyof APISettings,
    key: string,
    label: string,
    isSecret: boolean = false,
    placeholder: string = ''
  ) => {
    const fieldId = `${api}-${key}`;
    const isVisible = showSecrets[fieldId];
    
    return (
      <div key={fieldId}>
        <label className="block text-sm font-medium text-white mb-2">{label}</label>
        <div className="relative">
          <input
            type={isSecret && !isVisible ? 'password' : 'text'}
            value={localSettings?.[api]?.[key as keyof typeof localSettings[typeof api]] || ''}
            onChange={(e) => handleSettingChange(api, key, e.target.value)}
            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1ABC9C] backdrop-blur-lg pr-10"
            placeholder={placeholder}
          />
          {isSecret && (
            <button
              type="button"
              onClick={() => toggleSecretVisibility(fieldId)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
            >
              {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-full flex flex-col">
      {/* ヘッダー */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">API設定</h2>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isAutoSave ? 'bg-green-400' : 'bg-gray-400'}`}></div>
            <span className="text-xs text-gray-400">
              {isAutoSave ? '自動保存中' : '手動保存'}
            </span>
          </div>
        </div>

        {/* タブナビゲーション */}
        <div className="flex space-x-1 bg-white/5 rounded-lg p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center space-x-1 py-2 px-2 rounded-md text-xs transition-all ${
                activeTab === tab.id
                  ? 'bg-[#1ABC9C] text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <tab.icon className="w-3 h-3" style={{ color: activeTab === tab.id ? 'white' : tab.color }} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* コンテンツエリア */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Amazon設定 */}
        {activeTab === 'amazon' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-md font-medium text-white">Amazon API設定</h3>
              <button
                onClick={() => testAPIConnection('amazon')}
                disabled={testResults.amazon === 'testing'}
                className="flex items-center space-x-2 px-3 py-1 bg-[#FF9900] hover:bg-[#E8890A] disabled:bg-gray-600 rounded-lg text-xs transition-colors"
              >
                {testResults.amazon === 'testing' ? (
                  <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                ) : testResults.amazon === 'success' ? (
                  <CheckCircle className="w-3 h-3" />
                ) : testResults.amazon === 'error' ? (
                  <AlertCircle className="w-3 h-3" />
                ) : null}
                <span>接続テスト</span>
              </button>
            </div>
            
            {renderField('amazon', 'accessKeyId', 'Access Key ID', true, 'AKIA...')}
            {renderField('amazon', 'secretAccessKey', 'Secret Access Key', true, '...')}
            {renderField('amazon', 'region', 'リージョン', false, 'us-east-1')}
            {renderField('amazon', 'marketplaceId', 'Marketplace ID', false, 'A1VC38T7YXB528')}
            {renderField('amazon', 'sellerId', 'Seller ID', false, 'A...')}
          </motion.div>
        )}

        {/* 楽天設定 */}
        {activeTab === 'rakuten' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-md font-medium text-white">楽天API設定</h3>
              <button
                onClick={() => testAPIConnection('rakuten')}
                disabled={testResults.rakuten === 'testing'}
                className="flex items-center space-x-2 px-3 py-1 bg-[#BF0000] hover:bg-[#A60000] disabled:bg-gray-600 rounded-lg text-xs transition-colors"
              >
                {testResults.rakuten === 'testing' ? (
                  <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                ) : testResults.rakuten === 'success' ? (
                  <CheckCircle className="w-3 h-3" />
                ) : testResults.rakuten === 'error' ? (
                  <AlertCircle className="w-3 h-3" />
                ) : null}
                <span>接続テスト</span>
              </button>
            </div>
            
            {renderField('rakuten', 'applicationId', 'Application ID', false, '1234567890123456789')}
            {renderField('rakuten', 'secret', 'Secret', true, '...')}
            {renderField('rakuten', 'serviceSecret', 'Service Secret', true, '...')}
            {renderField('rakuten', 'shopUrl', 'ショップURL', false, 'https://www.rakuten.co.jp/shop/')}
          </motion.div>
        )}

        {/* Shopify設定 */}
        {activeTab === 'shopify' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-md font-medium text-white">Shopify API設定</h3>
              <button
                onClick={() => testAPIConnection('shopify')}
                disabled={testResults.shopify === 'testing'}
                className="flex items-center space-x-2 px-3 py-1 bg-[#95BF47] hover:bg-[#7DA63A] disabled:bg-gray-600 rounded-lg text-xs transition-colors"
              >
                {testResults.shopify === 'testing' ? (
                  <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                ) : testResults.shopify === 'success' ? (
                  <CheckCircle className="w-3 h-3" />
                ) : testResults.shopify === 'error' ? (
                  <AlertCircle className="w-3 h-3" />
                ) : null}
                <span>接続テスト</span>
              </button>
            </div>
            
            {renderField('shopify', 'shopDomain', 'ショップドメイン', false, 'mystore.myshopify.com')}
            {renderField('shopify', 'accessToken', 'Access Token', true, 'shpat_...')}
            {renderField('shopify', 'apiKey', 'API Key', false, '...')}
            {renderField('shopify', 'apiSecret', 'API Secret', true, '...')}
          </motion.div>
        )}

        {/* NextEngine設定 */}
        {activeTab === 'nextengine' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-md font-medium text-white">NextEngine API設定</h3>
              <button
                onClick={() => testAPIConnection('nextengine')}
                disabled={testResults.nextengine === 'testing'}
                className="flex items-center space-x-2 px-3 py-1 bg-[#0066CC] hover:bg-[#0052A3] disabled:bg-gray-600 rounded-lg text-xs transition-colors"
              >
                {testResults.nextengine === 'testing' ? (
                  <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                ) : testResults.nextengine === 'success' ? (
                  <CheckCircle className="w-3 h-3" />
                ) : testResults.nextengine === 'error' ? (
                  <AlertCircle className="w-3 h-3" />
                ) : null}
                <span>接続テスト</span>
              </button>
            </div>
            
            {renderField('nextengine', 'clientId', 'Client ID', false, '...')}
            {renderField('nextengine', 'clientSecret', 'Client Secret', true, '...')}
            {renderField('nextengine', 'redirectUri', 'Redirect URI', false, 'https://...')}
            {renderField('nextengine', 'uid', 'UID', false, '...')}
            {renderField('nextengine', 'accessToken', 'Access Token', true, '...')}
          </motion.div>
        )}

        {/* 自動保存設定 */}
        <div className="mt-6 p-3 bg-white/5 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">自動保存</p>
              <p className="text-xs text-gray-400">設定変更を自動的に保存</p>
            </div>
            <button
              onClick={() => setIsAutoSave(!isAutoSave)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isAutoSave ? 'bg-[#1ABC9C]' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isAutoSave ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* フッター */}
      <div className="p-4 border-t border-white/10 flex space-x-3">
        <button 
          onClick={handleSave}
          disabled={isAutoSave}
          className="flex-1 flex items-center justify-center space-x-2 py-2 px-4 bg-[#1ABC9C] hover:bg-[#16A085] disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          <Save className="w-4 h-4" />
          <span className="text-sm">{isAutoSave ? '自動保存中' : '保存'}</span>
        </button>
        <button 
          onClick={handleReset}
          className="flex items-center justify-center space-x-2 py-2 px-4 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          <span className="text-sm">リセット</span>
        </button>
      </div>
    </motion.div>
  );
};