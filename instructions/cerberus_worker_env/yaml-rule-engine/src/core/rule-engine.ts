import { Rule, RuleSet, EvaluationResult, Condition, Action } from '../types/rule.types';
import { LLMContextInjector } from './llm-context-injector';
import { NeuralEvaluator } from './neural-evaluator';
import { MetricsCollector } from '../metrics/metrics-collector';
import * as yaml from 'js-yaml';
import { EventEmitter } from 'events';

export class YAMLRuleEngine extends EventEmitter {
  private ruleSet: RuleSet | null = null;
  private contextInjector: LLMContextInjector;
  private neuralEvaluator: NeuralEvaluator;
  private metricsCollector: MetricsCollector;
  private ruleCache: Map<string, Rule> = new Map();
  private evaluationHistory: EvaluationResult[] = [];

  constructor() {
    super();
    this.contextInjector = new LLMContextInjector();
    this.neuralEvaluator = new NeuralEvaluator();
    this.metricsCollector = new MetricsCollector();
  }

  // YAMLファイルからルールをロード
  async loadRulesFromYAML(yamlContent: string): Promise<void> {
    try {
      this.ruleSet = yaml.load(yamlContent) as RuleSet;
      
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
    } catch (error) {
      this.emit('error', { type: 'loadError', error });
      throw error;
    }
  }

  // 動的ルール更新
  async updateRule(ruleId: string, updates: Partial<Rule>): Promise<void> {
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
  async evaluate(context: Record<string, any>): Promise<EvaluationResult[]> {
    if (!this.ruleSet) {
      throw new Error('No rules loaded');
    }

    const startTime = Date.now();
    const results: EvaluationResult[] = [];

    // LLMへのコンテキスト注入
    const enrichedContext = await this.contextInjector.inject(context, this.ruleSet.globalContext);

    // 優先度でソート
    const sortedRules = [...this.ruleSet.rules].sort((a, b) => b.priority - a.priority);

    // 神経網型並列評価
    const parallelResults = await this.neuralEvaluator.evaluateParallel(
      sortedRules,
      enrichedContext
    );

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
  private async evaluateRule(
    rule: Rule,
    context: Record<string, any>,
    neuralResult: { confidence: number; activation: number[] }
  ): Promise<EvaluationResult> {
    const startTime = Date.now();
    
    // 条件評価
    const matched = await this.evaluateConditions(rule.conditions, context);
    
    const executedActions: Action[] = [];
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
  private async evaluateConditions(conditions: Condition[], context: Record<string, any>): Promise<boolean> {
    let result = true;
    let currentOperator: 'AND' | 'OR' = 'AND';

    for (const condition of conditions) {
      const conditionResult = await this.evaluateCondition(condition, context);
      
      if (currentOperator === 'AND') {
        result = result && conditionResult;
      } else {
        result = result || conditionResult;
      }

      if (condition.operator) {
        currentOperator = condition.operator;
      }
    }

    return result;
  }

  // 個別条件評価
  private async evaluateCondition(condition: Condition, context: Record<string, any>): Promise<boolean> {
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
        return await this.contextInjector.evaluateWithLLM(
          condition.llmPrompt || '',
          context
        );
      
      case 'custom':
        // カスタム評価関数（プラグイン可能）
        return false; // TODO: 実装
      
      default:
        return false;
    }
  }

  // アクション実行
  private async executeAction(action: Action, context: Record<string, any>): Promise<void> {
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
        const generated = await this.contextInjector.generateWithLLM(
          action.prompt || '',
          context
        );
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
  private getFieldValue(field: string, context: Record<string, any>): any {
    const parts = field.split('.');
    let value = context;
    
    for (const part of parts) {
      value = value?.[part];
    }
    
    return value;
  }

  // フィールド値設定
  private setFieldValue(field: string, value: any, context: Record<string, any>): void {
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
  private async predictivePreload(
    results: EvaluationResult[],
    context: Record<string, any>
  ): Promise<void> {
    // 最も頻繁に使用されるルールを特定
    const ruleUsageStats = this.analyzeRuleUsage();
    
    // 次に使用される可能性の高いルールを予測
    const predictedRules = await this.neuralEvaluator.predictNextRules(
      results,
      context,
      ruleUsageStats
    );

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
  private analyzeRuleUsage(): Map<string, number> {
    const stats = new Map<string, number>();
    
    for (const result of this.evaluationHistory) {
      const count = stats.get(result.ruleId) || 0;
      stats.set(result.ruleId, count + 1);
    }
    
    return stats;
  }

  // 自己学習による最適化
  async optimizeRules(): Promise<void> {
    if (!this.ruleSet?.neuralConfig?.learningEnabled) {
      return;
    }

    // 評価履歴から学習
    const optimizations = await this.neuralEvaluator.learnFromHistory(
      this.evaluationHistory
    );

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