/**
 * MultiLLM new type definitions
 */

export interface ModelComparison {
  id: string;
  models: string[];
  prompt: string;
  responses: MultiLLMResponse[];
  metrics: ComparisonMetrics;
  timestamp: Date;
}

export interface MultiLLMResponse {
  model: string;
  response: {
    content: string;
    tokens?: number;
    time?: number;
  };
  error?: string;
  performance?: {
    latency: number;
    tokens: number;
    cost?: number;
  };
}

export interface ComparisonMetrics {
  averageLatency: number;
  totalTokens: number;
  totalCost: number;
  qualityScore?: number;
}

export interface ModelConfig {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  systemPrompt?: string;
}

export interface ModelCapabilities {
  contextWindow: number;
  supportedLanguages: string[];
  supportedFormats: string[];
  features: {
    streaming: boolean;
    functionCalling: boolean;
    visionInput: boolean;
    audioInput: boolean;
    codeExecution: boolean;
  };
}

export interface ModelPricing {
  inputTokens: number;  // per 1k tokens
  outputTokens: number; // per 1k tokens
  currency: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description?: string;
  template: string;
  variables: string[];
  category?: string;
  tags?: string[];
}

export interface BatchRequest {
  id: string;
  prompts: string[];
  models: string[];
  config?: ModelConfig;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  results?: MultiLLMResponse[][];
  error?: string;
}

export interface StreamingResponse {
  model: string;
  chunk: string;
  finished: boolean;
  error?: string;
}