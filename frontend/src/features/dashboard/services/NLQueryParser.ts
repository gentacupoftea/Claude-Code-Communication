import { NLQuery, QueryIntent, QueryEntity, ChartSuggestion, WidgetType } from '../types';

export class NLQueryParser {
  private intentPatterns: Map<string, RegExp[]>;
  private entityPatterns: Map<string, RegExp[]>;
  private chartSuggestionRules: Map<string, WidgetType[]>;

  constructor() {
    this.intentPatterns = new Map();
    this.entityPatterns = new Map();
    this.chartSuggestionRules = new Map();
    this.initializePatterns();
  }

  private initializePatterns() {
    // インテントパターン（日本語対応）
    this.intentPatterns = new Map([
      ['visualize', [
        /表示|見せて|グラフ|チャート|可視化/,
        /ビジュアル|描画|プロット/
      ]],
      ['analyze', [
        /分析|解析|調査|調べ/,
        /検証|評価|レビュー/
      ]],
      ['compare', [
        /比較|対比|違い|差/,
        /対照|並べ|versus|vs/
      ]],
      ['trend', [
        /推移|傾向|トレンド|変化/,
        /経時|時系列|推移/
      ]],
      ['forecast', [
        /予測|予想|見込み|将来/,
        /フォーキャスト|プロジェクション/
      ]]
    ]);

    // エンティティパターン
    this.entityPatterns = new Map([
      ['metric', [
        /売上|売り上げ|売上高|revenue/i,
        /利益|profit|収益/i,
        /コスト|費用|cost|expense/i,
        /件数|数量|count|quantity/i,
        /率|rate|割合|percentage/i
      ]],
      ['dimension', [
        /地域|エリア|region|area/i,
        /商品|製品|product|item/i,
        /顧客|customer|client/i,
        /カテゴリ|分類|category/i,
        /部門|部署|department/i
      ]],
      ['time', [
        /月別|月ごと|monthly/i,
        /年別|年ごと|yearly|annual/i,
        /日別|日ごと|daily/i,
        /週別|週ごと|weekly/i,
        /四半期|quarter/i,
        /今月|先月|今年|去年|yesterday|today/i
      ]]
    ]);

    // チャート提案ルール
    this.chartSuggestionRules = new Map([
      ['時系列', ['line-chart', 'bar-chart']],
      ['比較', ['bar-chart', 'pie-chart', 'scatter-chart']],
      ['構成比', ['pie-chart', 'bar-chart']],
      ['相関', ['scatter-chart', 'heatmap']],
      ['KPI', ['kpi-card', 'gauge']],
      ['地理', ['map', 'heatmap']]
    ]);
  }

  parse(query: string): NLQuery {
    const intent = this.detectIntent(query);
    const entities = this.extractEntities(query);
    const suggestions = this.generateChartSuggestions(query, intent, entities);

    return {
      text: query,
      intent,
      entities,
      suggestions
    };
  }

  private detectIntent(query: string): QueryIntent {
    let bestMatch = { action: 'visualize' as const, confidence: 0.5 };

    for (const [action, patterns] of this.intentPatterns) {
      for (const pattern of patterns) {
        if (pattern.test(query)) {
          bestMatch = {
            action: action as any,
            confidence: 0.8
          };
          break;
        }
      }
    }

    return bestMatch;
  }

  private extractEntities(query: string): QueryEntity[] {
    const entities: QueryEntity[] = [];

    for (const [type, patterns] of this.entityPatterns) {
      for (const pattern of patterns) {
        const matches = query.match(pattern);
        if (matches) {
          entities.push({
            type: type as any,
            value: matches[0],
            confidence: 0.7
          });
        }
      }
    }

    return entities;
  }

  private generateChartSuggestions(
    query: string,
    intent: QueryIntent,
    entities: QueryEntity[]
  ): ChartSuggestion[] {
    const suggestions: ChartSuggestion[] = [];

    // 時系列データの場合
    if (entities.some(e => e.type === 'time')) {
      suggestions.push({
        type: 'line-chart',
        reason: '時系列データの推移を見るのに最適です',
        confidence: 0.9,
        config: {
          interactions: { zoom: true, pan: true }
        }
      });
    }

    // 比較の場合
    if (intent.action === 'compare' || query.includes('比較')) {
      suggestions.push({
        type: 'bar-chart',
        reason: '複数の項目を比較するのに適しています',
        confidence: 0.85,
        config: {
          styling: { animation: true }
        }
      });

      if (entities.filter(e => e.type === 'dimension').length <= 5) {
        suggestions.push({
          type: 'pie-chart',
          reason: '構成比を視覚的に表現できます',
          confidence: 0.7,
          config: {}
        });
      }
    }

    // KPI表示の場合
    if (query.includes('KPI') || query.includes('指標')) {
      suggestions.push({
        type: 'kpi-card',
        reason: '重要指標を強調表示できます',
        confidence: 0.95,
        config: {
          styling: { fontSize: 24 }
        }
      });
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  // クエリをチャート設定に変換
  async convertToChartConfig(nlQuery: NLQuery, dataSource: any): Promise<any> {
    // 実装: NLクエリからチャート設定を生成
    const config = {
      type: nlQuery.suggestions[0]?.type || 'bar-chart',
      title: this.generateTitle(nlQuery),
      dimensions: this.extractDimensions(nlQuery),
      measures: this.extractMeasures(nlQuery),
      filters: this.extractFilters(nlQuery)
    };

    return config;
  }

  private generateTitle(nlQuery: NLQuery): string {
    const metrics = nlQuery.entities.filter(e => e.type === 'metric').map(e => e.value);
    const dimensions = nlQuery.entities.filter(e => e.type === 'dimension').map(e => e.value);
    const timeframe = nlQuery.entities.find(e => e.type === 'time')?.value;

    let title = '';
    if (metrics.length > 0) {
      title += metrics.join('・');
    }
    if (dimensions.length > 0) {
      title += `（${dimensions.join('・')}別）`;
    }
    if (timeframe) {
      title += ` - ${timeframe}`;
    }

    return title || 'データ分析';
  }

  private extractDimensions(nlQuery: NLQuery): string[] {
    // 実装: エンティティから次元を抽出
    return nlQuery.entities
      .filter(e => e.type === 'dimension')
      .map(e => e.field || e.value);
  }

  private extractMeasures(nlQuery: NLQuery): any[] {
    // 実装: エンティティから指標を抽出
    return nlQuery.entities
      .filter(e => e.type === 'metric')
      .map(e => ({
        field: e.field || e.value,
        aggregation: 'sum'
      }));
  }

  private extractFilters(nlQuery: NLQuery): any[] {
    // 実装: クエリからフィルタを抽出
    return [];
  }
}