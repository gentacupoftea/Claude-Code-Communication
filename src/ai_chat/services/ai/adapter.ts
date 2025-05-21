/**
 * AI Provider Adapter Interface
 * 
 * This module implements a common interface for different AI providers (OpenAI, Claude, Gemini)
 * to provide a consistent interaction regardless of the underlying AI service.
 */

export interface CompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export interface AIUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AIResponse {
  text: string;
  usage: AIUsage;
}

export interface AIProvider {
  id: string;
  name: string;
  getCompletion(prompt: string, options?: CompletionOptions): Promise<AIResponse>;
  getTokenCount(text: string): number;
  getMaxTokens(): number;
}

// OpenAI Implementation
export class OpenAIAdapter implements AIProvider {
  id = 'openai';
  name = 'OpenAI (GPT-4)';
  
  async getCompletion(prompt: string, options?: CompletionOptions): Promise<AIResponse> {
    try {
      // Using dynamic import to avoid bundling issues
      const { OpenAI } = await import('openai');
      
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OpenAI API key is not configured');
      }
      
      const openai = new OpenAI({ apiKey });
      
      const response = await openai.chat.completions.create({
        model: options?.model || 'gpt-4-0125-preview',
        messages: [{ role: 'user', content: prompt }],
        temperature: options?.temperature || 0.7,
        max_tokens: options?.maxTokens,
        top_p: options?.topP || 1,
        frequency_penalty: options?.frequencyPenalty || 0,
        presence_penalty: options?.presencePenalty || 0,
      });
      
      return {
        text: response.choices[0].message.content || '',
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0
        }
      };
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error(`OpenAI API request failed: ${error.message}`);
    }
  }
  
  getTokenCount(text: string): number {
    // Simple approximation: ~4 characters per token
    // For production, use a proper tokenizer like tiktoken
    return Math.ceil(text.length / 4);
  }
  
  getMaxTokens(): number {
    return 128000; // GPT-4-Turbo's maximum context length
  }
}

// Claude Implementation
export class ClaudeAdapter implements AIProvider {
  id = 'claude';
  name = 'Claude (Anthropic)';
  
  async getCompletion(prompt: string, options?: CompletionOptions): Promise<AIResponse> {
    try {
      // Using dynamic import to avoid bundling issues
      const { Anthropic } = await import('@anthropic-ai/sdk');
      
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error('Anthropic API key is not configured');
      }
      
      const anthropic = new Anthropic({ apiKey });
      
      const response = await anthropic.messages.create({
        model: options?.model || 'claude-3-opus-20240229',
        max_tokens: options?.maxTokens || 4096,
        temperature: options?.temperature || 0.7,
        system: "You are a helpful assistant integrated with Conea, a modern e-commerce analytics platform.",
        messages: [
          { role: 'user', content: prompt }
        ],
      });
      
      // Calculate approximate token usage
      const promptTokens = this.getTokenCount(prompt);
      const completionTokens = this.getTokenCount(response.content[0].text);
      
      return {
        text: response.content[0].text,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens
        }
      };
    } catch (error) {
      console.error('Claude API error:', error);
      throw new Error(`Claude API request failed: ${error.message}`);
    }
  }
  
  getTokenCount(text: string): number {
    // Claude tokenization is roughly ~4 chars per token
    return Math.ceil(text.length / 4);
  }
  
  getMaxTokens(): number {
    return 200000; // Claude 3 Opus context window
  }
}

// Gemini Implementation
export class GeminiAdapter implements AIProvider {
  id = 'gemini';
  name = 'Gemini (Google)';
  
  async getCompletion(prompt: string, options?: CompletionOptions): Promise<AIResponse> {
    try {
      // Using dynamic import to avoid bundling issues
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('Gemini API key is not configured');
      }
      
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: options?.model || 'gemini-pro',
      });
      
      const result = await model.generateContent(prompt);
      const response = result.response;
      
      // Calculate approximate token usage
      const promptTokens = this.getTokenCount(prompt);
      const completionTokens = this.getTokenCount(response.text());
      
      return {
        text: response.text(),
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens
        }
      };
    } catch (error) {
      console.error('Gemini API error:', error);
      throw new Error(`Gemini API request failed: ${error.message}`);
    }
  }
  
  getTokenCount(text: string): number {
    // Rough approximation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
  
  getMaxTokens(): number {
    return 32000; // Gemini Pro context window
  }
}