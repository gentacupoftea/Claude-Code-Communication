'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, CheckCircle, AlertCircle, Cpu, Brain, Bot } from 'lucide-react';
import { multiLLMAPI, ProviderStatus, ModelsResponse } from '@/src/lib/multillm-api';

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
  disabled?: boolean;
  showProviderInfo?: boolean;
}

interface ModelInfo {
  name: string;
  provider: string;
  displayName: string;
  description: string;
  icon: React.ReactNode;
  available: boolean;
  speed: 'fast' | 'medium' | 'slow';
  cost: 'low' | 'medium' | 'high';
}

const getProviderIcon = (provider: string) => {
  switch (provider) {
    case 'openai':
      return <Bot className="w-4 h-4 text-green-500" />;
    case 'anthropic':
      return <Brain className="w-4 h-4 text-purple-500" />;
    case 'google':
      return <Cpu className="w-4 h-4 text-blue-500" />;
    default:
      return <Bot className="w-4 h-4 text-gray-500" />;
  }
};

const getModelDisplayName = (model: string): string => {
  const displayNames: Record<string, string> = {
    'gpt-3.5-turbo': 'GPT-3.5 Turbo',
    'gpt-4': 'GPT-4',
    'gpt-4-turbo': 'GPT-4 Turbo',
    'claude-3-haiku-20240307': 'Claude 3 Haiku',
    'claude-3-sonnet-20240229': 'Claude 3 Sonnet',
    'claude-3-opus-20240229': 'Claude 3 Opus',
    'gemini-1.5-flash': 'Gemini 1.5 Flash',
    'gemini-1.5-pro': 'Gemini 1.5 Pro'
  };
  return displayNames[model] || model;
};

const getModelDescription = (model: string): string => {
  const descriptions: Record<string, string> = {
    'gpt-3.5-turbo': '高速で効率的、一般的なタスクに最適',
    'gpt-4': '高度な推論能力、複雑なタスクに対応',
    'gpt-4-turbo': 'GPT-4の高速版、長文処理が得意',
    'claude-3-haiku-20240307': '最高速、軽量なタスクに最適',
    'claude-3-sonnet-20240229': 'バランス型、汎用性が高い',
    'claude-3-opus-20240229': '最高性能、最も複雑なタスクに対応',
    'gemini-1.5-flash': '高速処理、マルチモーダル対応',
    'gemini-1.5-pro': '高性能、長いコンテキストに対応'
  };
  return descriptions[model] || '詳細な説明はありません';
};

