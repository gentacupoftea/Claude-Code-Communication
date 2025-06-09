/**
 * Model Selector Component
 * 選択されたワーカーの利用可能なモデルを選択するためのコンポーネント
 */

import React from 'react';
import { useModelSelection, useLLMStore } from '../../store/llmStore';

interface ModelSelectorProps {
  className?: string;
  disabled?: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  className = '',
  disabled = false,
}) => {
  const { models, selectedModel, selectModel } = useModelSelection();
  const selectedWorker = useLLMStore((state) => state.selectedWorker);
  const isLoading = useLLMStore((state) => state.isLoading);

  const handleModelChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const modelId = event.target.value;
    selectModel(modelId);
  };

  const modelDescriptions: { [key: string]: string } = {
    'gpt-4-turbo-preview': 'GPT-4 Turbo - 最新の高性能モデル',
    'gpt-4-turbo': 'GPT-4 Turbo - 高性能汎用モデル',
    'gpt-4': 'GPT-4 - 標準的な高性能モデル',
    'gpt-3.5-turbo': 'GPT-3.5 Turbo - 高速でコスト効率的',
    'claude-3-opus-20240229': 'Claude 3 Opus - 最高性能モデル',
    'claude-3-sonnet-20240229': 'Claude 3 Sonnet - バランス型モデル',
    'claude-3-haiku-20240307': 'Claude 3 Haiku - 高速軽量モデル',
    'llama3': 'Llama 3 - オープンソース汎用モデル',
    'codellama': 'Code Llama - コード特化モデル',
    'mistral': 'Mistral - 効率的な汎用モデル',
  };

  const isDisabled = disabled || !selectedWorker || isLoading;

  return (
    <div className={`model-selector ${className}`}>
      <label htmlFor="model-select" className="block text-sm font-medium text-gray-700 mb-2">
        AIモデル
      </label>
      <select
        id="model-select"
        value={selectedModel}
        onChange={handleModelChange}
        disabled={isDisabled}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        {!selectedWorker ? (
          <option value="">まずワーカーを選択してください</option>
        ) : isLoading ? (
          <option value="">モデルを読み込み中...</option>
        ) : models.length === 0 ? (
          <option value="">利用可能なモデルがありません</option>
        ) : (
          <>
            <option value="">モデルを選択してください</option>
            {models.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </>
        )}
      </select>
      
      {selectedModel && (
        <p className="mt-1 text-xs text-gray-500">
          {modelDescriptions[selectedModel] || `選択中: ${selectedModel}`}
        </p>
      )}
      
      {selectedWorker && !isLoading && models.length === 0 && (
        <p className="mt-1 text-xs text-red-500">
          {selectedWorker}ワーカーのモデルを読み込めませんでした
        </p>
      )}
    </div>
  );
};

export default ModelSelector;