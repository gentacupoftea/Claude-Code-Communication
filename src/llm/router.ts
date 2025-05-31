// LLMルーティングロジックの実装

import { AdvancedQuestion } from '../tests/advanced-questions';

export type LLMProvider = 'claude' | 'gemini' | 'gpt-4';

export interface RoutingDecision {
  provider: LLMProvider;
  reasoning: string;
  confidence: number;
  fallbackProvider?: LLMProvider;
}

export interface QuestionAnalysis {
  type: QuestionType;
  complexity: number;
  requiredCapabilities: string[];
  dataIntensity: 'low' | 'medium' | 'high';
  creativityRequired: 'low' | 'medium' | 'high';
  analyticalDepth: 'low' | 'medium' | 'high';
}

export type QuestionType = 
  | 'data_analysis'
  | 'creative_suggestion'
  | 'prediction'
  | 'optimization'
  | 'strategic_planning'
  | 'troubleshooting'
  | 'comparison'
  | 'explanation';

export class LLMRouter {
  private providerStrengths = {
    claude: {
      strengths: [
        'data_analysis',
        'explanation',
        'troubleshooting',
        'strategic_planning'
      ],
      capabilities: {
        contextHandling: 0.95,
        accuracy: 0.92,
        reasoning: 0.94,
        speed: 0.88
      }
    },
    gemini: {
      strengths: [
        'creative_suggestion',
        'strategic_planning',
        'comparison',
        'ideation'
      ],
      capabilities: {
        creativity: 0.96,
        multimodal: 0.94,
        innovation: 0.93,
        speed: 0.90
      }
    },
    'gpt-4': {
      strengths: [
        'prediction',
        'optimization',
        'data_analysis',
        'complex_calculation'
      ],
      capabilities: {
        analytical: 0.95,
        mathematical: 0.94,
        prediction: 0.92,
        structured: 0.91
      }
    }
  };

  route(question: string, context: any): RoutingDecision {
    const analysis = this.analyzeQuestion(question, context);
    const scores = this.calculateProviderScores(analysis);
    const decision = this.makeRoutingDecision(scores, analysis);
    
    return decision;
  }

  private analyzeQuestion(question: string, context: any): QuestionAnalysis {
    const analysis: QuestionAnalysis = {
      type: this.detectQuestionType(question),
      complexity: this.assessComplexity(question, context),
      requiredCapabilities: this.identifyRequiredCapabilities(question),
      dataIntensity: this.assessDataIntensity(question, context),
      creativityRequired: this.assessCreativityRequirement(question),
      analyticalDepth: this.assessAnalyticalDepth(question)
    };
    
    return analysis;
  }

  private detectQuestionType(question: string): QuestionType {
    const typePatterns: Record<QuestionType, RegExp[]> = {
      data_analysis: [
        /分析/i,
        /データ/i,
        /推移/i,
        /パターン/i,
        /傾向/i
      ],
      creative_suggestion: [
        /提案/i,
        /アイデア/i,
        /新しい/i,
        /革新的/i,
        /クリエイティブ/i
      ],
      prediction: [
        /予測/i,
        /予想/i,
        /将来/i,
        /見込み/i,
        /推定/i
      ],
      optimization: [
        /最適化/i,
        /改善/i,
        /効率化/i,
        /最大化/i,
        /最小化/i
      ],
      strategic_planning: [
        /戦略/i,
        /計画/i,
        /ロードマップ/i,
        /施策/i,
        /方針/i
      ],
      troubleshooting: [
        /問題/i,
        /解決/i,
        /原因/i,
        /対策/i,
        /トラブル/i
      ],
      comparison: [
        /比較/i,
        /違い/i,
        /優位性/i,
        /ベンチマーク/i,
        /対比/i
      ],
      explanation: [
        /説明/i,
        /理由/i,
        /なぜ/i,
        /仕組み/i,
        /概要/i
      ]
    };

    let maxScore = 0;
    let detectedType: QuestionType = 'explanation';

    for (const [type, patterns] of Object.entries(typePatterns)) {
      const score = patterns.filter(pattern => pattern.test(question)).length;
      if (score > maxScore) {
        maxScore = score;
        detectedType = type as QuestionType;
      }
    }

    return detectedType;
  }

