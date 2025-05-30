// レスポンス品質評価システム

export interface QualityScore {
  relevance: number;          // 関連性 (0-1)
  accuracy: number;           // 正確性 (0-1)
  completeness: number;       // 完全性 (0-1)
  actionability: number;      // 実行可能性 (0-1)
  ecDomainKnowledge: number; // ECドメイン知識 (0-1)
  overall: number;           // 総合スコア (0-1)
  breakdown: {
    [key: string]: {
      score: number;
      feedback: string;
    };
  };
}

export interface EvaluationCriteria {
  mustInclude: string[];
  shouldInclude: string[];
  bonusPoints: string[];
}

export class ResponseEvaluator {
  evaluate(
    question: string,
    response: string,
    criteria?: EvaluationCriteria
  ): QualityScore {
    const scores = {
      relevance: this.checkRelevance(question, response),
      accuracy: this.checkAccuracy(response),
      completeness: this.checkCompleteness(question, response, criteria),
      actionability: this.checkActionability(response),
      ecDomainKnowledge: this.checkECKnowledge(response)
    };

    const overall = this.calculateOverallScore(scores);

    const breakdown = this.generateDetailedBreakdown(
      question,
      response,
      scores,
      criteria
    );

    return {
      ...scores,
      overall,
      breakdown
    };
  }

  private checkRelevance(question: string, response: string): number {
    let score = 0;
    
    // 質問のキーワードがレスポンスに含まれているか
    const questionKeywords = this.extractKeywords(question);
    const responseText = response.toLowerCase();
    
    const keywordMatches = questionKeywords.filter(keyword => 
      responseText.includes(keyword.toLowerCase())
    ).length;
    
    const keywordCoverage = questionKeywords.length > 0 
      ? keywordMatches / questionKeywords.length 
      : 0;
    
    score += keywordCoverage * 0.5;

    // 質問タイプに対する適切な構造
    const questionType = this.detectQuestionType(question);
    const hasAppropriateStructure = this.checkResponseStructure(response, questionType);
    
    if (hasAppropriateStructure) {
      score += 0.3;
    }

    // 質問に対する直接的な回答があるか
    if (this.hasDirectAnswer(question, response)) {
      score += 0.2;
    }

    return Math.min(score, 1);
  }

  private checkAccuracy(response: string): number {
    let score = 1.0; // デフォルトは満点から減点方式

    // 数値の妥当性チェック
    const numbers = response.match(/\d+(?:\.\d+)?%?/g) || [];
    numbers.forEach(num => {
      const value = parseFloat(num.replace('%', ''));
      
      // 非現実的な数値のチェック
      if (num.includes('%')) {
        if (value > 1000 || value < -100) {
          score -= 0.1; // パーセンテージの異常値
        }
      }
    });

    // 矛盾のチェック
    if (this.hasContradictions(response)) {
      score -= 0.3;
    }

    // 業界標準との乖離チェック
    if (this.deviatesFromIndustryStandards(response)) {
      score -= 0.2;
    }

    return Math.max(score, 0);
  }

  private checkCompleteness(
    question: string,
    response: string,
    criteria?: EvaluationCriteria
  ): number {
    let score = 0;

    // 必須要素のチェック
    if (criteria?.mustInclude) {
      const mustIncludeMatches = criteria.mustInclude.filter(item =>
        response.toLowerCase().includes(item.toLowerCase())
      ).length;
      
      score += (mustIncludeMatches / criteria.mustInclude.length) * 0.5;
    } else {
      // デフォルトの完全性チェック
      score += this.checkDefaultCompleteness(question, response) * 0.5;
    }

    // 推奨要素のチェック
    if (criteria?.shouldInclude) {
      const shouldIncludeMatches = criteria.shouldInclude.filter(item =>
        response.toLowerCase().includes(item.toLowerCase())
      ).length;
      
      score += (shouldIncludeMatches / criteria.shouldInclude.length) * 0.3;
    }

    // ボーナス要素のチェック
    if (criteria?.bonusPoints) {
      const bonusMatches = criteria.bonusPoints.filter(item =>
        response.toLowerCase().includes(item.toLowerCase())
      ).length;
      
      score += (bonusMatches / criteria.bonusPoints.length) * 0.2;
    }

    // 構造的完全性
    const structuralCompleteness = this.checkStructuralCompleteness(response);
    score += structuralCompleteness * 0.2;

    return Math.min(score, 1);
  }

