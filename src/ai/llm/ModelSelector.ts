/**
 * LLMモデルセレクター
 * 
 * タスクに応じて最適なLLMモデルを選択するユーティリティ
 */

import { LATEST_MODELS } from './LLMService';

export interface TaskRequirements {
  type: 'analysis' | 'generation' | 'classification' | 'summarization' | 'translation' | 'code';
  complexity: 'low' | 'medium' | 'high';
  contextLength: 'short' | 'medium' | 'long';
  speed: 'fast' | 'balanced' | 'quality';
  language: 'ja' | 'en' | 'multi';
  budget: 'low' | 'medium' | 'high';
}

export interface ModelRecommendation {
  provider: 'anthropic' | 'openai' | 'google';
  model: string;
  reason: string;
  estimatedCost: number;
  alternativeOptions: Array<{
    provider: string;
    model: string;
    tradeoff: string;
  }>;
}

export class ModelSelector {
  /**
   * タスクに基づいて最適なモデルを推薦
   */
  static recommendModel(requirements: TaskRequirements): ModelRecommendation {
    // 日本語タスクの場合
    if (requirements.language === 'ja') {
      return this.recommendForJapanese(requirements);
    }

    // 複雑度による選択
    if (requirements.complexity === 'high') {
      return this.recommendForComplexTask(requirements);
    }

    // スピード重視
    if (requirements.speed === 'fast') {
      return this.recommendForSpeed(requirements);
    }

    // バランス型（デフォルト）
    return this.recommendBalanced(requirements);
  }

  /**
   * 日本語タスク向けの推薦
   */
  private static recommendForJapanese(requirements: TaskRequirements): ModelRecommendation {
    if (requirements.complexity === 'high' && requirements.contextLength === 'long') {
      return {
        provider: 'anthropic',
        model: LATEST_MODELS.anthropic.claude3_opus,
        reason: 'Claude 3 Opusは日本語の長文理解と複雑な推論に優れています',
        estimatedCost: 0.015,
        alternativeOptions: [
          {
            provider: 'anthropic',
            model: LATEST_MODELS.anthropic.claude3_5_sonnet,
            tradeoff: 'より高速で、品質も十分高い'
          },
          {
            provider: 'openai',
            model: LATEST_MODELS.openai.gpt4o,
            tradeoff: 'マルチモーダル対応、高速処理'
          }
        ]
      };
    }

    // 中程度の複雑さ
    return {
      provider: 'anthropic',
      model: LATEST_MODELS.anthropic.claude3_5_sonnet,
      reason: 'Claude 3.5 Sonnetは日本語処理において最高のバランスを提供',
      estimatedCost: 0.003,
      alternativeOptions: [
        {
          provider: 'google',
          model: LATEST_MODELS.google.gemini_pro,
          tradeoff: '長いコンテキストウィンドウ、コスト効率的'
        }
      ]
    };
  }

  /**
   * 複雑なタスク向けの推薦
   */
  private static recommendForComplexTask(requirements: TaskRequirements): ModelRecommendation {
    if (requirements.type === 'code' || requirements.type === 'analysis') {
      return {
        provider: 'anthropic',
        model: LATEST_MODELS.anthropic.claude3_opus,
        reason: 'Claude 3 Opusは複雑なコード理解と分析タスクで最高の性能',
        estimatedCost: 0.015,
        alternativeOptions: [
          {
            provider: 'openai',
            model: LATEST_MODELS.openai.gpt4_turbo,
            tradeoff: '同等の品質、API統合が容易'
          }
        ]
      };
    }

    return {
      provider: 'openai',
      model: LATEST_MODELS.openai.gpt4o,
      reason: 'GPT-4oは複雑な推論タスクで優れた性能を発揮',
      estimatedCost: 0.01,
      alternativeOptions: [
        {
          provider: 'anthropic',
          model: LATEST_MODELS.anthropic.claude3_opus,
          tradeoff: 'より深い分析が可能'
        }
      ]
    };
  }

  /**
   * スピード重視の推薦
   */
  private static recommendForSpeed(requirements: TaskRequirements): ModelRecommendation {
    if (requirements.budget === 'low') {
      return {
        provider: 'anthropic',
        model: LATEST_MODELS.anthropic.claude3_haiku,
        reason: 'Claude 3 Haikuは最速かつ最もコスト効率的',
        estimatedCost: 0.00025,
        alternativeOptions: [
          {
            provider: 'google',
            model: LATEST_MODELS.google.gemini_flash,
            tradeoff: '同様に高速、長いコンテキスト対応'
          }
        ]
      };
    }

    return {
      provider: 'openai',
      model: LATEST_MODELS.openai.gpt4o_mini,
      reason: 'GPT-4o miniは高速処理と品質のバランスが良い',
      estimatedCost: 0.00015,
      alternativeOptions: [
        {
          provider: 'anthropic',
          model: LATEST_MODELS.anthropic.claude3_haiku,
          tradeoff: 'より安価で同等の速度'
        }
      ]
    };
  }

