import { LLMModel, LLMResponse, MultiLLMRequest, ModelComparison } from '@/src/types/multillm';
import { multiLLMAPI } from '@/src/lib/api';

export class MultiLLMService {
  private static instance: MultiLLMService;
  
  // 利用可能なモデル一覧
  private availableModels: LLMModel[] = [
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      provider: 'openai',
      model: 'gpt-4-turbo-preview',
      description: '最新のGPT-4モデル。高度な推論と創造性を持つ',
      capabilities: ['text-generation', 'code-generation', 'analysis'],
      maxTokens: 128000,
      costPer1kTokens: { input: 0.01, output: 0.03 },
      isAvailable: true,
    },
    {
      id: 'claude-3-opus',
      name: 'Claude 3 Opus',
      provider: 'anthropic',
      model: 'claude-3-opus-20240229',
      description: 'Anthropicの最も高性能なモデル',
      capabilities: ['text-generation', 'code-generation', 'analysis', 'vision'],
      maxTokens: 200000,
      costPer1kTokens: { input: 0.015, output: 0.075 },
      isAvailable: true,
    },
    {
      id: 'gemini-pro',
      name: 'Gemini Pro',
      provider: 'google',
      model: 'gemini-pro',
      description: 'Googleの最新AIモデル',
      capabilities: ['text-generation', 'code-generation', 'multimodal'],
      maxTokens: 32000,
      costPer1kTokens: { input: 0.00125, output: 0.00375 },
      isAvailable: true,
    },
    {
      id: 'llama-3-70b',
      name: 'Llama 3 70B',
      provider: 'meta',
      model: 'llama-3-70b',
      description: 'Metaのオープンソース大規模言語モデル',
      capabilities: ['text-generation', 'code-generation'],
      maxTokens: 8192,
      costPer1kTokens: { input: 0.0008, output: 0.0024 },
      isAvailable: true,
    },
    {
      id: 'command-r-plus',
      name: 'Command R+',
      provider: 'cohere',
      model: 'command-r-plus',
      description: 'Cohereの最新エンタープライズモデル',
      capabilities: ['text-generation', 'retrieval', 'tool-use'],
      maxTokens: 128000,
      costPer1kTokens: { input: 0.003, output: 0.015 },
      isAvailable: true,
    },
  ];

  private constructor() {}

  public static getInstance(): MultiLLMService {
    if (!MultiLLMService.instance) {
      MultiLLMService.instance = new MultiLLMService();
    }
    return MultiLLMService.instance;
  }

  public getAvailableModels(): LLMModel[] {
    return this.availableModels;
  }

  public getModelById(modelId: string): LLMModel | undefined {
    return this.availableModels.find(model => model.id === modelId);
  }

  public async generateResponse(request: MultiLLMRequest): Promise<LLMResponse> {
    try {
      const modelConfig = this.getModelById(request.models[0]);
      if (!modelConfig) {
        throw new Error(`Model ${request.models[0]} not found`);
      }

      const response = await multiLLMAPI.sendMessage(
        [{ role: 'user', content: request.prompt }],
        {
          model: modelConfig.model,
          temperature: request.temperature || 0.7,
          max_tokens: request.maxTokens || 1000,
          system_prompt: request.systemPrompt || 'あなたは親切で知識豊富なAIアシスタントです。',
        }
      );

      return {
        id: Date.now().toString(),
        model: request.models[0],
        content: response.message,
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        } : undefined,
      };
    } catch (error) {
      throw new Error(`Failed to generate response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async compareModels(request: MultiLLMRequest): Promise<ModelComparison> {
    const startTime = Date.now();
    const responses = await Promise.all(
      request.models.map(async (modelId) => {
        const modelStartTime = Date.now();
        try {
          const response = await this.generateResponse({
            ...request,
            models: [modelId],
          });
          return {
            model: modelId,
            response,
            responseTime: Date.now() - modelStartTime,
          };
        } catch (error) {
          return {
            model: modelId,
            response: {} as LLMResponse,
            responseTime: Date.now() - modelStartTime,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    return {
      prompt: request.prompt,
      responses,
      timestamp: new Date().toISOString(),
    };
  }

  public async* streamResponse(
    request: MultiLLMRequest
  ): AsyncGenerator<string, void, unknown> {
    // ストリーミングレスポンスの実装
    // 現在のAPI構造に合わせて後で実装
    yield* this.generateStreamResponse(request);
  }

  private async* generateStreamResponse(request: MultiLLMRequest): AsyncGenerator<string, void, unknown> {
    try {
      const response = await this.generateResponse(request);
      const words = response.content.split(' ');
      
      for (const word of words) {
        yield word + ' ';
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (error) {
      yield `エラー: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
}

export const multiLLMService = MultiLLMService.getInstance();