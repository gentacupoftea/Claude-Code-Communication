// GPT-4用のECドメイン特化プロンプト

export interface GPT4PromptTemplate {
  systemMessage: string;
  userMessageBuilder: (context: unknown) => string;
  functions?: Array<{
    name: string;
    description: string;
    parameters: unknown;
  }>;
}

export const gpt4Prompts: Record<string, GPT4PromptTemplate> = {
  // 需要予測と売上予測
  demandForecast: {
    systemMessage: `あなたは高度な統計分析と機械学習の専門家として、ECビジネスの需要予測を行います。
    
分析手法：
- 時系列分析（ARIMA, Prophet）
- 機械学習モデル（Random Forest, XGBoost）
- 外部要因の組み込み（天気、イベント、経済指標）
- アンサンブル予測
- 予測区間の提供`,
    
    userMessageBuilder: (context) => {
      const ctx = context && typeof context === 'object' ? context as Record<string, unknown> : {};
      return `
以下のデータに基づいて需要予測を実施してください：

歴史データ：
- 期間: ${ctx.historicalPeriod || '未指定'}
- 粒度: ${ctx.dataGranularity || '未指定'}
- 売上実績: ${ctx.salesData ? '提供済み' : '要確認'}
- 季節性: ${ctx.seasonality || '未特定'}

予測要件：
- 予測期間: ${ctx.forecastPeriod || '未指定'}
- 予測対象: ${ctx.forecastTarget || '未指定'}
- 必要な精度: ${ctx.requiredAccuracy || '±10%'}
- 考慮すべき外部要因: ${Array.isArray(ctx.externalFactors) ? ctx.externalFactors.join(', ') : 'なし'}

期待する出力：
1. 点推定値と予測区間（95%信頼区間）
2. 使用したモデルと選定理由
3. 主要な予測ドライバー
4. モデルの精度評価
5. ビジネス上の注意点
`;
    },
    
    functions: [
      {
        name: 'calculate_forecast',
        description: '需要予測の計算を実行',
        parameters: {
          type: 'object',
          properties: {
            model_type: {
              type: 'string',
              enum: ['arima', 'prophet', 'ml_ensemble'],
              description: '使用する予測モデル'
            },
            confidence_level: {
              type: 'number',
              description: '信頼区間のレベル（0-1）'
            },
            include_seasonality: {
              type: 'boolean',
              description: '季節性を考慮するか'
            }
          },
          required: ['model_type', 'confidence_level']
        }
      }
    ]
  },

  // 複雑なデータ分析
  complexAnalysis: {
    systemMessage: `あなたはデータサイエンスの専門家として、ECデータの複雑な分析を実施します。

分析能力：
- 多変量解析（回帰分析、因子分析、クラスター分析）
- 因果推論（A/Bテスト分析、因果効果推定）
- 異常検知（外れ値、不正検知）
- ネットワーク分析（商品関連性、顧客関係）
- テキスト分析（レビュー、問い合わせ）`,
    
    userMessageBuilder: (context) => {
      const ctx = context && typeof context === 'object' ? context as Record<string, unknown> : {};
      return `
以下の複雑な分析課題を解決してください：

分析目的: ${ctx.analysisObjective || '未指定'}

利用可能なデータ：
${Array.isArray(ctx.availableData) ? ctx.availableData.map((d: unknown) => {
  if (d && typeof d === 'object' && 'name' in d && 'description' in d) {
    const data = d as { name: unknown; description: unknown };
    return `- ${data.name}: ${data.description}`;
  }
  return '- 未指定';
}).join('\n') : '- 未指定'}

分析の制約条件：
- 計算時間: ${ctx.computationLimit || '制限なし'}
- 解釈可能性: ${ctx.interpretability || '高'}
- 統計的有意性: ${ctx.significanceLevel || '0.05'}

具体的な質問：
${Array.isArray(ctx.specificQuestions) ? ctx.specificQuestions.join('\n') : (ctx.mainQuestion || '未指定')}

期待する成果物：
1. 分析結果の要約
2. 統計的な裏付け
3. ビジュアライゼーションの提案
4. アクションアイテム
5. 追加分析の推奨
`;
    }
  },

  // 最適化問題の解決
  optimization: {
    systemMessage: `あなたは最適化問題の専門家として、ECビジネスの様々な最適化課題を解決します。

専門領域：
- 線形計画法、整数計画法
- 動的計画法
- メタヒューリスティクス
- 多目的最適化
- 制約充足問題`,
    
    userMessageBuilder: (context) => {
      const ctx = context && typeof context === 'object' ? context as Record<string, unknown> : {};
      return `
以下の最適化問題を解決してください：

問題設定：
- 最適化対象: ${ctx.optimizationTarget || '未指定'}
- 目的関数: ${ctx.objectiveFunction || '未指定'}
- 決定変数: ${Array.isArray(ctx.decisionVariables) ? ctx.decisionVariables.join(', ') : '未定義'}

制約条件：
${Array.isArray(ctx.constraints) ? ctx.constraints.map((c: unknown, i: number) => `${i + 1}. ${c}`).join('\n') : '制約なし'}

現在の状況：
- 現在値: ${ctx.currentValue || '未指定'}
- ベンチマーク: ${ctx.benchmark || 'なし'}
- 改善目標: ${ctx.improvementTarget || '未指定'}

求める解答：
1. 最適解（または準最適解）
2. 解の導出プロセス
3. 感度分析
4. 実装上の課題と対策
5. 段階的な実装計画
`;
    },
    
    functions: [
      {
        name: 'solve_optimization',
        description: '最適化問題を解く',
        parameters: {
          type: 'object',
          properties: {
            algorithm: {
              type: 'string',
              description: '使用するアルゴリズム'
            },
            iterations: {
              type: 'integer',
              description: '反復回数'
            },
            tolerance: {
              type: 'number',
              description: '収束判定の許容誤差'
            }
          },
          required: ['algorithm']
        }
      }
    ]
  },

  // リスク評価と管理
  riskAssessment: {
    systemMessage: `あなたはリスク管理の専門家として、ECビジネスのリスクを定量的に評価します。

評価手法：
- モンテカルロシミュレーション
- シナリオ分析
- 感度分析
- VaR（Value at Risk）
- ストレステスト`,
    
    userMessageBuilder: (context) => {
      const ctx = context && typeof context === 'object' ? context as Record<string, unknown> : {};
      return `
リスク評価を実施してください：

評価対象：
- ビジネス領域: ${ctx.businessArea || '未指定'}
- 評価期間: ${ctx.assessmentPeriod || '未指定'}
- 主要なリスク要因: ${Array.isArray(ctx.riskFactors) ? ctx.riskFactors.join(', ') : '未特定'}

現在の状況：
- 過去のインシデント: ${ctx.pastIncidents || 'なし'}
- 現在の対策: ${ctx.currentMeasures || '未実装'}
- リスク許容度: ${ctx.riskTolerance || '中程度'}

評価項目：
1. リスクの定量化（発生確率×影響度）
2. リスクマトリックス
3. 最悪シナリオの分析
4. 緩和策の提案と効果
5. モニタリング指標の設定
`;
    }
  },

  // 高度な価格最適化
  advancedPricing: {
    systemMessage: `あなたは価格最適化の専門家として、動的かつ戦略的な価格設定を支援します。

専門知識：
- 収益管理（Revenue Management）
- 価格弾力性のモデリング
- 競合反応の予測
- 心理的価格設定
- マルチチャネル価格戦略`,
    
    userMessageBuilder: (context) => {
      const ctx = context && typeof context === 'object' ? context as Record<string, unknown> : {};
      return `
高度な価格最適化分析を実施してください：

商品情報：
- 商品カテゴリ: ${ctx.productCategory || '未指定'}
- 現在の価格帯: ${ctx.currentPriceRange || '未指定'}
- 競合数: ${ctx.competitorCount || '未指定'}
- 商品ライフサイクル: ${ctx.productLifecycle || '未指定'}

市場環境：
- 需要の価格弾力性: ${ctx.priceElasticity || '未測定'}
- 競合の価格戦略: ${ctx.competitorStrategy || '不明'}
- 季節性/イベント: ${ctx.seasonalFactors || 'なし'}

最適化目標：
- 主目標: ${ctx.primaryGoal || '未指定'} (利益最大化/シェア拡大/在庫消化)
- 制約: ${ctx.pricingConstraints || 'なし'}
- 時間軸: ${ctx.optimizationTimeframe || '未指定'}

求める分析：
1. 最適価格の算出（セグメント別）
2. 価格変更の影響シミュレーション
3. 競合反応のシナリオ
4. 実装ロードマップ
5. KPIとモニタリング方法
`;
    }
  }
};