  private assessComplexity(question: string, context: any): number {
    let complexity = 0;

    // 質問の長さ
    if (question.length > 200) complexity += 2;
    else if (question.length > 100) complexity += 1;

    // 複数の要求事項
    const requirementIndicators = [
      /かつ/g,
      /および/g,
      /また/g,
      /さらに/g,
      /同時に/g
    ];
    requirementIndicators.forEach(pattern => {
      complexity += (question.match(pattern) || []).length * 0.5;
    });

    // 専門用語の使用
    const technicalTerms = [
      /ROI/i,
      /LTV/i,
      /CAC/i,
      /ROAS/i,
      /機械学習/i,
      /最適化/i,
      /アルゴリズム/i
    ];
    technicalTerms.forEach(term => {
      if (term.test(question)) complexity += 0.5;
    });

    // コンテキストの複雑さ
    if (context) {
      const contextKeys = Object.keys(context);
      complexity += contextKeys.length * 0.3;
    }

    return Math.min(complexity, 10); // 0-10のスケールに正規化
  }

  private identifyRequiredCapabilities(question: string): string[] {
    const capabilities: string[] = [];

    const capabilityPatterns = {
      numerical: /\d+%|数値|計算|統計/i,
      temporal: /予測|将来|過去.*年|推移/i,
      comparative: /比較|対比|ベンチマーク/i,
      creative: /新しい|革新的|アイデア|提案/i,
      analytical: /分析|要因|原因|パターン/i,
      strategic: /戦略|計画|ロードマップ/i,
      technical: /実装|技術|システム|アルゴリズム/i
    };

    for (const [capability, pattern] of Object.entries(capabilityPatterns)) {
      if (pattern.test(question)) {
        capabilities.push(capability);
      }
    }

    return capabilities;
  }

  private assessDataIntensity(question: string, context: any): 'low' | 'medium' | 'high' {
    let dataScore = 0;

    // データ関連キーワード
    const dataKeywords = [
      /データ/g,
      /分析/g,
      /数値/g,
      /統計/g,
      /推移/g,
      /実績/g
    ];
    
    dataKeywords.forEach(keyword => {
      dataScore += (question.match(keyword) || []).length;
    });

    // コンテキストのデータ量
    if (context) {
      if (context.historicalData) dataScore += 3;
      if (context.metrics) dataScore += 2;
      if (context.kpis) dataScore += 2;
    }

    if (dataScore >= 5) return 'high';
    if (dataScore >= 2) return 'medium';
    return 'low';
  }

  private assessCreativityRequirement(question: string): 'low' | 'medium' | 'high' {
    let creativityScore = 0;

    const creativeKeywords = [
      /新しい/g,
      /革新的/g,
      /アイデア/g,
      /創造的/g,
      /ユニーク/g,
      /斬新/g,
      /提案/g
    ];

    creativeKeywords.forEach(keyword => {
      creativityScore += (question.match(keyword) || []).length * 2;
    });

    if (creativityScore >= 6) return 'high';
    if (creativityScore >= 3) return 'medium';
    return 'low';
  }

  private assessAnalyticalDepth(question: string): 'low' | 'medium' | 'high' {
    let analyticalScore = 0;

    const analyticalKeywords = [
      /深掘り/g,
      /詳細/g,
      /要因/g,
      /根本原因/g,
      /相関/g,
      /因果関係/g,
      /定量的/g
    ];

    analyticalKeywords.forEach(keyword => {
      analyticalScore += (question.match(keyword) || []).length * 2;
    });

    // 複雑な分析要求
    if (/なぜ.*なぜ/i.test(question)) analyticalScore += 3;
    if (/どのように.*影響/i.test(question)) analyticalScore += 2;

    if (analyticalScore >= 5) return 'high';
    if (analyticalScore >= 2) return 'medium';
    return 'low';
  }

  private calculateProviderScores(
    analysis: QuestionAnalysis
  ): Record<LLMProvider, number> {
    const scores: Record<LLMProvider, number> = {
      claude: 0,
      gemini: 0,
      'gpt-4': 0
    };

    // 質問タイプに基づくスコア
    for (const [provider, config] of Object.entries(this.providerStrengths)) {
      const typedProvider = provider as LLMProvider;
      if (config.strengths.includes(analysis.type)) {
        scores[typedProvider] += 3;
      }
    }

    // 複雑性に基づくスコア
    if (analysis.complexity > 7) {
      scores['claude'] += 2; // Claudeは複雑な文脈に強い
      scores['gpt-4'] += 1.5;
    }

    // データ強度に基づくスコア
    switch (analysis.dataIntensity) {
      case 'high':
        scores['gpt-4'] += 2.5;
        scores['claude'] += 2;
        break;
      case 'medium':
        scores['claude'] += 1.5;
        scores['gpt-4'] += 1.5;
        break;
    }

    // 創造性要求に基づくスコア
    switch (analysis.creativityRequired) {
      case 'high':
        scores['gemini'] += 3;
        break;
      case 'medium':
        scores['gemini'] += 2;
        scores['claude'] += 0.5;
        break;
    }

    // 分析深度に基づくスコア
    switch (analysis.analyticalDepth) {
      case 'high':
        scores['gpt-4'] += 2.5;
        scores['claude'] += 2;
        break;
      case 'medium':
        scores['claude'] += 1.5;
        scores['gpt-4'] += 1.5;
        break;
    }

    // 必要な能力に基づく追加スコア
    analysis.requiredCapabilities.forEach(capability => {
      switch (capability) {
        case 'numerical':
        case 'technical':
          scores['gpt-4'] += 1;
          break;
        case 'creative':
          scores['gemini'] += 1.5;
          break;
        case 'analytical':
        case 'strategic':
          scores['claude'] += 1;
          break;
      }
    });

    return scores;
  }

