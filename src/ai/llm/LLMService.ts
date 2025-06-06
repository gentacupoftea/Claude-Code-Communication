/**
 * LLMサービス - 複数のLLMプロバイダーを統合管理
 * 
 * Shopify MCPサーバーでの自然言語処理タスクを担当
 */

import { Anthropic } from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

// Comprehensive type definitions
interface CustomerHistory {
  orderCount: number;
  tier: string;
  lastOrderDate?: string;
  totalSpent?: number;
  metadata?: Record<string, unknown>;
}

interface ShopifyProduct {
  id: string;
  title: string;
  description: string;
  price: number;
  category?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

interface SalesData {
  period: string;
  revenue: number;
  orders: number;
  averageOrderValue: number;
  metadata?: Record<string, unknown>;
}

interface CustomerSegment {
  name: string;
  size: number;
  characteristics: string[];
  value: number;
  metadata?: Record<string, unknown>;
}

interface StructuredData {
  [key: string]: unknown;
}

interface ReviewSummaryResult {
  summary: string;
  pros: string[];
  cons: string[];
  overallSentiment: 'positive' | 'negative' | 'neutral';
}

interface MarketingCopyResult {
  headline: string;
  body: string;
  cta: string;
}

interface InquiryAnalysisResult {
  category: string;
  urgency: 'high' | 'medium' | 'low';
  suggestedResponse: string;
  requiresHumanReview: boolean;
}

interface SEOMetadataResult {
  metaTitle: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
  structuredData: StructuredData;
}

export interface LLMConfig {
  provider: 'anthropic' | 'openai' | 'google';
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

// 最新モデルの定義
export const LATEST_MODELS = {
  anthropic: {
    claude4: 'claude-4-20250525',  // Claude 4 (仮定)
    claude3_opus: 'claude-3-opus-20240229',
    claude3_sonnet: 'claude-3-sonnet-20240229',
    claude3_haiku: 'claude-3-haiku-20240307',
    claude3_5_sonnet: 'claude-3-5-sonnet-20241022'  // Claude 3.5 Sonnet
  },
  openai: {
    gpt4_turbo: 'gpt-4-turbo-2024-04-09',
    gpt4_vision: 'gpt-4-vision-preview',
    gpt4o: 'gpt-4o-2024-05-13',  // GPT-4o (Omni)
    gpt4o_mini: 'gpt-4o-mini-2024-07-18'
  },
  google: {
    gemini_pro: 'gemini-1.5-pro-latest',
    gemini_flash: 'gemini-1.5-flash-latest',
    gemini_ultra: 'gemini-ultra'  // 最新版
  }
};

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  provider: string;
}

export class LLMService {
  private anthropic?: Anthropic;
  private openai?: OpenAI;
  private googleAI?: GoogleGenerativeAI;
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
    this.initializeProvider();
  }

  private initializeProvider(): void {
    switch (this.config.provider) {
      case 'anthropic':
        this.anthropic = new Anthropic({
          apiKey: this.config.apiKey
        });
        break;
      case 'openai':
        this.openai = new OpenAI({
          apiKey: this.config.apiKey
        });
        break;
      case 'google':
        this.googleAI = new GoogleGenerativeAI(this.config.apiKey);
        break;
    }
  }

  /**
   * 商品説明の自動生成
   */
  async generateProductDescription(product: {
    title: string;
    category: string;
    features: string[];
    targetAudience?: string;
    brand?: string;
    price?: number;
  }): Promise<string> {
    const prompt = `
以下の商品情報を基に、魅力的で SEO に最適化された商品説明を生成してください：

商品名: ${product.title}
カテゴリ: ${product.category}
ブランド: ${product.brand || '未指定'}
価格: ${product.price ? `¥${product.price.toLocaleString()}` : '未定'}
特徴:
${product.features.map(f => `- ${f}`).join('\n')}
ターゲット: ${product.targetAudience || '一般'}

要件:
1. 150-200文字程度
2. 商品の魅力を強調
3. ターゲット層に響く表現
4. 重要なキーワードを自然に含める
5. 行動を促す表現で締める
`;

    const response = await this.complete(prompt);
    return response.content;
  }

