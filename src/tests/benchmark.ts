// ベンチマークテストの実装

import { advancedQuestions, generateQuestionSet, getQuestionStats } from './advanced-questions';
import { LLMRouter } from '../llm/router';
import { ContextBuilder } from '../llm/context-builder';
import { ResponseEnhancer } from '../llm/response-enhancer';
import { ResponseEvaluator } from '../evaluation/quality-scorer';
import { MetricsCalculator, BenchmarkResult } from '../evaluation/metrics';
import { FeedbackCollector } from '../evaluation/feedback-collector';
import { MultiLLMOrchestrator } from '../orchestrator/multi-llm';

export interface BenchmarkConfig {
  questionCount: number;
  categories?: string[];
  difficulties?: string[];
  runType: 'baseline' | 'improved';
  outputPath: string;
}

export class BenchmarkRunner {
  private router: LLMRouter;
  private contextBuilder: ContextBuilder;
  private responseEnhancer: ResponseEnhancer;
  private evaluator: ResponseEvaluator;
  private metricsCalculator: MetricsCalculator;
  private feedbackCollector: FeedbackCollector;
  private orchestrator: MultiLLMOrchestrator;

  constructor() {
    this.router = new LLMRouter();
    this.contextBuilder = new ContextBuilder();
    this.responseEnhancer = new ResponseEnhancer();
    this.evaluator = new ResponseEvaluator();
    this.metricsCalculator = new MetricsCalculator();
    this.feedbackCollector = new FeedbackCollector();
    this.orchestrator = new MultiLLMOrchestrator();
  }

  async runBenchmark(config: BenchmarkConfig): Promise<void> {
    console.log(`\\n🚀 ベンチマークテスト開始 (${config.runType})\\n`);
    
    // 質問セットの生成
    const questions = generateQuestionSet(config.questionCount, {
      categories: config.categories,
      difficulties: config.difficulties
    });

    console.log(`📋 テスト質問数: ${questions.length}`);
    console.log(`📊 質問統計:`, getQuestionStats());

    const results: BenchmarkResult[] = [];
    const startTime = Date.now();

    // 各質問を処理
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      console.log(`\\n[${i + 1}/${questions.length}] ${question.category} - ${question.difficulty}`);
      console.log(`❓ ${question.question.substring(0, 100)}...`);

      try {
        const result = await this.processQuestion(question, config.runType);
        results.push(result);
        
        console.log(`✅ 完了 - スコア: ${result.scores.overall.toFixed(2)} (${result.passed ? 'PASS' : 'FAIL'})`);
      } catch (error) {
        console.error(`❌ エラー:`, error);
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`\\n⏱️  総実行時間: ${(totalTime / 1000).toFixed(1)}秒`);

    // 集計メトリクスの計算
    const aggregateMetrics = this.metricsCalculator.calculateAggregateMetrics(results);
    
    // 結果の保存
    await this.saveResults(config, results, aggregateMetrics);
    
    // サマリーの表示
    this.displaySummary(aggregateMetrics);
  }

  private async processQuestion(
    question: any,
    runType: 'baseline' | 'improved'
  ): Promise<BenchmarkResult> {
    const startTime = Date.now();

    // ルーティング決定
    const routingDecision = this.router.route(question.question, question.context);
    
    // コンテキスト構築
    const enrichedContext = runType === 'improved' 
      ? this.contextBuilder.buildEnrichedContext(
          question.question,
          question.context,
          question.category
        )
      : question.context;

    // LLMへの問い合わせ（モック）
    const response = await this.orchestrator.query(
      question.question,
      enrichedContext,
      routingDecision.provider
    );

    // レスポンス強化（improvedモードのみ）
    const finalResponse = runType === 'improved'
      ? this.responseEnhancer.enhanceResponse(
          response,
          question.category,
          {
            addMetrics: true,
            addImplementationSteps: true,
            addVisualizationSuggestions: false
          }
        )
      : response;

    // 品質評価
    const scores = this.evaluator.evaluate(
      question.question,
      finalResponse,
      question.evaluationCriteria
    );

    const responseTime = Date.now() - startTime;
    const tokenCount = this.estimateTokenCount(finalResponse);

    return {
      questionId: question.id,
      category: question.category,
      difficulty: question.difficulty,
      provider: routingDecision.provider,
      scores: {
        relevance: scores.relevance,
        accuracy: scores.accuracy,
        completeness: scores.completeness,
        actionability: scores.actionability,
        ecDomainKnowledge: scores.ecDomainKnowledge,
        overall: scores.overall
      },
      responseTime,
      tokenCount,
      passed: scores.overall >= 0.8
    };
  }

