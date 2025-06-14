export interface Rule {
    id: string;
    name: string;
    description?: string;
    priority: number;
    conditions: Condition[];
    actions: Action[];
    metadata?: RuleMetadata;
}
export interface Condition {
    type: 'contains' | 'equals' | 'regex' | 'custom' | 'llm_evaluate';
    field: string;
    value: any;
    operator?: 'AND' | 'OR';
    llmPrompt?: string;
}
export interface Action {
    type: 'set' | 'append' | 'transform' | 'llm_generate' | 'trigger';
    target: string;
    value?: any;
    prompt?: string;
    functionName?: string;
}
export interface RuleMetadata {
    version: string;
    author?: string;
    createdAt: Date;
    updatedAt: Date;
    tags?: string[];
    neuralWeight?: number;
    learningRate?: number;
}
export interface RuleSet {
    version: string;
    name: string;
    rules: Rule[];
    globalContext?: Record<string, any>;
    neuralConfig?: NeuralConfig;
}
export interface NeuralConfig {
    parallelismLevel: number;
    layerDepth: number;
    activationThreshold: number;
    learningEnabled: boolean;
}
export interface EvaluationResult {
    ruleId: string;
    matched: boolean;
    score: number;
    executedActions: Action[];
    processingTime: number;
    neuralActivation?: number[];
}
//# sourceMappingURL=rule.types.d.ts.map