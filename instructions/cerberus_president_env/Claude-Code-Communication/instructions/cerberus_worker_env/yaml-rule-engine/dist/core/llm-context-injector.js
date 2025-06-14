"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMContextInjector = void 0;
const openai_1 = require("openai");
const anthropic_1 = __importDefault(require("anthropic"));
class LLMContextInjector {
    openai = null;
    anthropic = null;
    contextCache = new Map();
    compiledPrompts = new Map();
    constructor() {
        // API キーが設定されている場合のみ初期化
        if (process.env.OPENAI_API_KEY) {
            this.openai = new openai_1.OpenAI({
                apiKey: process.env.OPENAI_API_KEY
            });
        }
        if (process.env.ANTHROPIC_API_KEY) {
            this.anthropic = new anthropic_1.default({
                apiKey: process.env.ANTHROPIC_API_KEY
            });
        }
    }
    // コンテキストをLLM用に強化
    async inject(userContext, globalContext) {
        const cacheKey = JSON.stringify({ userContext, globalContext });
        // キャッシュチェック
        if (this.contextCache.has(cacheKey)) {
            return this.contextCache.get(cacheKey);
        }
        const enrichedContext = {
            ...globalContext,
            ...userContext,
            _metadata: {
                timestamp: new Date().toISOString(),
                contextVersion: '1.0',
                injectionType: 'llm-enhanced'
            }
        };
        // コンテキストの意味的拡張
        if (this.anthropic || this.openai) {
            enrichedContext._semantic = await this.extractSemanticContext(userContext);
        }
        // キャッシュに保存
        this.contextCache.set(cacheKey, enrichedContext);
        return enrichedContext;
    }
    // LLMによる条件評価
    async evaluateWithLLM(prompt, context) {
        if (!this.anthropic && !this.openai) {
            console.warn('No LLM configured, falling back to false');
            return false;
        }
        const evaluationPrompt = this.buildEvaluationPrompt(prompt, context);
        try {
            let response;
            if (this.anthropic) {
                const completion = await this.anthropic.messages.create({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 100,
                    temperature: 0,
                    system: 'You are a rule evaluation system. Answer only with "true" or "false".',
                    messages: [{
                            role: 'user',
                            content: evaluationPrompt
                        }]
                });
                response = completion.content[0].type === 'text' ? completion.content[0].text : '';
            }
            else if (this.openai) {
                const completion = await this.openai.chat.completions.create({
                    model: 'gpt-4-turbo-preview',
                    temperature: 0,
                    max_tokens: 100,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a rule evaluation system. Answer only with "true" or "false".'
                        },
                        {
                            role: 'user',
                            content: evaluationPrompt
                        }
                    ]
                });
                response = completion.choices[0].message.content || '';
            }
            else {
                return false;
            }
            return response.toLowerCase().includes('true');
        }
        catch (error) {
            console.error('LLM evaluation error:', error);
            return false;
        }
    }
    // LLMによるコンテンツ生成
    async generateWithLLM(prompt, context) {
        if (!this.anthropic && !this.openai) {
            return 'LLM not configured';
        }
        const generationPrompt = this.buildGenerationPrompt(prompt, context);
        try {
            if (this.anthropic) {
                const completion = await this.anthropic.messages.create({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 500,
                    temperature: 0.7,
                    messages: [{
                            role: 'user',
                            content: generationPrompt
                        }]
                });
                return completion.content[0].type === 'text' ? completion.content[0].text : '';
            }
            else if (this.openai) {
                const completion = await this.openai.chat.completions.create({
                    model: 'gpt-4-turbo-preview',
                    temperature: 0.7,
                    max_tokens: 500,
                    messages: [{
                            role: 'user',
                            content: generationPrompt
                        }]
                });
                return completion.choices[0].message.content || '';
            }
        }
        catch (error) {
            console.error('LLM generation error:', error);
            return 'Generation failed';
        }
        return '';
    }
    // ルールの事前コンパイル
    async precompile(rule) {
        // 条件のLLMプロンプトをコンパイル
        for (const condition of rule.conditions) {
            if (condition.type === 'llm_evaluate' && condition.llmPrompt) {
                const compiled = this.optimizePrompt(condition.llmPrompt);
                this.compiledPrompts.set(`${rule.id}_${condition.field}`, compiled);
            }
        }
        // アクションのLLMプロンプトをコンパイル
        for (const action of rule.actions) {
            if (action.type === 'llm_generate' && action.prompt) {
                const compiled = this.optimizePrompt(action.prompt);
                this.compiledPrompts.set(`${rule.id}_${action.target}`, compiled);
            }
        }
    }
    // セマンティックコンテキストの抽出
    async extractSemanticContext(context) {
        const contextSummary = JSON.stringify(context, null, 2);
        const prompt = `Extract key semantic information from this context:
${contextSummary}

Provide:
1. Main entities
2. Key relationships
3. Implicit intentions
4. Potential actions

Format as JSON.`;
        try {
            if (this.anthropic) {
                const completion = await this.anthropic.messages.create({
                    model: 'claude-3-haiku-20240307',
                    max_tokens: 300,
                    temperature: 0.3,
                    messages: [{
                            role: 'user',
                            content: prompt
                        }]
                });
                const response = completion.content[0].type === 'text' ? completion.content[0].text : '{}';
                return JSON.parse(response);
            }
            else if (this.openai) {
                const completion = await this.openai.chat.completions.create({
                    model: 'gpt-3.5-turbo',
                    temperature: 0.3,
                    max_tokens: 300,
                    response_format: { type: 'json_object' },
                    messages: [{
                            role: 'user',
                            content: prompt
                        }]
                });
                return JSON.parse(completion.choices[0].message.content || '{}');
            }
        }
        catch (error) {
            console.error('Semantic extraction error:', error);
        }
        return {};
    }
    // 評価プロンプトの構築
    buildEvaluationPrompt(prompt, context) {
        const compiledPrompt = this.compiledPrompts.get(prompt) || prompt;
        return `Given the following context:
${JSON.stringify(context, null, 2)}

Evaluate this condition:
${compiledPrompt}

Answer only "true" or "false".`;
    }
    // 生成プロンプトの構築
    buildGenerationPrompt(prompt, context) {
        const compiledPrompt = this.compiledPrompts.get(prompt) || prompt;
        return `Given the following context:
${JSON.stringify(context, null, 2)}

${compiledPrompt}`;
    }
    // プロンプトの最適化
    optimizePrompt(prompt) {
        // プロンプトの最適化ロジック
        // - 冗長な部分の削除
        // - 明確な指示の追加
        // - コンテキスト変数の効率的な配置
        return prompt
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/\{\{(\w+)\}\}/g, '${context.$1}');
    }
    // キャッシュクリア
    clearCache() {
        this.contextCache.clear();
        this.compiledPrompts.clear();
    }
}
exports.LLMContextInjector = LLMContextInjector;
