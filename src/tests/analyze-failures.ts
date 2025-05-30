// 失敗パターンの分析ツール

import * as fs from 'fs/promises';
import { FeedbackCollector } from '../evaluation/feedback-collector';

interface FailureAnalysis {
  totalFailures: number;
  failuresByCategory: Record<string, number>;
  failuresByDifficulty: Record<string, number>;
  failuresByProvider: Record<string, number>;
  commonPatterns: Array<{
    pattern: string;
    frequency: number;
    examples: string[];
  }>;
  recommendations: Array<{
    type: string;
    priority: string;
    description: string;
    implementation: string;
  }>;
}

export class FailureAnalyzer {
  private feedbackCollector: FeedbackCollector;

  constructor() {
    this.feedbackCollector = new FeedbackCollector();
  }

  async analyzeFailures(resultsPath: string): Promise<FailureAnalysis> {
    const results = JSON.parse(await fs.readFile(resultsPath, 'utf-8'));
    
    // 失敗した質問を抽出
    const failures = results.results.filter((r: any) => !r.passed);
    
    // 基本統計
    const analysis: FailureAnalysis = {
      totalFailures: failures.length,
      failuresByCategory: this.groupFailures(failures, 'category'),
      failuresByDifficulty: this.groupFailures(failures, 'difficulty'),
      failuresByProvider: this.groupFailures(failures, 'provider'),
      commonPatterns: [],
      recommendations: []
    };

    // 失敗パターンの分析
    const failedQuestions = await this.loadFailedQuestions(failures, results);
    analysis.commonPatterns = this.feedbackCollector.analyzeFailurePatterns(failedQuestions);

    // 改善推奨事項の生成
    analysis.recommendations = this.feedbackCollector.generateOptimizationRecommendations(
      results.aggregateMetrics,
      analysis.commonPatterns
    );

    return analysis;
  }

  private groupFailures(failures: any[], key: string): Record<string, number> {
    const grouped: Record<string, number> = {};
    
    failures.forEach(failure => {
      const value = failure[key];
      grouped[value] = (grouped[value] || 0) + 1;
    });
    
    return grouped;
  }

  private async loadFailedQuestions(
    failures: any[],
    fullResults: any
  ): Promise<Array<{ question: string; scores: any; provider: string }>> {
    // 実際の実装では、元の質問データを読み込む必要がある
    // ここではモックデータを使用
    return failures.map(f => ({
      question: `質問ID: ${f.questionId} のサンプル質問テキスト`,
      scores: f.scores,
      provider: f.provider
    }));
  }

  // 詳細な失敗分析レポートの生成
  async generateFailureReport(
    analysis: FailureAnalysis,
    outputPath: string
  ): Promise<void> {
    const report = [
      '# 失敗パターン分析レポート',
      '',
      `分析日時: ${new Date().toLocaleString('ja-JP')}`,
      '',
      '## サマリー',
      `- 総失敗数: ${analysis.totalFailures}`,
      '',
      '## カテゴリ別失敗数',
      ...Object.entries(analysis.failuresByCategory)
        .sort(([, a], [, b]) => b - a)
        .map(([category, count]) => `- ${category}: ${count}件`),
      '',
      '## 難易度別失敗数',
      ...Object.entries(analysis.failuresByDifficulty)
        .sort(([, a], [, b]) => b - a)
        .map(([difficulty, count]) => `- ${difficulty}: ${count}件`),
      '',
      '## プロバイダー別失敗数',
      ...Object.entries(analysis.failuresByProvider)
        .sort(([, a], [, b]) => b - a)
        .map(([provider, count]) => `- ${provider}: ${count}件`),
      '',
      '## 共通の失敗パターン',
      ...analysis.commonPatterns.map((pattern, index) => 
        `### ${index + 1}. ${pattern.pattern} (${pattern.frequency}件)\n` +
        '例:\n' +
        pattern.examples.map(ex => `- ${ex.substring(0, 100)}...`).join('\n')
      ),
      '',
      '## 改善推奨事項',
      ...analysis.recommendations.map((rec, index) => 
        `### ${index + 1}. [${rec.priority.toUpperCase()}] ${rec.description}\n` +
        `**タイプ**: ${rec.type}\n` +
        `**実装方法**:\n${rec.implementation}\n` +
        `**期待効果**: ${rec.expectedImpact}`
      )
    ].join('\n');

    await fs.writeFile(outputPath, report);
    console.log(`\n📄 失敗分析レポートを生成しました: ${outputPath}`);
  }

  // 特定のパターンに対する改善提案を生成
  generatePatternSpecificSuggestions(
    pattern: string
  ): string[] {
    const suggestions: Record<string, string[]> = {
      '長文質問（300文字以上）': [
        '質問を要点ごとに分割して処理',
        'コンテキストウィンドウの最適化',
        '重要キーワードの自動抽出強化'
      ],
      '複数要求を含む質問': [
        '要求事項の自動分解と優先順位付け',
        'マルチステップ回答の構造化',
        'チェックリスト形式での回答生成'
      ],
      '具体性に欠ける質問': [
        'デフォルト値や業界標準値の自動補完',
        '明確化のための追加質問の生成',
        '類似ケースからの推論'
      ],
      '専門用語が多い質問': [
        '専門用語辞書の拡充',
        '文脈に基づく用語解釈の強化',
        '平易な言葉での説明追加'
      ]
    };

    return suggestions[pattern] || ['パターン固有の最適化戦略を検討'];
  }

  // スコア改善シミュレーション
  simulateImprovements(
    currentScores: any,
    proposedChanges: string[]
  ): Record<string, number> {
    const improvements: Record<string, number> = { ...currentScores };
    
    proposedChanges.forEach(change => {
      if (change.includes('プロンプト')) {
        improvements.relevance += 0.05;
        improvements.completeness += 0.03;
      }
      if (change.includes('知識ベース')) {
        improvements.ecDomainKnowledge += 0.08;
        improvements.accuracy += 0.04;
      }
      if (change.includes('構造化')) {
        improvements.actionability += 0.06;
        improvements.completeness += 0.04;
      }
    });

    // 最大値を1.0に制限
    Object.keys(improvements).forEach(key => {
      improvements[key] = Math.min(improvements[key], 1.0);
    });

    return improvements;
  }
}

// CLI実行
export async function analyzeFailures(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.error('使用方法: ts-node analyze-failures.ts <results.json>');
    process.exit(1);
  }

  const analyzer = new FailureAnalyzer();
  const analysis = await analyzer.analyzeFailures(args[0]);
  
  // コンソールにサマリーを表示
  console.log('\n🔍 失敗分析サマリー');
  console.log(`総失敗数: ${analysis.totalFailures}`);
  console.log('\n最も多い失敗パターン:');
  analysis.commonPatterns.slice(0, 3).forEach((pattern, i) => {
    console.log(`${i + 1}. ${pattern.pattern} (${pattern.frequency}件)`);
  });
  
  console.log('\n優先度の高い改善推奨:');
  analysis.recommendations
    .filter(r => r.priority === 'high')
    .slice(0, 3)
    .forEach((rec, i) => {
      console.log(`${i + 1}. ${rec.description}`);
    });
  
  // 詳細レポートの生成
  const reportPath = args[0].replace('.json', '-failure-analysis.md');
  await analyzer.generateFailureReport(analysis, reportPath);
}

if (require.main === module) {
  analyzeFailures().catch(console.error);
}