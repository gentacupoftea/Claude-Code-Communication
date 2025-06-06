// ルーティングロジック最適化ツール

import * as fs from 'fs/promises';
import * as path from 'path';
import { LLMRouter } from '../llm/router';

interface BenchmarkResult {
  provider: string;
  scores: {
    overall: number;
    [key: string]: number;
  };
  category?: string;
  difficulty?: string;
  passed?: boolean;
  [key: string]: unknown;
}

interface BenchmarkResults {
  results: BenchmarkResult[];
  [key: string]: unknown;
}

interface AnalysisData {
  providerAccuracy: Map<string, { sum: number; count: number }>;
  categoryProviderFit: Map<string, Map<string, { sum: number; count: number }>>;
  difficultyProviderFit: Map<string, Map<string, { sum: number; count: number }>>;
  misroutedQuestions: unknown[];
}

interface FinalizedAnalysis {
  providerAccuracy: Record<string, number>;
  categoryProviderFit: Record<string, Record<string, number>>;
  difficultyProviderFit: Record<string, Record<string, number>>;
  misroutedQuestions: unknown[];
}

interface RoutingOptimizationResult {
  originalRules: unknown;
  optimizedRules: unknown;
  changes: Array<{
    type: string;
    description: string;
    impact: string;
  }>;
  testResults?: {
    accuracyBefore: number;
    accuracyAfter: number;
    improvement: number;
  };
}

export class RoutingOptimizer {
  private router: LLMRouter;
  private optimizationLog: RoutingOptimizationResult[] = [];

  constructor() {
    this.router = new LLMRouter();
  }

  async optimizeRouting(
    benchmarkResults: BenchmarkResults,
    failureAnalysis?: unknown
  ): Promise<void> {
    console.log('\n🚦 ルーティング最適化開始\n');

    // 現在のルーティング性能を分析
    const performanceAnalysis = this.analyzeRoutingPerformance(benchmarkResults);
    
    // 最適化ルールの生成
    const optimizationRules = this.generateOptimizationRules(
      performanceAnalysis,
      failureAnalysis
    );

    // ルールの適用とテスト
    for (const rule of optimizationRules) {
      const result = await this.applyAndTestRule(rule, benchmarkResults);
      this.optimizationLog.push(result);
      
      console.log(`✅ ${rule.type}: ${result.testResults?.improvement.toFixed(1)}%改善`);
    }

    // 最適化結果の保存
    await this.saveOptimizationResults();
  }

  private analyzeRoutingPerformance(benchmarkResults: BenchmarkResults): FinalizedAnalysis {
    const analysis: AnalysisData = {
      providerAccuracy: new Map<string, { sum: number; count: number }>(),
      categoryProviderFit: new Map<string, Map<string, { sum: number; count: number }>>(),
      difficultyProviderFit: new Map<string, Map<string, { sum: number; count: number }>>(),
      misroutedQuestions: [] as unknown[]
    };

    // プロバイダー別の精度計算
    benchmarkResults.results.forEach((result: BenchmarkResult) => {
      const provider = result.provider;
      const score = result.scores.overall;
      
      // プロバイダー全体の精度
      const current = analysis.providerAccuracy.get(provider) || { sum: 0, count: 0 };
      current.sum += score;
      current.count += 1;
      analysis.providerAccuracy.set(provider, current);

      // カテゴリ×プロバイダーの適合度
      if (result.category && !analysis.categoryProviderFit.has(result.category)) {
        analysis.categoryProviderFit.set(result.category, new Map());
      }
      if (result.category) {
        const categoryMap = analysis.categoryProviderFit.get(result.category)!;
        const catCurrent = categoryMap.get(provider) || { sum: 0, count: 0 };
        catCurrent.sum += score;
        catCurrent.count += 1;
        categoryMap.set(provider, catCurrent);
      }

      // 明らかにミスルーティングされた質問
      if (score < 0.5) {
        analysis.misroutedQuestions.push({
          questionId: result.questionId,
          category: result.category,
          difficulty: result.difficulty,
          provider: result.provider,
          score: score
        });
      }
    });

    return this.finalizeAnalysis(analysis);
  }

  private finalizeAnalysis(analysis: AnalysisData): FinalizedAnalysis {
    const finalized: FinalizedAnalysis = {
      providerAccuracy: {},
      categoryProviderFit: {},
      difficultyProviderFit: {},
      misroutedQuestions: analysis.misroutedQuestions
    };

    // 平均値の計算
    analysis.providerAccuracy.forEach((value, provider: string) => {
      finalized.providerAccuracy[provider] = value.sum / value.count;
    });

    analysis.categoryProviderFit.forEach((providerMap, category: string) => {
      finalized.categoryProviderFit[category] = {};
      providerMap.forEach((value, provider: string) => {
        finalized.categoryProviderFit[category][provider] = value.sum / value.count;
      });
    });

    return finalized;
  }

