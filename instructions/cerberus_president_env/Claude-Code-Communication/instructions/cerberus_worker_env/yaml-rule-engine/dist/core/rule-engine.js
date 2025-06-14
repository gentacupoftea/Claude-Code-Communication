"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.YAMLRuleEngine = void 0;
const llm_context_injector_1 = require("./llm-context-injector");
const neural_evaluator_1 = require("./neural-evaluator");
const metrics_collector_1 = require("../metrics/metrics-collector");
const yaml = __importStar(require("js-yaml"));
const events_1 = require("events");
class YAMLRuleEngine extends events_1.EventEmitter {
    ruleSet = null;
    contextInjector;
    neuralEvaluator;
    metricsCollector;
    ruleCache = new Map();
    evaluationHistory = [];
    constructor() {
        super();
        this.contextInjector = new llm_context_injector_1.LLMContextInjector();
        this.neuralEvaluator = new neural_evaluator_1.NeuralEvaluator();
        this.metricsCollector = new metrics_collector_1.MetricsCollector();
    }
    // YAMLファイルからルールをロード
    async loadRulesFromYAML(yamlContent) {
        try {
            this.ruleSet = yaml.load(yamlContent);
            // ルールをキャッシュに格納
            this.ruleSet.rules.forEach(rule => {
                this.ruleCache.set(rule.id, rule);
            });
            // 神経網設定を適用
            if (this.ruleSet.neuralConfig) {
                this.neuralEvaluator.configure(this.ruleSet.neuralConfig);
            }
            // メトリクス収集開始
            this.metricsCollector.startCollection({
                ruleCount: this.ruleSet.rules.length,
                neuralEnabled: !!this.ruleSet.neuralConfig?.learningEnabled
            });
            this.emit('rulesLoaded', this.ruleSet);
        }
        catch (error) {
            this.emit('error', { type: 'loadError', error });
            throw error;
        }
    }
    // 動的ルール更新
    async updateRule(ruleId, updates) {
        const rule = this.ruleCache.get(ruleId);
        if (!rule) {
            throw new Error(`Rule ${ruleId} not found`);
        }
        const updatedRule = { ...rule, ...updates };
        updatedRule.metadata = {
            ...updatedRule.metadata,
            updatedAt: new Date()
        };
        this.ruleCache.set(ruleId, updatedRule);
        // ルールセット内も更新
        if (this.ruleSet) {
            const index = this.ruleSet.rules.findIndex(r => r.id === ruleId);
            if (index !== -1) {
                this.ruleSet.rules[index] = updatedRule;
            }
        }
        // 神経網の再学習をトリガー
        if (this.ruleSet?.neuralConfig?.learningEnabled) {
            await this.neuralEvaluator.retrainWithRule(updatedRule);
        }
        this.emit('ruleUpdated', { ruleId, updates });
    }
    // ルール評価（神経網型並列評価）
    async evaluate(context) {
        if (!this.ruleSet) {
            throw new Error('No rules loaded');
        }
        const startTime = Date.now();
        const results = [];
        // LLMへのコンテキスト注入
        const enrichedContext = await this.contextInjector.inject(context, this.ruleSet.globalContext);
        // 優先度でソート
        const sortedRules = [...this.ruleSet.rules].sort((a, b) => b.priority - a.priority);
        // 神経網型並列評価
        const parallelResults = await this.neuralEvaluator.evaluateParallel(sortedRules, enrichedContext);
        // 各ルールの評価
        for (let i = 0; i < sortedRules.length; i++) {
            const rule = sortedRules[i];
            const neuralResult = parallelResults[i];
            const result = await this.evaluateRule(rule, enrichedContext, neuralResult);
            results.push(result);
            // メトリクス記録
            this.metricsCollector.recordEvaluation({
                ruleId: rule.id,
                processingTime: result.processingTime,
                matched: result.matched,
                neuralScore: neuralResult.confidence
            });
            // 競合解決: 高優先度ルールがマッチしたら、同じターゲットの低優先度ルールをスキップ
            if (result.matched && result.executedActions.length > 0) {
                const targets = result.executedActions.map(a => a.target);
                // 後続のルールで同じターゲットを持つものをフィルタリング
                // （実装は簡略化）
            }
        }
        // 評価履歴に追加
        this.evaluationHistory.push(...results);
        // 予測的プリロード
        await this.predictivePreload(results, enrichedContext);
        const totalTime = Date.now() - startTime;
        this.emit('evaluationComplete', { results, totalTime });
        return results;
    }
    // 個別ルール評価
    async evaluateRule(rule, context, neuralResult) {
        const startTime = Date.now();
        // 条件評価
        const matched = await this.evaluateConditions(rule.conditions, context);
        const executedActions = [];
        let score = matched ? 1.0 : 0.0;
        // 神経網の信頼度を考慮
        if (rule.metadata?.neuralWeight) {
            score = score * (1 - rule.metadata.neuralWeight) +
                neuralResult.confidence * rule.metadata.neuralWeight;
        }
        // マッチした場合、アクションを実行
        if (matched && score > 0.5) {
            for (const action of rule.actions) {
                await this.executeAction(action, context);
                executedActions.push(action);
            }
        }
        return {
            ruleId: rule.id,
            matched,
            score,
            executedActions,
            processingTime: Date.now() - startTime,
            neuralActivation: neuralResult.activation
        };
    }
    // 条件評価
    async evaluateConditions(conditions, context) {
        let result = true;
        let currentOperator = 'AND';
        for (const condition of conditions) {
            const conditionResult = await this.evaluateCondition(condition, context);
            if (currentOperator === 'AND') {
                result = result && conditionResult;
            }
            else {
                result = result || conditionResult;
            }
            if (condition.operator) {
                currentOperator = condition.operator;
            }
        }
        return result;
    }
    // 個別条件評価
    async evaluateCondition(condition, context) {
        const fieldValue = this.getFieldValue(condition.field, context);
        switch (condition.type) {
            case 'equals':
                return fieldValue === condition.value;
            case 'contains':
                return String(fieldValue).includes(String(condition.value));
            case 'regex':
                return new RegExp(condition.value).test(String(fieldValue));
            case 'llm_evaluate':
                // LLMによる評価
                return await this.contextInjector.evaluateWithLLM(condition.llmPrompt || '', context);
            case 'custom':
                // カスタム評価関数（プラグイン可能）
                return false; // TODO: 実装
            default:
                return false;
        }
    }
    // アクション実行
    async executeAction(action, context) {
        switch (action.type) {
            case 'set':
                this.setFieldValue(action.target, action.value, context);
                break;
            case 'append':
                const current = this.getFieldValue(action.target, context) || [];
                this.setFieldValue(action.target, [...current, action.value], context);
                break;
            case 'llm_generate':
                // LLMによる生成
                const generated = await this.contextInjector.generateWithLLM(action.prompt || '', context);
                this.setFieldValue(action.target, generated, context);
                break;
            case 'trigger':
                // 外部関数のトリガー
                this.emit('actionTrigger', { functionName: action.functionName, context });
                break;
            case 'transform':
                // 値の変換
                // TODO: 実装
                break;
        }
    }
    // フィールド値取得（ネストしたパスに対応）
    getFieldValue(field, context) {
        const parts = field.split('.');
        let value = context;
        for (const part of parts) {
            value = value?.[part];
        }
        return value;
    }
    // フィールド値設定
    setFieldValue(field, value, context) {
        const parts = field.split('.');
        let target = context;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!target[parts[i]]) {
                target[parts[i]] = {};
            }
            target = target[parts[i]];
        }
        target[parts[parts.length - 1]] = value;
    }
    // 予測的ルールプリロード
    async predictivePreload(results, context) {
        // 最も頻繁に使用されるルールを特定
        const ruleUsageStats = this.analyzeRuleUsage();
        // 次に使用される可能性の高いルールを予測
        const predictedRules = await this.neuralEvaluator.predictNextRules(results, context, ruleUsageStats);
        // 予測されたルールをプリロード
        for (const ruleId of predictedRules) {
            const rule = this.ruleCache.get(ruleId);
            if (rule) {
                // ルールの事前コンパイルや最適化
                await this.contextInjector.precompile(rule);
            }
        }
    }
    // ルール使用統計の分析
    analyzeRuleUsage() {
        const stats = new Map();
        for (const result of this.evaluationHistory) {
            const count = stats.get(result.ruleId) || 0;
            stats.set(result.ruleId, count + 1);
        }
        return stats;
    }
    // 自己学習による最適化
    async optimizeRules() {
        if (!this.ruleSet?.neuralConfig?.learningEnabled) {
            return;
        }
        // 評価履歴から学習
        const optimizations = await this.neuralEvaluator.learnFromHistory(this.evaluationHistory);
        // ルールの優先度を調整
        for (const optimization of optimizations) {
            const rule = this.ruleCache.get(optimization.ruleId);
            if (rule) {
                await this.updateRule(optimization.ruleId, {
                    priority: optimization.newPriority,
                    metadata: {
                        ...rule.metadata,
                        neuralWeight: optimization.neuralWeight
                    }
                });
            }
        }
        this.emit('rulesOptimized', optimizations);
    }
    // メトリクス取得
    getMetrics() {
        return this.metricsCollector.getMetrics();
    }
}
exports.YAMLRuleEngine = YAMLRuleEngine;