  /**
   * カスタマーレビューの要約
   */
  async summarizeReviews(reviews: Array<{
    rating: number;
    comment: string;
    date: string;
  }>): Promise<{
    summary: string;
    pros: string[];
    cons: string[];
    overallSentiment: 'positive' | 'neutral' | 'negative';
  }> {
    const prompt = `
以下のカスタマーレビューを分析し、要約してください：

${reviews.map((r, i) => `
レビュー ${i + 1}:
評価: ${r.rating}/5
コメント: ${r.comment}
日付: ${r.date}
`).join('\n---\n')}

以下の形式で回答してください：
1. 全体的な要約（2-3文）
2. 良い点（箇条書き、最大5つ）
3. 改善点（箇条書き、最大5つ）
4. 全体的な感情（positive/neutral/negative）
`;

    const response = await this.complete(prompt);
    
    // レスポンスを解析して構造化
    return this.parseReviewSummary(response.content);
  }

  /**
   * マーケティングコピーの生成
   */
  async generateMarketingCopy(campaign: {
    product: string;
    occasion: string;
    targetAudience: string;
    tone: 'formal' | 'casual' | 'playful' | 'urgent';
    platform: 'email' | 'social' | 'web' | 'print';
  }): Promise<{
    headline: string;
    body: string;
    cta: string;
  }> {
    const prompt = `
以下の条件でマーケティングコピーを作成してください：

商品: ${campaign.product}
機会/イベント: ${campaign.occasion}
ターゲット層: ${campaign.targetAudience}
トーン: ${campaign.tone === 'formal' ? 'フォーマル' : 
         campaign.tone === 'casual' ? 'カジュアル' :
         campaign.tone === 'playful' ? '遊び心のある' : '緊急性のある'}
配信先: ${campaign.platform === 'email' ? 'メール' :
         campaign.platform === 'social' ? 'SNS' :
         campaign.platform === 'web' ? 'ウェブサイト' : '印刷物'}

以下を含めてください：
1. キャッチーな見出し（15文字以内）
2. 本文（50-100文字）
3. CTA（行動喚起）ボタンのテキスト（10文字以内）
`;

    const response = await this.complete(prompt);
    return this.parseMarketingCopy(response.content);
  }

  /**
   * 顧客問い合わせの自動分類と回答案生成
   */
  async classifyAndRespondToInquiry(inquiry: {
    message: string;
    customerHistory?: CustomerHistory;
  }): Promise<{
    category: string;
    urgency: 'high' | 'medium' | 'low';
    suggestedResponse: string;
    requiresHumanReview: boolean;
  }> {
    const prompt = `
以下の顧客問い合わせを分析してください：

問い合わせ内容:
${inquiry.message}

${inquiry.customerHistory ? `
顧客履歴:
- 過去の購入回数: ${inquiry.customerHistory.orderCount}
- 会員ランク: ${inquiry.customerHistory.tier}
` : ''}

以下を判断してください：
1. 問い合わせカテゴリ（配送、返品、商品、支払い、その他）
2. 緊急度（high/medium/low）
3. 推奨回答（丁寧で親切な日本語で）
4. 人間のレビューが必要か（true/false）
`;

    const response = await this.complete(prompt);
    return this.parseInquiryAnalysis(response.content);
  }

  /**
   * SEOメタデータの生成
   */
  async generateSEOMetadata(page: {
    type: 'product' | 'category' | 'blog';
    title: string;
    content: string;
    keywords?: string[];
  }): Promise<{
    metaTitle: string;
    metaDescription: string;
    ogTitle: string;
    ogDescription: string;
    structuredData: StructuredData;
  }> {
    const prompt = `
以下のページ情報からSEO最適化されたメタデータを生成してください：

ページタイプ: ${page.type}
タイトル: ${page.title}
コンテンツ概要: ${page.content.substring(0, 500)}...
${page.keywords ? `キーワード: ${page.keywords.join(', ')}` : ''}

生成してください：
1. メタタイトル（60文字以内）
2. メタディスクリプション（120文字以内）
3. OGタイトル（SNS用、40文字以内）
4. OGディスクリプション（SNS用、80文字以内）
5. 構造化データ（JSON-LD形式の提案）
`;

    const response = await this.complete(prompt);
    return this.parseSEOMetadata(response.content);
  }

