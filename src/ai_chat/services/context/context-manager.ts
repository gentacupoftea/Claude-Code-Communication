/**
 * Context Manager
 * 
 * Manages conversation context and token limits
 */

import { AIProvider } from '../ai/adapter';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

export class ContextManager {
  private messages: ChatMessage[] = [];
  private tokenCount: number = 0;
  private activeProvider: AIProvider;
  private tokenThreshold: number = 0.8; // 80% of max tokens is the threshold
  
  /**
   * Create a new context manager
   * @param provider The AI provider to use for token counting
   */
  constructor(provider: AIProvider) {
    this.activeProvider = provider;
  }
  
  /**
   * Set the active AI provider
   * @param provider The new AI provider
   */
  setProvider(provider: AIProvider) {
    this.activeProvider = provider;
    // Recalculate token count with new provider's tokenizer
    this.recalculateTokenCount();
  }
  
  /**
   * Add a new message to the context
   * @param message The message to add
   * @returns true if message was added, false if summarization is needed
   */
  addMessage(message: ChatMessage): boolean {
    // Add timestamp if not provided
    const messageWithTimestamp = {
      ...message,
      timestamp: message.timestamp || Date.now()
    };
    
    // Calculate tokens for this message
    const messageTokens = this.activeProvider.getTokenCount(message.content);
    const newTokenCount = this.tokenCount + messageTokens;
    const maxTokens = this.activeProvider.getMaxTokens();
    
    // Check if we're exceeding the threshold
    if (newTokenCount > maxTokens * this.tokenThreshold) {
      return false; // Summarization needed
    }
    
    // Add message and update token count
    this.messages.push(messageWithTimestamp);
    this.tokenCount = newTokenCount;
    return true;
  }
  
  /**
   * Get all messages in the context
   */
  getMessages(): ChatMessage[] {
    return [...this.messages];
  }
  
  /**
   * Get the current token count
   */
  getCurrentTokenCount(): number {
    return this.tokenCount;
  }
  
  /**
   * Get the maximum tokens allowed by the provider
   */
  getMaxTokens(): number {
    return this.activeProvider.getMaxTokens();
  }
  
  /**
   * Clear all messages from the context
   */
  clear() {
    this.messages = [];
    this.tokenCount = 0;
  }
  
  /**
   * Get the token usage as a percentage of max tokens
   */
  getTokenUsagePercentage(): number {
    return (this.tokenCount / this.activeProvider.getMaxTokens()) * 100;
  }
  
  /**
   * Recalculate token count using current provider
   */
  private recalculateTokenCount() {
    this.tokenCount = 0;
    for (const message of this.messages) {
      this.tokenCount += this.activeProvider.getTokenCount(message.content);
    }
  }
  
  /**
   * Get system messages only
   */
  getSystemMessages(): ChatMessage[] {
    return this.messages.filter(msg => msg.role === 'system');
  }
  
  /**
   * Get the number of user-assistant exchanges
   */
  getExchangeCount(): number {
    return this.messages.filter(msg => msg.role === 'user').length;
  }
}