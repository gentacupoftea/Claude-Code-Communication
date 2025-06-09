/**
 * Backend API Client
 * MultiLLM APIとの通信を管理するクライアント
 */

// APIのベースURL（環境変数から取得、デフォルトはローカルホスト）
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// エラーレスポンスの型定義
interface ErrorResponse {
  detail: string;
}

// ワーカー情報の型定義
export interface Worker {
  type: string;
  description: string;
}

// モデル情報の型定義
export interface Model {
  id: string;
  name: string;
}

// 生成レスポンスの型定義
export interface GenerateResponse {
  success: boolean;
  response: string;
  worker_type: string;
  model_id?: string;
}

// ワーカー一覧レスポンスの型定義
interface WorkersResponse {
  workers: string[];
}

// モデル一覧レスポンスの型定義
interface ModelsResponse {
  worker_type: string;
  models: string[];
}

/**
 * APIエラーをハンドリングする共通関数
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData: ErrorResponse = await response.json().catch(() => ({
      detail: `HTTP error! status: ${response.status}`
    }));
    throw new Error(errorData.detail || `API request failed with status ${response.status}`);
  }
  return response.json();
}

/**
 * 利用可能なワーカー一覧を取得する
 * @returns ワーカータイプの配列
 */
export async function fetchWorkers(): Promise<string[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/workers`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const data = await handleResponse<WorkersResponse>(response);
    return data.workers;
  } catch (error) {
    console.error('Failed to fetch workers:', error);
    throw error;
  }
}

/**
 * 特定のワーカーで利用可能なモデル一覧を取得する
 * @param workerType ワーカータイプ（例: 'openai', 'anthropic', 'local_llm'）
 * @returns モデルIDの配列
 */
export async function fetchModels(workerType: string): Promise<string[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/workers/${workerType}/models`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const data = await handleResponse<ModelsResponse>(response);
    return data.models;
  } catch (error) {
    console.error(`Failed to fetch models for worker ${workerType}:`, error);
    throw error;
  }
}

/**
 * LLMを使用してレスポンスを生成する
 * @param prompt ユーザーのプロンプト
 * @param worker 使用するワーカータイプ
 * @param model 使用するモデルID
 * @returns 生成されたレスポンス
 */
export async function generateResponse(
  prompt: string,
  worker: string,
  model: string
): Promise<GenerateResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        worker_type: worker,
        model_id: model,
      }),
    });
    
    return await handleResponse<GenerateResponse>(response);
  } catch (error) {
    console.error('Failed to generate response:', error);
    throw error;
  }
}

/**
 * APIの疎通確認を行う
 * @returns APIが正常に動作しているかどうか
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
    });
    return response.ok;
  } catch (error) {
    console.error('API health check failed:', error);
    return false;
  }
}