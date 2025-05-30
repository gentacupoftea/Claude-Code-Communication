/**
 * AI Service - 複数のAIプロバイダーを統合
 */

const axios = require('axios');

class AIService {
  constructor() {
    this.providers = {
      openai: {
        apiKey: process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY,
        baseURL: 'https://api.openai.com/v1',
        models: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo']
      },
      anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY,
        baseURL: 'https://api.anthropic.com/v1',
        models: ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229']
      },
      google: {
        apiKey: process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        models: ['gemini-1.5-flash', 'gemini-1.5-pro']
      }
    };
  }

  /**
   * 利用可能なモデル一覧を取得
   */
  getAvailableModels() {
    const models = [];
    Object.values(this.providers).forEach(provider => {
      models.push(...provider.models);
    });
    return models;
  }

  /**
   * モデルからプロバイダーを特定
   */
  getProviderByModel(model) {
    for (const [name, provider] of Object.entries(this.providers)) {
      if (provider.models.includes(model)) {
        return { name, ...provider };
      }
    }
    // デフォルトはOpenAI
    return { name: 'openai', ...this.providers.openai };
  }

  /**
   * OpenAI APIを使用してチャット
   */
  async chatWithOpenAI(messages, options = {}) {
    const { model = 'gpt-3.5-turbo', temperature = 0.7, max_tokens = 1000 } = options;
    
    try {
      const response = await axios.post(
        `${this.providers.openai.baseURL}/chat/completions`,
        {
          model,
          messages,
          temperature,
          max_tokens
        },
        {
          headers: {
            'Authorization': `Bearer ${this.providers.openai.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        message: response.data.choices[0].message.content,
        model,
        usage: response.data.usage
      };
    } catch (error) {
      console.error('OpenAI API Error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Anthropic APIを使用してチャット
   */
  async chatWithAnthropic(messages, options = {}) {
    const { model = 'claude-3-haiku-20240307', temperature = 0.7, max_tokens = 1000 } = options;
    
    // Anthropicのメッセージ形式に変換
    const systemMessage = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');
    
    try {
      const response = await axios.post(
        `${this.providers.anthropic.baseURL}/messages`,
        {
          model: model,
          messages: userMessages,
          system: systemMessage?.content,
          max_tokens,
          temperature
        },
        {
          headers: {
            'x-api-key': this.providers.anthropic.apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        message: response.data.content[0].text,
        model,
        usage: {
          prompt_tokens: response.data.usage.input_tokens,
          completion_tokens: response.data.usage.output_tokens,
          total_tokens: response.data.usage.input_tokens + response.data.usage.output_tokens
        }
      };
    } catch (error) {
      console.error('Anthropic API Error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Google Gemini APIを使用してチャット
   */
  async chatWithGoogle(messages, options = {}) {
    const { model = 'gemini-1.5-flash', temperature = 0.7, max_tokens = 1000 } = options;
    
    // Geminiのメッセージ形式に変換
    const contents = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));
    
    try {
      const response = await axios.post(
        `${this.providers.google.baseURL}/models/${model}:generateContent?key=${this.providers.google.apiKey}`,
        {
          contents,
          generationConfig: {
            temperature,
            maxOutputTokens: max_tokens
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      const content = response.data.candidates[0].content.parts[0].text;
      
      return {
        message: content,
        model,
        usage: {
          prompt_tokens: 0, // Gemini APIは使用トークン数を返さない
          completion_tokens: 0,
          total_tokens: 0
        }
      };
    } catch (error) {
      console.error('Google API Error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * 統合チャット関数
   */
  async chat(messages, options = {}) {
    const { model = 'gpt-3.5-turbo' } = options;
    const provider = this.getProviderByModel(model);

    if (!provider.apiKey) {
      throw new Error(`API key not configured for ${provider.name}`);
    }

    switch (provider.name) {
      case 'openai':
        return this.chatWithOpenAI(messages, options);
      case 'anthropic':
        return this.chatWithAnthropic(messages, options);
      case 'google':
        return this.chatWithGoogle(messages, options);
      default:
        throw new Error(`Unsupported provider: ${provider.name}`);
    }
  }
}

module.exports = AIService;