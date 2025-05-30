// フィードバック収集と改善提案

export interface ImprovementFeedback {
  questionId: string;
  provider: string;
  weaknesses: string[];
  suggestions: string[];
  exampleImprovement?: {
    original: string;
    improved: string;
    explanation: string;
  };
}

export interface OptimizationRecommendation {
  type: 'prompt' | 'routing' | 'knowledge' | 'context';
  priority: 'high' | 'medium' | 'low';
  description: string;
  implementation: string;
  expectedImpact: string;
}

export class FeedbackCollector {
  collectFeedback(
    question: string,
    response: string,
    scores: any,
    expectedElements: string[]
  ): ImprovementFeedback {
    const weaknesses = this.identifyWeaknesses(response, scores, expectedElements);
    const suggestions = this.generateSuggestions(weaknesses, question);
    const exampleImprovement = this.createExampleImprovement(
      response,
      weaknesses,
      suggestions
    );

    return {
      questionId: '', // This should be set by the caller
      provider: '', // This should be set by the caller
      weaknesses,
      suggestions,
      exampleImprovement
    };
  }

  private identifyWeaknesses(
    response: string,
    scores: any,
    expectedElements: string[]
  ): string[] {
    const weaknesses: string[] = [];

    // スコアベースの弱点
    if (scores.relevance < 0.7) {
      weaknesses.push('質問の核心から逸れた内容が含まれている');
    }
    if (scores.accuracy < 0.7) {
      weaknesses.push('データや主張の正確性に改善の余地がある');
    }
    if (scores.completeness < 0.7) {
      const missingElements = expectedElements.filter(elem => 
        !response.toLowerCase().includes(elem.toLowerCase())
      );
      if (missingElements.length > 0) {
        weaknesses.push(`重要な要素が欠けている: ${missingElements.join(', ')}`);
      }
    }
    if (scores.actionability < 0.7) {
      weaknesses.push('具体的な行動指針が不足している');
    }
    if (scores.ecDomainKnowledge < 0.7) {
      weaknesses.push('EC業界の専門知識や用語の活用が不十分');
    }

    // 構造的な弱点
    if (!response.includes('\n')) {
      weaknesses.push('構造化されていない（段落分けがない）');
    }
    if (response.length < 500) {
      weaknesses.push('回答が簡潔すぎる可能性がある');
    }
    if (!response.match(/\d+/)) {
      weaknesses.push('数値データや具体的な指標が含まれていない');
    }

    return weaknesses;
  }

  private generateSuggestions(weaknesses: string[], question: string): string[] {
    const suggestions: string[] = [];

    weaknesses.forEach(weakness => {
      switch (true) {
        case weakness.includes('核心から逸れた'):
          suggestions.push('質問の主要キーワードを抽出し、それらに直接関連する内容に焦点を絞る');
          break;
        
        case weakness.includes('正確性'):
          suggestions.push('業界ベンチマークデータを参照し、現実的な数値範囲を使用する');
          suggestions.push('主張には根拠となるデータや理論を併記する');
          break;
        
        case weakness.includes('重要な要素が欠けている'):
          suggestions.push('回答前に必要な要素のチェックリストを作成し、すべてカバーする');
          suggestions.push('ECドメイン知識ベースから関連する概念を追加する');
          break;
        
        case weakness.includes('行動指針'):
          suggestions.push('具体的な実装ステップを番号付きリストで提示する');
          suggestions.push('各提案に期待される効果とタイムラインを追加する');
          break;
        
        case weakness.includes('専門知識'):
          suggestions.push('EC業界の標準的な用語（CVR、AOV、LTVなど）を適切に使用する');
          suggestions.push('業界のベストプラクティスや成功事例を引用する');
          break;
        
        case weakness.includes('構造化'):
          suggestions.push('見出しを使用してセクションを分ける（##を使用）');
          suggestions.push('箇条書きや番号付きリストで情報を整理する');
          break;
        
        case weakness.includes('簡潔すぎる'):
          suggestions.push('各ポイントに具体例や詳細な説明を追加する');
          suggestions.push('「なぜ」「どのように」を説明して深みを加える');
          break;
        
        case weakness.includes('数値データ'):
          suggestions.push('業界平均値や期待される改善率などの具体的な数値を含める');
          suggestions.push('ROIやKPIなどの測定可能な指標を提示する');
          break;
      }
    });

    return [...new Set(suggestions)]; // 重複を削除
  }

  private createExampleImprovement(
    originalResponse: string,
    weaknesses: string[],
    suggestions: string[]
  ): ImprovementFeedback['exampleImprovement'] | undefined {
    // 最も重要な弱点に対する改善例を作成
    if (weaknesses.length === 0) return undefined;

    const primaryWeakness = weaknesses[0];
    let improvedSnippet = '';
    let explanation = '';

    // 元のレスポンスの最初の段落を取得
    const firstParagraph = originalResponse.split('\n')[0].substring(0, 200);

    if (primaryWeakness.includes('構造化')) {
      improvedSnippet = `## 現状分析\n${firstParagraph}\n\n## 主要な発見\n1. [具体的な発見1]\n2. [具体的な発見2]\n\n## 改善提案\n...`;
      explanation = '見出しと番号付きリストを使用して構造を明確にしました';
    } else if (primaryWeakness.includes('数値データ')) {
      improvedSnippet = originalResponse.replace(
        /改善が見込まれます/g,
        '15-20%の改善が見込まれます（業界平均: 12%）'
      );
      explanation = '具体的な数値と業界ベンチマークを追加しました';
    } else if (primaryWeakness.includes('行動指針')) {
      improvedSnippet = `${firstParagraph}\n\n実装ステップ:\n1. 週1: 現状分析とKPI設定\n2. 週2-3: パイロットテスト実施\n3. 週4: 結果分析と調整\n4. 週5以降: 本格展開`;
      explanation = '具体的な実装ステップとタイムラインを追加しました';
    }

    return {
      original: firstParagraph,
      improved: improvedSnippet,
      explanation
    };
  }

