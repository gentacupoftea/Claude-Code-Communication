import { Rule } from '../types/rule.types';
export declare class LLMContextInjector {
    private openai;
    private anthropic;
    private contextCache;
    private compiledPrompts;
    constructor();
    inject(userContext: Record<string, any>, globalContext?: Record<string, any>): Promise<Record<string, any>>;
    evaluateWithLLM(prompt: string, context: Record<string, any>): Promise<boolean>;
    generateWithLLM(prompt: string, context: Record<string, any>): Promise<string>;
    precompile(rule: Rule): Promise<void>;
    private extractSemanticContext;
    private buildEvaluationPrompt;
    private buildGenerationPrompt;
    private optimizePrompt;
    clearCache(): void;
}
//# sourceMappingURL=llm-context-injector.d.ts.map