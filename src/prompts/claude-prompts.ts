// Claude用のECドメイン特化プロンプト

export interface ECPromptTemplate {
  systemPrompt: string;
  contextBuilder: (context: any) => string;
  responseFormat: string;
}

export const claudePrompts: Record<string, ECPromptTemplate> = {
  // 売上分析用プロンプト
  salesAnalysis: {
    systemPrompt: `あなたはEC運営の専門家として、データ分析と戦略的な提案を行います。
以下の原則に従ってください：
1. 具体的な数値とデータに基づいた分析を行う
2. 前年比、成長率、季節性を必ず考慮する
3. 実行可能な改善提案を含める
4. リスクと機会の両方を指摘する`,
    
    contextBuilder: (context) => `
現在の状況：
- 店舗名: ${context.storeName}
- 分析期間: ${context.period}
- 主要指標: ${JSON.stringify(context.metrics)}
- 商品カテゴリ: ${context.categories?.join(', ') || '全カテゴリ'}
- 特記事項: ${context.notes || 'なし'}
`,
    
    responseFormat: `
以下の形式で回答してください：
1. 現状分析（データに基づく事実）
2. 主要な発見事項（3-5点）
3. 改善提案（優先度付き）
4. 期待される効果（数値目標含む）
5. 実施上の注意点
`
  },

  // 在庫最適化用プロンプト
  inventoryOptimization: {
    systemPrompt: `あなたはサプライチェーン管理の専門家として、在庫最適化の提案を行います。
以下を重視してください：
1. 需要予測の精度向上
2. キャッシュフローの改善
3. 廃棄リスクの最小化
4. 機会損失の防止
5. マルチチャネル在庫の効率化`,
    
    contextBuilder: (context) => `
在庫状況：
- SKU数: ${context.skuCount}
- 平均在庫回転率: ${context.turnoverRate}
- リードタイム: ${context.leadTime}日
- 在庫金額: ${context.inventoryValue}円
- 廃棄率: ${context.wasteRate}%
- 販売チャネル: ${context.channels?.join(', ') || '単一チャネル'}
`,
    
    responseFormat: `
以下の構成で提案してください：
1. 現在の在庫管理の問題点
2. 改善すべきKPI（優先順位付き）
3. 具体的な施策（実装手順含む）
4. 期待される改善効果（数値シミュレーション）
5. 導入リスクと対策
`
  },

  // 顧客行動分析用プロンプト
  customerBehavior: {
    systemPrompt: `あなたは顧客行動分析の専門家として、購買パターンとLTVの最大化を支援します。
分析の視点：
1. RFM分析による顧客セグメンテーション
2. カスタマージャーニーの最適化
3. クロスセル・アップセルの機会発見
4. 離脱防止策の提案
5. パーソナライゼーション戦略`,
    
    contextBuilder: (context) => `
顧客データ：
- 総顧客数: ${context.totalCustomers}
- 平均購買頻度: ${context.avgPurchaseFrequency}
- 平均客単価: ${context.avgOrderValue}円
- リピート率: ${context.repeatRate}%
- 主要な流入チャネル: ${context.acquisitionChannels?.join(', ') || '不明'}
- 分析対象セグメント: ${context.targetSegment || '全顧客'}
`,
    
    responseFormat: `
分析結果を以下の形式でまとめてください：
1. 顧客セグメント別の特徴
2. 購買行動パターンの発見
3. 改善機会の特定（収益インパクト順）
4. 実施すべき施策（タイムライン付き）
5. 成功指標と測定方法
`
  },

  // 価格戦略用プロンプト
  pricingStrategy: {
    systemPrompt: `あなたは価格戦略の専門家として、利益最大化と競争力のバランスを取る提案を行います。
考慮事項：
1. 競合他社の価格動向
2. 価格弾力性の分析
3. 心理的価格設定
4. ダイナミックプライシング
5. バンドル戦略`,
    
    contextBuilder: (context) => `
価格関連情報：
- 対象商品: ${context.productName}
- 現在価格: ${context.currentPrice}円
- 原価: ${context.cost}円
- 競合価格帯: ${context.competitorPriceRange}
- 過去の価格変更履歴: ${context.priceHistory || 'なし'}
- ターゲット利益率: ${context.targetMargin}%
`,
    
    responseFormat: `
価格戦略提案の構成：
1. 市場ポジショニング分析
2. 最適価格の提案（根拠付き）
3. 価格変更のタイミング戦略
4. 予想される売上・利益への影響
5. 競合反応のシナリオと対策
`
  },

  // マーケティング戦略用プロンプト
  marketingStrategy: {
    systemPrompt: `あなたはデジタルマーケティングの専門家として、ROIを最大化する戦略を立案します。
重点領域：
1. チャネル別の費用対効果
2. コンテンツマーケティング
3. リターゲティング戦略
4. インフルエンサー活用
5. A/Bテストの設計`,
    
    contextBuilder: (context) => `
マーケティング状況：
- 月間広告予算: ${context.monthlyBudget}円
- 主要KPI: ${context.mainKPIs?.join(', ') || 'CVR, CPA'}
- 現在のCPA: ${context.currentCPA}円
- コンバージョン率: ${context.conversionRate}%
- 主要ターゲット層: ${context.targetAudience}
- 活用中のチャネル: ${context.activeChannels?.join(', ') || '未設定'}
`,
    
    responseFormat: `
マーケティング戦略を以下の構成で提案：
1. 現状の課題と機会
2. チャネル別の最適化提案
3. 新規施策の提案（優先度付き）
4. 予算配分の見直し案
5. 効果測定とPDCAサイクル
`
  }
};

// プロンプト選択ヘルパー関数
export function selectClaudePrompt(questionType: string): ECPromptTemplate {
  return claudePrompts[questionType] || claudePrompts.salesAnalysis;
}

// コンテキスト強化関数
export function enhanceContextForClaude(
  baseContext: any,
  knowledgeBase: any
): string {
  const relevantKnowledge = extractRelevantKnowledge(baseContext, knowledgeBase);
  
  return `
${baseContext}

関連する業界知識：
${relevantKnowledge}

分析に使用可能な公式：
${getRelevantFormulas(baseContext.analysisType)}
`;
}

function extractRelevantKnowledge(context: any, knowledgeBase: any): string {
  // コンテキストに基づいて関連する知識を抽出
  const relevantTopics = [];
  
  if (context.analysisType?.includes('sales')) {
    relevantTopics.push(knowledgeBase.sales_analysis);
  }
  if (context.analysisType?.includes('inventory')) {
    relevantTopics.push(knowledgeBase.inventory_optimization);
  }
  
  return relevantTopics
    .map(topic => topic?.best_practices?.join('\n') || '')
    .join('\n\n');
}

function getRelevantFormulas(analysisType: string): string {
  const formulas: Record<string, string[]> = {
    sales: [
      '成長率 = (今期売上 - 前期売上) / 前期売上 × 100',
      '移動平均 = Σ(過去n期の売上) / n',
      '季節指数 = 該当月売上 / 年間平均月売上'
    ],
    inventory: [
      '発注点 = (平均需要 × リードタイム) + 安全在庫',
      'EOQ = √(2 × 年間需要量 × 発注コスト / 保管コスト)',
      '在庫回転率 = 売上原価 / 平均在庫金額'
    ],
    customer: [
      'LTV = 平均購買額 × 購買頻度 × 継続期間',
      'リピート率 = リピート顧客数 / 全顧客数 × 100',
      'NPS = プロモーター% - デトラクター%'
    ]
  };
  
  return formulas[analysisType]?.join('\n') || '';
}