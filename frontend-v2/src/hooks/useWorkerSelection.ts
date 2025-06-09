/**
 * Worker Selection Management Hook
 * Sprint 2 AI-1号機の成果物 - ワーカー選択機能専用カスタムフック
 */

import { useCallback, useEffect } from 'react';
import { useLLMStore } from '../store/llmStore';

/**
 * ワーカーとモデル選択を管理するカスタムフック
 * ワーカー一覧取得、選択、モデル自動読み込みを統合管理
 */
export const useWorkerSelection = () => {
  const {
    workers,
    models,
    selectedWorker,
    selectedModel,
    isLoading,
    error,
    loadWorkers,
    selectWorkerAndLoadModels,
    selectModel,
    checkHealth,
  } = useLLMStore();

  // 初期化処理（ワーカー一覧とヘルスチェック）
  const initialize = useCallback(async () => {
    try {
      await Promise.all([
        loadWorkers(),
        checkHealth(),
      ]);
    } catch (error) {
      console.error('Worker selection initialization failed:', error);
    }
  }, [loadWorkers, checkHealth]);

  // ワーカー選択（モデル自動読み込み付き）
  const selectWorker = useCallback(async (workerType: string) => {
    if (workerType === selectedWorker) return;
    
    try {
      await selectWorkerAndLoadModels(workerType);
    } catch (error) {
      console.error(`Failed to select worker ${workerType}:`, error);
      throw error;
    }
  }, [selectWorkerAndLoadModels, selectedWorker]);

  // モデル選択（バリデーション付き）
  const selectModelSafe = useCallback((modelId: string) => {
    if (!models.includes(modelId)) {
      throw new Error(`Model ${modelId} is not available for worker ${selectedWorker}`);
    }
    selectModel(modelId);
  }, [selectModel, models, selectedWorker]);

  // 利用可能なワーカー情報の取得
  const getWorkerInfo = useCallback(() => {
    return workers.map(worker => ({
      id: worker,
      name: worker,
      isSelected: worker === selectedWorker,
      hasModels: worker === selectedWorker ? models.length > 0 : false,
    }));
  }, [workers, selectedWorker, models.length]);

  // 利用可能なモデル情報の取得
  const getModelInfo = useCallback(() => {
    return models.map(model => ({
      id: model,
      name: model,
      isSelected: model === selectedModel,
      worker: selectedWorker,
    }));
  }, [models, selectedModel, selectedWorker]);

  // 選択状態の検証
  const validateSelection = useCallback((): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!selectedWorker) {
      errors.push('ワーカーが選択されていません');
    }

    if (!selectedModel) {
      if (selectedWorker) {
        errors.push('モデルが選択されていません');
      }
    }

    if (selectedWorker && models.length === 0) {
      warnings.push('選択されたワーカーにモデルがありません');
    }

    if (workers.length === 0) {
      errors.push('利用可能なワーカーがありません');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }, [selectedWorker, selectedModel, models.length, workers.length]);

  // 選択状態のリセット
  const resetSelection = useCallback(async () => {
    if (workers.length > 0) {
      await selectWorker(workers[0]);
    }
  }, [workers, selectWorker]);

  // 次のワーカーを選択
  const selectNextWorker = useCallback(async () => {
    const currentIndex = workers.indexOf(selectedWorker);
    const nextIndex = (currentIndex + 1) % workers.length;
    if (nextIndex !== currentIndex && workers[nextIndex]) {
      await selectWorker(workers[nextIndex]);
    }
  }, [workers, selectedWorker, selectWorker]);

  // 前のワーカーを選択
  const selectPreviousWorker = useCallback(async () => {
    const currentIndex = workers.indexOf(selectedWorker);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : workers.length - 1;
    if (prevIndex !== currentIndex && workers[prevIndex]) {
      await selectWorker(workers[prevIndex]);
    }
  }, [workers, selectedWorker, selectWorker]);

  // 選択状態の要約
  const getSelectionStatus = useCallback(() => {
    const validation = validateSelection();
    
    return {
      hasWorkers: workers.length > 0,
      hasModels: models.length > 0,
      workerSelected: !!selectedWorker,
      modelSelected: !!selectedModel,
      isReady: validation.isValid,
      isLoading,
      error,
      validation,
      counts: {
        workers: workers.length,
        models: models.length,
      },
    };
  }, [
    workers.length,
    models.length,
    selectedWorker,
    selectedModel,
    validateSelection,
    isLoading,
    error,
  ]);

  return {
    // 基本状態
    workers,
    models,
    selectedWorker,
    selectedModel,
    isLoading,
    error,
    
    // アクション
    initialize,
    selectWorker,
    selectModel: selectModelSafe,
    resetSelection,
    selectNextWorker,
    selectPreviousWorker,
    
    // ユーティリティ
    getWorkerInfo,
    getModelInfo,
    validateSelection,
    getSelectionStatus,
    
    // 便利なフラグ
    isReady: !!selectedWorker && !!selectedModel,
    hasWorkers: workers.length > 0,
    hasModels: models.length > 0,
    canSelectModel: !!selectedWorker && models.length > 0,
  };
};

export default useWorkerSelection;