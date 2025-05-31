/**
 * MultiLLM API 連携設定
 */

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

export interface ChatResponse {
  message: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface AgentConfig {
  name: string;
  description: string;
  model: string;
  temperature: number;
  max_tokens: number;
  system_prompt: string;
  language: string;
  response_style: string;
  response_length: number;
  timeout: number;
  max_history: number;
}

class MultiLLMAPI {
  private baseURL: string;
  private apiKey: string;

  constructor() {
    // 環境変数から設定を取得
    this.baseURL = process.env.NEXT_PUBLIC_MULTILLM_API_URL || 'http://localhost:8000';
    this.apiKey = process.env.NEXT_PUBLIC_MULTILLM_API_KEY || 'demo_key_please_replace';
  }

  /**
   * チャットメッセージを送信
   */
  async sendMessage(
    messages: ChatMessage[],
    agentConfig: Partial<AgentConfig> = {},
    files?: File[]
  ): Promise<ChatResponse> {
    try {
      console.log('[MultiLLM API] Using baseURL:', this.baseURL);
      console.log('[MultiLLM API] Sending message:', { messages, agentConfig });

      // ファイルがある場合はFormDataを使用
      if (files && files.length > 0) {
        const formData = new FormData();
        
        // メッセージデータを追加
        formData.append('messages', JSON.stringify(messages.map(msg => ({
          role: msg.role,
          content: msg.content
        }))));
        formData.append('model', agentConfig.model || 'gpt-3.5-turbo');
        formData.append('temperature', String(agentConfig.temperature || 0.7));
        formData.append('max_tokens', String(agentConfig.max_tokens || 1000));
        formData.append('system_prompt', agentConfig.system_prompt || 'あなたは親切で知識豊富なAIアシスタントです。');
        
        // ファイルを追加
        files.forEach((file, index) => {
          formData.append(`file_${index}`, file);
        });

        const response = await fetch(`${this.baseURL}/api/chat/with-files`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[MultiLLM API] Error response:', errorText);
          throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('[MultiLLM API] Response received:', data);

        return {
          message: data.message || data.choices?.[0]?.message?.content || 'レスポンスを取得できませんでした。',
          model: data.model || 'unknown',
          usage: data.usage
        };
      }

      // ファイルがない場合は通常のJSONリクエスト
      const requestBody = {
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        model: agentConfig.model || 'gpt-3.5-turbo',
        temperature: agentConfig.temperature || 0.7,
        max_tokens: agentConfig.max_tokens || 1000,
        system_prompt: agentConfig.system_prompt || 'あなたは親切で知識豊富なAIアシスタントです。',
        ...agentConfig
      };

      const response = await fetch(`${this.baseURL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[MultiLLM API] Error response:', errorText);
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[MultiLLM API] Response received:', data);

      // バックエンドのレスポンス形式に合わせて修正
      return {
        message: data.message || data.choices?.[0]?.message?.content || 'レスポンスを取得できませんでした。',
        model: data.model || 'unknown',
        usage: data.usage
      };
    } catch (error) {
      console.error('[MultiLLM API] Error:', error);
      
      // フォールバック応答
      return {
        message: this.generateFallbackResponse(),
        model: 'fallback',
        usage: undefined
      };
    }
  }

  /**
   * 利用可能なモデル一覧を取得
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseURL}/api/models`);

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      return data.models || ['gpt-3.5-turbo', 'gpt-4', 'claude-3-haiku-20240307'];
    } catch (error) {
      console.error('[MultiLLM API] Failed to fetch models:', error);
      // デフォルトのモデル一覧を返す
      return ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    }
  }

  /**
   * API接続テスト
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/api/health`);
      return response.ok;
    } catch (error) {
      console.error('[MultiLLM API] Connection test failed:', error);
      return false;
    }
  }

  /**
   * ファイルをアップロード
   */
  async uploadFile(file: File): Promise<{ success: boolean; fileId?: string }> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${this.baseURL}/api/files/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      const data = await response.json();
      return { success: true, fileId: data.fileId };
    } catch (error) {
      console.error('[MultiLLM API] File upload failed:', error);
      return { success: false };
    }
  }

  /**
   * フォールバック応答生成
   */
  private generateFallbackResponse(): string {
    const responses = [
      '申し訳ありませんが、現在AIサービスに接続できません。しばらく後にもう一度お試しください。',
      'システムが一時的に利用できません。ご不便をおかけして申し訳ありません。',
      '接続に問題が発生しました。少し時間をおいて再度お試しください。',
      'ただいまサーバーメンテナンス中です。後ほどご利用ください。',
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }
}

// シングルトンインスタンス
export const multiLLMAPI = new MultiLLMAPI();

// デフォルトのエージェント設定
export const defaultAgentConfig: AgentConfig = {
  name: 'Conea Assistant',
  description: '高度なAIアシスタントとして、様々な質問にお答えします。',
  model: 'gpt-3.5-turbo',
  temperature: 0.7,
  max_tokens: 1000,
  system_prompt: 'あなたは親切で知識豊富なAIアシスタントです。ユーザーの質問に対して、正確で役立つ情報を提供してください。日本語で回答してください。',
  language: 'ja',
  response_style: 'friendly',
  response_length: 3,
  timeout: 30,
  max_history: 50
};