/**
 * Worker Selector Component
 * LLMワーカータイプを選択するためのコンポーネント
 */

import React from 'react';
import { useWorkerSelection } from '../../store/llmStore';

interface WorkerSelectorProps {
  className?: string;
  disabled?: boolean;
}

export const WorkerSelector: React.FC<WorkerSelectorProps> = ({
  className = '',
  disabled = false,
}) => {
  const { workers, selectedWorker, selectWorkerAndLoadModels } = useWorkerSelection();

  const handleWorkerChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const workerType = event.target.value;
    selectWorkerAndLoadModels(workerType);
  };

  const workerDescriptions: { [key: string]: string } = {
    openai: 'OpenAI GPT - 汎用的なAIモデル',
    anthropic: 'Claude - 高品質な推論とコード生成',
    claude: 'Claude - 高品質な推論とコード生成', 
    local_llm: 'Local LLM - ローカル実行モデル',
  };

  return (
    <div className={`worker-selector ${className}`}>
      <label htmlFor="worker-select" className="block text-sm font-medium text-gray-700 mb-2">
        LLMワーカー
      </label>
      <select
        id="worker-select"
        value={selectedWorker}
        onChange={handleWorkerChange}
        disabled={disabled || workers.length === 0}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        {workers.length === 0 ? (
          <option value="">ワーカーを読み込み中...</option>
        ) : (
          <>
            <option value="">ワーカーを選択してください</option>
            {workers.map((worker) => (
              <option key={worker} value={worker}>
                {worker} - {workerDescriptions[worker] || 'AI Language Model'}
              </option>
            ))}
          </>
        )}
      </select>
      
      {selectedWorker && (
        <p className="mt-1 text-xs text-gray-500">
          選択中: {workerDescriptions[selectedWorker] || selectedWorker}
        </p>
      )}
    </div>
  );
};

export default WorkerSelector;