  private makeRoutingDecision(
    scores: Record<LLMProvider, number>,
    analysis: QuestionAnalysis
  ): RoutingDecision {
    // 最高スコアのプロバイダーを選択
    let selectedProvider: LLMProvider = 'claude';
    let maxScore = -1;
    let secondBestProvider: LLMProvider | undefined;
    let secondBestScore = -1;

    for (const [provider, score] of Object.entries(scores)) {
      if (score > maxScore) {
        secondBestProvider = selectedProvider;
        secondBestScore = maxScore;
        selectedProvider = provider as LLMProvider;
        maxScore = score;
      } else if (score > secondBestScore) {
        secondBestProvider = provider as LLMProvider;
        secondBestScore = score;
      }
    }

    // 信頼度の計算
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    const confidence = totalScore > 0 ? maxScore / totalScore : 0.33;

    // 選択理由の生成
    const reasoning = this.generateRoutingReasoning(
      selectedProvider,
      analysis,
      scores
    );

    return {
      provider: selectedProvider,
      reasoning,
      confidence,
      fallbackProvider: confidence < 0.6 ? secondBestProvider : undefined
    };
  }

  private generateRoutingReasoning(
    provider: LLMProvider,
    analysis: QuestionAnalysis,
    scores: Record<LLMProvider, number>
  ): string {
    const reasons: string[] = [];

    // プロバイダーの強みに基づく理由
    if (this.providerStrengths[provider].strengths.includes(analysis.type)) {
      reasons.push(`${provider}は${analysis.type}タイプの質問に特に優れています`);
    }

    // 分析結果に基づく理由
    if (analysis.dataIntensity === 'high' && provider === 'gpt-4') {
      reasons.push('データ集約的な分析にGPT-4の数値処理能力が適しています');
    }
    
    if (analysis.creativityRequired === 'high' && provider === 'gemini') {
      reasons.push('高い創造性が求められるため、Geminiの革新的な提案力を活用します');
    }
    
    if (analysis.complexity > 7 && provider === 'claude') {
      reasons.push('複雑な文脈理解が必要なため、Claudeの高い文脈処理能力が適切です');
    }

    // スコア差に基づく理由
    const scoreDiff = scores[provider] - Math.max(
      ...Object.entries(scores)
        .filter(([p]) => p !== provider)
        .map(([, s]) => s)
    );
    
    if (scoreDiff > 2) {
      reasons.push(`他のモデルと比較して顕著な優位性があります（スコア差: ${scoreDiff.toFixed(1)}）`);
    }

    return reasons.join('。');
  }

  // 質問の複雑さに基づいてプロバイダーを選択する簡易メソッド
  selectByComplexity(question: string): LLMProvider {
    const complexity = this.assessComplexity(question, null);
    
    if (complexity > 7) return 'claude';
    if (complexity > 4) return 'gpt-4';
    return 'gemini';
  }

  // バッチ処理用：複数の質問を最適なプロバイダーに振り分け
  batchRoute(
    questions: Array<{ id: string; question: string; context?: any }>
  ): Map<LLMProvider, Array<{ id: string; question: string; context?: any }>> {
    const routing = new Map<LLMProvider, Array<{ id: string; question: string; context?: any }>>();
    
    // 初期化
    (['claude', 'gemini', 'gpt-4'] as LLMProvider[]).forEach(provider => {
      routing.set(provider, []);
    });

    // 各質問をルーティング
    questions.forEach(q => {
      const decision = this.route(q.question, q.context);
      routing.get(decision.provider)!.push(q);
    });

    return routing;
  }
}