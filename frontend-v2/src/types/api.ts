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
}

/**
 * POST /api/v1/chat/completions のレスポンスボディ
 */
export interface ChatCompletionResponse {
  role: 'assistant';
  content: string;
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