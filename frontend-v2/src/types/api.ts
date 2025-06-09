/**
 * API Types Definition
 * フロントエンドAPIクライアント用の型定義
 */

/**
 * POST /api/v1/chat/completions のリクエストボディ
 */
export interface ChatCompletionRequest {
  messages: {
    role: 'user' | 'assistant';
    content: string;
  }[];
  model: string; // 例: 'claude-3-opus'
  worker_type?: string; // 例: 'anthropic', 'openai', 'local_llm'
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

/**
 * POST /api/v1/chat/completions のレスポンスボディ
 */
export interface ChatCompletionResponse {
  response: string;
  worker_type?: string;
  model_id?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  finish_reason?: string;
}

/**
 * API エラーレスポンス
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    error_code: string;
    message: string;
    type: string;
    details?: Record<string, any>;
  };
  timestamp: string;
}

/**
 * API 成功レスポンスの基本型
 */
export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
}

/**
 * 共通のAPIレスポンス型
 */
export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * ローカルLLMプロバイダ情報
 */
export interface LocalLLMProvider {
  name: string;
  type: 'ollama' | 'deepseek';
  api_base: string;
  status: 'healthy' | 'unhealthy';
}

/**
 * プロバイダ追加リクエスト
 */
export interface AddProviderRequest {
  name: string;
  provider_type: 'ollama' | 'deepseek';
  api_base: string;
  api_key?: string; // Deepseek用
  timeout?: number;
}

/**
 * プロバイダ一覧レスポンス
 */
export interface ProvidersResponse {
  success: boolean;
  providers: LocalLLMProvider[];
}

/**
 * ヘルスチェックレスポンス
 */
export interface HealthCheckResponse {
  success: boolean;
  health_status: Record<string, boolean>;
}

/**
 * AIの思考ステップ（思考ストリーム用）
 */
export interface ThinkingStep {
  id: string;
  type: 'thinking' | 'analysis' | 'task_planning' | 'tool_use' | 'response' | 'error' | 'complete';
  content: string;
  metadata?: {
    tool?: string;
    duration?: number;
    progress?: number;
    [key: string]: any;
  };
  timestamp: string;
}

/**
 * 思考ストリームのレスポンス（Server-Sent Events）
 */
export interface ThinkingStreamEvent {
  type: 'start' | 'step' | 'end' | 'error';
  data?: ThinkingStep;
  error?: string;
}