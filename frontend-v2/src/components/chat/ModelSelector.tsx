'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDownIcon, CheckIcon } from '@heroicons/react/24/outline';
import { LLMModel } from '@/src/types/multillm';
import { MultiLLMService } from '@/src/services/multillm.service';

interface ModelSelectorProps {
  selectedModels: string[];
  onModelSelect: (modelIds: string[]) => void;
  multiSelect?: boolean;
  className?: string;
  disabled?: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModels,
  onModelSelect,
  multiSelect = false,
  className = '',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // MultiLLMService から利用可能なモデルを取得
  const availableModels = useMemo(() => {
    return MultiLLMService.getInstance().getAvailableModels();
  }, []);

  // 選択されたモデルの表示用データ
  const selectedModelData = useMemo(() => {
    return availableModels.filter(model => selectedModels.includes(model.id));
  }, [availableModels, selectedModels]);

  // モデル選択処理
  const handleModelSelect = useCallback((modelId: string) => {
    if (disabled) return;

    if (multiSelect) {
      const newSelection = selectedModels.includes(modelId)
        ? selectedModels.filter(id => id !== modelId)
        : [...selectedModels, modelId];
      onModelSelect(newSelection);
    } else {
      onModelSelect([modelId]);
      setIsOpen(false);
    }
  }, [selectedModels, onModelSelect, multiSelect, disabled]);

  // プロバイダー別のアイコン
  const getProviderIcon = (provider: string) => {
    const icons = {
      openai: '🤖',
      anthropic: '🧠',
      google: '🔍',
      meta: '📘',
      cohere: '⭐',
    };
    return icons[provider as keyof typeof icons] || '🤖';
  };

  // 表示用のラベル
  const displayLabel = useMemo(() => {
    if (selectedModelData.length === 0) {
      return 'モデルを選択してください';
    }
    if (selectedModelData.length === 1) {
      return selectedModelData[0].name;
    }
    return `${selectedModelData.length}個のモデルを選択中`;
  }, [selectedModelData]);

  return (
    <div className={`relative ${className}`}>
      {/* セレクターボタン */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between px-4 py-3 bg-gray-800 
          border border-gray-600 rounded-lg text-left transition-colors
          ${disabled 
            ? 'opacity-50 cursor-not-allowed' 
            : 'hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]'
          }
        `}
      >
        <div className="flex items-center space-x-2">
          {selectedModelData.length > 0 && (
            <div className="flex -space-x-1">
              {selectedModelData.slice(0, 3).map((model) => (
                <span
                  key={model.id}
                  className="inline-flex items-center justify-center w-6 h-6 text-xs rounded-full bg-gray-600"
                  title={model.name}
                >
                  {getProviderIcon(model.provider)}
                </span>
              ))}
              {selectedModelData.length > 3 && (
                <span className="inline-flex items-center justify-center w-6 h-6 text-xs rounded-full bg-gray-600">
                  +{selectedModelData.length - 3}
                </span>
              )}
            </div>
          )}
          <span className="text-white">{displayLabel}</span>
        </div>
        <ChevronDownIcon 
          className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* ドロップダウンメニュー */}
      <AnimatePresence>
        {isOpen && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute z-50 w-full mt-2 bg-gray-800 border border-gray-600 rounded-lg shadow-xl max-h-80 overflow-y-auto"
          >
            <div className="py-2">
              {availableModels.map((model) => {
                const isSelected = selectedModels.includes(model.id);
                
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => handleModelSelect(model.id)}
                    className={`
                      w-full px-4 py-3 text-left hover:bg-gray-700 transition-colors
                      ${isSelected ? 'bg-gray-700' : ''}
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">
                          {getProviderIcon(model.provider)}
                        </span>
                        <div>
                          <div className="text-white font-medium">{model.name}</div>
                          <div className="text-sm text-gray-400">{model.description}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            ${model.costPer1kTokens.input.toFixed(4)}/1K input tokens
                          </div>
                        </div>
                      </div>
                      {isSelected && (
                        <CheckIcon className="w-5 h-5 text-[#1ABC9C]" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* オーバーレイ */}
      {isOpen && !disabled && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};