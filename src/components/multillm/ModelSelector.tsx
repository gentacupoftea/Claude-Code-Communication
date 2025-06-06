'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, 
  Zap, 
  Eye, 
  DollarSign, 
  Clock, 
  Star,
  Check,
  AlertCircle,
  ChevronDown,
  Settings,
  BarChart3,
  Sparkles
} from 'lucide-react';
import { LLMProvider, LLMModel } from '@/src/types/multillm';
import { MultiLLMService } from '@/src/services/multillm.service';

interface ModelSelectorProps {
  selectedModels: string[];
  onModelToggle: (modelId: string, selected: boolean) => void;
  maxSelections?: number;
  showComparison?: boolean;
  onCompareModels?: (models: string[]) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModels,
  onModelToggle,
  maxSelections = 3,
  showComparison = true,
  onCompareModels
}) => {
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'cost' | 'speed' | 'quality'>('name');

  useEffect(() => {
    const multiLLMService = MultiLLMService.getInstance();
    const availableProviders = multiLLMService.getAvailableProviders();
    setProviders(availableProviders);
    
    // デフォルトで最初のプロバイダーを展開
    if (availableProviders.length > 0) {
      setExpandedProvider(availableProviders[0].id);
    }
  }, []);

  const getProviderIcon = (providerId: string) => {
    switch (providerId) {
      case 'openai':
        return '🤖';
      case 'anthropic':
        return '🎭';
      case 'google':
        return '🔍';
      default:
        return '🧠';
    }
  };

  const getModelStatusIcon = (model: LLMModel) => {
    if (selectedModels.includes(model.id)) {
      return <Check className="w-4 h-4 text-green-500" />;
    }
    return null;
  };

  const getModelStrengthColor = (strength: string) => {
    const colors: { [key: string]: string } = {
      '推論': 'bg-purple-500',
      'コーディング': 'bg-blue-500',
      '創作': 'bg-pink-500',
      '分析': 'bg-green-500',
      'チャット': 'bg-yellow-500',
      'マルチモーダル': 'bg-red-500',
      '高速処理': 'bg-orange-500',
      '経済性': 'bg-gray-500',
      '安全性': 'bg-teal-500',
      '長文理解': 'bg-indigo-500'
    };
    return colors[strength] || 'bg-gray-500';
  };

  const formatPrice = (price: number) => {
    if (price < 0.000001) {
      return `$${(price * 1000000).toFixed(2)}/1M tokens`;
    }
    return `$${(price * 1000).toFixed(3)}/1K tokens`;
  };

  const sortModels = (models: LLMModel[]) => {
    return [...models].sort((a, b) => {
      switch (sortBy) {
        case 'cost':
          return a.pricing.outputTokenPrice - b.pricing.outputTokenPrice;
        case 'speed':
          return b.maxOutputTokens - a.maxOutputTokens; // 仮の速度指標
        case 'quality':
          return b.contextLength - a.contextLength; // 仮の品質指標
        default:
          return a.displayName.localeCompare(b.displayName);
      }
    });
  };

  const handleModelClick = (model: LLMModel) => {
    const isSelected = selectedModels.includes(model.id);
    
    if (isSelected) {
      onModelToggle(model.id, false);
    } else if (selectedModels.length < maxSelections) {
      onModelToggle(model.id, true);
    }
  };

  const handleCompare = () => {
    if (onCompareModels && selectedModels.length >= 2) {
      onCompareModels(selectedModels);
    }
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">モデル選択</h2>
          <p className="text-gray-400 mt-1">
            {selectedModels.length}/{maxSelections} モデルが選択されています
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* ソート */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'speed' | 'quality' | 'cost')}
            className="bg-gray-800 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="name">名前順</option>
            <option value="cost">価格順</option>
            <option value="speed">速度順</option>
            <option value="quality">品質順</option>
          </select>

          {/* 詳細表示切り替え */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
              showAdvanced ? 'bg-[#1ABC9C] text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>詳細</span>
          </button>

          {/* 比較ボタン */}
          {showComparison && selectedModels.length >= 2 && (
            <button
              onClick={handleCompare}
              className="flex items-center space-x-2 px-4 py-2 bg-[#3498DB] hover:bg-[#2980B9] 
                       rounded-lg transition-colors text-white"
            >
              <BarChart3 className="w-4 h-4" />
              <span>比較</span>
            </button>
          )}
        </div>
      </div>

      {/* プロバイダーリスト */}
      <div className="space-y-4">
        {providers.map((provider) => (
          <motion.div
            key={provider.id}
            layout
            className="bg-gray-900/50 backdrop-blur-lg rounded-xl border border-white/10 overflow-hidden"
          >
            {/* プロバイダーヘッダー */}
            <button
              onClick={() => setExpandedProvider(
                expandedProvider === provider.id ? null : provider.id
              )}
              className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center space-x-4">
                <div className="text-2xl">{getProviderIcon(provider.id)}</div>
                <div className="text-left">
                  <h3 className="text-lg font-semibold text-white">{provider.displayName}</h3>
                  <p className="text-sm text-gray-400">{provider.description}</p>
                </div>
                <div className={`px-2 py-1 rounded-full text-xs ${
                  provider.status === 'available' ? 'bg-green-500/20 text-green-400' :
                  provider.status === 'rate_limited' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {provider.status === 'available' ? '利用可能' :
                   provider.status === 'rate_limited' ? 'レート制限中' : 'エラー'}
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="text-right text-sm text-gray-400">
                  <div>{provider.models.filter(m => m.isEnabled).length} モデル</div>
                  <div>{formatPrice(provider.pricing.outputTokenPrice)}</div>
                </div>
                <ChevronDown 
                  className={`w-5 h-5 text-gray-400 transition-transform ${
                    expandedProvider === provider.id ? 'rotate-180' : ''
                  }`} 
                />
              </div>
            </button>

            {/* モデルリスト */}
            <AnimatePresence>
              {expandedProvider === provider.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="border-t border-white/10"
                >
                  <div className="p-4 space-y-3">
                    {sortModels(provider.models.filter(m => m.isEnabled)).map((model) => {
                      const isSelected = selectedModels.includes(model.id);
                      const canSelect = !isSelected && selectedModels.length < maxSelections;
                      
                      return (
                        <motion.div
                          key={model.id}
                          whileHover={{ scale: 1.02 }}
                          className={`p-4 rounded-lg border cursor-pointer transition-all ${
                            isSelected 
                              ? 'border-[#1ABC9C] bg-[#1ABC9C]/10' 
                              : canSelect
                                ? 'border-white/20 hover:border-white/40 bg-white/5'
                                : 'border-white/10 bg-white/5 opacity-50 cursor-not-allowed'
                          }`}
                          onClick={() => canSelect || isSelected ? handleModelClick(model) : null}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-2">
                                <h4 className="text-lg font-medium text-white">
                                  {model.displayName}
                                </h4>
                                {getModelStatusIcon(model)}
                                {model.isMultimodal && (
                                  <div className="flex items-center space-x-1 px-2 py-1 
                                                bg-purple-500/20 rounded text-xs text-purple-400">
                                    <Eye className="w-3 h-3" />
                                    <span>マルチモーダル</span>
                                  </div>
                                )}
                              </div>
                              
                              {model.description && (
                                <p className="text-sm text-gray-400 mb-3">{model.description}</p>
                              )}

                              {/* 強み */}
                              <div className="flex flex-wrap gap-2 mb-3">
                                {model.strengths.map((strength) => (
                                  <span
                                    key={strength}
                                    className={`px-2 py-1 rounded text-xs text-white ${getModelStrengthColor(strength)}`}
                                  >
                                    {strength}
                                  </span>
                                ))}
                              </div>

                              {showAdvanced && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <div className="text-gray-400">コンテキスト長</div>
                                    <div className="text-white font-medium">
                                      {model.contextLength.toLocaleString()}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-gray-400">最大出力</div>
                                    <div className="text-white font-medium">
                                      {model.maxOutputTokens.toLocaleString()}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-gray-400">入力価格</div>
                                    <div className="text-white font-medium">
                                      {formatPrice(model.pricing.inputTokenPrice)}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-gray-400">出力価格</div>
                                    <div className="text-white font-medium">
                                      {formatPrice(model.pricing.outputTokenPrice)}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {!showAdvanced && (
                              <div className="text-right">
                                <div className="text-sm text-gray-400 mb-1">出力価格</div>
                                <div className="text-white font-medium text-sm">
                                  {formatPrice(model.pricing.outputTokenPrice)}
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* 選択状況 */}
      {selectedModels.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900/50 backdrop-blur-lg rounded-xl border border-white/10 p-4"
        >
          <h3 className="text-lg font-semibold text-white mb-3">選択中のモデル</h3>
          <div className="space-y-2">
            {selectedModels.map((modelId) => {
              const allModels = providers.flatMap(p => p.models);
              const model = allModels.find(m => m.id === modelId);
              if (!model) return null;

              return (
                <div key={modelId} className="flex items-center justify-between p-2 
                                           bg-white/5 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <span className="text-xl">{getProviderIcon(model.provider)}</span>
                    <span className="text-white font-medium">{model.displayName}</span>
                    <span className="text-sm text-gray-400">({model.provider})</span>
                  </div>
                  <button
                    onClick={() => onModelToggle(modelId, false)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    削除
                  </button>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* 使用制限の警告 */}
      {selectedModels.length >= maxSelections && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4"
        >
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-orange-400" />
            <span className="text-orange-400 font-medium">
              最大{maxSelections}個までのモデルを選択できます
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
};