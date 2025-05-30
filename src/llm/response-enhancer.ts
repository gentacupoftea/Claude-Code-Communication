// レスポンス強化モジュール

export interface EnhancementOptions {
  addVisualizationSuggestions?: boolean;
  addImplementationSteps?: boolean;
  addRiskAssessment?: boolean;
  addMetrics?: boolean;
  formatAsReport?: boolean;
}

export class ResponseEnhancer {
  enhanceResponse(
    rawResponse: string,
    questionType: string,
    options: EnhancementOptions = {}
  ): string {
    let enhancedResponse = rawResponse;

    // 基本的な構造化
    enhancedResponse = this.structureResponse(enhancedResponse, questionType);

    // オプションに基づく強化
    if (options.addVisualizationSuggestions) {
      enhancedResponse += this.addVisualizationSuggestions(questionType);
    }

    if (options.addImplementationSteps) {
      enhancedResponse += this.addImplementationSteps(questionType);
    }

    if (options.addRiskAssessment) {
      enhancedResponse += this.addRiskAssessment(questionType);
    }

    if (options.addMetrics) {
      enhancedResponse += this.addMetrics(questionType);
    }

    if (options.formatAsReport) {
      enhancedResponse = this.formatAsReport(enhancedResponse, questionType);
    }

    return enhancedResponse;
  }

  private structureResponse(response: string, questionType: string): string {
    // レスポンスが既に構造化されている場合はそのまま返す
    if (response.includes('##') || response.includes('1.')) {
      return response;
    }

    // 質問タイプに応じた構造化
    const structures: Record<string, string[]> = {
      data_analysis: [
        '## 現状分析',
        '## 主要な発見',
        '## 改善提案',
        '## 期待効果'
      ],
      prediction: [
        '## 予測結果',
        '## 予測根拠',
        '## 信頼区間',
        '## リスク要因'
      ],
      optimization: [
        '## 最適化案',
        '## 実装手順',
        '## コスト影響',
        '## 期待ROI'
      ],
      strategic_planning: [
        '## 戦略概要',
        '## 実行計画',
        '## 必要リソース',
        '## 成功指標'
      ]
    };

    const structure = structures[questionType] || structures.data_analysis;
    
    // レスポンスを段落に分割して構造化
    const paragraphs = response.split('\n\n').filter(p => p.trim());
    let structuredResponse = '';
    
    structure.forEach((section, index) => {
      structuredResponse += `${section}\n`;
      if (paragraphs[index]) {
        structuredResponse += `${paragraphs[index]}\n\n`;
      }
    });

    return structuredResponse;
  }

  private addVisualizationSuggestions(questionType: string): string {
    const visualizations: Record<string, string[]> = {
      data_analysis: [
        '- 時系列グラフ: 売上推移の可視化',
        '- ヒートマップ: 曜日×時間帯の売上密度',
        '- パレート図: 商品別売上貢献度'
      ],
      prediction: [
        '- 予測チャート: 実績と予測値の比較',
        '- 信頼区間バンド: 予測の不確実性表示',
        '- シナリオ比較: 複数予測の並列表示'
      ],
      customer_behavior: [
        '- サンキー図: カスタマージャーニーフロー',
        '- コホート分析表: 顧客セグメント別推移',
        '- RFMマトリックス: 顧客価値の分布'
      ],
      optimization: [
        '- 最適化前後比較: KPIの改善度',
        '- 感度分析: パラメータ変更の影響',
        '- ROIウォーターフォール: 収益影響の内訳'
      ]
    };

    const suggestions = visualizations[questionType] || visualizations.data_analysis;
    
    return `\n\n## 推奨ビジュアライゼーション\n${suggestions.join('\n')}`;
  }

  private addImplementationSteps(questionType: string): string {
    const steps: Record<string, string[]> = {
      optimization: [
        '1. 現状のベースライン測定',
        '2. パイロットテストの実施（全体の10%）',
        '3. 結果の検証と調整',
        '4. 段階的な全体展開',
        '5. 継続的なモニタリングと最適化'
      ],
      strategic_planning: [
        '1. ステークホルダーの合意形成',
        '2. 詳細計画の策定',
        '3. リソースの確保',
        '4. キックオフと初期実装',
        '5. 定期的なレビューと調整'
      ],
      data_analysis: [
        '1. データ品質の確認',
        '2. 分析環境の構築',
        '3. 初期分析の実施',
        '4. 結果の検証',
        '5. レポーティング体制の確立'
      ]
    };

    const implementationSteps = steps[questionType] || steps.optimization;
    
    return `\n\n## 実装ステップ\n${implementationSteps.join('\n')}`;
  }

