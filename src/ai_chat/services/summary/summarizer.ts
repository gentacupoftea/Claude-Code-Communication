/**
 * Conversation Summarizer
 * 
 * Summarizes conversation history to manage context length
 */

import { AIProvider } from '../ai/adapter';
import { ChatMessage } from '../context/context-manager';

export class ConversationSummarizer {
  /**
   * Template for the summary prompt
   */
  private readonly summaryPromptTemplate = 
    `以下の会話を簡潔に要約してください。重要なポイント、質問、結論を含めてください。
     このサマリーは会話の続きのためにAIモデルに提供されます。
     ---
     {conversation}
     ---
     要約:`;
  
  /**
   * Create a new conversation summarizer
   * @param aiProvider The AI provider to use for summarization
   */
  constructor(private aiProvider: AIProvider) {}
  
  /**
   * Summarize a conversation
   * @param messages The messages to summarize
   * @returns Promise resolving to the summary text
   */
  async summarizeConversation(messages: ChatMessage[]): Promise<string> {
    // Convert messages to a string
    const conversationText = messages.map(msg => {
      const roleLabels = {
        'user': 'ユーザー',
        'assistant': 'アシスタント',
        'system': 'システム'
      };
      const role = roleLabels[msg.role] || msg.role;
      return `${role}: ${msg.content}`;
    }).join('\n\n');
    
    // Create the summary prompt
    const summaryPrompt = this.summaryPromptTemplate.replace(
      '{conversation}',
      conversationText
    );
    
    // Get the summary from the AI
    const response = await this.aiProvider.getCompletion(summaryPrompt, {
      temperature: 0.3, // Lower temperature for more deterministic summary
      maxTokens: 1000   // Limit summary length
    });
    
    return response.text;
  }
  
  /**
   * Summarize recent messages, incorporating previous summary
   * @param messages Recent messages to summarize
   * @param previousSummary Previous conversation summary
   * @returns Promise resolving to the updated summary
   */
  async updateSummary(messages: ChatMessage[], previousSummary: string): Promise<string> {
    // Create a prompt that incorporates the previous summary
    const incrementalSummaryPrompt = 
      `以下は過去の会話の要約です：
       ---
       ${previousSummary}
       ---
       
       以下は要約後に行われた新しい会話です：
       ---
       ${messages.map(msg => {
         const roleLabels = {
           'user': 'ユーザー',
           'assistant': 'アシスタント',
           'system': 'システム'
         };
         const role = roleLabels[msg.role] || msg.role;
         return `${role}: ${msg.content}`;
       }).join('\n\n')}
       ---
       
       過去の要約と新しい会話を統合した、更新版の要約を作成してください。重要なポイント、質問、結論を含めてください。`;
    
    // Get the updated summary
    const response = await this.aiProvider.getCompletion(incrementalSummaryPrompt, {
      temperature: 0.3,
      maxTokens: 1000
    });
    
    return response.text;
  }
  
  /**
   * Generate a shorter summary for provider switching
   * @param messages Messages to summarize
   * @returns Promise resolving to a concise summary
   */
  async generateConciseSummary(messages: ChatMessage[]): Promise<string> {
    const conciseSummaryPrompt = 
      `以下の会話を非常に簡潔に要約してください。会話の本質と主要なトピックのみを含めてください。
       最大200単語です。
       ---
       ${messages.map(msg => {
         const roleLabels = {
           'user': 'ユーザー',
           'assistant': 'アシスタント',
           'system': 'システム'
         };
         const role = roleLabels[msg.role] || msg.role;
         return `${role}: ${msg.content}`;
       }).join('\n\n')}
       ---
       簡潔な要約:`;
    
    const response = await this.aiProvider.getCompletion(conciseSummaryPrompt, {
      temperature: 0.3,
      maxTokens: 400
    });
    
    return response.text;
  }
}