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
<<<<<<< HEAD
        models: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo']
=======
        models: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'],
        enabled: process.env.ENABLE_OPENAI !== 'false'
>>>>>>> origin/main
      },
      anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY,
        baseURL: 'https://api.anthropic.com/v1',
<<<<<<< HEAD
        models: ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229']
=======
        models: ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229'],
        enabled: process.env.ENABLE_CLAUDE !== 'false'
>>>>>>> origin/main
      },
      google: {
        apiKey: process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
<<<<<<< HEAD
        models: ['gemini-1.5-flash', 'gemini-1.5-pro']
      }
    };
=======
        models: ['gemini-1.5-flash', 'gemini-1.5-pro'],
        enabled: process.env.ENABLE_GEMINI !== 'false'
      }
    };
    
    // APIキーの検証と利用可能プロバイダーの初期化
    this.availableProviders = this.initializeProviders();
  }

  /**
   * プロバイダーの初期化と検証
   */
  initializeProviders() {
    const available = {};
    
    for (const [name, provider] of Object.entries(this.providers)) {
      if (provider.enabled && provider.apiKey && provider.apiKey !== 'your_' + name + '_api_key_here') {
        available[name] = provider;
        console.log(`[AIService] ${name} provider initialized`);
      } else {
        console.log(`[AIService] ${name} provider skipped (disabled or no API key)`);
      }
    }
    
    if (Object.keys(available).length === 0) {
      console.warn('[AIService] Warning: No AI providers available');
    }
    
    return available;
  }

  /**
   * 利用可能なプロバイダー一覧を取得
   */
  getAvailableProviders() {
    return Object.keys(this.availableProviders);
>>>>>>> origin/main
  }

  /**
   * 利用可能なモデル一覧を取得
   */
  getAvailableModels() {
    const models = [];
<<<<<<< HEAD
    Object.values(this.providers).forEach(provider => {
=======
    Object.values(this.availableProviders).forEach(provider => {
>>>>>>> origin/main
      models.push(...provider.models);
    });
    return models;
  }

  /**
<<<<<<< HEAD
=======
   * プロバイダーの状態を取得
   */
  getProviderStatus() {
    const status = {};
    for (const [name, provider] of Object.entries(this.providers)) {
      status[name] = {
        enabled: provider.enabled,
        configured: !!(provider.apiKey && provider.apiKey !== 'your_' + name + '_api_key_here'),
        available: name in this.availableProviders,
        models: provider.models
      };
    }
    return status;
  }

  /**
>>>>>>> origin/main
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

<<<<<<< HEAD
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
=======
    if (!(provider.name in this.availableProviders)) {
      const availableModels = this.getAvailableModels();
      throw new Error(`Provider ${provider.name} not available. Available models: ${availableModels.join(', ')}`);
    }

    try {
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
    } catch (error) {
      console.error(`[AIService] ${provider.name} API error:`, error.message);
      
      // フォールバック機能（有効化されている場合）
      if (process.env.ENABLE_FALLBACK === 'true' && this.getAvailableProviders().length > 1) {
        return this.chatWithFallback(messages, options, provider.name);
      }
      
      throw error;
    }
  }

  /**
   * フォールバック機能
   */
  async chatWithFallback(messages, options, failedProvider) {
    const availableProviders = this.getAvailableProviders().filter(p => p !== failedProvider);
    
    if (availableProviders.length === 0) {
      throw new Error('No fallback providers available');
    }

    console.log(`[AIService] Attempting fallback to ${availableProviders[0]}`);
    
    // 最初の利用可能なプロバイダーのモデルを使用
    const fallbackProvider = this.availableProviders[availableProviders[0]];
    const fallbackModel = fallbackProvider.models[0];
    
    return this.chat(messages, { ...options, model: fallbackModel });
  }
>>>>>>> origin/main
}

module.exports = AIService;