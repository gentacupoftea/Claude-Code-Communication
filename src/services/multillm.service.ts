import { 
  LLMProvider, 
  LLMModel, 
  ChatMessage, 
  ChatSession, 
  MultiLLMRequest, 
  MultiLLMResponse, 
  ModelComparison,
  LLMUsageStats,
  ModelPerformanceMetrics,
  StreamingResponse
} from '@/src/types/multillm';

export class MultiLLMService {
  private static instance: MultiLLMService;
  private providers: LLMProvider[] = [];
  private currentSession: ChatSession | null = null;
  private usageStats: LLMUsageStats[] = [];
  
  private constructor() {
    this.initializeProviders();
  }

  public static getInstance(): MultiLLMService {
    if (!MultiLLMService.instance) {
      MultiLLMService.instance = new MultiLLMService();
    }
    return MultiLLMService.instance;
  }

  private initializeProviders() {
    // デモ用のプロバイダー設定
    this.providers = [
      {
        id: 'openai',
        name: 'OpenAI',
        displayName: 'OpenAI',
        description: '高品質な自然言語処理モデル',
        models: [
          {
            id: 'gpt-4o',
            name: 'GPT-4o',
            displayName: 'GPT-4o',
            provider: 'openai',
            contextLength: 128000,
            maxOutputTokens: 4096,
            isMultimodal: true,
            supportedLanguages: ['ja', 'en', 'zh', 'ko', 'es', 'fr', 'de'],
            strengths: ['推論', '創作', 'コーディング', '分析'],
            useCase: ['チャット', 'コーディング', '文書作成', '分析'],
            pricing: {
              inputTokenPrice: 0.000005,
              outputTokenPrice: 0.000015
            },
            isEnabled: true,
            description: '最新のGPT-4オムニモデル'
          },
          {
            id: 'gpt-3.5-turbo',
            name: 'GPT-3.5 Turbo',
            displayName: 'GPT-3.5 Turbo',
            provider: 'openai',
            contextLength: 16384,
            maxOutputTokens: 4096,
            isMultimodal: false,
            supportedLanguages: ['ja', 'en', 'zh', 'ko', 'es', 'fr'],
            strengths: ['チャット', '要約', '翻訳'],
            useCase: ['チャット', '要約', 'Q&A'],
            pricing: {
              inputTokenPrice: 0.0000005,
              outputTokenPrice: 0.0000015
            },
            isEnabled: true,
            description: '高速で経済的なチャットモデル'
          }
        ],
        isEnabled: true,
        requiresApiKey: true,
        maxTokens: 128000,
        supportedFeatures: [
          { id: 'text_generation', name: 'テキスト生成', description: '自然言語でのテキスト生成', supported: true },
          { id: 'code_generation', name: 'コード生成', description: 'プログラムコード生成', supported: true },
          { id: 'image_analysis', name: '画像分析', description: '画像の理解と分析', supported: true },
          { id: 'function_calling', name: '関数呼び出し', description: 'ツール・API呼び出し', supported: true }
        ],
        pricing: {
          inputTokenPrice: 0.000005,
          outputTokenPrice: 0.000015,
          currency: 'USD'
        },
        status: 'available',
        lastHealthCheck: new Date()
      },
      {
        id: 'anthropic',
        name: 'Anthropic',
        displayName: 'Anthropic',
        description: '安全性重視のAIアシスタント',
        models: [
          {
            id: 'claude-3-5-sonnet',
            name: 'Claude 3.5 Sonnet',
            displayName: 'Claude 3.5 Sonnet',
            provider: 'anthropic',
            contextLength: 200000,
            maxOutputTokens: 8192,
            isMultimodal: true,
            supportedLanguages: ['ja', 'en', 'zh', 'ko', 'es', 'fr', 'de'],
            strengths: ['推論', '分析', '安全性', '長文理解'],
            useCase: ['研究', '分析', '長文要約', 'コンサルティング'],
            pricing: {
              inputTokenPrice: 0.000003,
              outputTokenPrice: 0.000015
            },
            isEnabled: true,
            description: 'Anthropicの最新モデル'
          },
          {
            id: 'claude-3-haiku',
            name: 'Claude 3 Haiku',
            displayName: 'Claude 3 Haiku',
            provider: 'anthropic',
            contextLength: 200000,
            maxOutputTokens: 4096,
            isMultimodal: true,
            supportedLanguages: ['ja', 'en', 'zh', 'ko'],
            strengths: ['高速処理', '経済性'],
            useCase: ['チャット', '簡単な作業', 'Q&A'],
            pricing: {
              inputTokenPrice: 0.00000025,
              outputTokenPrice: 0.00000125
            },
            isEnabled: true,
            description: '高速で経済的なClaudeモデル'
          }
        ],
        isEnabled: true,
        requiresApiKey: true,
        maxTokens: 200000,
        supportedFeatures: [
          { id: 'text_generation', name: 'テキスト生成', description: '自然言語でのテキスト生成', supported: true },
          { id: 'code_generation', name: 'コード生成', description: 'プログラムコード生成', supported: true },
          { id: 'image_analysis', name: '画像分析', description: '画像の理解と分析', supported: true },
          { id: 'document_analysis', name: '文書分析', description: '長文書の分析', supported: true }
        ],
        pricing: {
          inputTokenPrice: 0.000003,
          outputTokenPrice: 0.000015,
          currency: 'USD'
        },
        status: 'available',
        lastHealthCheck: new Date()
      },
      {
        id: 'google',
        name: 'Google',
        displayName: 'Google',
        description: 'Googleの次世代AIモデル',
        models: [
          {
            id: 'gemini-1.5-pro',
            name: 'Gemini 1.5 Pro',
            displayName: 'Gemini 1.5 Pro',
            provider: 'google',
            contextLength: 2000000,
            maxOutputTokens: 8192,
            isMultimodal: true,
            supportedLanguages: ['ja', 'en', 'zh', 'ko', 'es', 'fr', 'de', 'it'],
            strengths: ['マルチモーダル', '長文処理', '検索連携'],
            useCase: ['研究', '分析', '検索', 'マルチメディア'],
            pricing: {
              inputTokenPrice: 0.00000125,
              outputTokenPrice: 0.000005
            },
            isEnabled: true,
            description: '最大200万トークンの長文処理が可能'
          },
          {
            id: 'gemini-1.5-flash',
            name: 'Gemini 1.5 Flash',
            displayName: 'Gemini 1.5 Flash',
            provider: 'google',
            contextLength: 1000000,
            maxOutputTokens: 8192,
            isMultimodal: true,
            supportedLanguages: ['ja', 'en', 'zh', 'ko'],
            strengths: ['高速処理', '経済性', 'マルチモーダル'],
            useCase: ['チャット', 'リアルタイム処理'],
            pricing: {
              inputTokenPrice: 0.000000075,
              outputTokenPrice: 0.0000003
            },
            isEnabled: true,
            description: '高速で経済的なGeminiモデル'
          }
        ],
        isEnabled: true,
        requiresApiKey: true,
        maxTokens: 2000000,
        supportedFeatures: [
          { id: 'text_generation', name: 'テキスト生成', description: '自然言語でのテキスト生成', supported: true },
          { id: 'code_generation', name: 'コード生成', description: 'プログラムコード生成', supported: true },
          { id: 'image_analysis', name: '画像分析', description: '画像の理解と分析', supported: true },
          { id: 'video_analysis', name: '動画分析', description: '動画の理解と分析', supported: true },
          { id: 'search_integration', name: '検索連携', description: 'Google検索との連携', supported: true }
        ],
        pricing: {
          inputTokenPrice: 0.00000125,
          outputTokenPrice: 0.000005,
          currency: 'USD'
        },
        status: 'available',
        lastHealthCheck: new Date()
      }
    ];
  }

