// ベンチマーク結果の比較ツール

import * as fs from 'fs/promises';
import * as path from 'path';

interface TestResult {
  questionId: string;
  scores?: {
    overall: number;
  };
  [key: string]: any;
}

interface ComparisonResult {
  baseline: any;
  improved: any;
  improvements: {
    overallPassRate: number;
    categoryImprovements: Record<string, number>;
    difficultyImprovements: Record<string, number>;
    scoreImprovements: Record<string, number>;
  };
  regressions: string[];
  summary: string;
}

export class ResultsComparator {
  async compareResults(
    baselinePath: string,
    improvedPath: string
  ): Promise<ComparisonResult> {
    // 結果ファイルの読み込み
    const baseline = JSON.parse(await fs.readFile(baselinePath, 'utf-8'));
    const improved = JSON.parse(await fs.readFile(improvedPath, 'utf-8'));

    // 改善度の計算
    const improvements = this.calculateImprovements(baseline, improved);
    
    // 後退した領域の特定
    const regressions = this.identifyRegressions(baseline, improved);
    
    // サマリーの生成
    const summary = this.generateSummary(improvements, regressions);

    return {
      baseline,
      improved,
      improvements,
      regressions,
      summary
    };
  }

  private calculateImprovements(baseline: any, improved: any): ComparisonResult['improvements'] {
    const baselineMetrics = baseline.aggregateMetrics;
    const improvedMetrics = improved.aggregateMetrics;

    // 全体的な合格率の改善
    const overallPassRate = improvedMetrics.passRate - baselineMetrics.passRate;

    // カテゴリ別の改善
    const categoryImprovements: Record<string, number> = {};
    Object.keys(baselineMetrics.scoresByCategory).forEach(category => {
      const baselineScore = baselineMetrics.scoresByCategory[category].averageScore;
      const improvedScore = improvedMetrics.scoresByCategory[category]?.averageScore || 0;
      categoryImprovements[category] = improvedScore - baselineScore;
    });

    // 難易度別の改善
    const difficultyImprovements: Record<string, number> = {};
    Object.keys(baselineMetrics.scoresByDifficulty).forEach(difficulty => {
      const baselineScore = baselineMetrics.scoresByDifficulty[difficulty].averageScore;
      const improvedScore = improvedMetrics.scoresByDifficulty[difficulty]?.averageScore || 0;
      difficultyImprovements[difficulty] = improvedScore - baselineScore;
    });

    // スコア項目別の改善
    const scoreImprovements: Record<string, number> = {};
    Object.keys(baselineMetrics.averageScores).forEach(scoreType => {
      const baselineScore = baselineMetrics.averageScores[scoreType];
      const improvedScore = improvedMetrics.averageScores[scoreType];
      scoreImprovements[scoreType] = improvedScore - baselineScore;
    });

    return {
      overallPassRate,
      categoryImprovements,
      difficultyImprovements,
      scoreImprovements
    };
  }

  private identifyRegressions(baseline: any, improved: any): string[] {
    const regressions: string[] = [];
    
    // 個別の質問で後退したものを特定
    const baselineResults = new Map(
      baseline.results.map((r: any) => [r.questionId, r])
    );
    
    improved.results.forEach((improvedResult: TestResult) => {
      const baselineResult = baselineResults.get(improvedResult.questionId);
      if (baselineResult && improvedResult.scores?.overall && baselineResult.scores?.overall && 
          improvedResult.scores.overall < baselineResult.scores.overall) {
        const decrease = baselineResult.scores.overall - improvedResult.scores.overall;
        if (decrease > 0.05) { // 5%以上の低下
          regressions.push(
            `質問 ${improvedResult.questionId}: ` +
            `${(decrease * 100).toFixed(1)}%低下 ` +
            `(${baselineResult.scores?.overall?.toFixed(2)} → ${improvedResult.scores?.overall?.toFixed(2)})`
          );
        }
      }
    });

    return regressions;
  }

