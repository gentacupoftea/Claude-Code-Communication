/**
 * LLM State Management Store
 * Zustand を使用したMultiLLM APIの状態管理
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { fetchWorkers, fetchModels, generateResponse, checkApiHealth } from '../lib/backendApi';
import { apiClient } from '../lib/apiClient';
import { ThinkingStep, ChatCompletionRequest } from '../types/api';

// チャットメッセージの型定義
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  worker?: string;
  model?: string;
}

// ストアの状態型定義
interface LLMStore {
  // 状態
  workers: string[];
  models: string[];
  selectedWorker: string;
  selectedModel: string;
  isLoading: boolean;
  isGenerating: boolean;
  chatHistory: ChatMessage[];
  apiHealthy: boolean;
  error: string | null;
  
  // 思考ストリーム関連の状態
  thinkingSteps: ThinkingStep[];
  isThinking: boolean;

  // アクション
  loadWorkers: () => Promise<void>;
  selectWorkerAndLoadModels: (worker: string) => Promise<void>;
  selectModel: (model: string) => void;
  sendMessage: (message: string) => Promise<void>;
  clearChatHistory: () => void;
  checkHealth: () => Promise<void>;
  clearError: () => void;
  
  // 思考ストリーム関連のアクション
  addThinkingStep: (step: ThinkingStep) => void;
  clearThinkingSteps: () => void;
  startThinking: () => void;
  stopThinking: () => void;
  sendMessageWithStream: (message: string) => Promise<void>;
}

// Zustandストアの作成
export const useLLMStore = create<LLMStore>()(
  devtools(
    (set, get) => ({
      // 初期状態
      workers: [],
      models: [],
      selectedWorker: '',
      selectedModel: '',
      isLoading: false,
      isGenerating: false,
      chatHistory: [],
      apiHealthy: false,
      error: null,
      
      // 思考ストリーム関連の初期状態
      thinkingSteps: [],
      isThinking: false,

      // ワーカー一覧を読み込む
      loadWorkers: async () => {
        try {
          set({ isLoading: true, error: null });
          const workers = await fetchWorkers();
          set({ 
            workers,
            selectedWorker: workers.length > 0 ? workers[0] : '',
            isLoading: false 
          });

          // 最初のワーカーが選択されている場合、そのモデルを自動読み込み
          if (workers.length > 0) {
            await get().selectWorkerAndLoadModels(workers[0]);
          }
        } catch (error) {
          console.error('Failed to load workers:', error);
          set({ 
            error: error instanceof Error ? error.message : 'ワーカーの読み込みに失敗しました',
            isLoading: false 
          });
        }
      },

      // ワーカーを選択してモデル一覧を読み込む
      selectWorkerAndLoadModels: async (worker: string) => {
        try {
          set({ isLoading: true, error: null, selectedWorker: worker });
          const models = await fetchModels(worker);
          set({ 
            models,
            selectedModel: models.length > 0 ? models[0] : '',
            isLoading: false 
          });
        } catch (error) {
          console.error(`Failed to load models for worker ${worker}:`, error);
          set({ 
            error: error instanceof Error ? error.message : 'モデルの読み込みに失敗しました',
            isLoading: false 
          });
        }
      },

      // モデルを選択
      selectModel: (model: string) => {
        set({ selectedModel: model });
      },

      // メッセージを送信してレスポンスを取得
      sendMessage: async (message: string) => {
        const { selectedWorker, selectedModel, chatHistory } = get();
        
        if (!selectedWorker || !selectedModel) {
          set({ error: 'ワーカーとモデルを選択してください' });
          return;
        }

        try {
          set({ isGenerating: true, error: null });

          // ユーザーメッセージをチャット履歴に追加
          const userMessage: ChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: message,
            timestamp: new Date(),
          };

          set({ 
            chatHistory: [...chatHistory, userMessage] 
          });

          // API呼び出し
          const response = await generateResponse(message, selectedWorker, selectedModel);

          // アシスタントメッセージをチャット履歴に追加
          const assistantMessage: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: response.response,
            timestamp: new Date(),
            worker: selectedWorker,
            model: selectedModel,
          };

          set({ 
            chatHistory: [...get().chatHistory, assistantMessage],
            isGenerating: false 
          });
        } catch (error) {
          console.error('Failed to send message:', error);
          set({ 
            error: error instanceof Error ? error.message : 'メッセージの送信に失敗しました',
            isGenerating: false 
          });
        }
      },

      // チャット履歴をクリア
      clearChatHistory: () => {
        set({ chatHistory: [] });
      },

      // APIヘルスチェック
      checkHealth: async () => {
        try {
          const healthy = await checkApiHealth();
          set({ apiHealthy: healthy });
        } catch (error) {
          console.error('Health check failed:', error);
          set({ apiHealthy: false });
        }
      },

      // エラーをクリア
      clearError: () => {
        set({ error: null });
      },

      // 思考ストリーム関連のアクション実装
      addThinkingStep: (step: ThinkingStep) => {
        const { thinkingSteps } = get();
        set({ thinkingSteps: [...thinkingSteps, step] });
      },

      clearThinkingSteps: () => {
        set({ thinkingSteps: [] });
      },

      startThinking: () => {
        set({ isThinking: true });
      },

      stopThinking: () => {
        set({ isThinking: false });
      },

      // ストリーミング対応のメッセージ送信
      sendMessageWithStream: async (message: string) => {
        const { selectedWorker, selectedModel, chatHistory } = get();
        
        if (!selectedWorker || !selectedModel) {
          set({ error: 'ワーカーとモデルを選択してください' });
          return;
        }

        try {
          set({ isGenerating: true, error: null });
          get().clearThinkingSteps();
          get().startThinking();

          // ユーザーメッセージをチャット履歴に追加
          const userMessage: ChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: message,
            timestamp: new Date(),
          };

          set({ 
            chatHistory: [...chatHistory, userMessage] 
          });

          // ストリーミングリクエストの準備
          const request: ChatCompletionRequest = {
            messages: [
              { role: 'user', content: message }
            ],
            model: selectedModel,
            worker_type: selectedWorker,
            stream: true,
          };

          let finalResponse = '';

          // ストリームからThinkingStepを受信
          for await (const thinkingStep of apiClient.chatStream(request)) {
            get().addThinkingStep(thinkingStep);
            
            // 最終的な応答を抽出
            if (thinkingStep.type === 'response') {
              finalResponse = thinkingStep.content;
            }
          }

          // アシスタントメッセージをチャット履歴に追加
          const assistantMessage: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: finalResponse || '応答を取得できませんでした',
            timestamp: new Date(),
            worker: selectedWorker,
            model: selectedModel,
          };

          set({ 
            chatHistory: [...get().chatHistory, assistantMessage],
            isGenerating: false 
          });

          get().stopThinking();
        } catch (error) {
          console.error('Failed to send message with stream:', error);
          set({ 
            error: error instanceof Error ? error.message : 'ストリーミングメッセージの送信に失敗しました',
            isGenerating: false 
          });
          get().stopThinking();
        }
      },
    }),
    {
      name: 'llm-store',
    }
  )
);

// ストアのセレクター（パフォーマンス最適化用）
export const selectWorkers = (state: LLMStore) => state.workers;
export const selectModels = (state: LLMStore) => state.models;
export const selectSelectedWorker = (state: LLMStore) => state.selectedWorker;
export const selectSelectedModel = (state: LLMStore) => state.selectedModel;
export const selectIsLoading = (state: LLMStore) => state.isLoading;
export const selectIsGenerating = (state: LLMStore) => state.isGenerating;
export const selectChatHistory = (state: LLMStore) => state.chatHistory;
export const selectApiHealthy = (state: LLMStore) => state.apiHealthy;
export const selectError = (state: LLMStore) => state.error;

// カスタムフック（便利な組み合わせ用）
export const useWorkerSelection = () => {
  const workers = useLLMStore(selectWorkers);
  const selectedWorker = useLLMStore(selectSelectedWorker);
  const loadWorkers = useLLMStore((state) => state.loadWorkers);
  const selectWorkerAndLoadModels = useLLMStore((state) => state.selectWorkerAndLoadModels);
  
  return {
    workers,
    selectedWorker,
    loadWorkers,
    selectWorkerAndLoadModels,
  };
};

export const useModelSelection = () => {
  const models = useLLMStore(selectModels);
  const selectedModel = useLLMStore(selectSelectedModel);
  const selectModel = useLLMStore((state) => state.selectModel);
  
  return {
    models,
    selectedModel,
    selectModel,
  };
};

export const useChat = () => {
  const chatHistory = useLLMStore(selectChatHistory);
  const isGenerating = useLLMStore(selectIsGenerating);
  const sendMessage = useLLMStore((state) => state.sendMessage);
  const clearChatHistory = useLLMStore((state) => state.clearChatHistory);
  
  return {
    chatHistory,
    isGenerating,
    sendMessage,
    clearChatHistory,
  };
};