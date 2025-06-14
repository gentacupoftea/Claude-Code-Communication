import { Rule, NeuralConfig, EvaluationResult } from '../types/rule.types';
interface NeuralResult {
    confidence: number;
    activation: number[];
}
interface RuleOptimization {
    ruleId: string;
    newPriority: number;
    neuralWeight: number;
}
export declare class NeuralEvaluator {
    private config;
    private neuralNetwork;
    private workers;
    private evaluationPatterns;
    constructor();
    configure(config: NeuralConfig): void;
    evaluateParallel(rules: Rule[], context: Record<string, any>): Promise<NeuralResult[]>;
    retrainWithRule(rule: Rule): Promise<void>;
    predictNextRules(currentResults: EvaluationResult[], context: Record<string, any>, usageStats: Map<string, number>): Promise<string[]>;
    learnFromHistory(history: EvaluationResult[]): Promise<RuleOptimization[]>;
    private initializeWorkers;
    private adjustWorkerPool;
    private chunkRules;
    private evaluateChunk;
    private extractRulePattern;
    private extractContextPattern;
    private calculatePatternSimilarity;
    private calculateOptimalNeuralWeight;
}
export {};
//# sourceMappingURL=neural-evaluator.d.ts.map