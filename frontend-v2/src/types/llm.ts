/**
 * LLM Types - Sprint 1 AI-5号機の成果物
 * MultiLLM システムで使用される型定義
 */

// 基本的なLLMプロバイダー定義
export type LLMProvider = 'openai' | 'anthropic' | 'claude' | 'local_llm' | 'google' | 'meta' | 'cohere';

// ワーカータイプ（実際のAPI実装に基づく）
export type WorkerType = 'openai' | 'anthropic' | 'claude' | 'local_llm';

// LLMモデル情報
export interface LLMModel {
  id: string;
  name: string;
  provider: LLMProvider;
  worker_type: WorkerType;
  description: string;
  capabilities: LLMCapability[];
  maxTokens: number;
  costPer1kTokens?: {
    input: number;
    output: number;
  };
  isAvailable: boolean;
  icon?: string;
  version?: string;
}

// LLMの能力タイプ
export type LLMCapability = 
  | 'text_generation'
  | 'code_generation'
  | 'analysis'
  | 'translation'
  | 'summarization'
  | 'question_answering'
  | 'creative_writing'
  | 'reasoning'
  | 'math'
  | 'image_understanding'
  | 'function_calling';

// チャットメッセージ役割
export type MessageRole = 'user' | 'assistant' | 'system';

// チャットメッセージ
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  worker?: WorkerType;
  model?: string;
  metadata?: MessageMetadata;
}

// メッセージメタデータ
export interface MessageMetadata {
  usage?: TokenUsage;
  responseTime?: number;
  error?: string;
  context?: Record<string, any>;
}

// トークン使用量
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// LLMレスポンス
export interface LLMResponse {
  id: string;
  model: string;
  worker_type: WorkerType;
  content: string;
  success: boolean;
  usage?: TokenUsage;
  responseTime?: number;
  metadata?: Record<string, any>;
  error?: string;
}

// MultiLLMリクエスト
export interface MultiLLMRequest {
  prompt: string;
  worker_type: WorkerType;
  model_id?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  streamResponse?: boolean;
  context?: ChatContext;
}

// チャットコンテキスト
export interface ChatContext {
  conversationId?: string;
  previousMessages?: ChatMessage[];
  userPreferences?: UserPreferences;
  sessionData?: Record<string, any>;
}

// ユーザー設定
export interface UserPreferences {
  defaultWorker?: WorkerType;
  defaultModel?: string;
  temperature?: number;
  maxTokens?: number;
  streamingEnabled?: boolean;
  language?: 'ja' | 'en';
}

// ワーカー情報
export interface WorkerInfo {
  type: WorkerType;
  description: string;
  isAvailable: boolean;
  models: string[];
  status: WorkerStatus;
  lastHealthCheck?: Date;
  capabilities: LLMCapability[];
}

// ワーカーステータス
export type WorkerStatus = 'online' | 'offline' | 'error' | 'maintenance';

// モデル比較結果
export interface ModelComparison {
  prompt: string;
  responses: ModelComparisonResult[];
  timestamp: Date;
  totalResponseTime: number;
}

// モデル比較の個別結果
export interface ModelComparisonResult {
  worker_type: WorkerType;
  model: string;
  response: LLMResponse;
  responseTime: number;
  success: boolean;
  error?: string;
  score?: number;
}

// ストリーミングチャンク
export interface StreamingChunk {
  id: string;
  content: string;
  isComplete: boolean;
  metadata?: Record<string, any>;
}

// API設定
export interface APIConfiguration {
  baseURL: string;
  timeout: number;
  retryAttempts: number;
  enableStreaming: boolean;
  enableHealthCheck: boolean;
  healthCheckInterval: number;
}

// エラー情報
export interface LLMError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
  worker_type?: WorkerType;
  model?: string;
}

// セッション情報
export interface ChatSession {
  id: string;
  userId?: string;
  startTime: Date;
  lastActivity: Date;
  messages: ChatMessage[];
  configuration: UserPreferences;
  totalTokensUsed: number;
  totalCost?: number;
}

// 統計情報
export interface UsageStatistics {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  averageResponseTime: number;
  successRate: number;
  workerUsage: Record<WorkerType, number>;
  modelUsage: Record<string, number>;
  timeRange: {
    start: Date;
    end: Date;
  };
}

// 型ガード関数
export function isLLMResponse(obj: any): obj is LLMResponse {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.content === 'string' &&
    typeof obj.success === 'boolean'
  );
}

export function isChatMessage(obj: any): obj is ChatMessage {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.role === 'string' &&
    typeof obj.content === 'string' &&
    obj.timestamp instanceof Date
  );
}

export function isWorkerType(value: string): value is WorkerType {
  return ['openai', 'anthropic', 'claude', 'local_llm'].includes(value);
}

// デフォルト値
export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  temperature: 0.7,
  maxTokens: 2000,
  streamingEnabled: true,
  language: 'ja',
};

export const DEFAULT_API_CONFIGURATION: APIConfiguration = {
  baseURL: 'http://localhost:8000',
  timeout: 30000,
  retryAttempts: 3,
  enableStreaming: true,
  enableHealthCheck: true,
  healthCheckInterval: 30000,
};