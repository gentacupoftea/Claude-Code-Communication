// コンテキスト構築ヘルパー

import * as ecKnowledgeBase from '../knowledge/ec-knowledge-base.json';
import * as industryBenchmarks from '../knowledge/industry-benchmarks.json';
import * as bestPractices from '../knowledge/best-practices.json';

export interface KnowledgeCategoryData {
  concepts?: string[];
  formulas?: string[];
  examples?: string[];
  best_practices?: string[];
  kpis?: string[];
}

export interface PracticeCategoryData {
  quickWins?: Array<{ practice: string }>;
  longTerm?: Array<{ practice: string }>;
  quick_wins?: Array<{ practice: string }>;
  advanced_strategies?: Array<{ practice: string }>;
}

export interface RelevantBenchmarks {
  conversionRates?: {
    overall?: unknown;
    industry?: unknown;
    byDevice?: unknown;
  };
  aov?: {
    overall?: unknown;
    industry?: unknown;
    byDevice?: unknown;
  };
  cart_abandonment?: {
    overall?: unknown;
    industry?: unknown;
  };
  customer_lifetime_value?: {
    industry?: unknown;
  };
  [key: string]: unknown;
}

export interface EnrichedContext {
  originalContext: unknown;
  relevantKnowledge: {
    concepts: string[];
    formulas: string[];
    bestPractices: string[];
    kpis: string[];
  };
  industryBenchmarks: RelevantBenchmarks;
  suggestedApproaches: string[];
}

export class ContextBuilder {
  private knowledgeBase = ecKnowledgeBase;
  private benchmarks = industryBenchmarks;
  private practices = bestPractices;

  buildEnrichedContext(
    question: string,
    baseContext: unknown,
    analysisType: string
  ): EnrichedContext {
    const relevantKnowledge = this.extractRelevantKnowledge(question, analysisType);
    const relevantBenchmarks = this.extractRelevantBenchmarks(question, baseContext);
    const suggestedApproaches = this.suggestApproaches(question, analysisType);

    return {
      originalContext: baseContext,
      relevantKnowledge,
      industryBenchmarks: relevantBenchmarks,
      suggestedApproaches
    };
  }

  private extractRelevantKnowledge(
    question: string,
    analysisType: string
  ): EnrichedContext['relevantKnowledge'] {
    const knowledge: EnrichedContext['relevantKnowledge'] = {
      concepts: [],
      formulas: [],
      bestPractices: [],
      kpis: []
    };

    // 分析タイプに基づいて関連知識を抽出
    const knowledgeCategories = this.identifyRelevantCategories(question, analysisType);
    
    knowledgeCategories.forEach(category => {
      const categoryData = (this.knowledgeBase as Record<string, KnowledgeCategoryData>)[category];
      if (categoryData) {
        knowledge.concepts.push(...(categoryData.concepts || []));
        knowledge.formulas.push(...(categoryData.formulas || []));
        knowledge.bestPractices.push(...(categoryData.best_practices || []));
        knowledge.kpis.push(...(categoryData.kpis || []));
      }
    });

    // 重複を削除
    knowledge.concepts = [...new Set(knowledge.concepts)];
    knowledge.formulas = [...new Set(knowledge.formulas)];
    knowledge.bestPractices = [...new Set(knowledge.bestPractices)];
    knowledge.kpis = [...new Set(knowledge.kpis)];

    return knowledge;
  }

