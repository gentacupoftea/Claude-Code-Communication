'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, Sparkles, Zap, Brain, Globe, Users } from 'lucide-react';
import { LLMModel } from '@/src/types/multillm';
import { multiLLMService } from '@/src/services/multillm.service';

interface ModelSelectorProps {
  selectedModels: string[];
  onModelChange: (models: string[]) => void;
  multiSelect?: boolean;
}

const providerIcons: Record<string, React.ReactNode> = {
  openai: <Sparkles className="w-4 h-4" />,
  anthropic: <Brain className="w-4 h-4" />,
  google: <Globe className="w-4 h-4" />,
  meta: <Users className="w-4 h-4" />,
  cohere: <Zap className="w-4 h-4" />,
};

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModels,
  onModelChange,
  multiSelect = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const models = multiLLMService.getAvailableModels();

  const handleModelSelect = (modelId: string) => {
    if (multiSelect) {
      if (selectedModels.includes(modelId)) {
        onModelChange(selectedModels.filter(id => id !== modelId));
      } else {
        onModelChange([...selectedModels, modelId]);
      }
    } else {
      onModelChange([modelId]);
      setIsOpen(false);
    }
  };

  const selectedModelNames = selectedModels
    .map(id => models.find(m => m.id === id)?.name)
    .filter(Boolean)
    .join(', ');

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-4 py-2
                   bg-white/5 border border-white/10 rounded-lg
                   hover:bg-white/10 transition-colors"
      >
        <div className="flex items-center space-x-2">
          {selectedModels.length > 0 ? (
            <>
              {providerIcons[models.find(m => m.id === selectedModels[0])?.provider || 'openai']}
              <span className="text-sm">
                {selectedModelNames || 'モデルを選択'}
              </span>
            </>
          ) : (
            <span className="text-sm text-gray-400">モデルを選択</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute z-50 w-full mt-2 bg-gray-800 border border-white/10 rounded-lg shadow-xl overflow-hidden"
            >
              <div className="max-h-96 overflow-y-auto">
                {models.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => handleModelSelect(model.id)}
                    disabled={!model.isAvailable}
                    className={`
                      w-full px-4 py-3 flex items-start space-x-3
                      hover:bg-white/5 transition-colors text-left
                      ${!model.isAvailable ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    <div className="mt-0.5">
                      {providerIcons[model.provider]}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm">{model.name}</h4>
                        {selectedModels.includes(model.id) && (
                          <Check className="w-4 h-4 text-[#1ABC9C]" />
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {model.description}
                      </p>
                      <div className="flex items-center space-x-3 mt-1">
                        <span className="text-xs text-gray-500">
                          最大トークン: {model.maxTokens.toLocaleString()}
                        </span>
                        <span className="text-xs text-gray-500">
                          ${model.costPer1kTokens.input}/1K入力
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {multiSelect && (
                <div className="border-t border-white/10 p-3">
                  <p className="text-xs text-gray-400 text-center">
                    複数のモデルを選択して比較できます
                  </p>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};