  // 改善サイクル全体の最適化推奨事項を生成
  generateOptimizationRecommendations(
    aggregateResults: any,
    failurePatterns: any[]
  ): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // プロンプト最適化の推奨
    if (aggregateResults.averageScores.relevance < 0.8) {
      recommendations.push({
        type: 'prompt',
        priority: 'high',
        description: '質問タイプ別のプロンプトテンプレートの精緻化',
        implementation: `
1. 各質問タイプのキーワードマッピングを強化
2. レスポンスフォーマットをより明確に指定
3. 質問の文脈をより詳細に含める`,
        expectedImpact: '関連性スコアが10-15%向上'
      });
    }

    // ルーティング最適化の推奨
    const providerPerformance = aggregateResults.scoresByProvider;
    const underperformingProviders = Object.entries(providerPerformance)
      .filter(([_, stats]: [string, any]) => stats.passRate < 0.7);
    
    if (underperformingProviders.length > 0) {
      recommendations.push({
        type: 'routing',
        priority: 'high',
        description: 'LLMルーティングロジックの改善',
        implementation: `
1. 質問の複雑性評価アルゴリズムを調整
2. プロバイダーの強み/弱みマッピングを更新
3. フォールバック戦略の実装`,
        expectedImpact: '適切なプロバイダー選択により全体的な品質向上'
      });
    }

    // 知識ベース最適化の推奨
    if (aggregateResults.averageScores.ecDomainKnowledge < 0.75) {
      recommendations.push({
        type: 'knowledge',
        priority: 'medium',
        description: 'EC知識ベースの拡充と更新',
        implementation: `
1. 最新の業界トレンドとベストプラクティスを追加
2. 業界別のベンチマークデータを更新
3. 成功事例とケーススタディを充実`,
        expectedImpact: 'ECドメイン知識スコアが15-20%向上'
      });
    }

    // コンテキスト強化の推奨
    if (aggregateResults.averageScores.completeness < 0.8) {
      recommendations.push({
        type: 'context',
        priority: 'medium',
        description: 'コンテキスト構築プロセスの強化',
        implementation: `
1. 質問から必要な文脈要素を自動抽出
2. 関連する業界データを動的に付与
3. 過去の成功パターンを参照`,
        expectedImpact: '回答の完全性が向上し、必要な要素の網羅率が上昇'
      });
    }

    // 特定カテゴリの改善
    Object.entries(aggregateResults.scoresByCategory).forEach(([category, stats]: [string, any]) => {
      if (stats.passRate < 0.6) {
        recommendations.push({
          type: 'prompt',
          priority: 'high',
          description: `${category}カテゴリ専用の最適化`,
          implementation: `
1. ${category}特有のプロンプトテンプレートを作成
2. カテゴリ専門の知識ベースを構築
3. 成功事例を分析してパターンを抽出`,
          expectedImpact: `${category}カテゴリのパス率が20%以上向上`
        });
      }
    });

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  // パターン分析：失敗しやすい質問の特徴を抽出
  analyzeFailurePatterns(
    failedQuestions: Array<{ question: string; scores: any; provider: string }>
  ): Array<{ pattern: string; frequency: number; examples: string[] }> {
    const patterns: Map<string, string[]> = new Map();

    failedQuestions.forEach(({ question }) => {
      // 長い質問
      if (question.length > 300) {
        const pattern = '長文質問（300文字以上）';
        patterns.set(pattern, [...(patterns.get(pattern) || []), question]);
      }

      // 複数の要求
      if ((question.match(/また|さらに|および|かつ/g) || []).length > 2) {
        const pattern = '複数要求を含む質問';
        patterns.set(pattern, [...(patterns.get(pattern) || []), question]);
      }

      // 抽象的な質問
      if (!question.match(/\d+/) && !question.match(/具体的/)) {
        const pattern = '具体性に欠ける質問';
        patterns.set(pattern, [...(patterns.get(pattern) || []), question]);
      }

      // 専門用語が多い
      const technicalTerms = question.match(/[A-Z]{2,}/g) || [];
      if (technicalTerms.length > 3) {
        const pattern = '専門用語が多い質問';
        patterns.set(pattern, [...(patterns.get(pattern) || []), question]);
      }
    });

    return Array.from(patterns.entries()).map(([pattern, examples]) => ({
      pattern,
      frequency: examples.length,
      examples: examples.slice(0, 3) // 最大3つの例を保持
    })).sort((a, b) => b.frequency - a.frequency);
  }
}