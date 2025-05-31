// 評価メトリクス定義

export interface BenchmarkResult {
  questionId: string;
  category: string;
  difficulty: string;
  provider: string;
  scores: {
    relevance: number;
    accuracy: number;
    completeness: number;
    actionability: number;
    ecDomainKnowledge: number;
    overall: number;
  };
  responseTime: number;
  tokenCount: number;
  passed: boolean;
}

export interface AggregateMetrics {
  totalQuestions: number;
  passedQuestions: number;
  passRate: number;
  averageScores: {
    relevance: number;
    accuracy: number;
    completeness: number;
    actionability: number;
    ecDomainKnowledge: number;
    overall: number;
  };
  scoresByCategory: Record<string, {
    count: number;
    passed: number;
    passRate: number;
    averageScore: number;
  }>;
  scoresByDifficulty: Record<string, {
    count: number;
    passed: number;
    passRate: number;
    averageScore: number;
  }>;
  scoresByProvider: Record<string, {
    count: number;
    passed: number;
    passRate: number;
    averageScore: number;
    averageResponseTime: number;
  }>;
  performanceMetrics: {
    averageResponseTime: number;
    totalTokens: number;
    tokensPerQuestion: number;
  };
}

export class MetricsCalculator {
  private passingThreshold = 0.8; // 80%以上で合格

  calculateAggregateMetrics(results: BenchmarkResult[]): AggregateMetrics {
    const totalQuestions = results.length;
    const passedQuestions = results.filter(r => r.passed).length;

    return {
      totalQuestions,
      passedQuestions,
      passRate: totalQuestions > 0 ? passedQuestions / totalQuestions : 0,
      averageScores: this.calculateAverageScores(results),
      scoresByCategory: this.groupByCategory(results),
      scoresByDifficulty: this.groupByDifficulty(results),
      scoresByProvider: this.groupByProvider(results),
      performanceMetrics: this.calculatePerformanceMetrics(results)
    };
  }

  private calculateAverageScores(results: BenchmarkResult[]): AggregateMetrics['averageScores'] {
    if (results.length === 0) {
      return {
        relevance: 0,
        accuracy: 0,
        completeness: 0,
        actionability: 0,
        ecDomainKnowledge: 0,
        overall: 0
      };
    }

    const sum = results.reduce((acc, result) => ({
      relevance: acc.relevance + result.scores.relevance,
      accuracy: acc.accuracy + result.scores.accuracy,
      completeness: acc.completeness + result.scores.completeness,
      actionability: acc.actionability + result.scores.actionability,
      ecDomainKnowledge: acc.ecDomainKnowledge + result.scores.ecDomainKnowledge,
      overall: acc.overall + result.scores.overall
    }), {
      relevance: 0,
      accuracy: 0,
      completeness: 0,
      actionability: 0,
      ecDomainKnowledge: 0,
      overall: 0
    });

    const count = results.length;
    return {
      relevance: sum.relevance / count,
      accuracy: sum.accuracy / count,
      completeness: sum.completeness / count,
      actionability: sum.actionability / count,
      ecDomainKnowledge: sum.ecDomainKnowledge / count,
      overall: sum.overall / count
    };
  }

  private groupByCategory(results: BenchmarkResult[]): AggregateMetrics['scoresByCategory'] {
    const grouped: AggregateMetrics['scoresByCategory'] = {};

    results.forEach(result => {
      if (!grouped[result.category]) {
        grouped[result.category] = {
          count: 0,
          passed: 0,
          passRate: 0,
          averageScore: 0
        };
      }

      grouped[result.category].count++;
      if (result.passed) grouped[result.category].passed++;
    });

    // 平均スコアとパス率を計算
    Object.keys(grouped).forEach(category => {
      const categoryResults = results.filter(r => r.category === category);
      const totalScore = categoryResults.reduce((sum, r) => sum + r.scores.overall, 0);
      
      grouped[category].averageScore = totalScore / categoryResults.length;
      grouped[category].passRate = grouped[category].passed / grouped[category].count;
    });

    return grouped;
  }

  private groupByDifficulty(results: BenchmarkResult[]): AggregateMetrics['scoresByDifficulty'] {
    const grouped: AggregateMetrics['scoresByDifficulty'] = {};

    results.forEach(result => {
      if (!grouped[result.difficulty]) {
        grouped[result.difficulty] = {
          count: 0,
          passed: 0,
          passRate: 0,
          averageScore: 0
        };
      }

      grouped[result.difficulty].count++;
      if (result.passed) grouped[result.difficulty].passed++;
    });

    // 平均スコアとパス率を計算
    Object.keys(grouped).forEach(difficulty => {
      const difficultyResults = results.filter(r => r.difficulty === difficulty);
      const totalScore = difficultyResults.reduce((sum, r) => sum + r.scores.overall, 0);
      
      grouped[difficulty].averageScore = totalScore / difficultyResults.length;
      grouped[difficulty].passRate = grouped[difficulty].passed / grouped[difficulty].count;
    });

    return grouped;
  }