  private checkActionability(response: string): number {
    let score = 0;

    // 具体的な行動指示の存在
    const actionPatterns = [
      /\d+\.\s*[^\n]+/g,              // 番号付きリスト
      /[・•]\s*[^\n]+/g,              // 箇条書き
      /まず|次に|最後に/g,            // 順序を示す表現
      /実施|実行|導入|開始/g,         // 行動を示す動詞
      /〜してください|〜すべき/g,     // 指示形
    ];

    actionPatterns.forEach(pattern => {
      const matches = response.match(pattern) || [];
      if (matches.length > 0) {
        score += 0.15;
      }
    });

    // 数値目標の存在
    if (/\d+%(?:向上|改善|削減|増加)/g.test(response)) {
      score += 0.2;
    }

    // タイムラインの存在
    if (/\d+(?:日|週間|ヶ月|年)(?:以内|後|で)/g.test(response)) {
      score += 0.15;
    }

    // 具体例の存在
    if (/例えば|具体的には|実際に/g.test(response)) {
      score += 0.1;
    }

    return Math.min(score, 1);
  }

  private checkECKnowledge(response: string): number {
    let score = 0;

    // EC専門用語の適切な使用
    const ecTerms = [
      'CVR', 'コンバージョン率',
      'AOV', '客単価',
      'LTV', '顧客生涯価値',
      'CAC', '顧客獲得コスト',
      'ROAS', '広告費用対効果',
      'カート放棄',
      'リピート率',
      'チャーン',
      'アップセル',
      'クロスセル'
    ];

    const usedTerms = ecTerms.filter(term => 
      response.includes(term)
    );

    score += Math.min(usedTerms.length * 0.1, 0.4);

    // 業界ベストプラクティスへの言及
    const bestPracticeKeywords = [
      'ベストプラクティス',
      '業界標準',
      '成功事例',
      'ケーススタディ',
      '他社事例'
    ];

    const bestPracticeMatches = bestPracticeKeywords.filter(keyword =>
      response.includes(keyword)
    ).length;

    score += bestPracticeMatches * 0.15;

    // EC特有の課題への理解
    const ecChallenges = [
      '季節性',
      'マルチチャネル',
      'オムニチャネル',
      'フルフィルメント',
      'ラストマイル',
      '返品率'
    ];

    const challengeMatches = ecChallenges.filter(challenge =>
      response.includes(challenge)
    ).length;

    score += challengeMatches * 0.1;

    return Math.min(score, 1);
  }

  private calculateOverallScore(scores: Omit<QualityScore, 'overall' | 'breakdown'>): number {
    // 重み付け平均
    const weights = {
      relevance: 0.25,
      accuracy: 0.25,
      completeness: 0.20,
      actionability: 0.15,
      ecDomainKnowledge: 0.15
    };

    let weightedSum = 0;
    let totalWeight = 0;

    for (const [key, weight] of Object.entries(weights)) {
      weightedSum += scores[key as keyof typeof scores] * weight;
      totalWeight += weight;
    }

    return weightedSum / totalWeight;
  }

  private generateDetailedBreakdown(
    question: string,
    response: string,
    scores: Omit<QualityScore, 'overall' | 'breakdown'>,
    criteria?: EvaluationCriteria
  ): QualityScore['breakdown'] {
    const breakdown: QualityScore['breakdown'] = {};

    // 関連性の詳細
    breakdown.relevance = {
      score: scores.relevance,
      feedback: this.generateRelevanceFeedback(question, response, scores.relevance)
    };

    // 正確性の詳細
    breakdown.accuracy = {
      score: scores.accuracy,
      feedback: this.generateAccuracyFeedback(response, scores.accuracy)
    };

    // 完全性の詳細
    breakdown.completeness = {
      score: scores.completeness,
      feedback: this.generateCompletenessFeedback(response, scores.completeness, criteria)
    };

    // 実行可能性の詳細
    breakdown.actionability = {
      score: scores.actionability,
      feedback: this.generateActionabilityFeedback(response, scores.actionability)
    };

    // ECドメイン知識の詳細
    breakdown.ecDomainKnowledge = {
      score: scores.ecDomainKnowledge,
      feedback: this.generateECKnowledgeFeedback(response, scores.ecDomainKnowledge)
    };

    return breakdown;
  }

  // ヘルパーメソッド
  private extractKeywords(text: string): string[] {
    // 簡易的なキーワード抽出（実際にはより高度な処理が必要）
    const stopWords = ['を', 'に', 'が', 'で', 'と', 'は', 'の', 'て', 'た', 'し', 'する', 'です', 'ます'];
    
    return text
      .split(/[\s、。！？]/g)
      .filter(word => word.length > 2 && !stopWords.includes(word))
      .slice(0, 10);
  }

  private detectQuestionType(question: string): string {
    if (question.includes('分析')) return 'analysis';
    if (question.includes('予測')) return 'prediction';
    if (question.includes('最適化')) return 'optimization';
    if (question.includes('戦略')) return 'strategy';
    return 'general';
  }

