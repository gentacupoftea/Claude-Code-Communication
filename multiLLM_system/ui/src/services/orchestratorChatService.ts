/**
 * Orchestrator Chat Service
 * Connects to the MultiLLM Orchestrator API for real AI responses
 */

import { v4 as uuidv4 } from 'uuid';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  userId?: string;
  status?: 'sending' | 'sent' | 'error';
}

export interface ThinkingUpdate {
  type: { icon: string; label: string };
  stage: string;
  steps?: Array<{
    description: string;
    detail?: string;
    timestamp: Date;
  }>;
}

interface StreamEvent {
  type: 'start' | 'thinking' | 'chunk' | 'error' | 'complete';
  data?: any;
  message_id?: string;
}

class OrchestratorChatService {
  private apiUrl: string;
  private userId: string;
  private activeStreams: Map<string, AbortController> = new Map();
  private messageCallbacks: Map<string, (message: ChatMessage) => void> = new Map();
  private thinkingCallbacks: Map<string, (update: ThinkingUpdate) => void> = new Map();
  private chatHistory: Map<string, ChatMessage[]> = new Map();

  constructor() {
    // Use environment variable or default to local development
    this.apiUrl = process.env.REACT_APP_ORCHESTRATOR_API_URL || 'http://localhost:8000';
    this.userId = localStorage.getItem('userId') || uuidv4();
    localStorage.setItem('userId', this.userId);
  }

