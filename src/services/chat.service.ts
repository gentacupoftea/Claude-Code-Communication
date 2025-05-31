import { apiClient, API_CONFIG } from '@/src/lib/api-config';

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface ChatSession {
  id: string;
  projectId: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface SendMessageRequest {
  sessionId: string;
  content: string;
  model?: string;
}

export interface SendMessageResponse {
  message: ChatMessage;
  response: ChatMessage;
}

export class ChatService {
  private static instance: ChatService;

  private constructor() {}

  public static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  public async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    return apiClient.post<SendMessageResponse>(
      API_CONFIG.ENDPOINTS.CHAT.SEND_MESSAGE,
      request
    );
  }

  public async getChatHistory(sessionId: string): Promise<ChatMessage[]> {
    return apiClient.get<ChatMessage[]>(
      `${API_CONFIG.ENDPOINTS.CHAT.GET_HISTORY}?sessionId=${sessionId}`
    );
  }

  public async createSession(projectId: string): Promise<ChatSession> {
    return apiClient.post<ChatSession>(
      API_CONFIG.ENDPOINTS.CHAT.CREATE_SESSION,
      { projectId }
    );
  }

  public async deleteSession(sessionId: string): Promise<void> {
    return apiClient.delete<void>(
      API_CONFIG.ENDPOINTS.CHAT.DELETE_SESSION(sessionId)
    );
  }

  // ストリーミングレスポンス用
  public async* streamMessage(
    request: SendMessageRequest
  ): AsyncGenerator<string, void, unknown> {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.MULTILLM.STREAM}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      throw new Error(`Stream error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      yield chunk;
    }
  }
}

export const chatService = ChatService.getInstance();