  private groupByProvider(results: BenchmarkResult[]): AggregateMetrics['scoresByProvider'] {
    const grouped: AggregateMetrics['scoresByProvider'] = {};

    results.forEach(result => {
      if (!grouped[result.provider]) {
        grouped[result.provider] = {
          count: 0,
          passed: 0,
          passRate: 0,
          averageScore: 0,
          averageResponseTime: 0
        };
      }

      grouped[result.provider].count++;
      if (result.passed) grouped[result.provider].passed++;
    });

    // 平均スコアと応答時間を計算
    Object.keys(grouped).forEach(provider => {
      const providerResults = results.filter(r => r.provider === provider);
      const totalScore = providerResults.reduce((sum, r) => sum + r.scores.overall, 0);
      const totalTime = providerResults.reduce((sum, r) => sum + r.responseTime, 0);
      
      grouped[provider].averageScore = totalScore / providerResults.length;
      grouped[provider].averageResponseTime = totalTime / providerResults.length;
      grouped[provider].passRate = grouped[provider].passed / grouped[provider].count;
    });

    return grouped;
  }

  private calculatePerformanceMetrics(results: BenchmarkResult[]): AggregateMetrics['performanceMetrics'] {
    if (results.length === 0) {
      return {
        averageResponseTime: 0,
        totalTokens: 0,
        tokensPerQuestion: 0
      };
    }

    const totalResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0);
    const totalTokens = results.reduce((sum, r) => sum + r.tokenCount, 0);

    return {
      averageResponseTime: totalResponseTime / results.length,
      totalTokens,
      tokensPerQuestion: totalTokens / results.length
    };
  }

  // 改善が必要な領域を特定
  identifyImprovementAreas(metrics: AggregateMetrics): string[] {
    const areas: string[] = [];

    // 全体的なパス率が低い場合
    if (metrics.passRate < 0.7) {
      areas.push('全体的な回答品質の向上が必要です');
    }

    // 特定のスコアが低い場合
    const scoreThreshold = 0.7;
    if (metrics.averageScores.relevance < scoreThreshold) {
      areas.push('質問への関連性を高める必要があります');
    }
    if (metrics.averageScores.accuracy < scoreThreshold) {
      areas.push('回答の正確性を向上させる必要があります');
    }
    if (metrics.averageScores.completeness < scoreThreshold) {
      areas.push('回答の完全性を改善する必要があります');
    }
    if (metrics.averageScores.actionability < scoreThreshold) {
      areas.push('より実行可能な提案を含める必要があります');
    }
    if (metrics.averageScores.ecDomainKnowledge < scoreThreshold) {
      areas.push('EC業界の専門知識をより活用する必要があります');
    }

    // 難易度別の問題
    Object.entries(metrics.scoresByDifficulty).forEach(([difficulty, stats]) => {
      if (stats.passRate < 0.6) {
        areas.push(`${difficulty}レベルの質問への対応力を強化する必要があります`);
      }
    });

    // カテゴリ別の問題
    Object.entries(metrics.scoresByCategory).forEach(([category, stats]) => {
      if (stats.passRate < 0.6) {
        areas.push(`${category}カテゴリの質問への対応を改善する必要があります`);
      }
    });

    return areas;
  }

  // 成功パターンの抽出
  extractSuccessPatterns(results: BenchmarkResult[]): {
    highPerformanceQuestions: BenchmarkResult[];
    successFactors: string[];
  } {
    // 高得点の質問を抽出
    const highPerformanceQuestions = results.filter(r => r.scores.overall >= 0.9);

    // 成功要因の分析
    const successFactors: string[] = [];

    // プロバイダー別の成功率
    const providerSuccess: Record<string, number> = {};
    highPerformanceQuestions.forEach(q => {
      providerSuccess[q.provider] = (providerSuccess[q.provider] || 0) + 1;
    });

    const topProvider = Object.entries(providerSuccess)
      .sort(([, a], [, b]) => b - a)[0];
    
    if (topProvider) {
      successFactors.push(`${topProvider[0]}が最も高い成功率を示しています`);
    }

    // カテゴリ別の成功パターン
    const categorySuccess: Record<string, number> = {};
    highPerformanceQuestions.forEach(q => {
      categorySuccess[q.category] = (categorySuccess[q.category] || 0) + 1;
    });

    const topCategory = Object.entries(categorySuccess)
      .sort(([, a], [, b]) => b - a)[0];
    
    if (topCategory) {
      successFactors.push(`${topCategory[0]}カテゴリで特に良好な結果が得られています`);
    }

    return {
      highPerformanceQuestions,
      successFactors
    };
  }
}