  private generateOptimizationRules(
    performanceAnalysis: FinalizedAnalysis,
    failureAnalysis?: unknown
  ): Array<{
    type: string;
    rule: unknown;
    priority: number;
  }> {
    const rules: Array<{ type: string; rule: unknown; priority: number }> = [];

    // ルール1: カテゴリ別の最適プロバイダーマッピング更新
    Object.entries(performanceAnalysis.categoryProviderFit).forEach(([category, providers]: [string, Record<string, number>]) => {
      const bestProvider = Object.entries(providers)
        .sort(([, a], [, b]) => b - a)[0];
      
      if (bestProvider) {
        rules.push({
          type: `category_mapping_${category}`,
          rule: {
            category,
            preferredProvider: bestProvider[0],
            confidence: bestProvider[1]
          },
          priority: 1
        });
      }
    });

    // ルール2: 複雑性スコアリングの調整
    if (failureAnalysis && typeof failureAnalysis === 'object' && 'commonPatterns' in failureAnalysis) {
      const commonPatterns = (failureAnalysis as { commonPatterns: unknown }).commonPatterns;
      if (Array.isArray(commonPatterns)) {
        const complexityAdjustments = this.deriveComplexityAdjustments(
          commonPatterns as Array<{ pattern: string; frequency: number }>
        );
        
        rules.push({
          type: 'complexity_scoring',
          rule: complexityAdjustments,
          priority: 2
        });
      }
    }

    // ルール3: プロバイダー強みの再定義
    const providerStrengthUpdates = this.calculateProviderStrengths(
      performanceAnalysis
    );
    
    rules.push({
      type: 'provider_strengths',
      rule: providerStrengthUpdates,
      priority: 3
    });

    // ルール4: フォールバック戦略の改善
    const fallbackRules = this.generateFallbackRules(
      performanceAnalysis.misroutedQuestions
    );
    
    if (fallbackRules.length > 0) {
      rules.push({
        type: 'fallback_strategy',
        rule: fallbackRules,
        priority: 4
      });
    }

    return rules.sort((a, b) => a.priority - b.priority);
  }

  private deriveComplexityAdjustments(
    commonPatterns: Array<{ pattern: string; frequency: number }>
  ): {
    weights: Record<string, number>;
    thresholds: Record<string, number>;
  } {
    const adjustments = {
      weights: {} as Record<string, number>,
      thresholds: {} as Record<string, number>
    };

    commonPatterns.forEach(pattern => {
      if (pattern.pattern.includes('長文')) {
        adjustments.weights.lengthWeight = 2.5; // 現在の2から増加
        adjustments.thresholds.longQuestionThreshold = 250; // 300から減少
      }
      
      if (pattern.pattern.includes('複数要求')) {
        adjustments.weights.multipleRequirementsWeight = 1.5; // 追加の重み
      }
      
      if (pattern.pattern.includes('専門用語')) {
        adjustments.weights.technicalTermWeight = 0.8; // 新しい重み
      }
    });

    return adjustments;
  }

  private calculateProviderStrengths(performanceAnalysis: FinalizedAnalysis): Record<string, { strengths: string[]; weaknesses: string[] }> {
    const strengths: Record<string, { strengths: string[]; weaknesses: string[] }> = {
      claude: { strengths: [], weaknesses: [] },
      gemini: { strengths: [], weaknesses: [] },
      'gpt-4': { strengths: [], weaknesses: [] }
    };

    // カテゴリ別の強み・弱みを特定
    Object.entries(performanceAnalysis.categoryProviderFit).forEach(([category, providers]: [string, Record<string, number>]) => {
      const sortedProviders = Object.entries(providers)
        .sort(([, a]: [string, number], [, b]: [string, number]) => b - a) as [string, number][];
      
      // 最高性能のプロバイダー
      if (sortedProviders[0] && sortedProviders[0][1] > 0.8) {
        const providerName = sortedProviders[0][0] as keyof typeof strengths;
        if (providerName in strengths) {
          strengths[providerName].strengths.push(category);
        }
      }
      
      // 最低性能のプロバイダー
      if (sortedProviders[sortedProviders.length - 1] && 
          sortedProviders[sortedProviders.length - 1][1] < 0.6) {
        const providerName = sortedProviders[sortedProviders.length - 1][0] as keyof typeof strengths;
        if (providerName in strengths) {
          strengths[providerName].weaknesses.push(category);
        }
      }
    });

    return strengths;
  }