  // 利用可能なプロバイダー一覧を取得
  public getAvailableProviders(): LLMProvider[] {
    return this.providers.filter(p => p.isEnabled);
  }

  // 利用可能なモデル一覧を取得
  public getAvailableModels(): LLMModel[] {
    return this.providers
      .filter(p => p.isEnabled)
      .flatMap(p => p.models.filter(m => m.isEnabled));
  }

  // 特定のプロバイダーのモデルを取得
  public getModelsByProvider(providerId: string): LLMModel[] {
    const provider = this.providers.find(p => p.id === providerId);
    return provider ? provider.models.filter(m => m.isEnabled) : [];
  }

  // 単一モデルでのメッセージ送信
  public async sendMessage(
    messages: ChatMessage[],
    modelId: string,
    settings?: {
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    }
  ): Promise<ChatMessage> {
    const model = this.getAvailableModels().find(m => m.id === modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    // デモ用の応答生成
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    const responses = [
      `${model.displayName}を使用した応答です。`,
      `こんにちは！${model.displayName}です。ご質問にお答えします。`,
      `${model.provider}の${model.displayName}による詳細な分析結果をお送りします。`,
      `${model.displayName}の強み（${model.strengths.join('、')}）を活用してお答えします。`,
    ];

    const response: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: responses[Math.floor(Math.random() * responses.length)] + 
               `\n\n最後のメッセージ: "${messages[messages.length - 1]?.content}"`,
      timestamp: new Date(),
      model: model.id,
      provider: model.provider,
      metadata: {
        tokenCount: Math.floor(Math.random() * 500) + 100,
        responseTime: Math.floor(Math.random() * 2000) + 500,
        cost: Math.random() * 0.01,
        temperature: settings?.temperature || 0.7,
        maxTokens: settings?.maxTokens || 1000
      }
    };

    // 使用統計を更新
    this.updateUsageStats(model.provider, model.id, response.metadata!);

    return response;
  }