const getModelCharacteristics = (model: string): { speed: 'fast' | 'medium' | 'slow'; cost: 'low' | 'medium' | 'high' } => {
  const characteristics: Record<string, { speed: 'fast' | 'medium' | 'slow'; cost: 'low' | 'medium' | 'high' }> = {
    'gpt-3.5-turbo': { speed: 'fast', cost: 'low' },
    'gpt-4': { speed: 'slow', cost: 'high' },
    'gpt-4-turbo': { speed: 'medium', cost: 'high' },
    'claude-3-haiku-20240307': { speed: 'fast', cost: 'low' },
    'claude-3-sonnet-20240229': { speed: 'medium', cost: 'medium' },
    'claude-3-opus-20240229': { speed: 'slow', cost: 'high' },
    'gemini-1.5-flash': { speed: 'fast', cost: 'low' },
    'gemini-1.5-pro': { speed: 'medium', cost: 'medium' }
  };
  return characteristics[model] || { speed: 'medium', cost: 'medium' };
};

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  onModelChange,
  disabled = false,
  showProviderInfo = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [modelsData, setModelsData] = useState<ModelsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await multiLLMAPI.getModelsAndProviders();
        setModelsData(data);
        
        // 現在選択されているモデルが利用可能でない場合、最初の利用可能なモデルに変更
        if (!data.models.includes(selectedModel) && data.models.length > 0) {
          onModelChange(data.models[0]);
        }
      } catch (err) {
        setError('モデル一覧の取得に失敗しました');
        console.error('Failed to fetch models:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchModels();
  }, [selectedModel, onModelChange]);

  const getModelsByProvider = (): Record<string, ModelInfo[]> => {
    if (!modelsData) return {};

    const modelsByProvider: Record<string, ModelInfo[]> = {};
    
    Object.entries(modelsData.providerStatus).forEach(([provider, status]) => {
      if (status.available) {
        modelsByProvider[provider] = status.models
          .filter((model: string) => modelsData.models.includes(model))
          .map((model: string) => {
            const characteristics = getModelCharacteristics(model);
            return {
              name: model,
              provider,
              displayName: getModelDisplayName(model),
              description: getModelDescription(model),
              icon: getProviderIcon(provider),
              available: true,
              speed: characteristics.speed,
              cost: characteristics.cost
            };
          });
      }
    });

    return modelsByProvider;
  };

  const getProviderDisplayName = (provider: string): string => {
    const names: Record<string, string> = {
      openai: 'OpenAI',
      anthropic: 'Anthropic',
      google: 'Google'
    };
    return names[provider] || provider;
  };

  const getSpeedBadge = (speed: 'fast' | 'medium' | 'slow') => {
    const colors = {
      fast: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      slow: 'bg-red-100 text-red-800'
    };
    const labels = { fast: '高速', medium: '標準', slow: '低速' };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[speed]}`}>
        {labels[speed]}
      </span>
    );
  };

  const getCostBadge = (cost: 'low' | 'medium' | 'high') => {
    const colors = {
      low: 'bg-blue-100 text-blue-800',
      medium: 'bg-purple-100 text-purple-800',
      high: 'bg-orange-100 text-orange-800'
    };
    const labels = { low: '低コスト', medium: '標準', high: '高コスト' };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[cost]}`}>
        {labels[cost]}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="w-full p-3 bg-gray-100 rounded-lg animate-pulse">
        <div className="h-4 bg-gray-300 rounded w-32"></div>
      </div>
    );
  }

  if (error || !modelsData) {
    return (
      <div className="w-full p-3 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center space-x-2 text-red-600">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error || 'モデル情報の読み込みに失敗しました'}</span>
        </div>
      </div>
    );
  }

  const modelsByProvider = getModelsByProvider();
  const availableProviders = Object.keys(modelsByProvider);

  if (availableProviders.length === 0) {
    return (
      <div className="w-full p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-center space-x-2 text-yellow-600">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">利用可能なAIプロバイダーがありません</span>
        </div>
      </div>
    );
  }

  const selectedModelInfo = Object.values(modelsByProvider)
    .flat()
    .find(model => model.name === selectedModel);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full p-3 bg-white border border-gray-200 rounded-lg text-left flex items-center justify-between transition-colors ${
          disabled ? 'bg-gray-50 cursor-not-allowed' : 'hover:bg-gray-50'
        }`}
      >
        <div className="flex items-center space-x-3">
          {selectedModelInfo?.icon}
          <div>
            <div className="font-medium text-gray-900">
              {selectedModelInfo?.displayName || 'モデルを選択'}
            </div>
            {showProviderInfo && selectedModelInfo && (
              <div className="text-sm text-gray-500">
                {getProviderDisplayName(selectedModelInfo.provider)}
              </div>
            )}
          </div>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 transition-transform ${
            isOpen ? 'transform rotate-180' : ''
          }`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg"
          >
            <div className="max-h-96 overflow-y-auto">
              {availableProviders.map((provider) => (
                <div key={provider} className="border-b border-gray-100 last:border-b-0">
                  <div className="p-3 bg-gray-50 text-sm font-medium text-gray-600 flex items-center space-x-2">
                    {getProviderIcon(provider)}
                    <span>{getProviderDisplayName(provider)}</span>
                  </div>
                  {modelsByProvider[provider].map((model) => (
                    <button
                      key={model.name}
                      onClick={() => {
                        onModelChange(model.name);
                        setIsOpen(false);
                      }}
                      className={`w-full p-3 text-left hover:bg-gray-50 transition-colors ${
                        selectedModel === model.name ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900">{model.displayName}</span>
                            {selectedModel === model.name && (
                              <CheckCircle className="w-4 h-4 text-blue-500" />
                            )}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">{model.description}</div>
                          <div className="flex items-center space-x-2 mt-2">
                            {getSpeedBadge(model.speed)}
                            {getCostBadge(model.cost)}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ModelSelector;