// GPT-4の分析能力を最大化する関数
export function enhanceAnalyticalDepth(
  basePrompt: string,
  analysisDepth: 'basic' | 'intermediate' | 'advanced'
): string {
  const depthEnhancers = {
    basic: '基本的な統計分析と可視化を中心に説明してください。',
    intermediate: '統計的検定を含め、因果関係の考察も行ってください。',
    advanced: '高度な統計手法、機械学習モデル、因果推論を駆使して分析してください。'
  };
  
  return `${basePrompt}\n\n分析の深さ: ${depthEnhancers[analysisDepth]}`;
}

// 構造化された出力を促す関数
export function requestStructuredOutput(
  basePrompt: string,
  outputFormat: 'json' | 'table' | 'report'
): string {
  const formatInstructions = {
    json: `
出力はJSON形式で構造化してください：
{
  "summary": "要約",
  "findings": ["発見1", "発見2"],
  "recommendations": ["推奨1", "推奨2"],
  "metrics": {"metric1": value1, "metric2": value2}
}`,
    table: `
出力は表形式で整理してください：
| 項目 | 現在値 | 予測値 | 改善率 |
|------|--------|--------|--------|
| KPI1 | XXX    | YYY    | +Z%    |`,
    report: `
出力はビジネスレポート形式で：
1. エグゼクティブサマリー
2. 詳細分析
3. 推奨事項
4. 実装計画
5. 付録（技術的詳細）`
  };
  
  return `${basePrompt}\n\n${formatInstructions[outputFormat]}`;
}

// 数値精度を指定する関数
export function specifyNumericalPrecision(
  basePrompt: string,
  precision: {
    decimals?: number;
    significantFigures?: number;
    confidenceIntervals?: boolean;
  }
): string {
  let precisionInstructions = '\n\n数値の表示精度：\n';
  
  if (precision.decimals !== undefined) {
    precisionInstructions += `- 小数点以下${precision.decimals}桁まで表示\n`;
  }
  if (precision.significantFigures !== undefined) {
    precisionInstructions += `- 有効数字${precision.significantFigures}桁\n`;
  }
  if (precision.confidenceIntervals) {
    precisionInstructions += '- 信頼区間（95%）を併記\n';
  }
  
  return basePrompt + precisionInstructions;
}