// MultiLLM サービスのモックアップ実装

import { LLMResponse, MultiLLMRequest, ChatMessage } from '@/src/types/multillm';
import { API_ENDPOINTS, createApiUrl } from '@/src/lib/api-config';

export interface MultiLLMServiceConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
}

export class MultiLLMService {
  private config: MultiLLMServiceConfig;
  private abortController: AbortController | null = null;

  constructor(config: MultiLLMServiceConfig = {}) {
    this.config = {
      // Next.jsのプロキシを使うため、baseUrlは空にする
      baseUrl: '',
      timeout: 30000,
      ...config,
    };
  }

  async getAvailableModels(): Promise<any[]> {
    try {
      const response = await fetch(`${this.config.baseUrl}${API_ENDPOINTS.MULTILLM.MODELS}`);
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('[MultiLLM Service] Failed to fetch models:', error);
      // エラー時は空の配列を返す
      return [];
    }
  }

  async chat(request: MultiLLMRequest): Promise<LLMResponse> {
    try {
      // 既存のリクエストをキャンセル
      this.cancelRequest();
      
      // 新しいAbortControllerを作成
      this.abortController = new AbortController();

      const response = await fetch(`${this.config.baseUrl}${API_ENDPOINTS.CHAT.SEND}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
        },
        body: JSON.stringify(request),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data as LLMResponse;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request was cancelled');
      }
      
      // モックレスポンスを返す（開発用）
      console.warn('API call failed, returning mock response:', error);
      return this.getMockResponse(request);
    }
  }

  async streamChat(
    request: MultiLLMRequest,
    onChunk: (chunk: string) => void,
    onComplete?: () => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    try {
      // 既存のリクエストをキャンセル
      this.cancelRequest();
      
      // 新しいAbortControllerを作成
      this.abortController = new AbortController();

      const response = await fetch(`${this.config.baseUrl}${API_ENDPOINTS.CHAT.STREAM}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
        },
        body: JSON.stringify({ ...request, stream: true }),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        const chunk = decoder.decode(value, { stream: true });
        onChunk(chunk);
      }
      
      onComplete?.();
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          onError?.(new Error('Request was cancelled'));
        } else {
          onError?.(error);
        }
      }
      
      // モックストリームレスポンス（開発用）
      console.warn('Stream API call failed, using mock stream:', error);
      this.mockStreamResponse(request, onChunk, onComplete);
    }
  }

  cancelRequest(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private getMockResponse(request: MultiLLMRequest): LLMResponse {
    const lastMessage = request.messages[request.messages.length - 1];
    
    return {
      id: 'mock-' + Date.now(),
      model: request.model || 'gpt-3.5-turbo',
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
      message: {
        role: 'assistant',
        content: `これはモックレスポンスです。実際のAPIに接続されていません。\n\nあなたのメッセージ: "${lastMessage.content}"\n\n実際の実装では、ここでAI応答が返されます。`,
      },
      finishReason: 'stop',
      error: null,
    };
  }

  private async mockStreamResponse(
    request: MultiLLMRequest,
    onChunk: (chunk: string) => void,
    onComplete?: () => void
  ): Promise<void> {
    const mockMessage = 'これはモックストリームレスポンスです。実際のAPIに接続されていません。';
    const words = mockMessage.split('');
    
    for (const word of words) {
      await new Promise(resolve => setTimeout(resolve, 50));
      onChunk(word);
    }
    
    onComplete?.();
  }

  // ヘルパーメソッド
  formatMessages(messages: ChatMessage[]): MultiLLMRequest {
    return {
      messages,
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 1000,
      stream: false,
    };
  }

  updateConfig(config: Partial<MultiLLMServiceConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// デフォルトインスタンスをエクスポート
export const multiLLMService = new MultiLLMService();