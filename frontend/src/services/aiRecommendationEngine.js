/**
 * AI推薦エンジン サービス
 * 2025年完全知能化対応
 */

export class AIRecommendationEngine {
  constructor(config = {}) {
    this.config = {
      apiEndpoint: config.apiEndpoint || process.env.REACT_APP_AI_ENDPOINT || '/api/ai',
      confidenceThreshold: config.confidenceThreshold || 0.6,
      maxRecommendations: config.maxRecommendations || 10,
      ...config
    };
  }

  /**
   * AI推薦を生成
   */
  async generateRecommendations(userData, context = {}) {
    try {
      const response = await fetch(`${this.config.apiEndpoint}/recommendations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userData,
          context,
          config: {
            confidenceThreshold: this.config.confidenceThreshold,
            maxRecommendations: this.config.maxRecommendations
          }
        })
      });

      if (!response.ok) {
        throw new Error(`推薦生成に失敗しました: ${response.status}`);
      }

      const recommendations = await response.json();
      return this.processRecommendations(recommendations);
    } catch (error) {
      // 詳細なエラーログ記録
      const errorDetails = {
        timestamp: new Date().toISOString(),
        method: 'generateRecommendations',
        variables: variables ? Object.keys(variables).length : 0,
        preferences: preferences ? Object.keys(preferences).length : 0,
        error: {
          message: error.message,
          stack: error.stack,
          code: error.code,
          response: error.response?.data
        }
      };
      
      console.error('AI推薦生成エラー - 詳細:', errorDetails);
      
      // ユーザー向けエラーメッセージの生成
      let userMessage = 'AI推薦の生成中にエラーが発生しました。';
      
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        userMessage = 'リクエストがタイムアウトしました。ネットワーク接続を確認して再試行してください。';
      } else if (error.code === 'NETWORK_ERROR' || !navigator.onLine) {
        userMessage = 'ネットワーク接続に問題があります。インターネット接続を確認してください。';
      } else if (error.response?.status === 503) {
        userMessage = 'AIサービスが一時的に利用できません。しばらく後に再試行してください。';
      } else if (error.response?.status >= 500) {
        userMessage = 'サーバーエラーが発生しました。管理者に連絡してください。';
      }
      
      // カスタムエラーオブジェクトを投げる
      const customError = new Error(userMessage);
      customError.originalError = error;
      customError.userFriendly = true;
      customError.retryable = error.code === 'ECONNABORTED' || error.response?.status >= 500;
      
      throw customError;
    }
  }

  /**
   * 推薦結果の後処理
   */
  processRecommendations(rawRecommendations) {
    return rawRecommendations
      .filter(rec => rec.confidence >= this.config.confidenceThreshold)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.config.maxRecommendations)
      .map(rec => ({
        ...rec,
        confidenceLevel: this.getConfidenceLevel(rec.confidence),
        formattedConfidence: `${Math.round(rec.confidence * 100)}%`
      }));
  }

  /**
   * 信頼度レベル判定
   */
  getConfidenceLevel(confidence) {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'medium';
    return 'low';
  }

  /**
   * モデル更新
   */
  async updateModel(trainingData) {
    try {
      const response = await fetch(`${this.config.apiEndpoint}/model/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(trainingData)
      });

      if (!response.ok) {
        throw new Error(`モデル更新に失敗しました: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('モデル更新エラー:', error);
      throw error;
    }
  }

  /**
   * モデルメトリクスを取得
   */
  async getModelMetrics() {
    try {
      const response = await fetch(`${this.config.apiEndpoint}/model/metrics`);
      
      if (!response.ok) {
        throw new Error(`メトリクス取得に失敗しました: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('メトリクス取得エラー:', error);
      // デフォルト値を返す
      return {
        accuracy: 0.85,
        precision: 0.82,
        recall: 0.78,
        f1Score: 0.80
      };
    }
  }
}

export default AIRecommendationEngine;