  /**
   * Send a message to the Orchestrator
   */
  async sendMessage(content: string, context: any = {}): Promise<string> {
    const messageId = uuidv4();
    const roomId = this.getRoomId(context);
    
    // Add user message to history
    const userMessage: ChatMessage = {
      id: messageId,
      role: 'user',
      content,
      userId: this.userId,
      timestamp: new Date(),
      status: 'sent'
    };
    
    this.addToHistory(roomId, userMessage);
    
    // Notify listeners of user message
    const messageCallback = this.messageCallbacks.get(roomId);
    if (messageCallback) {
      messageCallback(userMessage);
    }
    
    // Create abort controller for this stream
    const abortController = new AbortController();
    this.activeStreams.set(messageId, abortController);
    
    try {
      const response = await fetch(`${this.apiUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          context,
          user_id: this.userId,
          include_thinking: true
        }),
        signal: abortController.signal
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Process server-sent events
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessageId: string | null = null;
      let accumulatedContent = '';
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event: StreamEvent = JSON.parse(line.slice(6));
                
                switch (event.type) {
                  case 'start':
                    assistantMessageId = event.message_id || uuidv4();
                    break;
                    
                  case 'thinking':
                    const thinkingCallback = this.thinkingCallbacks.get(roomId);
                    if (thinkingCallback && event.data) {
                      thinkingCallback(event.data);
                    }
                    break;
                    
                  case 'chunk':
                    if (event.data && assistantMessageId) {
                      accumulatedContent += event.data.content;
                      
                      const assistantMessage: ChatMessage = {
                        id: assistantMessageId,
                        role: 'assistant',
                        content: accumulatedContent,
                        timestamp: new Date(),
                        status: event.data.is_complete ? 'sent' : 'sending'
                      };
                      
                      // Update history and notify listeners
                      this.updateAssistantMessage(roomId, assistantMessage);
                      
                      if (messageCallback) {
                        messageCallback(assistantMessage);
                      }
                    }
                    break;
                    
                  case 'error':
                    console.error('Orchestrator error:', event.data);
                    if (assistantMessageId) {
                      const errorMessage: ChatMessage = {
                        id: assistantMessageId,
                        role: 'assistant',
                        content: `エラーが発生しました: ${event.data?.error || 'Unknown error'}`,
                        timestamp: new Date(),
                        status: 'error'
                      };
                      
                      this.updateAssistantMessage(roomId, errorMessage);
                      
                      if (messageCallback) {
                        messageCallback(errorMessage);
                      }
                    }
                    break;
                    
                  case 'complete':
                    // Stream completed successfully
                    break;
                }
              } catch (e) {
                console.error('Error parsing SSE event:', e);
              }
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error sending message:', error);
        
        // Send error message
        const errorMessage: ChatMessage = {
          id: uuidv4(),
          role: 'assistant',
          content: `接続エラーが発生しました。Orchestratorサーバーが起動していることを確認してください。`,
          timestamp: new Date(),
          status: 'error'
        };
        
        this.addToHistory(roomId, errorMessage);
        
        const messageCallback = this.messageCallbacks.get(roomId);
        if (messageCallback) {
          messageCallback(errorMessage);
        }
      }
    } finally {
      this.activeStreams.delete(messageId);
    }
    
    return messageId;
  }

  /**
   * Subscribe to messages for a specific context
   */
  subscribeToMessages(
    context: any,
    onMessage: (message: ChatMessage) => void,
    onInitialLoad?: (messages: ChatMessage[]) => void,
    limit: number = 50
  ): () => void {
    const roomId = this.getRoomId(context);
    
    // Store callback
    this.messageCallbacks.set(roomId, onMessage);
    
    // Send initial history
    if (onInitialLoad) {
      const history = this.chatHistory.get(roomId) || [];
      onInitialLoad(history.slice(-limit));
    }
    
    // Return unsubscribe function
    return () => {
      this.messageCallbacks.delete(roomId);
    };
  }

  /**
   * Subscribe to thinking updates
   */
  subscribeToThinking(
    context: any,
    onUpdate: (update: ThinkingUpdate) => void
  ): () => void {
    const roomId = this.getRoomId(context);
    this.thinkingCallbacks.set(roomId, onUpdate);
    
    return () => {
      this.thinkingCallbacks.delete(roomId);
    };
  }

  /**
   * Get chat history
   */
  async getChatHistory(context: any, limit: number = 50): Promise<ChatMessage[]> {
    const roomId = this.getRoomId(context);
    const history = this.chatHistory.get(roomId) || [];
    return history.slice(-limit);
  }

  /**
   * Interrupt active stream
   */
  interruptStream(messageId: string) {
    const controller = this.activeStreams.get(messageId);
    if (controller) {
      controller.abort();
      this.activeStreams.delete(messageId);
    }
  }

  /**
   * Get Orchestrator status
   */
  async getStatus(): Promise<any> {
    try {
      const response = await fetch(`${this.apiUrl}/api/status`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error getting orchestrator status:', error);
      return { status: 'error', error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get available workers
   */
  async getWorkers(): Promise<any> {
    try {
      const response = await fetch(`${this.apiUrl}/api/workers`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error getting workers:', error);
      return { workers: [] };
    }
  }

  // Private helper methods
  private getRoomId(context: any): string {
    if (context.taskId) {
      return `task-${context.taskId}`;
    } else if (context.projectId) {
      return `project-${context.projectId}`;
    }
    return 'general';
  }

  private addToHistory(roomId: string, message: ChatMessage) {
    if (!this.chatHistory.has(roomId)) {
      this.chatHistory.set(roomId, []);
    }
    
    const history = this.chatHistory.get(roomId)!;
    history.push(message);
    
    // Keep only last 1000 messages
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
  }

  private updateAssistantMessage(roomId: string, message: ChatMessage) {
    const history = this.chatHistory.get(roomId);
    if (!history) return;
    
    // Find and update existing message or add new one
    const existingIndex = history.findIndex(m => m.id === message.id);
    if (existingIndex >= 0) {
      history[existingIndex] = message;
    } else {
      history.push(message);
    }
  }

  /**
   * Cleanup
   */
  cleanup() {
    // Abort all active streams
    this.activeStreams.forEach(controller => controller.abort());
    this.activeStreams.clear();
    this.messageCallbacks.clear();
    this.thinkingCallbacks.clear();
  }
}

export default new OrchestratorChatService();