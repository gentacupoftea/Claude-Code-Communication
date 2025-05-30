import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';

interface AnalysisOptions {
  includeEmotionAnalysis?: boolean;
  includeSentimentAnalysis?: boolean;
  includePersonalityTraits?: boolean;
  includeBehaviorPatterns?: boolean;
  generateDetailedReport?: boolean;
}

interface AnalysisResult {
  summary: {
    dominantPersonality: string;
    keyInsights: string[];
    recommendations: string[];
  };
  emotions?: any;
  sentiment?: any;
  personality?: any;
  behaviorPatterns?: any;
  detailedAnalysis?: string;
}

class AIAnalysisService {
  private openai: OpenAI;
  private anthropic: Anthropic;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }

  async analyzePersona(
    data: any,
    options: AnalysisOptions,
    targetAudience: string
  ): Promise<AnalysisResult> {
    logger.info('Starting AI persona analysis');

    const result: AnalysisResult = {
      summary: {
        dominantPersonality: '',
        keyInsights: [],
        recommendations: []
      }
    };

    try {
      // 1. データの前処理
      const processedData = await this.preprocessData(data);

      // 2. 感情分析
      if (options.includeEmotionAnalysis) {
        result.emotions = await this.analyzeEmotions(processedData);
      }

      // 3. センチメント分析
      if (options.includeSentimentAnalysis) {
        result.sentiment = await this.analyzeSentiment(processedData);
      }

      // 4. 性格特性分析
      if (options.includePersonalityTraits) {
        result.personality = await this.analyzePersonality(processedData);
      }

      // 5. 行動パターン分析
      if (options.includeBehaviorPatterns) {
        result.behaviorPatterns = await this.analyzeBehaviorPatterns(processedData);
      }

      // 6. 統合分析とサマリー生成
      const summary = await this.generateSummary(
        result,
        processedData,
        targetAudience
      );
      result.summary = summary;

      // 7. 詳細レポート生成
      if (options.generateDetailedReport) {
        result.detailedAnalysis = await this.generateDetailedAnalysis(
          result,
          processedData,
          targetAudience
        );
      }

      logger.info('AI persona analysis completed successfully');
      return result;
    } catch (error) {
      logger.error('AI analysis failed:', error);
      throw error;
    }
  }

  private async preprocessData(data: any): Promise<any> {
    // データの前処理（テキスト抽出、正規化など）
    return {
      transcripts: data.transcript ? await this.extractText(data.transcript) : '',
      surveyData: data.survey ? JSON.parse(data.survey.toString()) : {},
      purchaseData: data.purchaseData ? await this.parseCsv(data.purchaseData) : []
    };
  }

  private async analyzeEmotions(data: any): Promise<any> {
    const prompt = `
    以下のデータから感情分析を行い、主要な感情とその強度を特定してください：
    
    ${JSON.stringify(data, null, 2)}
    
    以下の形式で回答してください：
    - 主要な感情（喜び、悲しみ、怒り、恐れ、驚き、嫌悪）
    - 各感情の強度（0-100）
    - 感情の変化パターン
    `;

    const response = await this.openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  }

  private async analyzeSentiment(data: any): Promise<any> {
    const prompt = `
    以下のデータからセンチメント分析を行い、全体的な感情の傾向を分析してください：
    
    ${JSON.stringify(data, null, 2)}
    
    以下の項目について分析してください：
    - 全体的なセンチメント（ポジティブ/ネガティブ/ニュートラル）
    - センチメントスコア（-1.0 から 1.0）
    - 主要なトピックごとのセンチメント
    `;

    const response = await this.anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-opus-20240229',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000
    });

    return JSON.parse(response.content[0].text || '{}');
  }

  private async analyzePersonality(data: any): Promise<any> {
    const prompt = `
    以下のデータからBig Fiveモデルに基づいて性格特性を分析してください：
    
    ${JSON.stringify(data, null, 2)}
    
    以下の5つの特性について0-100のスコアで評価してください：
    1. 開放性（Openness）
    2. 誠実性（Conscientiousness）
    3. 外向性（Extraversion）
    4. 協調性（Agreeableness）
    5. 神経症傾向（Neuroticism）
    
    また、最も顕著な性格特性とその理由も説明してください。
    `;

    const response = await this.openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  }

  private async analyzeBehaviorPatterns(data: any): Promise<any> {
    const prompt = `
    以下のデータから行動パターンを分析してください：
    
    ${JSON.stringify(data, null, 2)}
    
    分析項目：
    - 購買行動パターン
    - 意思決定プロセス
    - 価値観と優先順位
    - ライフスタイルの特徴
    - 行動の一貫性と変化
    `;

    const response = await this.anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-opus-20240229',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1500
    });

    return JSON.parse(response.content[0].text || '{}');
  }

  private async generateSummary(
    analysisResult: any,
    data: any,
    targetAudience: string
  ): Promise<any> {
    const prompt = `
    以下の分析結果を統合し、ペルソナの要約を作成してください：
    
    分析結果：
    ${JSON.stringify(analysisResult, null, 2)}
    
    ターゲットオーディエンス：${targetAudience}
    
    以下の形式で要約を作成してください：
    {
      "dominantPersonality": "最も顕著な性格タイプ（例：革新的な探求者）",
      "keyInsights": [
        "重要な洞察1",
        "重要な洞察2",
        "重要な洞察3"
      ],
      "recommendations": [
        "推奨アクション1",
        "推奨アクション2",
        "推奨アクション3"
      ]
    }
    `;

    const response = await this.openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  }

  private async generateDetailedAnalysis(
    analysisResult: any,
    data: any,
    targetAudience: string
  ): Promise<string> {
    const prompt = `
    以下の分析結果に基づいて、詳細なペルソナ分析レポートを作成してください：
    
    分析結果：
    ${JSON.stringify(analysisResult, null, 2)}
    
    ターゲットオーディエンス：${targetAudience}
    
    レポートには以下の内容を含めてください：
    1. エグゼクティブサマリー
    2. 詳細な性格分析
    3. 感情とセンチメントの詳細
    4. 行動パターンと傾向
    5. マーケティングとコミュニケーション戦略の提案
    6. 今後の調査推奨事項
    
    マークダウン形式で、プロフェッショナルなトーンで作成してください。
    `;

    const response = await this.anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-opus-20240229',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000
    });

    return response.content[0].text || '';
  }

  private async extractText(buffer: Buffer): Promise<string> {
    // PDFやその他のドキュメントからテキストを抽出
    // 実際の実装では pdf-parse などのライブラリを使用
    return buffer.toString('utf-8');
  }

  private async parseCsv(buffer: Buffer): Promise<any[]> {
    // CSVデータのパース
    // 実際の実装では csv-parse などのライブラリを使用
    const text = buffer.toString('utf-8');
    const lines = text.split('\n');
    const headers = lines[0].split(',');
    
    return lines.slice(1).map(line => {
      const values = line.split(',');
      return headers.reduce((obj, header, index) => {
        obj[header] = values[index];
        return obj;
      }, {} as any);
    });
  }
}

export const aiAnalysisService = new AIAnalysisService();