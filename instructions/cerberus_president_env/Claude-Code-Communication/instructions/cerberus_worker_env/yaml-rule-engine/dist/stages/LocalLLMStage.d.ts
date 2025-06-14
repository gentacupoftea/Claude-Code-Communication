/**
 * Stage 4: ローカルLLM
 * オフライン推論による代替データ生成
 */
import { IFallbackStage, FallbackResult } from '../interfaces/IFallbackService';
export interface LocalLLMConfig {
    provider: 'openai' | 'anthropic' | 'ollama';
    apiKey?: string;
    model?: string;
    baseURL?: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
}
export declare class LocalLLMStage implements IFallbackStage {
    name: string;
    priority: number;
    timeout: number;
    retryCount: number;
    private llmClient;
    private config;
    constructor(config: LocalLLMConfig);
    private initializeLLMClient;
    execute(input: any): Promise<FallbackResult>;
    private buildPrompt;
    private generateResponse;
    private generateOpenAIResponse;
    private generateAnthropicResponse;
    private parseResponse;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=LocalLLMStage.d.ts.map