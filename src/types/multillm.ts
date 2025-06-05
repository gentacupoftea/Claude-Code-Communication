// Multi-LLM機能のタイプ定義

export interface LLMProvider {
  id: string;
  name: string;
  displayName: string;
  description: string;
  models: LLMModel[];
  isEnabled: boolean;
  requiresApiKey: boolean;
  maxTokens: number;
  supportedFeatures: LLMFeature[];
  pricing: {
    inputTokenPrice: number;
    outputTokenPrice: number;
    currency: string;
  };
  status: 'available' | 'unavailable' | 'rate_limited' | 'error';
  lastHealthCheck: Date;
}

export interface LLMModel {
  id: string;
  name: string;
  displayName: string;
  provider: string;
  model?: string; // 古いmultillm.tsから移行
  contextLength: number;
  maxOutputTokens: number;
  maxTokens?: number; // 古いmultillm.tsから移行（互換性のため）
  isMultimodal: boolean;
  supportedLanguages: string[];
  strengths: string[];
  useCase: string[];
  capabilities?: string[]; // 古いmultillm.tsから移行
  pricing: {
    inputTokenPrice: number;
    outputTokenPrice: number;
  };
  costPer1kTokens?: { // 古いmultillm.tsから移行（互換性のため）
    input: number;
    output: number;
  };
  isEnabled: boolean;
  isAvailable?: boolean; // 古いmultillm.tsから移行
  description?: string;
  icon?: string; // 古いmultillm.tsから移行
}

export interface LLMFeature {
  id: string;
  name: string;
  description: string;
  supported: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  model?: string;
  provider?: string;
  metadata?: {
    tokenCount?: number;
    responseTime?: number;
    cost?: number;
    temperature?: number;
    maxTokens?: number;
  };
  attachments?: MessageAttachment[];
  isEdited?: boolean;
  editHistory?: string[];
}

export interface MessageAttachment {
  id: string;
  type: 'image' | 'document' | 'code' | 'url';
  name: string;
  url?: string;
  content?: string;
  mimeType?: string;
  size?: number;
}

export interface ChatSession {
  id: string;
  title: string;
  description?: string;
  messages: ChatMessage[];
  participants: ChatParticipant[];
  settings: SessionSettings;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  isActive: boolean;
  metadata: {
    totalMessages: number;
    totalTokens: number;
    totalCost: number;
    averageResponseTime: number;
  };
}

export interface ChatParticipant {
  id: string;
  type: 'human' | 'ai';
  name: string;
  model?: string;
  provider?: string;
  systemPrompt?: string;
  isActive: boolean;
  settings: {
    temperature: number;
    maxTokens: number;
    topP: number;
    frequencyPenalty: number;
    presencePenalty: number;
  };
}

export interface SessionSettings {
  allowMultipleModels: boolean;
  autoSwitchModel: boolean;
  compareResponses: boolean;
  saveHistory: boolean;
  enableSearch: boolean;
  maxHistoryLength: number;
  defaultModel: string;
  defaultProvider: string;
  systemPrompt?: string;
}

export interface ModelComparison {
  id?: string; // 新しい定義を優先
  prompt: string;
  responses: {
    model: string;
    provider?: string; // 新しい定義から
    response?: LLMResponse | string; // 古い定義との互換性
    content?: string; // 新しい定義との互換性
    responseTime: number;
    error?: string;
    metadata?: { // 新しい定義から
      tokenCount: number;
      cost: number;
      quality?: number;
      relevance?: number;
      creativity?: number;
      confidence?: number;
    };
  }[];
  analysis?: { // 新しい定義から
    winner?: string;
    scores: { [modelId: string]: number };
    reasoning: string;
    criteria: string[];
  };
  timestamp: string | Date; // 両方の形式をサポート
}

export interface LLMUsageStats {
  provider: string;
  model: string;
  period: 'day' | 'week' | 'month' | 'year';
  data: {
    requests: number;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    averageResponseTime: number;
    errorRate: number;
    successRate: number;
  };
  timestamp: Date;
}

export interface ModelPerformanceMetrics {
  model: string;
  provider: string;
  metrics: {
    averageResponseTime: number;
    successRate: number;
    errorRate: number;
    averageTokensPerResponse: number;
    costEfficiency: number;
    userSatisfaction: number;
  };
  benchmarks: {
    coding: number;
    reasoning: number;
    creativity: number;
    factualAccuracy: number;
    conversational: number;
  };
  lastUpdated: Date;
}

export interface StreamingResponse {
  id: string;
  delta: string;
  isComplete: boolean;
  metadata?: {
    model: string;
    provider: string;
    timestamp: Date;
  };
}

export interface MultiLLMRequest {
  prompt: string;
  models: string[];
  temperature?: number; // 古いmultillm.tsから
  maxTokens?: number; // 古いmultillm.tsから
  systemPrompt?: string;
  streamResponse?: boolean; // 古いmultillm.tsから
  settings?: { // 新しい定義から
    temperature: number;
    maxTokens: number;
    stream: boolean;
    compareResponses: boolean;
  };
  context?: ChatMessage[];
  attachments?: MessageAttachment[];
}

export interface MultiLLMResponse {
  requestId: string;
  responses: {
    model: string;
    provider: string;
    content: string;
    metadata: {
      responseTime: number;
      tokenCount: number;
      cost: number;
      confidence?: number;
    };
    error?: string;
  }[];
  comparison?: ModelComparison;
  totalCost: number;
  totalResponseTime: number;
}

// 古いmultillm.tsから移行（互換性のため保持）
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