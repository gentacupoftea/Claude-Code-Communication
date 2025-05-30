'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GlassmorphicCard } from '@/src/components/common';
import { 
  Save, 
  RotateCcw, 
  Bot, 
  MessageSquare,
  Settings,
  Database,
  Cpu,
  Plug,
  Layout,
  Sparkles,
  Book,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { multiLLMAPI, AgentConfig, defaultAgentConfig } from '@/src/lib/api';
import { APISettingsPanel } from './APISettingsPanel';
import { APISettings, defaultAPISettings } from '@/src/types/api-settings';
import { WidgetLibrary } from './WidgetLibrary';
import { DashboardEditor } from './DashboardEditor';
import { LearningDataPanel } from './LearningDataPanel';
import { Dashboard, Widget, DraggableItem } from '@/src/types/widgets';

interface EditPanelProps {
  agentConfig?: Partial<AgentConfig>;
  onConfigChange?: (config: Partial<AgentConfig>) => void;
  apiSettings?: APISettings;
  onAPISettingsChange?: (settings: APISettings) => void;
  dashboard?: Dashboard;
  onDashboardSave?: (dashboard: Dashboard) => void;
  generatedWidgets?: DraggableItem[];
  onFullscreenToggle?: () => void;
  isFullscreen?: boolean;
}

export const EditPanel: React.FC<EditPanelProps> = ({ 
  agentConfig = defaultAgentConfig, 
  onConfigChange,
  apiSettings = defaultAPISettings,
  onAPISettingsChange,
  dashboard,
  onDashboardSave,
  generatedWidgets = [],
  onFullscreenToggle,
  isFullscreen = false
}) => {
  const [activeTab, setActiveTab] = useState('general');
  const [isAutoSave, setIsAutoSave] = useState(true);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [localConfig, setLocalConfig] = useState<Partial<AgentConfig>>(agentConfig);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  const tabs = [
    { id: 'general', label: '基本設定', icon: Bot },
    { id: 'model', label: 'AIモデル', icon: Cpu },
    { id: 'api', label: 'API設定', icon: Plug },
    { id: 'learning', label: '学習データ', icon: Book },
    { id: 'widgets', label: 'ウィジェット', icon: Sparkles },
    { id: 'dashboard', label: 'ダッシュボード', icon: Layout },
    { id: 'messages', label: 'メッセージ', icon: MessageSquare },
    { id: 'advanced', label: '詳細設定', icon: Settings }
  ];

  // 利用可能なモデルを取得
  useEffect(() => {
    const fetchModels = async () => {
      setIsLoadingModels(true);
      try {
        const models = await multiLLMAPI.getAvailableModels();
        setAvailableModels(models);
      } catch (error) {
        console.error('Failed to fetch models:', error);
      } finally {
        setIsLoadingModels(false);
      }
    };
    
    fetchModels();
  }, []);

  // 設定変更時の処理
  const handleConfigChange = (key: keyof AgentConfig, value: any) => {
    const newConfig = { ...localConfig, [key]: value };
    setLocalConfig(newConfig);
    
    if (isAutoSave && onConfigChange) {
      onConfigChange(newConfig);
    }
  };

  // 手動保存
  const handleSave = () => {
    if (onConfigChange) {
      onConfigChange(localConfig);
    }
  };

  // リセット
  const handleReset = () => {
    setLocalConfig(defaultAgentConfig);
    if (onConfigChange) {
      onConfigChange(defaultAgentConfig);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* ヘッダー */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">エージェント設定</h2>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isAutoSave ? 'bg-green-400' : 'bg-gray-400'}`}></div>
              <span className="text-xs text-gray-400">
                {isAutoSave ? '自動保存中' : '保存停止'}
              </span>
            </div>
            {activeTab === 'dashboard' && onFullscreenToggle && (
              <button
                onClick={onFullscreenToggle}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                title={isFullscreen ? 'フルスクリーンを終了' : 'フルスクリーン表示'}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4 text-gray-400" />
                ) : (
                  <Maximize2 className="w-4 h-4 text-gray-400" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* タブナビゲーション */}
        <div className="grid grid-cols-4 gap-1 bg-white/5 rounded-lg p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-md text-xs transition-all ${
                activeTab === tab.id
                  ? 'bg-[#1ABC9C] text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <tab.icon className="w-3 h-3 mb-1" />
              <span className="text-[10px] leading-none">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* コンテンツエリア */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'general' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-white mb-2">エージェント名</label>
              <input
                type="text"
                value={localConfig.name || ''}
                onChange={(e) => handleConfigChange('name', e.target.value)}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1ABC9C] backdrop-blur-lg"
                placeholder="エージェント名を入力..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">説明</label>
              <textarea
                value={localConfig.description || ''}
                onChange={(e) => handleConfigChange('description', e.target.value)}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1ABC9C] backdrop-blur-lg h-20 resize-none"
                placeholder="エージェントの説明を入力..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">言語設定</label>
              <select 
                value={localConfig.language || 'ja'}
                onChange={(e) => handleConfigChange('language', e.target.value)}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#1ABC9C] backdrop-blur-lg"
              >
                <option value="ja">日本語</option>
                <option value="en">English</option>
                <option value="zh">中文</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <div>
                <p className="text-sm font-medium text-white">自動保存</p>
                <p className="text-xs text-gray-400">変更を自動的に保存</p>
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
          </motion.div>
        )}

        {activeTab === 'model' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-white mb-2">AIモデル</label>
              <select 
                value={localConfig.model || 'gpt-3.5-turbo'}
                onChange={(e) => handleConfigChange('model', e.target.value)}
                disabled={isLoadingModels}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#1ABC9C] backdrop-blur-lg disabled:opacity-50"
              >
                {isLoadingModels ? (
                  <option>モデルを読み込み中...</option>
                ) : (
                  availableModels.map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))
                )}
              </select>
              {isLoadingModels && (
                <p className="text-xs text-gray-400 mt-1">利用可能なモデルを取得中...</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">創造性 (Temperature)</label>
              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={localConfig.temperature || 0.7}
                  onChange={(e) => handleConfigChange('temperature', parseFloat(e.target.value))}
                  className="w-full accent-[#1ABC9C]"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>保守的 (0.0)</span>
                  <span className="text-white">{localConfig.temperature || 0.7}</span>
                  <span>創造的 (2.0)</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">最大トークン数</label>
              <input
                type="number"
                min="100"
                max="4000"
                step="100"
                value={localConfig.max_tokens || 1000}
                onChange={(e) => handleConfigChange('max_tokens', parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1ABC9C] backdrop-blur-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">システムプロンプト</label>
              <textarea
                value={localConfig.system_prompt || ''}
                onChange={(e) => handleConfigChange('system_prompt', e.target.value)}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1ABC9C] backdrop-blur-lg h-24 resize-none"
                placeholder="AIの振る舞いを定義するシステムプロンプトを入力..."
              />
            </div>
          </motion.div>
        )}

        {activeTab === 'api' && (
          <APISettingsPanel 
            apiSettings={apiSettings}
            onSettingsChange={onAPISettingsChange}
          />
        )}

        {activeTab === 'learning' && (
          <LearningDataPanel />
        )}

        {activeTab === 'widgets' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="h-full"
          >
            <WidgetLibrary 
              generatedWidgets={generatedWidgets}
            />
          </motion.div>
        )}

        {activeTab === 'dashboard' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="h-full"
          >
            <DashboardEditor 
              dashboard={dashboard}
              onSave={onDashboardSave}
            />
          </motion.div>
        )}

        {activeTab === 'messages' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-white mb-2">応答スタイル</label>
              <select 
                value={localConfig.response_style || 'friendly'}
                onChange={(e) => handleConfigChange('response_style', e.target.value)}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#1ABC9C] backdrop-blur-lg"
              >
                <option value="friendly">フレンドリー</option>
                <option value="professional">プロフェッショナル</option>
                <option value="casual">カジュアル</option>
                <option value="formal">フォーマル</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">返答の長さ</label>
              <div className="space-y-2">
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={localConfig.response_length || 3}
                  onChange={(e) => handleConfigChange('response_length', parseInt(e.target.value))}
                  className="w-full accent-[#1ABC9C]"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>簡潔</span>
                  <span className="text-white">{localConfig.response_length || 3}</span>
                  <span>詳細</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}


        {activeTab === 'advanced' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-white mb-2">応答時間制限 (秒)</label>
              <input
                type="number"
                min="5"
                max="120"
                value={localConfig.timeout || 30}
                onChange={(e) => handleConfigChange('timeout', parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1ABC9C] backdrop-blur-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">最大会話履歴</label>
              <input
                type="number"
                min="10"
                max="200"
                value={localConfig.max_history || 50}
                onChange={(e) => handleConfigChange('max_history', parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1ABC9C] backdrop-blur-lg"
              />
            </div>

            <div className="bg-white/5 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-2">
                <Database className="w-4 h-4 text-[#1ABC9C]" />
                <span className="text-sm font-medium text-white">学習データ</span>
              </div>
              <div className="text-xs text-gray-400 space-y-1">
                <p>FAQ: 1,234件</p>
                <p>対話履歴: 5,678件</p>
                <p>最終更新: 2024年1月15日</p>
              </div>
            </div>
          </motion.div>
        )}
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
    </div>
  );
};