/**
 * AI Chat Controller
 * 
 * Handles AI chat interactions, provider switching, and message processing
 */

import { Request, Response } from 'express';
import { AIProviderManager } from '../services/ai/provider-manager';
import { ChatMessage, ContextManager } from '../services/context/context-manager';
import { ChartProcessor } from '../services/chart/chart-processor';
import { ContextTransferManager } from '../services/context/transfer-manager';
import { ConversationSummarizer } from '../services/summary/summarizer';
import { sanitizeInput, sanitizeOutput } from '../utils/security';

export class AIChatController {
  private providerManager: AIProviderManager;
  private contextManager: ContextManager;
  private chartProcessor: ChartProcessor;
  private transferManager: ContextTransferManager;
  
  constructor() {
    this.providerManager = new AIProviderManager();
    this.contextManager = new ContextManager(this.providerManager.getActiveProvider());
    this.chartProcessor = new ChartProcessor();
    this.transferManager = new ContextTransferManager(
      this.contextManager,
      this.providerManager.getActiveProvider()
    );
    
    // Add initial system message
    await this.contextManager.addMessage({
      role: 'system',
      content: 'You are a helpful assistant integrated with Conea, a modern e-commerce analytics platform focused on Shopify integrations. Provide concise, accurate responses and help users understand their business data. You have the ability to generate charts when requested using specific syntax.'
    });
  }
  
  /**
   * Handle sending a message to the AI
   */
  async sendMessage(req: Request, res: Response) {
    try {
      const { message, providerId } = req.body;
      
      // Validate input
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message is required' });
      }
      
      // Sanitize user input
      const sanitizedMessage = sanitizeInput(message);
      
      // Handle provider change if requested
      if (providerId && providerId !== this.providerManager.getActiveProvider().id) {
        await this.changeProvider(providerId);
      }
      
      // Create user message with sanitized content
      const userMessage: ChatMessage = {
        role: 'user',
        content: sanitizedMessage
      };
      
      // Check if we need summarization
      const canAddDirectly = await this.contextManager.addMessage(userMessage);
      if (!canAddDirectly) {
        await this.summarizeAndResetContext();
        await this.contextManager.addMessage(userMessage);
      }
      
      // Get all messages for the AI
      const messages = this.contextManager.getMessages();
      
      // Format messages for the provider
      const formattedPrompt = this.formatMessagesForProvider(messages);
      
      // Get AI response
      const aiResponse = await this.providerManager.getCompletion(
        formattedPrompt,
        {}
      );
      
      // Create assistant message with sanitized content
      const sanitizedResponse = sanitizeOutput(aiResponse.text);
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: sanitizedResponse
      };
      
      // Add to context
      await this.contextManager.addMessage(assistantMessage);
      
      // Process charts in the sanitized response
      const processedResponse = await this.chartProcessor.processText(sanitizedResponse);
      
      // Send sanitized and processed response
      res.json({
        message: processedResponse,
        provider: this.providerManager.getActiveProvider().name,
        tokenUsage: {
          current: this.contextManager.getCurrentTokenCount(),
          max: this.contextManager.getMaxTokens(),
          percentage: this.contextManager.getTokenUsagePercentage(),
          ...aiResponse.usage
        }
      });
    } catch (error) {
      console.error('Chat error:', error);
      res.status(500).json({ error: `Failed to process message: ${error.message}` });
    }
  }
  
  /**
   * Get available AI providers
   */
  async getAvailableProviders(req: Request, res: Response) {
    try {
      res.json({
        providers: this.providerManager.getAvailableProviders(),
        activeProvider: this.providerManager.getActiveProvider().id
      });
    } catch (error) {
      console.error('Error getting providers:', error);
      res.status(500).json({ error: 'Failed to get providers' });
    }
  }
  
  /**
   * Get conversation history
   */
  async getConversationHistory(req: Request, res: Response) {
    try {
      // Get messages excluding system messages
      const messages = this.contextManager.getMessages()
        .filter(msg => msg.role !== 'system')
        .map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp
        }));
      
      res.json({
        messages,
        tokenUsage: {
          current: this.contextManager.getCurrentTokenCount(),
          max: this.contextManager.getMaxTokens(),
          percentage: this.contextManager.getTokenUsagePercentage()
        }
      });
    } catch (error) {
      console.error('Error getting conversation history:', error);
      res.status(500).json({ error: 'Failed to get conversation history' });
    }
  }
  
  /**
   * Clear conversation history
   */
  async clearConversation(req: Request, res: Response) {
    try {
      // Keep the initial system message
      const systemMessages = this.contextManager.getSystemMessages()
        .filter(msg => !msg.content.startsWith('これまでの会話の要約:'));
      
      // Clear context
      this.contextManager.clear();
      
      // Add back system messages
      for (const msg of systemMessages) {
        await this.contextManager.addMessage(msg);
      }
      
      res.json({ success: true, message: 'Conversation cleared' });
    } catch (error) {
      console.error('Error clearing conversation:', error);
      res.status(500).json({ error: 'Failed to clear conversation' });
    }
  }
  
  /**
   * Get chart examples
   */
  async getChartExamples(req: Request, res: Response) {
    try {
      const { chartType } = req.query;
      const example = this.chartProcessor.generateExampleChartCode(chartType as string);
      res.json({ example });
    } catch (error) {
      console.error('Error getting chart example:', error);
      res.status(500).json({ error: 'Failed to get chart example' });
    }
  }
  
  /**
   * Change the active AI provider
   */
  private async changeProvider(newProviderId: string): Promise<void> {
    // Set the new provider
    if (!this.providerManager.setActiveProvider(newProviderId)) {
      throw new Error(`Invalid provider ID: ${newProviderId}`);
    }
    
    // Create a new context manager
    const newContextManager = await this.transferManager.transferToNewProvider(
      this.providerManager.getActiveProvider()
    );
    
    // Update context manager and transfer manager
    this.contextManager = newContextManager;
    this.transferManager = new ContextTransferManager(
      this.contextManager,
      this.providerManager.getActiveProvider()
    );
  }
  
  /**
   * Summarize the conversation and reset the context
   */
  private async summarizeAndResetContext(): Promise<void> {
    // Create summarizer
    const summarizer = new ConversationSummarizer(
      this.providerManager.getActiveProvider()
    );
    
    // Get all messages
    const messages = this.contextManager.getMessages();
    
    // Generate summary
    const summary = await summarizer.summarizeConversation(messages);
    
    // Keep system messages that are not summaries
    const systemMessages = messages
      .filter(msg => msg.role === 'system' && !msg.content.startsWith('これまでの会話の要約:'));
    
    // Clear context
    this.contextManager.clear();
    
    // Add original system messages
    for (const msg of systemMessages) {
      this.contextManager.addMessage(msg);
    }
    
    // Add summary as system message
    await this.contextManager.addMessage({
      role: 'system',
      content: `これまでの会話の要約: ${summary}`
    });
  }
  
  /**
   * Format messages for the provider
   */
  private formatMessagesForProvider(messages: ChatMessage[]): string {
    // Here you can implement different formatting for different providers
    // For simplicity, using a standard format for all providers
    
    return messages.map(msg => {
      const role = msg.role === 'user' ? 'User' : 
                  msg.role === 'assistant' ? 'Assistant' : 
                  'System';
      return `${role}: ${msg.content}`;
    }).join('\n\n');
  }
}