  private estimateTokenCount(text: string): number {
    // 簡易的なトークン数推定（実際のトークナイザーを使うべき）
    return Math.ceil(text.length / 4);
  }

  private async saveResults(
    config: BenchmarkConfig,
    results: BenchmarkResult[],
    aggregateMetrics: any
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const data = {
      metadata: {
        timestamp,
        runType: config.runType,
        questionCount: config.questionCount,
        categories: config.categories,
        difficulties: config.difficulties
      },
      results,
      aggregateMetrics,
      improvementAreas: this.metricsCalculator.identifyImprovementAreas(aggregateMetrics),
      successPatterns: this.metricsCalculator.extractSuccessPatterns(results)
    };

    // ファイルに保存（実装では実際のファイル書き込みが必要）
    const fs = await import('fs').then(m => m.promises);
    await fs.writeFile(
      config.outputPath,
      JSON.stringify(data, null, 2)
    );

    console.log(`\\n💾 結果を保存しました: ${config.outputPath}`);
  }

  private displaySummary(metrics: any): void {
    console.log('\\n' + '='.repeat(60));
    console.log('📊 ベンチマーク結果サマリー');
    console.log('='.repeat(60));
    
    console.log(`\\n✅ 合格率: ${(metrics.passRate * 100).toFixed(1)}% (${metrics.passedQuestions}/${metrics.totalQuestions})`);
    
    console.log('\\n📈 平均スコア:');
    Object.entries(metrics.averageScores).forEach(([key, value]) => {
      console.log(`  - ${this.translateMetric(key)}: ${(value as number).toFixed(2)}`);
    });
    
    console.log('\\n🏷️  カテゴリ別パフォーマンス:');
    Object.entries(metrics.scoresByCategory).forEach(([category, stats]: [string, any]) => {
      console.log(`  - ${category}: 合格率 ${(stats.passRate * 100).toFixed(1)}%, 平均スコア ${stats.averageScore.toFixed(2)}`);
    });
    
    console.log('\\n📊 難易度別パフォーマンス:');
    Object.entries(metrics.scoresByDifficulty).forEach(([difficulty, stats]: [string, any]) => {
      console.log(`  - ${difficulty}: 合格率 ${(stats.passRate * 100).toFixed(1)}%, 平均スコア ${stats.averageScore.toFixed(2)}`);
    });
    
    console.log('\\n🤖 プロバイダー別パフォーマンス:');
    Object.entries(metrics.scoresByProvider).forEach(([provider, stats]: [string, any]) => {
      console.log(`  - ${provider}: 合格率 ${(stats.passRate * 100).toFixed(1)}%, 平均応答時間 ${stats.averageResponseTime.toFixed(0)}ms`);
    });
    
    console.log('\\n⚡ パフォーマンスメトリクス:');
    console.log(`  - 平均応答時間: ${metrics.performanceMetrics.averageResponseTime.toFixed(0)}ms`);
    console.log(`  - 質問あたりトークン数: ${metrics.performanceMetrics.tokensPerQuestion.toFixed(0)}`);
  }

  private translateMetric(metric: string): string {
    const translations: Record<string, string> = {
      relevance: '関連性',
      accuracy: '正確性',
      completeness: '完全性',
      actionability: '実行可能性',
      ecDomainKnowledge: 'ECドメイン知識',
      overall: '総合'
    };
    return translations[metric] || metric;
  }
}

// メイン実行関数
export async function runBenchmark(): Promise<void> {
  const args = process.argv.slice(2);
  const runType = args.includes('--baseline') ? 'baseline' : 
                  args.includes('--improved') ? 'improved' : 'baseline';

  const config: BenchmarkConfig = {
    questionCount: 50, // テスト用に50問
    runType,
    outputPath: `./test-results/benchmark-${runType}-${Date.now()}.json`
  };

  const runner = new BenchmarkRunner();
  await runner.runBenchmark(config);
}

// CLIから実行される場合
if (require.main === module) {
  runBenchmark().catch(console.error);
}