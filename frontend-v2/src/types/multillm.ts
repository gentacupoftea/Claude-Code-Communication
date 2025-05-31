export interface LLMModel {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'google' | 'meta' | 'cohere';
  model: string;
  description: string;
  capabilities: string[];
  maxTokens: number;
  costPer1kTokens: {
    input: number;
    output: number;
  };
  isAvailable: boolean;
  icon?: string;
}

export interface LLMResponse {
  id: string;
  model: string;
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: Record<string, any>;
}

export interface MultiLLMRequest {
  prompt: string;
  models: string[];
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  streamResponse?: boolean;
}

export interface ModelComparison {
  prompt: string;
  responses: {
    model: string;
    response: LLMResponse;
    responseTime: number;
    error?: string;
  }[];
  timestamp: string;
}