  private identifyRelevantCategories(question: string, analysisType: string): string[] {
    const categories: string[] = [];
    
    // キーワードマッピング
    const categoryKeywords = {
      sales_analysis: ['売上', '販売', '収益', 'セール', '前年比'],
      inventory_optimization: ['在庫', '発注', 'リードタイム', '廃棄'],
      customer_behavior: ['顧客', 'LTV', 'リピート', 'チャーン', 'RFM'],
      pricing_strategy: ['価格', '値下げ', 'プライシング', 'マージン'],
      marketing_optimization: ['マーケティング', '広告', 'ROAS', 'キャンペーン'],
      operations_excellence: ['配送', 'フルフィルメント', '返品', 'カスタマーサポート']
    };

    // 質問文からカテゴリを特定
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => question.includes(keyword))) {
        categories.push(category);
      }
    }

    // 分析タイプからもカテゴリを追加
    if (analysisType && !categories.includes(analysisType)) {
      categories.push(analysisType);
    }

    return categories.length > 0 ? categories : ['sales_analysis']; // デフォルト
  }

  private extractRelevantBenchmarks(question: string, context: unknown): RelevantBenchmarks {
    const relevantBenchmarks: RelevantBenchmarks = {};

    // 業界の特定
    const industry = this.detectIndustry(question, context);

    // コンバージョン率ベンチマーク
    if (question.includes('コンバージョン') || question.includes('CVR')) {
      relevantBenchmarks.conversionRates = {
        overall: this.benchmarks.conversion_rates.overall_average,
        industry: industry 
          ? this.benchmarks.conversion_rates.by_industry[industry as keyof typeof industryBenchmarks.conversion_rates.by_industry]
          : null,
        byDevice: this.benchmarks.conversion_rates.by_device
      };
    }

    // AOVベンチマーク
    if (question.includes('客単価') || question.includes('AOV')) {
      relevantBenchmarks.averageOrderValues = {
        overall: this.benchmarks.average_order_values.overall_average,
        industry: industry
          ? this.benchmarks.average_order_values.by_industry[industry as keyof typeof industryBenchmarks.average_order_values.by_industry]
          : null
      };
    }

    // カート放棄率
    if (question.includes('カート') || question.includes('放棄')) {
      relevantBenchmarks.cartAbandonment = {
        overall: this.benchmarks.cart_abandonment_rates.overall_average,
        reasons: this.benchmarks.cart_abandonment_rates.abandonment_reasons
      };
    }

    // 顧客維持率
    if (question.includes('リピート') || question.includes('顧客維持')) {
      relevantBenchmarks.customerRetention = {
        repeatPurchaseRate: this.benchmarks.customer_retention.repeat_purchase_rates.overall_average,
        ltv: this.benchmarks.customer_retention.customer_lifetime_values.overall_average
      };
    }

    return relevantBenchmarks;
  }

  private detectIndustry(question: string, context: unknown): string | null {
    // コンテキストから業界を検出
    if (context && typeof context === 'object' && 'industry' in context) {
      const industry = (context as { industry: unknown }).industry;
      if (typeof industry === 'string') {
        return this.normalizeIndustry(industry);
      }
    }

    // 質問文から業界を推測
    const industryKeywords = {
      fashion: ['ファッション', 'アパレル', '服', '衣類'],
      electronics: ['電化製品', '家電', 'ガジェット', 'PC'],
      home_garden: ['家具', 'インテリア', 'ガーデニング', '園芸'],
      health_beauty: ['コスメ', '化粧品', '美容', 'ヘルスケア'],
      food_beverage: ['食品', '飲料', 'グルメ', '食材'],
      sports_outdoor: ['スポーツ', 'アウトドア', 'フィットネス'],
      toys_hobbies: ['おもちゃ', 'ホビー', 'ゲーム'],
      books_media: ['本', '書籍', 'メディア', '電子書籍'],
      automotive: ['自動車', 'カー用品', 'バイク'],
      b2b: ['B2B', '法人', '業務用']
    };

    for (const [industry, keywords] of Object.entries(industryKeywords)) {
      if (keywords.some(keyword => question.includes(keyword))) {
        return industry;
      }
    }

    return null;
  }

  private normalizeIndustry(industry: string): string {
    const normalizationMap: Record<string, string> = {
      'アパレル': 'fashion',
      'ファッション': 'fashion',
      '家電': 'electronics',
      '化粧品': 'health_beauty',
      'コスメ': 'health_beauty',
      '食品': 'food_beverage'
    };

    return normalizationMap[industry] || industry.toLowerCase();
  }

  private suggestApproaches(question: string, _analysisType: string): string[] {
    const approaches: string[] = [];

    // ベストプラクティスから関連するアプローチを抽出
    const practiceCategories = this.identifyPracticeCategories(question);
    
    practiceCategories.forEach(category => {
      const categoryData = (this.practices as Record<string, PracticeCategoryData>)[category];
      if (categoryData) {
        // クイックウィンを優先的に提案
        if (categoryData.quick_wins) {
          approaches.push(...categoryData.quick_wins.map(qw => qw.practice));
        }
        
        // 高度な戦略も含める
        if (categoryData.advanced_strategies && question.includes('高度')) {
          approaches.push(...categoryData.advanced_strategies.map(as => as.practice));
        }
      }
    });

    return [...new Set(approaches)].slice(0, 5); // 最大5つの提案
  }

  private identifyPracticeCategories(question: string): string[] {
    const categories: string[] = [];
    
    const categoryMapping = {
      sales_optimization: ['売上', '収益', 'AOV', 'コンバージョン'],
      customer_experience: ['顧客体験', 'UX', 'チェックアウト', 'モバイル'],
      marketing_automation: ['マーケティング', '自動化', 'メール', 'セグメント'],
      inventory_management: ['在庫', 'ABC分析', '季節', '需要予測'],
      customer_service: ['カスタマーサポート', '対応', 'CS', 'サービス'],
      data_analytics: ['分析', 'ダッシュボード', 'KPI', 'データ'],
      technology_stack: ['技術', 'ツール', 'システム', '統合']
    };

    for (const [category, keywords] of Object.entries(categoryMapping)) {
      if (keywords.some(keyword => question.includes(keyword))) {
        categories.push(category);
      }
    }

    return categories;
  }

  // 時系列データの文脈を構築
  buildTimeSeriesContext(
    data: unknown[],
    period: string,
    granularity: string
  ): string {
    return `
時系列データコンテキスト:
- データ期間: ${period}
- データ粒度: ${granularity}
- データポイント数: ${data.length}
- 最新データ: ${data[data.length - 1]}
- トレンド: ${this.calculateTrend(data)}
`;
  }

  private calculateTrend(data: unknown[]): string {
    if (data.length < 2) return '不明';
    
    // 数値配列にフィルタリング
    const numericData = data.filter((item): item is number => typeof item === 'number');
    if (numericData.length < 2) return '不明';
    
    const recent = numericData.slice(-5);
    const older = numericData.slice(-10, -5);
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    
    const change = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    if (change > 5) return `上昇傾向（+${change.toFixed(1)}%）`;
    if (change < -5) return `下降傾向（${change.toFixed(1)}%）`;
    return '横ばい';
  }

  // 競合比較の文脈を構築
  buildCompetitiveContext(
    ownMetrics: unknown,
    competitorMetrics: unknown[],
    focusAreas: string[]
  ): string {
    return `
競合比較コンテキスト:
自社指標:
${JSON.stringify(ownMetrics, null, 2)}

競合指標（${competitorMetrics.length}社）:
${competitorMetrics.map((c, i) => `競合${i + 1}: ${JSON.stringify(c)}`).join('\n')}

重点領域: ${focusAreas.join(', ')}
`;
  }
}