  /**
   * バランス型の推薦
   */
  private static recommendBalanced(requirements: TaskRequirements): ModelRecommendation {
    return {
      provider: 'anthropic',
      model: LATEST_MODELS.anthropic.claude3_5_sonnet,
      reason: 'Claude 3.5 Sonnetは品質、速度、コストの最適なバランス',
      estimatedCost: 0.003,
      alternativeOptions: [
        {
          provider: 'openai',
          model: LATEST_MODELS.openai.gpt4o,
          tradeoff: 'マルチモーダル対応、より新しいモデル'
        },
        {
          provider: 'google',
          model: LATEST_MODELS.google.gemini_pro,
          tradeoff: '100万トークンのコンテキストウィンドウ'
        }
      ]
    };
  }

  /**
   * モデルの能力比較
   */
  static compareModels(): Record<string, {
    strengths: string[];
    weaknesses: string[];
    bestFor: string[];
    contextWindow: number;
    costPer1kTokens: { input: number; output: number };
  }> {
    return {
      [LATEST_MODELS.anthropic.claude4]: {
        strengths: ['最新の推論能力', '複雑なタスク', '創造的な問題解決'],
        weaknesses: ['最も高価', 'まだベータ版'],
        bestFor: ['研究開発', '複雑な分析', '革新的なソリューション'],
        contextWindow: 200000,
        costPer1kTokens: { input: 0.02, output: 0.06 }
      },
      [LATEST_MODELS.anthropic.claude3_5_sonnet]: {
        strengths: ['優れた日本語理解', '高速処理', 'コーディング能力'],
        weaknesses: ['Opusより推論能力が劣る'],
        bestFor: ['一般的なビジネスタスク', 'コード生成', '文章作成'],
        contextWindow: 200000,
        costPer1kTokens: { input: 0.003, output: 0.015 }
      },
      [LATEST_MODELS.anthropic.claude3_opus]: {
        strengths: ['最高の推論能力', '複雑な分析', '長文理解'],
        weaknesses: ['処理速度', 'コスト'],
        bestFor: ['複雑な分析', '研究', '高度な文章作成'],
        contextWindow: 200000,
        costPer1kTokens: { input: 0.015, output: 0.075 }
      },
      [LATEST_MODELS.openai.gpt4o]: {
        strengths: ['マルチモーダル', '高速', 'API統合'],
        weaknesses: ['日本語はClaudeに劣る場合がある'],
        bestFor: ['画像解析', 'リアルタイムアプリ', 'チャットボット'],
        contextWindow: 128000,
        costPer1kTokens: { input: 0.005, output: 0.015 }
      },
      [LATEST_MODELS.google.gemini_pro]: {
        strengths: ['超長文コンテキスト', 'マルチモーダル', 'Google統合'],
        weaknesses: ['新しいため実績が少ない'],
        bestFor: ['文書分析', '動画理解', 'Google Workspace統合'],
        contextWindow: 1000000,
        costPer1kTokens: { input: 0.00035, output: 0.00105 }
      }
    };
  }

  /**
   * 使用シナリオ別の推奨設定
   */
  static getScenarioConfig(scenario: string): {
    provider: string;
    model: string;
    temperature: number;
    maxTokens: number;
    systemPrompt?: string;
  } {
    const scenarios: Record<string, any> = {
      'product_description': {
        provider: 'anthropic',
        model: LATEST_MODELS.anthropic.claude3_5_sonnet,
        temperature: 0.8,
        maxTokens: 500,
        systemPrompt: 'あなたは経験豊富なECマーケターです。SEO最適化された魅力的な商品説明を作成してください。'
      },
      'customer_support': {
        provider: 'anthropic',
        model: LATEST_MODELS.anthropic.claude3_haiku,
        temperature: 0.3,
        maxTokens: 300,
        systemPrompt: 'あなたは親切で知識豊富なカスタマーサポート担当者です。'
      },
      'data_analysis': {
        provider: 'anthropic',
        model: LATEST_MODELS.anthropic.claude3_opus,
        temperature: 0.1,
        maxTokens: 2000,
        systemPrompt: 'あなたはデータサイエンティストです。正確で洞察に富んだ分析を提供してください。'
      },
      'creative_marketing': {
        provider: 'openai',
        model: LATEST_MODELS.openai.gpt4o,
        temperature: 0.9,
        maxTokens: 800,
        systemPrompt: 'あなたはクリエイティブディレクターです。革新的なマーケティングアイデアを提案してください。'
      }
    };

    return scenarios[scenario] || scenarios['product_description'];
  }
}