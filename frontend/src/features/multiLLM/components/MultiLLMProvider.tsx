import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { WorkerLLMManager } from '../services/WorkerLLMManager';
import { DataSourceService } from '../services/DataSourceService';
import { ToolService } from '../services/ToolService';
import { 
  MultiLLMConfig, 
  LLMRequest, 
  LLMResponse, 
  ChatMessage 
} from '../types';

interface MultiLLMContextValue {
  sendMessage: (message: string) => Promise<void>;
  messages: ChatMessage[];
  responses: LLMResponse[];
  isLoading: boolean;
  error: string | null;
  clearChat: () => void;
  config: MultiLLMConfig;
  updateConfig: (config: Partial<MultiLLMConfig>) => void;
}

const MultiLLMContext = createContext<MultiLLMContextValue | undefined>(undefined);

export function useMultiLLM() {
  const context = useContext(MultiLLMContext);
  if (!context) {
    throw new Error('useMultiLLM must be used within MultiLLMProvider');
  }
  return context;
}

const defaultConfig: MultiLLMConfig = {
  workers: [
    {
      id: 'analyzer-1',
      name: 'データ分析専門AI',
      type: 'analyzer',
      capabilities: ['統計分析', 'トレンド分析', '予測分析'],
      model: 'gpt-4-turbo-preview',
      temperature: 0.2,
      maxTokens: 2000
    },
    {
      id: 'visualizer-1',
      name: 'データ可視化専門AI',
      type: 'visualizer',
      capabilities: ['チャート生成', 'ダッシュボード設計', 'インフォグラフィック'],
      model: 'gpt-4-turbo-preview',
      temperature: 0.3,
      maxTokens: 1500
    },
    {
      id: 'planner-1',
      name: '戦略立案専門AI',
      type: 'planner',
      capabilities: ['事業計画', 'マーケティング戦略', 'リソース最適化'],
      model: 'gpt-4-turbo-preview',
      temperature: 0.4,
      maxTokens: 2500
    },
    {
      id: 'general-1',
      name: '汎用AI',
      type: 'general',
      capabilities: ['一般的な質問応答', '要約', '翻訳'],
      model: 'gpt-4-turbo-preview',
      temperature: 0.5,
      maxTokens: 1000
    }
  ],
  orchestrator: {
    model: 'gpt-4-turbo-preview',
    temperature: 0.1
  },
  maxConcurrentWorkers: 3,
  timeout: 30000
};

export function MultiLLMProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [responses, setResponses] = useState<LLMResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<MultiLLMConfig>(defaultConfig);

  const managerRef = useRef<WorkerLLMManager>();
  const dataServiceRef = useRef<DataSourceService>();
  const toolServiceRef = useRef<ToolService>();

  // サービスの初期化
  if (!managerRef.current) {
    managerRef.current = new WorkerLLMManager(config);
    dataServiceRef.current = new DataSourceService();
    toolServiceRef.current = new ToolService();
  }

  const sendMessage = useCallback(async (message: string) => {
    setIsLoading(true);
    setError(null);

    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);

    try {
      const request: LLMRequest = {
        query: message,
        history: messages,
        tools: toolServiceRef.current!.getAvailableTools()
      };

      const llmResponses = await managerRef.current!.processRequest(request);
      
      setResponses(llmResponses);

      // 統合されたレスポンスをメッセージとして追加
      const mainResponse = llmResponses.find(r => r.workerId === 'aggregated');
      if (mainResponse) {
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: mainResponse.content,
          timestamp: new Date(),
          metadata: {
            responses: llmResponses,
            visualization: mainResponse.visualization,
            thinking: mainResponse.thinking
          }
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setResponses([]);
    setError(null);
  }, []);

  const updateConfig = useCallback((newConfig: Partial<MultiLLMConfig>) => {
    const updatedConfig = { ...config, ...newConfig };
    setConfig(updatedConfig);
    managerRef.current = new WorkerLLMManager(updatedConfig);
  }, [config]);

  const value: MultiLLMContextValue = {
    sendMessage,
    messages,
    responses,
    isLoading,
    error,
    clearChat,
    config,
    updateConfig
  };

  return (
    <MultiLLMContext.Provider value={value}>
      {children}
    </MultiLLMContext.Provider>
  );
}