  private generateFallbackRules(misroutedQuestions: unknown[]): unknown[] {
    const rules: unknown[] = [];
    
    // パターン分析
    const patterns = new Map<string, number>();
    
    misroutedQuestions.forEach(q => {
      if (q && typeof q === 'object' && 'category' in q && 'difficulty' in q) {
        const item = q as { category: string; difficulty: string };
        const pattern = `${item.category}_${item.difficulty}`;
        patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
      }
    });

    // 頻出パターンに対するフォールバックルール
    patterns.forEach((count, pattern) => {
      if (count >= 3) { // 3回以上失敗したパターン
        const [category, difficulty] = pattern.split('_');
        rules.push({
          condition: { category, difficulty },
          action: 'use_ensemble', // 複数プロバイダーの結果を統合
          confidence_threshold: 0.6
        });
      }
    });

    return rules;
  }

  private async applyAndTestRule(
    rule: { type: string; rule: unknown; priority: number },
    benchmarkResults: BenchmarkResults
  ): Promise<RoutingOptimizationResult> {
    // 元のルールを保存
    const originalRules = this.captureCurrentRules();
    
    // ルールを適用（実際の実装では実際にルーターを更新）
    const optimizedRules = this.applyRule(originalRules, rule);
    
    // テスト実行（シミュレーション）
    const testResults = this.simulateRouting(
      benchmarkResults,
      originalRules,
      optimizedRules
    );

    return {
      originalRules,
      optimizedRules,
      changes: [{
        type: rule.type,
        description: this.describeRule(rule),
        impact: `${testResults.improvement.toFixed(1)}%改善`
      }],
      testResults
    };
  }

  private captureCurrentRules(): unknown {
    // 現在のルーティングルールをキャプチャ（簡略化）
    return {
      providerStrengths: {
        claude: ['data_analysis', 'explanation'],
        gemini: ['creative_suggestion', 'strategic_planning'],
        'gpt-4': ['prediction', 'optimization']
      },
      complexityWeights: {
        lengthWeight: 2,
        requirementsWeight: 0.5,
        technicalWeight: 0.5
      }
    };
  }

  private applyRule(originalRules: unknown, rule: { type: string; rule: unknown; priority: number }): unknown {
    const optimized = JSON.parse(JSON.stringify(originalRules));
    
    switch (rule.type) {
      case 'complexity_scoring':
        if (rule.rule && typeof rule.rule === 'object' && 'weights' in rule.rule) {
          Object.assign(optimized.complexityWeights, (rule.rule as { weights: unknown }).weights);
        }
        break;
        
      case 'provider_strengths':
        if (rule.rule && typeof rule.rule === 'object') {
          Object.entries(rule.rule).forEach(([provider, updates]: [string, unknown]) => {
            if (updates && typeof updates === 'object' && 'strengths' in updates) {
              optimized.providerStrengths[provider] = (updates as { strengths: unknown }).strengths;
            }
          });
        }
        break;
        
      default:
        if (rule.type.startsWith('category_mapping_')) {
          if (!optimized.categoryMappings) {
            optimized.categoryMappings = {};
          }
          if (rule.rule && typeof rule.rule === 'object' && 'category' in rule.rule && 'preferredProvider' in rule.rule) {
            const ruleData = rule.rule as { category: string; preferredProvider: string };
            optimized.categoryMappings[ruleData.category] = ruleData.preferredProvider;
          }
        }
    }
    
    return optimized;
  }

  private simulateRouting(
    benchmarkResults: BenchmarkResults,
    originalRules: unknown,
    optimizedRules: unknown
  ): { accuracyBefore: number; accuracyAfter: number; improvement: number } {
    let originalCorrect = 0;
    let optimizedCorrect = 0;
    let total = 0;

    benchmarkResults.results.forEach((result: BenchmarkResult) => {
      total++;
      
      // 元のルーティングでの正解率
      if (result.passed) {
        originalCorrect++;
      }
      
      // 最適化されたルーティングでの予測
      const newProvider = this.predictProvider(
        result,
        optimizedRules
      );
      
      // 新しいプロバイダーでより良い結果が期待できるか
      if (this.wouldImprove(result, newProvider)) {
        optimizedCorrect++;
      } else if (result.passed) {
        optimizedCorrect++; // 既に成功している場合は維持
      }
    });

    const accuracyBefore = originalCorrect / total;
    const accuracyAfter = optimizedCorrect / total;
    const improvement = ((accuracyAfter - accuracyBefore) / accuracyBefore) * 100;

    return {
      accuracyBefore,
      accuracyAfter,
      improvement
    };
  }