  private checkResponseStructure(response: string, questionType: string): boolean {
    const structures: Record<string, RegExp[]> = {
      analysis: [/現状|分析結果|要因/],
      prediction: [/予測|見込み|推定/],
      optimization: [/改善案|最適化|効率化/],
      strategy: [/戦略|計画|施策/]
    };

    const requiredStructures = structures[questionType] || [];
    return requiredStructures.some(pattern => pattern.test(response));
  }

  private hasDirectAnswer(question: string, response: string): boolean {
    // 質問に対する直接的な回答があるかの簡易チェック
    if (question.includes('なぜ')) {
      return /理由|原因|ため/g.test(response);
    }
    if (question.includes('どのように')) {
      return /方法|手順|ステップ/g.test(response);
    }
    if (question.includes('いつ')) {
      return /時期|タイミング|期間/g.test(response);
    }
    return true;
  }

  private hasContradictions(response: string): boolean {
    // 簡易的な矛盾チェック
    const contradictionPatterns = [
      /増加.*減少|減少.*増加/,
      /高い.*低い|低い.*高い/,
      /必要.*不要|不要.*必要/
    ];
    
    return contradictionPatterns.some(pattern => pattern.test(response));
  }

  private deviatesFromIndustryStandards(response: string): boolean {
    // 業界標準から大きく外れた数値のチェック
    const unrealisticPatterns = [
      /CVR.*[3-9]\d%|CVR.*100%/,  // CVR 30%以上は非現実的
      /成長率.*[5-9]\d\d%/,        // 成長率500%以上は要注意
      /離脱率.*[0-2]%/             // 離脱率2%以下は非現実的
    ];
    
    return unrealisticPatterns.some(pattern => pattern.test(response));
  }

  private checkDefaultCompleteness(question: string, response: string): number {
    // デフォルトの完全性チェック
    const responseLength = response.length;
    const questionComplexity = question.length;
    
    const ratio = responseLength / questionComplexity;
    
    if (ratio < 2) return 0.3;
    if (ratio < 5) return 0.6;
    if (ratio < 10) return 0.8;
    return 1.0;
  }

  private checkStructuralCompleteness(response: string): number {
    let score = 0;
    
    // セクション分けがあるか
    if (/##\s*.+/g.test(response)) score += 0.3;
    
    // リスト構造があるか
    if (/\d+\.|[・•]/g.test(response)) score += 0.3;
    
    // 段落分けがあるか
    if (response.split('\n\n').length > 2) score += 0.2;
    
    // 結論があるか
    if (/まとめ|結論|総括|以上/g.test(response)) score += 0.2;
    
    return score;
  }

  // フィードバック生成メソッド
  private generateRelevanceFeedback(question: string, response: string, score: number): string {
    if (score >= 0.8) return '質問に対して高い関連性を持つ回答です。';
    if (score >= 0.6) return '質問に関連していますが、より焦点を絞った回答が望ましいです。';
    return '質問の核心から逸れている部分があります。質問の要点を再確認してください。';
  }

  private generateAccuracyFeedback(response: string, score: number): string {
    if (score >= 0.9) return '高い正確性を保っています。';
    if (score >= 0.7) return '概ね正確ですが、一部の数値や主張に検証が必要です。';
    return '正確性に懸念があります。データと主張の妥当性を再確認してください。';
  }

  private generateCompletenessFeedback(
    response: string, 
    score: number, 
    criteria?: EvaluationCriteria
  ): string {
    if (score >= 0.8) return '包括的で完全な回答です。';
    if (score >= 0.6) {
      const missing = criteria?.mustInclude?.filter(item => 
        !response.toLowerCase().includes(item.toLowerCase())
      ) || [];
      
      if (missing.length > 0) {
        return `以下の要素が不足しています: ${missing.join(', ')}`;
      }
      return '主要な要素は含まれていますが、さらに詳細な説明が可能です。';
    }
    return '重要な要素が欠けています。回答の完全性を向上させてください。';
  }

  private generateActionabilityFeedback(response: string, score: number): string {
    if (score >= 0.8) return '具体的で実行可能な提案が含まれています。';
    if (score >= 0.5) return '実行可能な要素はありますが、より具体的な手順が必要です。';
    return '実行に移すための具体的な指示が不足しています。';
  }

  private generateECKnowledgeFeedback(response: string, score: number): string {
    if (score >= 0.8) return 'EC業界の深い知識が反映されています。';
    if (score >= 0.5) return '基本的なEC知識は示されていますが、より専門的な視点が望まれます。';
    return 'EC業界特有の視点や専門知識をより活用してください。';
  }
}