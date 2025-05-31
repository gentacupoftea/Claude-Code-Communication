import { LLMResponse, WorkerLLM } from '../types';
import { LLMAPIService } from './LLMAPIService';
import { LLM_CONFIG } from '../config';

export interface AggregationResult {
  summary: string;
  details: {
    mainInsights: string[];
    keyFindings: any;
    recommendations: string[];
  };
  visualizations: any[];
  confidence: number;
  metadata: {
    workersUsed: string[];
    processingTime: number;
  };
}

export class AggregatorLLMService {
  private apiService: LLMAPIService;

  constructor() {
    this.apiService = new LLMAPIService({
      endpoint: LLM_CONFIG.openai.endpoint,
      apiKey: LLM_CONFIG.openai.apiKey,
      model: LLM_CONFIG.openai.models.orchestrator,
      maxRetries: LLM_CONFIG.defaults.maxRetries
    });
  }

  async aggregateResponses(
    userQuery: string,
    workerResponses: LLMResponse[],
    workers: WorkerLLM[]
  ): Promise<AggregationResult> {
    const startTime = Date.now();

    // Worker情報をマッピング
    const workerMap = new Map(workers.map(w => [w.id, w]));
    
    // レスポンスを整形
    const formattedResponses = workerResponses.map(response => ({
      workerId: response.workerId,
      workerName: workerMap.get(response.workerId)?.name || 'Unknown',
      workerType: workerMap.get(response.workerId)?.type || 'unknown',
      content: response.content,
      data: response.data,
      visualization: response.visualization,
      confidence: response.confidence
    }));

    // Aggregator用のプロンプトを生成
    const prompt = this.createAggregationPrompt(userQuery, formattedResponses);

    try {
      // LLMに集約を依頼
      const aggregationResponse = await this.apiService.callLLM(prompt, {
        temperature: 0.3,
        maxTokens: 2000
      });

      // レスポンスをパース
      const parsedResponse = this.parseAggregationResponse(aggregationResponse);

      // 可視化データを統合
      const allVisualizations = workerResponses
        .filter(r => r.visualization)
        .map(r => r.visualization);

      return {
        summary: parsedResponse.summary,
        details: parsedResponse.details,
        visualizations: allVisualizations,
        confidence: this.calculateOverallConfidence(workerResponses),
        metadata: {
          workersUsed: workerResponses.map(r => r.workerId),
          processingTime: Date.now() - startTime
        }
      };
    } catch (error) {
      console.error('Aggregation error:', error);
      // フォールバック：シンプルな集約
      return this.fallbackAggregation(userQuery, workerResponses, startTime);
    }
  }

  private createAggregationPrompt(userQuery: string, formattedResponses: any[]): string {
    return `
あなたは高度な統合能力を持つAIアシスタントです。
複数の専門AIからの回答を統合し、ユーザーに最も価値のある包括的な回答を作成してください。

## ユーザーの質問:
${userQuery}

## 各専門AIからの回答:
${JSON.stringify(formattedResponses, null, 2)}

## タスク:
1. 各AIの回答から重要な情報を抽出
2. 矛盾する情報がある場合は、信頼度と文脈を考慮して調整
3. ユーザーの質問に対する直接的で分かりやすい回答を作成
4. 重要な洞察と推奨事項を整理

## 出力形式（JSON）:
{
  "summary": "ユーザーへの簡潔で分かりやすい回答（日本語）",
  "details": {
    "mainInsights": ["主要な洞察1", "主要な洞察2"],
    "keyFindings": {
      "分析結果": "詳細",
      "その他の発見": "詳細"
    },
    "recommendations": ["推奨事項1", "推奨事項2"]
  }
}

注意事項:
- ユーザーにとって最も価値のある情報を優先
- 専門用語は避け、分かりやすい日本語で説明
- 実用的なアドバイスを含める
- 可視化データがある場合は、その説明も含める
`;
  }

  private parseAggregationResponse(response: string): any {
    try {
      // JSONレスポンスを抽出
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Failed to parse aggregation response:', error);
    }

    // パース失敗時のデフォルト構造
    return {
      summary: response,
      details: {
        mainInsights: [],
        keyFindings: {},
        recommendations: []
      }
    };
  }

  private calculateOverallConfidence(responses: LLMResponse[]): number {
    if (responses.length === 0) return 0;
    
    // 信頼度の加重平均を計算
    const totalConfidence = responses.reduce((sum, r) => sum + r.confidence, 0);
    return totalConfidence / responses.length;
  }

  private fallbackAggregation(
    userQuery: string,
    workerResponses: LLMResponse[],
    startTime: number
  ): AggregationResult {
    // シンプルなフォールバック集約
    const summary = this.createFallbackSummary(userQuery, workerResponses);
    const insights = this.extractInsights(workerResponses);
    
    return {
      summary,
      details: {
        mainInsights: insights,
        keyFindings: this.extractKeyFindings(workerResponses),
        recommendations: this.extractRecommendations(workerResponses)
      },
      visualizations: workerResponses
        .filter(r => r.visualization)
        .map(r => r.visualization),
      confidence: this.calculateOverallConfidence(workerResponses),
      metadata: {
        workersUsed: workerResponses.map(r => r.workerId),
        processingTime: Date.now() - startTime
      }
    };
  }

  private createFallbackSummary(userQuery: string, responses: LLMResponse[]): string {
    if (responses.length === 0) {
      return 'お問い合わせいただいた内容について、現在処理中です。';
    }

    if (responses.length === 1) {
      return responses[0].content;
    }

    // 複数のレスポンスを統合
    let summary = `${userQuery}について、以下の分析結果が得られました：\n\n`;
    
    responses.forEach((response, index) => {
      if (response.content) {
        summary += `### 分析${index + 1}:\n${response.content.substring(0, 200)}...\n\n`;
      }
    });

    return summary;
  }

  private extractInsights(responses: LLMResponse[]): string[] {
    const insights: string[] = [];
    
    responses.forEach(response => {
      // データから洞察を抽出
      if (response.data?.insights) {
        insights.push(...response.data.insights);
      }
      
      // 思考過程から重要な点を抽出
      if (response.thinking && response.thinking.length > 0) {
        insights.push(response.thinking[0]);
      }
    });

    // 重複を削除
    return [...new Set(insights)].slice(0, 5);
  }

  private extractKeyFindings(responses: LLMResponse[]): any {
    const findings: any = {};
    
    responses.forEach(response => {
      if (response.data) {
        Object.entries(response.data).forEach(([key, value]) => {
          if (key !== 'insights' && key !== 'recommendations') {
            findings[key] = value;
          }
        });
      }
    });

    return findings;
  }

  private extractRecommendations(responses: LLMResponse[]): string[] {
    const recommendations: string[] = [];
    
    responses.forEach(response => {
      if (response.data?.recommendations) {
        recommendations.push(...response.data.recommendations);
      }
    });

    // 重複を削除
    return [...new Set(recommendations)].slice(0, 5);
  }
}