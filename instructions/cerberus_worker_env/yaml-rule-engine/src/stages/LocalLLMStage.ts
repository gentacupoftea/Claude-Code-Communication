/**
 * Stage 4: ローカルLLM
 * オフライン推論による代替データ生成
 */

import { IFallbackStage, FallbackResult } from '../interfaces/IFallbackService';
import { logger } from '../utils/logger';
import OpenAI from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';

export interface LocalLLMConfig {
  provider: 'openai' | 'anthropic' | 'ollama';
  apiKey?: string;
  model?: string;
  baseURL?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export class LocalLLMStage implements IFallbackStage {
  name = 'local-llm';
  priority = 4;
  timeout = 15000; // LLMは時間がかかる可能性
  retryCount = 1;
  
  private llmClient: any;
  private config: LocalLLMConfig;

  constructor(config: LocalLLMConfig) {
    this.config = {
      temperature: 0.3,
      maxTokens: 500,
      systemPrompt: 'You are a helpful assistant that provides fallback data when primary sources are unavailable.',
      ...config
    };

    this.initializeLLMClient();
  }

  private initializeLLMClient(): void {
    switch (this.config.provider) {
      case 'openai':
        this.llmClient = new OpenAI({
          apiKey: this.config.apiKey,
          baseURL: this.config.baseURL
        });
        break;
        
      case 'anthropic':
        this.llmClient = new Anthropic({
          apiKey: this.config.apiKey
        });
        break;
        
      case 'ollama':
        // Ollamaの場合はローカルエンドポイントを使用
        this.llmClient = new OpenAI({
          baseURL: this.config.baseURL || 'http://localhost:11434/v1',
          apiKey: 'ollama' // Ollamaはキー不要だがライブラリが要求
        });
        break;
    }
  }

  async execute(input: any): Promise<FallbackResult> {
    const startTime = Date.now();

    try {
      const prompt = this.buildPrompt(input);
      const response = await this.generateResponse(prompt);

      // レスポンスをパース
      const data = this.parseResponse(response);

      return {
        success: true,
        data,
        stage: this.name,
        duration: Date.now() - startTime,
        metadata: {
          source: 'local-llm',
          provider: this.config.provider,
          model: this.config.model,
          generated: true
        }
      };
    } catch (error) {
      logger.error('Local LLM execution failed', {
        error: error.message,
        provider: this.config.provider
      });

      return {
        success: false,
        error: error as Error,
        stage: this.name,
        duration: Date.now() - startTime,
        metadata: {
          source: 'local-llm',
          provider: this.config.provider,
          error: error.message
        }
      };
    }
  }

  private buildPrompt(input: any): string {
    // inputからプロンプトを構築
    if (typeof input === 'string') {
      return `Please provide fallback data for the following request: ${input}`;
    }

    if (typeof input === 'object' && input.prompt) {
      return input.prompt;
    }

    // 構造化データからプロンプトを生成
    const context = JSON.stringify(input, null, 2);
    return `Based on the following context, generate appropriate fallback data:
    
Context:
${context}

Requirements:
1. Generate realistic and consistent data
2. Follow the same structure as requested
3. Ensure data integrity and validity
4. Return JSON format if applicable`;
  }

  private async generateResponse(prompt: string): Promise<string> {
    switch (this.config.provider) {
      case 'openai':
      case 'ollama':
        return this.generateOpenAIResponse(prompt);
        
      case 'anthropic':
        return this.generateAnthropicResponse(prompt);
        
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }

  private async generateOpenAIResponse(prompt: string): Promise<string> {
    const completion = await this.llmClient.chat.completions.create({
      model: this.config.model || 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: this.config.systemPrompt
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens
    });

    return completion.choices[0]?.message?.content || '';
  }

  private async generateAnthropicResponse(prompt: string): Promise<string> {
    const message = await this.llmClient.messages.create({
      model: this.config.model || 'claude-3-haiku-20240307',
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      system: this.config.systemPrompt,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    return message.content[0]?.text || '';
  }

  private parseResponse(response: string): any {
    // JSONレスポンスを試みる
    try {
      // JSONブロックを抽出
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }

      // 直接JSONパース
      return JSON.parse(response);
    } catch (error) {
      // JSONでない場合はテキストとして返す
      logger.debug('LLM response is not JSON, returning as text');
      return { text: response };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // 簡単なプロンプトでLLMの応答性を確認
      const testPrompt = 'Respond with "OK" if you are operational.';
      const response = await this.generateResponse(testPrompt);
      return response.toLowerCase().includes('ok');
    } catch (error) {
      logger.error('LLM health check failed', error);
      return false;
    }
  }
}