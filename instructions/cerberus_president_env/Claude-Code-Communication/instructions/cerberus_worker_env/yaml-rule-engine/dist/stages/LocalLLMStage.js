"use strict";
/**
 * Stage 4: ローカルLLM
 * オフライン推論による代替データ生成
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalLLMStage = void 0;
const logger_1 = require("../utils/logger");
const openai_1 = __importDefault(require("openai"));
const sdk_1 = require("@anthropic-ai/sdk");
class LocalLLMStage {
    name = 'local-llm';
    priority = 4;
    timeout = 15000; // LLMは時間がかかる可能性
    retryCount = 1;
    llmClient;
    config;
    constructor(config) {
        this.config = {
            temperature: 0.3,
            maxTokens: 500,
            systemPrompt: 'You are a helpful assistant that provides fallback data when primary sources are unavailable.',
            ...config
        };
        this.initializeLLMClient();
    }
    initializeLLMClient() {
        switch (this.config.provider) {
            case 'openai':
                this.llmClient = new openai_1.default({
                    apiKey: this.config.apiKey,
                    baseURL: this.config.baseURL
                });
                break;
            case 'anthropic':
                this.llmClient = new sdk_1.Anthropic({
                    apiKey: this.config.apiKey
                });
                break;
            case 'ollama':
                // Ollamaの場合はローカルエンドポイントを使用
                this.llmClient = new openai_1.default({
                    baseURL: this.config.baseURL || 'http://localhost:11434/v1',
                    apiKey: 'ollama' // Ollamaはキー不要だがライブラリが要求
                });
                break;
        }
    }
    async execute(input) {
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
        }
        catch (error) {
            logger_1.logger.error('Local LLM execution failed', {
                error: error.message,
                provider: this.config.provider
            });
            return {
                success: false,
                error: error,
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
    buildPrompt(input) {
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
    async generateResponse(prompt) {
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
    async generateOpenAIResponse(prompt) {
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
    async generateAnthropicResponse(prompt) {
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
    parseResponse(response) {
        // JSONレスポンスを試みる
        try {
            // JSONブロックを抽出
            const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[1]);
            }
            // 直接JSONパース
            return JSON.parse(response);
        }
        catch (error) {
            // JSONでない場合はテキストとして返す
            logger_1.logger.debug('LLM response is not JSON, returning as text');
            return { text: response };
        }
    }
    async healthCheck() {
        try {
            // 簡単なプロンプトでLLMの応答性を確認
            const testPrompt = 'Respond with "OK" if you are operational.';
            const response = await this.generateResponse(testPrompt);
            return response.toLowerCase().includes('ok');
        }
        catch (error) {
            logger_1.logger.error('LLM health check failed', error);
            return false;
        }
    }
}
exports.LocalLLMStage = LocalLLMStage;