  // 複数モデルでの比較応答
  public async sendMultiModelRequest(request: MultiLLMRequest): Promise<MultiLLMResponse> {
    const responses = await Promise.all(
      request.models.map(async (modelId) => {
        const model = this.getAvailableModels().find(m => m.id === modelId);
        if (!model) {
          return {
            model: modelId,
            provider: 'unknown',
            content: '',
            metadata: { responseTime: 0, tokenCount: 0, cost: 0 },
            error: `Model ${modelId} not found`
          };
        }

        // デモ用の遅延
        await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));

        const responseTime = Math.floor(Math.random() * 2000) + 500;
        const tokenCount = Math.floor(Math.random() * 500) + 100;
        const cost = tokenCount * model.pricing.outputTokenPrice;

        return {
          model: model.id,
          provider: model.provider,
          content: `【${model.displayName}の応答】\n\n${request.prompt}について、${model.displayName}の観点からお答えします。\n\n私の強みは${model.strengths.join('、')}です。この質問に対して、${model.useCase.join('、')}の経験を活かして回答いたします。`,
          metadata: {
            responseTime,
            tokenCount,
            cost,
            confidence: Math.random() * 0.3 + 0.7
          }
        };
      })
    );

    const comparison = request.settings?.compareResponses ? 
      this.generateComparison(request.prompt, responses) : undefined;

    return {
      requestId: `req-${Date.now()}`,
      responses,
      comparison,
      totalCost: responses.reduce((sum, r) => sum + r.metadata.cost, 0),
      totalResponseTime: Math.max(...responses.map(r => r.metadata.responseTime))
    };
  }

  // ストリーミング応答（デモ用）
  public async *streamResponse(
    messages: ChatMessage[],
    modelId: string,
    settings?: { temperature?: number; maxTokens?: number }
  ): AsyncGenerator<StreamingResponse, void, unknown> {
    const model = this.getAvailableModels().find(m => m.id === modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    const fullResponse = `${model.displayName}によるストリーミング応答です。この応答は段階的に配信されています。リアルタイムで応答が表示されることで、より自然な対話体験を提供します。`;
    
    const words = fullResponse.split('');
    
    for (let i = 0; i < words.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
      
      yield {
        id: `stream-${Date.now()}-${i}`,
        delta: words[i],
        isComplete: i === words.length - 1,
        metadata: {
          model: model.id,
          provider: model.provider,
          timestamp: new Date()
        }
      };
    }
  }

  // モデル比較の生成
  private generateComparison(prompt: string, responses: any[]): ModelComparison {
    // デモ用の簡単な比較分析
    const scores: { [modelId: string]: number } = {};
    let winner = '';
    let maxScore = 0;

    responses.forEach(response => {
      const score = Math.random() * 30 + 70; // 70-100の範囲
      scores[response.model] = score;
      if (score > maxScore) {
        maxScore = score;
        winner = response.model;
      }
    });

    return {
      id: `comparison-${Date.now()}`,
      prompt,
      responses: responses.map(r => ({
        ...r,
        metadata: {
          ...r.metadata,
          quality: Math.random() * 20 + 80,
          relevance: Math.random() * 15 + 85,
          creativity: Math.random() * 25 + 75
        }
      })),
      analysis: {
        winner,
        scores,
        reasoning: `${winner}が最も適切な応答を提供しました。品質、関連性、創造性の総合評価で優勝しています。`,
        criteria: ['品質', '関連性', '創造性', '有用性']
      },
      timestamp: new Date()
    };
  }

  // 使用統計の更新
  private updateUsageStats(provider: string, model: string, metadata: any) {
    const existingStats = this.usageStats.find(s => 
      s.provider === provider && s.model === model && s.period === 'day'
    );

    if (existingStats) {
      existingStats.data.requests += 1;
      existingStats.data.outputTokens += metadata.tokenCount || 0;
      existingStats.data.cost += metadata.cost || 0;
      existingStats.data.averageResponseTime = 
        (existingStats.data.averageResponseTime + (metadata.responseTime || 0)) / 2;
    } else {
      this.usageStats.push({
        provider,
        model,
        period: 'day',
        data: {
          requests: 1,
          inputTokens: 0,
          outputTokens: metadata.tokenCount || 0,
          cost: metadata.cost || 0,
          averageResponseTime: metadata.responseTime || 0,
          errorRate: 0,
          successRate: 100
        },
        timestamp: new Date()
      });
    }
  }

  // 使用統計の取得
  public getUsageStats(period: 'day' | 'week' | 'month' = 'day'): LLMUsageStats[] {
    return this.usageStats.filter(s => s.period === period);
  }

  // モデルパフォーマンスメトリクスの取得
  public getModelPerformanceMetrics(): ModelPerformanceMetrics[] {
    return this.getAvailableModels().map(model => ({
      model: model.id,
      provider: model.provider,
      metrics: {
        averageResponseTime: 1200 + Math.random() * 800,
        successRate: 95 + Math.random() * 4,
        errorRate: Math.random() * 2,
        averageTokensPerResponse: 250 + Math.random() * 200,
        costEfficiency: Math.random() * 20 + 80,
        userSatisfaction: Math.random() * 10 + 90
      },
      benchmarks: {
        coding: Math.random() * 20 + 80,
        reasoning: Math.random() * 15 + 85,
        creativity: Math.random() * 25 + 75,
        factualAccuracy: Math.random() * 10 + 90,
        conversational: Math.random() * 15 + 85
      },
      lastUpdated: new Date()
    }));
  }

  // ヘルスチェック
  public async performHealthCheck(): Promise<void> {
    for (const provider of this.providers) {
      try {
        // デモ用のヘルスチェック
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
        provider.status = Math.random() > 0.1 ? 'available' : 'rate_limited';
        provider.lastHealthCheck = new Date();
      } catch (error) {
        provider.status = 'error';
      }
    }
  }

  // 現在のセッション管理
  public setCurrentSession(session: ChatSession) {
    this.currentSession = session;
  }

  public getCurrentSession(): ChatSession | null {
    return this.currentSession;
  }

  // モデル推奨機能
  public recommendModel(
    useCase: string,
    requirements: {
      budget?: 'low' | 'medium' | 'high';
      speed?: 'fast' | 'medium' | 'slow';
      quality?: 'basic' | 'good' | 'excellent';
    }
  ): LLMModel | null {
    const models = this.getAvailableModels();
    
    // 簡単な推奨ロジック
    if (requirements.budget === 'low') {
      return models.find(m => m.pricing.outputTokenPrice < 0.000002) || models[0];
    }
    
    if (requirements.speed === 'fast') {
      return models.find(m => m.id.includes('flash') || m.id.includes('turbo')) || models[0];
    }
    
    if (requirements.quality === 'excellent') {
      return models.find(m => m.id.includes('gpt-4') || m.id.includes('claude-3.5')) || models[0];
    }
    
    return models[0];
  }

  // 後方互換性のためのメソッド（旧版との互換性）
  public getModelById(modelId: string): LLMModel | undefined {
    return this.getAvailableModels().find(model => model.id === modelId);
  }
}

export const multiLLMService = MultiLLMService.getInstance();