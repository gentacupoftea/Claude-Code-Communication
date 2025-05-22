/**
 * Context Transfer Manager
 * 
 * Manages transferring context between different AI providers
 */

import { AIProvider } from '../ai/adapter';
import { ChatMessage, ContextManager } from './context-manager';
import { ConversationSummarizer } from '../summary/summarizer';

export interface ContextTransferData {
  summary: string;
  messages: ChatMessage[];
}

export class ContextTransferManager {
  private summarizer: ConversationSummarizer;
  private contextManager: ContextManager;
  
  /**
   * Create a new context transfer manager
   * @param contextManager The context manager to use
   * @param aiProvider The AI provider to use for summarization
   */
  constructor(contextManager: ContextManager, aiProvider: AIProvider) {
    this.contextManager = contextManager;
    this.summarizer = new ConversationSummarizer(aiProvider);
  }
  
  /**
   * Prepare context for transfer
   * @returns Promise resolving to the transfer data
   */
  async prepareContextTransfer(): Promise<ContextTransferData> {
    const messages = this.contextManager.getMessages();
    
    // Generate a concise summary
    const summary = await this.summarizer.generateConciseSummary(messages);
    
    // Get the recent messages (last 5 or fewer exchanges)
    const recentMessages = this.getRecentMessages(messages, 5);
    
    return {
      summary,
      messages: recentMessages
    };
  }
  
  /**
   * Transfer context to a new provider
   * @param newProvider The new AI provider
   * @param newContextManager The new context manager (optional)
   * @returns Promise resolving to the new context manager
   */
  async transferToNewProvider(
    newProvider: AIProvider,
    newContextManager?: ContextManager
  ): Promise<ContextManager> {
    // Create a new context manager if not provided
    const targetManager = newContextManager || new ContextManager(newProvider);
    
    // Generate summary and get recent messages
    const { summary, messages } = await this.prepareContextTransfer();
    
    // Add summary as system message
    await targetManager.addMessage({
      role: 'system',
      content: `これまでの会話の要約: ${summary}`
    });
    
    // Add system messages from original context
    const systemMessages = this.contextManager.getSystemMessages();
    for (const msg of systemMessages) {
      if (msg.content.startsWith('これまでの会話の要約:')) {
        continue; // Skip old summaries
      }
      await targetManager.addMessage(msg);
    }
    
    // Add recent messages
    for (const msg of messages) {
      await targetManager.addMessage(msg);
    }
    
    return targetManager;
  }
  
  /**
   * Get recent messages from the conversation
   * @param messages All messages
   * @param exchangeCount Number of recent exchanges to include
   * @returns Recent messages
   */
  private getRecentMessages(messages: ChatMessage[], exchangeCount: number): ChatMessage[] {
    // First, filter out system messages
    const nonSystemMessages = messages.filter(msg => msg.role !== 'system');
    
    // If we have fewer messages than requested, return all non-system messages
    if (nonSystemMessages.length <= exchangeCount * 2) {
      return nonSystemMessages;
    }
    
    // Otherwise, return the most recent exchanges
    // For N exchanges, we need the 2*N most recent messages (user + assistant pairs)
    return nonSystemMessages.slice(-exchangeCount * 2);
  }
}