  private addRiskAssessment(questionType: string): string {
    const risks: Record<string, Array<{risk: string; mitigation: string}>> = {
      optimization: [
        {
          risk: '既存プロセスへの影響',
          mitigation: '段階的導入とロールバック計画'
        },
        {
          risk: '投資対効果の未達成',
          mitigation: 'パイロットテストによる事前検証'
        }
      ],
      prediction: [
        {
          risk: '予測精度の低下',
          mitigation: '複数モデルのアンサンブル使用'
        },
        {
          risk: '外部要因による変動',
          mitigation: 'シナリオ分析と感度分析'
        }
      ],
      strategic_planning: [
        {
          risk: '市場環境の変化',
          mitigation: '四半期ごとの戦略見直し'
        },
        {
          risk: 'リソース不足',
          mitigation: '優先順位付けと段階的実行'
        }
      ]
    };

    const riskItems = risks[questionType] || risks.optimization;
    
    let riskSection = '\n\n## リスク評価と対策\n';
    riskItems.forEach(item => {
      riskSection += `**リスク**: ${item.risk}\n`;
      riskSection += `**対策**: ${item.mitigation}\n\n`;
    });

    return riskSection;
  }

  private addMetrics(questionType: string): string {
    const metrics: Record<string, string[]> = {
      optimization: [
        '- 効率改善率: 目標 +20%',
        '- コスト削減額: 月額○○万円',
        '- ROI: 6ヶ月で回収見込み'
      ],
      prediction: [
        '- 予測精度: MAPE < 10%',
        '- 信頼区間: 95%',
        '- 更新頻度: 週次'
      ],
      strategic_planning: [
        '- 市場シェア: +5%目標',
        '- 顧客満足度: NPS +10ポイント',
        '- 収益成長: 前年比 +15%'
      ]
    };

    const kpis = metrics[questionType] || metrics.optimization;
    
    return `\n\n## 成功指標（KPI）\n${kpis.join('\n')}`;
  }

  private formatAsReport(response: string, questionType: string): string {
    const date = new Date().toLocaleDateString('ja-JP');
    
    return `
# 分析レポート

**作成日**: ${date}  
**分析タイプ**: ${this.translateQuestionType(questionType)}

---

## エグゼクティブサマリー

${this.extractSummary(response)}

---

${response}

---

## 次のステップ

1. 本レポートの内容についてステークホルダーと協議
2. 実装計画の詳細化
3. 必要なリソースの確保
4. パイロットプロジェクトの開始

---

*本レポートは自動生成されています。詳細な分析や追加情報が必要な場合は、担当チームまでお問い合わせください。*
`;
  }

  private translateQuestionType(type: string): string {
    const translations: Record<string, string> = {
      data_analysis: 'データ分析',
      prediction: '予測分析',
      optimization: '最適化分析',
      strategic_planning: '戦略立案',
      creative_suggestion: '創造的提案',
      troubleshooting: '問題解決',
      comparison: '比較分析',
      explanation: '説明・解説'
    };

    return translations[type] || type;
  }

  private extractSummary(response: string): string {
    // レスポンスの最初の段落または最初の3文を抽出
    const paragraphs = response.split('\n\n');
    const firstParagraph = paragraphs[0];
    
    if (firstParagraph.length < 200) {
      return firstParagraph;
    }
    
    // 長い場合は最初の3文を抽出
    const sentences = firstParagraph.split('。');
    return sentences.slice(0, 3).join('。') + '。';
  }

  // 数値を強調表示
  highlightNumbers(response: string): string {
    return response.replace(
      /(\d+(?:\.\d+)?%?)/g,
      '**$1**'
    );
  }

  // アクションアイテムを抽出
  extractActionItems(response: string): string[] {
    const actionItems: string[] = [];
    
    // 「〜してください」「〜すべき」「〜を推奨」などのパターンを検索
    const patterns = [
      /([^。]+(?:してください|すべき|を推奨|が必要|を実施))/g,
      /([^。]+(?:改善|最適化|導入|検討)(?:する|を))/g
    ];

    patterns.forEach(pattern => {
      const matches = response.match(pattern);
      if (matches) {
        actionItems.push(...matches);
      }
    });

    return [...new Set(actionItems)].slice(0, 5);
  }

  // 専門用語の説明を追加
  addGlossary(response: string): string {
    const terms: Record<string, string> = {
      'LTV': '顧客生涯価値（Life Time Value）',
      'CAC': '顧客獲得コスト（Customer Acquisition Cost）',
      'ROAS': '広告費用対効果（Return On Ad Spend）',
      'AOV': '平均注文金額（Average Order Value）',
      'CVR': 'コンバージョン率（Conversion Rate）',
      'CPA': '顧客獲得単価（Cost Per Acquisition）',
      'CTR': 'クリック率（Click Through Rate）',
      'NPS': 'ネットプロモータースコア（Net Promoter Score）'
    };

    let glossarySection = '\n\n## 用語解説\n';
    let hasTerms = false;

    for (const [term, explanation] of Object.entries(terms)) {
      if (response.includes(term)) {
        glossarySection += `- **${term}**: ${explanation}\n`;
        hasTerms = true;
      }
    }

    return hasTerms ? response + glossarySection : response;
  }
}