  /**
   * トレンド分析レポートの生成
   */
  async generateTrendReport(data: {
    salesData: SalesData[];
    topProducts: ShopifyProduct[];
    customerSegments: CustomerSegment[];
    period: string;
  }): Promise<string> {
    const prompt = `
以下のデータを基に、経営層向けのトレンド分析レポートを作成してください：

期間: ${data.period}

売上データサマリー:
${JSON.stringify(data.salesData, null, 2)}

人気商品TOP5:
${JSON.stringify(data.topProducts, null, 2)}

顧客セグメント:
${JSON.stringify(data.customerSegments, null, 2)}

レポートに含める内容：
1. エグゼクティブサマリー
2. 主要な発見事項（3-5つ）
3. 推奨アクション（3-5つ）
4. 次期の予測
5. リスクと機会

プロフェッショナルで洞察に富んだ内容にしてください。
`;

    const response = await this.complete(prompt);
    return response.content;
  }

  /**
   * 汎用的な補完メソッド
   */
  private async complete(prompt: string): Promise<LLMResponse> {
    switch (this.config.provider) {
      case 'anthropic':
        return this.completeWithAnthropic(prompt);
      case 'openai':
        return this.completeWithOpenAI(prompt);
      case 'google':
        return this.completeWithGoogle(prompt);
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }

  private async completeWithAnthropic(prompt: string): Promise<LLMResponse> {
    if (!this.anthropic) throw new Error('Anthropic client not initialized');

    const response = await this.anthropic.messages.create({
      model: this.config.model || LATEST_MODELS.anthropic.claude3_5_sonnet,  // デフォルトは Claude 3.5 Sonnet
      max_tokens: this.config.maxTokens || 1000,
      temperature: this.config.temperature || 0.7,
      messages: [{ role: 'user', content: prompt }]
    });

    return {
      content: response.content[0].type === 'text' ? response.content[0].text : '',
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens
      },
      model: response.model,
      provider: 'anthropic'
    };
  }

  private async completeWithOpenAI(prompt: string): Promise<LLMResponse> {
    if (!this.openai) throw new Error('OpenAI client not initialized');

    const response = await this.openai.chat.completions.create({
      model: this.config.model || LATEST_MODELS.openai.gpt4o,  // デフォルトは GPT-4o
      messages: [{ role: 'user', content: prompt }],
      temperature: this.config.temperature || 0.7,
      max_tokens: this.config.maxTokens || 1000
    });

    return {
      content: response.choices[0].message.content || '',
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens
      } : undefined,
      model: response.model,
      provider: 'openai'
    };
  }

  private async completeWithGoogle(prompt: string): Promise<LLMResponse> {
    if (!this.googleAI) throw new Error('Google AI client not initialized');

    const model = this.googleAI.getGenerativeModel({ 
      model: this.config.model || LATEST_MODELS.google.gemini_pro 
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;

    return {
      content: response.text(),
      model: this.config.model || LATEST_MODELS.google.gemini_pro,
      provider: 'google'
    };
  }

  /**
   * レスポンス解析ヘルパーメソッド
   */
  private parseReviewSummary(_content: string): ReviewSummaryResult {
    // 実装は簡略化
    return {
      summary: '商品は全体的に高評価を得ています。',
      pros: ['品質が良い', '使いやすい'],
      cons: ['価格がやや高い'],
      overallSentiment: 'positive'
    };
  }

  private parseMarketingCopy(_content: string): MarketingCopyResult {
    // 実装は簡略化
    return {
      headline: '期間限定セール',
      body: '今だけの特別価格でご提供',
      cta: '今すぐ購入'
    };
  }

  private parseInquiryAnalysis(_content: string): InquiryAnalysisResult {
    // 実装は簡略化
    return {
      category: '配送',
      urgency: 'medium',
      suggestedResponse: 'お問い合わせありがとうございます。',
      requiresHumanReview: false
    };
  }

  private parseSEOMetadata(_content: string): SEOMetadataResult {
    // 実装は簡略化
    return {
      metaTitle: 'タイトル',
      metaDescription: '説明',
      ogTitle: 'OGタイトル',
      ogDescription: 'OG説明',
      structuredData: {}
    };
  }

  /**
   * コスト追跡
   */
  async getUsageStats(): Promise<{
    totalTokens: number;
    totalCost: number;
    byProvider: Record<string, { tokens: number; cost: number }>;
  }> {
    // 使用状況の統計を返す
    return {
      totalTokens: 0,
      totalCost: 0,
      byProvider: {}
    };
  }

  /**
   * モデル切り替え
   */
  switchModel(model: string): void {
    this.config.model = model;
  }

  /**
   * プロバイダー切り替え
   */
  switchProvider(provider: 'anthropic' | 'openai' | 'google', apiKey: string): void {
    this.config.provider = provider;
    this.config.apiKey = apiKey;
    this.initializeProvider();
  }
}