  private predictProvider(result: BenchmarkResult, rules: unknown): string {
    // カテゴリマッピングがある場合
    if (rules && typeof rules === 'object' && 'categoryMappings' in rules) {
      const rulesObj = rules as { categoryMappings: Record<string, string> };
      if (result.category && rulesObj.categoryMappings[result.category]) {
        return rulesObj.categoryMappings[result.category];
      }
    }
    
    // デフォルトロジック
    return result.provider;
  }

  private wouldImprove(result: BenchmarkResult, newProvider: string): boolean {
    // 簡易的な改善予測
    // 実際の実装では、過去のデータから学習したモデルを使用
    const improvementProbability: Record<string, Record<string, number>> = {
      'data_analysis': { claude: 0.9, 'gpt-4': 0.85, gemini: 0.7 },
      'creative_suggestion': { gemini: 0.95, claude: 0.7, 'gpt-4': 0.75 },
      'prediction': { 'gpt-4': 0.92, claude: 0.8, gemini: 0.75 }
    };
    
    const category = result.category || 'default';
    const currentScore = result.scores.overall;
    const expectedScore = improvementProbability[category]?.[newProvider] || 0.7;
    
    return expectedScore > currentScore;
  }

  private describeRule(rule: { type: string; rule: unknown; priority: number }): string {
    const descriptions: Record<string, (r: unknown) => string> = {
      complexity_scoring: () => '複雑性スコアリングの重み調整',
      provider_strengths: () => 'プロバイダー強みマッピングの更新',
      fallback_strategy: () => 'フォールバック戦略の改善'
    };
    
    if (rule.type.startsWith('category_mapping_')) {
      if (rule.rule && typeof rule.rule === 'object' && 'category' in rule.rule && 'preferredProvider' in rule.rule) {
        const ruleData = rule.rule as { category: string; preferredProvider: string };
        return `${ruleData.category}カテゴリを${ruleData.preferredProvider}に優先ルーティング`;
      }
    }
    
    return descriptions[rule.type]?.(rule) || rule.type;
  }

  private async saveOptimizationResults(): Promise<void> {
    const outputDir = path.join(process.cwd(), 'optimization-results');
    await fs.mkdir(outputDir, { recursive: true });
    
    const summaryPath = path.join(outputDir, 'routing-optimization.json');
    const summary = {
      timestamp: new Date().toISOString(),
      optimizations: this.optimizationLog,
      totalImprovement: this.calculateTotalImprovement(),
      recommendations: this.generateRecommendations()
    };
    
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
    
    console.log(`\n💾 ルーティング最適化結果を保存しました: ${summaryPath}`);
  }

  private calculateTotalImprovement(): number {
    if (this.optimizationLog.length === 0) return 0;
    
    const improvements = this.optimizationLog
      .map(log => log.testResults?.improvement || 0);
    
    return improvements.reduce((sum, imp) => sum + imp, 0) / improvements.length;
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    // 大幅な改善が見られたルール
    const significantImprovements = this.optimizationLog
      .filter(log => (log.testResults?.improvement || 0) > 5);
    
    if (significantImprovements.length > 0) {
      recommendations.push(
        '以下のルールは特に効果的でした：' +
        significantImprovements.map(log => log.changes[0].type).join(', ')
      );
    }
    
    // 追加の最適化機会
    recommendations.push(
      'アンサンブル手法の導入により、さらなる精度向上が期待できます',
      'リアルタイムフィードバックループの実装を検討してください',
      '季節性やトレンドを考慮した動的ルーティングの実装を推奨します'
    );
    
    return recommendations;
  }
}

// CLI実行
export async function optimizeRouting(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.error('使用方法: ts-node routing-optimizer.ts <benchmark-results.json> [failure-analysis.json]');
    process.exit(1);
  }
  
  const benchmarkResults = JSON.parse(await fs.readFile(args[0], 'utf-8'));
  let failureAnalysis = null;
  
  if (args[1]) {
    try {
      failureAnalysis = JSON.parse(await fs.readFile(args[1], 'utf-8'));
    } catch (error) {
      console.warn('失敗分析ファイルの読み込みに失敗しました:', error);
    }
  }
  
  const optimizer = new RoutingOptimizer();
  await optimizer.optimizeRouting(benchmarkResults, failureAnalysis);
}

if (require.main === module) {
  optimizeRouting().catch(console.error);
}