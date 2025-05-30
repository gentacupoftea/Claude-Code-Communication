interface APIConfig {
  endpoint: string;
  apiKey: string;
  model: string;
  maxRetries: number;
}

export class LLMAPIService {
  private config: APIConfig;

  constructor(config: APIConfig) {
    this.config = config;
  }

  async callLLM(
    prompt: string, 
    options: {
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
    } = {}
  ): Promise<any> {
    const payload = {
      model: this.config.model,
      messages: [
        {
          role: 'system',
          content: 'あなたは高度な分析能力を持つAIアシスタントです。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 1000,
      stream: options.stream || false
    };

    let retries = 0;
    while (retries < this.config.maxRetries) {
      try {
        const response = await fetch(this.config.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
      } catch (error) {
        retries++;
        if (retries >= this.config.maxRetries) {
          throw error;
        }
        await this.sleep(1000 * retries); // 指数バックオフ
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}