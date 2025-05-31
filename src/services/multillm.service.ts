import { LLMModel } from '@/src/types/multillm';

interface CompareRequest {
  prompt: string;
  models: string[];
}

interface CompareResponse {
  responses: Array<{
    model: string;
    response: {
      content: string;
    };
    error?: string;
  }>;
}

class MultiLLMService {
  private models: LLMModel[] = [
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      provider: 'OpenAI',
      description: 'Most capable GPT-4 model'
    },
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      provider: 'OpenAI',
      description: 'Fast and cost-effective'
    },
    {
      id: 'claude-3-opus',
      name: 'Claude 3 Opus',
      provider: 'Anthropic',
      description: 'High intelligence model'
    }
  ];

  getAvailableModels(): LLMModel[] {
    return this.models;
  }

  getModelById(id: string): LLMModel | undefined {
    return this.models.find(model => model.id === id);
  }

  async compareModels(request: CompareRequest): Promise<CompareResponse> {
    // デモ用の実装
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      responses: request.models.map(model => ({
        model,
        response: {
          content: `デモ応答 (${this.getModelById(model)?.name}): ${request.prompt}に対する回答です。`
        }
      }))
    };
  }
}

export const multiLLMService = new MultiLLMService();