  private generateSummary(
    improvements: ComparisonResult['improvements'],
    regressions: string[]
  ): string {
    const lines: string[] = [
      '# ベンチマーク結果比較サマリー',
      '',
      '## 全体的な改善',
      `- 合格率: ${improvements.overallPassRate >= 0 ? '+' : ''}${(improvements.overallPassRate * 100).toFixed(1)}%`,
      '',
      '## スコア別改善',
    ];

    Object.entries(improvements.scoreImprovements).forEach(([score, improvement]) => {
      const symbol = improvement >= 0 ? '📈' : '📉';
      lines.push(
        `${symbol} ${this.translateScore(score)}: ` +
        `${improvement >= 0 ? '+' : ''}${(improvement * 100).toFixed(1)}%`
      );
    });

    lines.push('', '## カテゴリ別改善');
    const sortedCategories = Object.entries(improvements.categoryImprovements)
      .sort(([, a], [, b]) => b - a);
    
    sortedCategories.forEach(([category, improvement]) => {
      if (Math.abs(improvement) > 0.01) {
        lines.push(
          `- ${category}: ${improvement >= 0 ? '+' : ''}${(improvement * 100).toFixed(1)}%`
        );
      }
    });

    lines.push('', '## 難易度別改善');
    Object.entries(improvements.difficultyImprovements).forEach(([difficulty, improvement]) => {
      lines.push(
        `- ${difficulty}: ${improvement >= 0 ? '+' : ''}${(improvement * 100).toFixed(1)}%`
      );
    });

    if (regressions.length > 0) {
      lines.push('', '## ⚠️ 後退した領域', ...regressions);
    }

    // 総合評価
    lines.push('', '## 総合評価');
    if (improvements.overallPassRate > 0.1) {
      lines.push('✅ 大幅な改善が見られます！');
    } else if (improvements.overallPassRate > 0.05) {
      lines.push('✅ 明確な改善が確認できます。');
    } else if (improvements.overallPassRate > 0) {
      lines.push('✅ わずかながら改善が見られます。');
    } else {
      lines.push('❌ 改善が見られません。さらなる最適化が必要です。');
    }

    return lines.join('\\n');
  }

  private translateScore(score: string): string {
    const translations: Record<string, string> = {
      relevance: '関連性',
      accuracy: '正確性',
      completeness: '完全性',
      actionability: '実行可能性',
      ecDomainKnowledge: 'ECドメイン知識',
      overall: '総合スコア'
    };
    return translations[score] || score;
  }

  // 詳細レポートの生成
  async generateDetailedReport(
    comparison: ComparisonResult,
    outputPath: string
  ): Promise<void> {
    const report = [
      '# 詳細比較レポート',
      '',
      `生成日時: ${new Date().toLocaleString('ja-JP')}`,
      '',
      comparison.summary,
      '',
      '## 詳細データ',
      '',
      '### ベースライン統計',
      '```json',
      JSON.stringify(comparison.baseline.aggregateMetrics, null, 2),
      '```',
      '',
      '### 改善後統計',
      '```json',
      JSON.stringify(comparison.improved.aggregateMetrics, null, 2),
      '```',
      '',
      '## 個別質問の改善度TOP10',
      ...this.getTopImprovements(comparison.baseline.results, comparison.improved.results),
      '',
      '## 改善が必要な質問TOP10',
      ...this.getBottomPerformers(comparison.improved.results)
    ].join('\\n');

    await fs.writeFile(outputPath, report);
    console.log(`\\n📄 詳細レポートを生成しました: ${outputPath}`);
  }

  private getTopImprovements(
    baselineResults: any[],
    improvedResults: any[]
  ): string[] {
    const baselineMap = new Map(
      baselineResults.map(r => [r.questionId, r])
    );

    const improvements = improvedResults
      .map(improved => {
        const baseline = baselineMap.get(improved.questionId);
        if (!baseline) return null;
        
        return {
          questionId: improved.questionId,
          category: improved.category,
          improvement: (improved.scores?.overall || 0) - (baseline.scores?.overall || 0),
          newScore: improved.scores?.overall || 0
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.improvement - a.improvement)
      .slice(0, 10);

    return improvements.map((item: any, index) => 
      `${index + 1}. ${item.category} (${item.questionId}): ` +
      `+${(item.improvement * 100).toFixed(1)}% → ${(item.newScore * 100).toFixed(1)}%`
    );
  }

  private getBottomPerformers(results: any[]): string[] {
    const bottom = results
      .sort((a, b) => (a.scores?.overall || 0) - (b.scores?.overall || 0))
      .slice(0, 10);

    return bottom.map((item, index) => 
      `${index + 1}. ${item.category} (${item.questionId}): ` +
      `${((item.scores?.overall || 0) * 100).toFixed(1)}% ${item.passed ? '' : '❌'}`
    );
  }
}

// CLI実行
export async function compareResults(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('使用方法: ts-node compare-results.ts <baseline.json> <improved.json>');
    process.exit(1);
  }

  const comparator = new ResultsComparator();
  const comparison = await comparator.compareResults(args[0], args[1]);
  
  console.log(comparison.summary);
  
  // 詳細レポートの生成
  const reportPath = path.join(
    path.dirname(args[1]),
    `comparison-report-${Date.now()}.md`
  );
  await comparator.generateDetailedReport(comparison, reportPath);
}

if (require.main === module) {
  compareResults().catch(console.error);
}