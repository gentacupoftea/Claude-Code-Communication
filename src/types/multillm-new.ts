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
  contextLength: number;
  maxOutputTokens: number;
  isMultimodal: boolean;
  supportedLanguages: string[];
  strengths: string[];
  useCase: string[];
  pricing: {
    inputTokenPrice: number;
    outputTokenPrice: number;
  };
  isEnabled: boolean;
  description?: string;
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
  id: string;
  prompt: string;
  responses: {
    model: string;
    provider: string;
    response: string;
    metadata: {
      responseTime: number;
      tokenCount: number;
      cost: number;
      quality?: number;
      relevance?: number;
      creativity?: number;
    };
  }[];
  analysis: {
    winner?: string;
    scores: { [modelId: string]: number };
    reasoning: string;
    criteria: string[];
  };
  timestamp: Date;
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
  settings: {
    temperature: number;
    maxTokens: number;
    stream: boolean;
    compareResponses: boolean;
  };
  context?: ChatMessage[];
  attachments?: MessageAttachment[];
  systemPrompt?: string;
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