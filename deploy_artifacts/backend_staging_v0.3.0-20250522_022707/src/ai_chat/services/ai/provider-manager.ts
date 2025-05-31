/**
 * AI Provider Manager
 * 
 * Manages multiple AI providers and allows switching between them
 * while maintaining a consistent interface for the application.
 */

import { AIProvider, AIResponse, CompletionOptions, OpenAIAdapter, ClaudeAdapter, GeminiAdapter } from './adapter';

export class AIProviderManager {
  private providers: Map<string, AIProvider> = new Map();
  private activeProvider: AIProvider;
  
  constructor() {
    const openaiAdapter = new OpenAIAdapter();
    const claudeAdapter = new ClaudeAdapter();
    const geminiAdapter = new GeminiAdapter();
    
    this.providers.set(openaiAdapter.id, openaiAdapter);
    this.providers.set(claudeAdapter.id, claudeAdapter);
    this.providers.set(geminiAdapter.id, geminiAdapter);
    
    // Set Claude as default provider
    this.activeProvider = claudeAdapter;
  }
  
  /**
   * Get list of available AI providers
   */
  getAvailableProviders(): Array<{id: string, name: string}> {
    return Array.from(this.providers.values()).map(p => ({
      id: p.id,
      name: p.name
    }));
  }
  
  /**
   * Set the active AI provider
   * @param providerId Provider ID to set as active
   * @returns boolean indicating if the provider was successfully set
   */
  setActiveProvider(providerId: string): boolean {
    if (this.providers.has(providerId)) {
      this.activeProvider = this.providers.get(providerId)!;
      return true;
    }
    return false;
  }
  
  /**
   * Get a completion from the active AI provider
   * @param prompt The prompt to send to the AI
   * @param options Optional parameters for the completion
   * @returns Promise resolving to the AI response
   */
  async getCompletion(prompt: string, options?: CompletionOptions): Promise<AIResponse> {
    return this.activeProvider.getCompletion(prompt, options);
  }
  
  /**
   * Get the currently active AI provider
   */
  getActiveProvider(): AIProvider {
    return this.activeProvider;
  }
  
  /**
   * Get AI provider by ID
   * @param providerId The provider ID
   * @returns The provider or undefined if not found
   */
  getProvider(providerId: string): AIProvider | undefined {
    return this.providers.get(providerId);
  }
}