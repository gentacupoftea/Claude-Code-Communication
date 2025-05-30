/**
 * BigQuery自動保存ミドルウェア
 * APIレスポンスを自動的にBigQueryに保存
 */

const BigQueryStorageService = require('../services/bigquery-storage.service');

class BigQueryAutoSaveMiddleware {
  constructor() {
    this.bigQueryService = new BigQueryStorageService();
    this.saveQueue = [];
    this.processing = false;
  }

  /**
   * レスポンスをインターセプトしてBigQueryに保存
   */
  autoSaveMiddleware() {
    return async (req, res, next) => {
      // 元のjsonメソッドを保存
      const originalJson = res.json;
      const startTime = Date.now();

      // jsonメソッドをオーバーライド
      res.json = (data) => {
        // APIレスポンスを解析
        const shouldSave = this.shouldSaveResponse(req, data);

        if (shouldSave) {
          // 非同期で保存（レスポンスをブロックしない）
          this.queueSave({
            endpoint: req.path,
            method: req.method,
            query: req.body?.query || req.query?.q || '',
            response: data,
            userId: req.headers['x-user-id'] || 'anonymous',
            processingTime: Date.now() - startTime,
            timestamp: new Date()
          });
        }

        // 元のレスポンスを返す
        return originalJson.call(res, data);
      };

      next();
    };
  }

  /**
   * レスポンスを保存すべきか判定
   */
  shouldSaveResponse(req, data) {
    // 保存対象のエンドポイント
    const saveTargets = [
      '/api/shopify/analytics',
      '/api/smaregi/analytics',
      '/api/rakuten/analytics',
      '/api/ga4/analytics',
      '/api/aggregate'
    ];

    // エンドポイントが対象に含まれている
    const isTargetEndpoint = saveTargets.some(target => 
      req.path.includes(target)
    );

    // 成功レスポンスである
    const isSuccessResponse = data && data.success !== false;

    // データが含まれている
    const hasData = data && (
      data.data || 
      data.chartData || 
      data.aggregatedData ||
      data.results
    );

    return isTargetEndpoint && isSuccessResponse && hasData;
  }

  /**
   * 保存キューに追加
   */
  queueSave(saveData) {
    this.saveQueue.push(saveData);
    
    // キューの処理を開始
    if (!this.processing) {
      this.processQueue();
    }
  }

  /**
   * キューを処理
   */
  async processQueue() {
    if (this.saveQueue.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;
    const data = this.saveQueue.shift();

    try {
      // データを変換してBigQueryに保存
      const queryData = {
        userQuery: data.query,
        userId: data.userId,
        aiProvider: 'api-direct',
        apiCalls: [data.endpoint],
        processingTime: data.processingTime
      };

      const chartData = this.extractChartData(data.response);
      const aggregatedData = this.extractAggregatedData(data.response, data.endpoint);

      if (chartData && aggregatedData) {
        const result = await this.bigQueryService.saveProcessedQuery(
          queryData,
          chartData,
          aggregatedData
        );

        console.log(`✅ 自動保存完了: ${data.endpoint} - Chart: ${result.chartId}`);
      }
    } catch (error) {
      console.error('BigQuery自動保存エラー:', error);
    }

    // 次のアイテムを処理
    setTimeout(() => this.processQueue(), 100);
  }

  /**
   * レスポンスからチャートデータを抽出
   */
  extractChartData(response) {
    try {
      // チャートタイプを推定
      const chartType = this.detectChartType(response);
      
      // データポイントを抽出
      let dataPoints = [];
      
      if (response.data && Array.isArray(response.data)) {
        dataPoints = response.data;
      } else if (response.chartData) {
        dataPoints = response.chartData.dataPoints || response.chartData;
      } else if (response.results) {
        dataPoints = this.convertResultsToDataPoints(response.results);
      }

      return {
        chartType: chartType,
        dataPoints: dataPoints,
        chartConfig: {
          responsive: true,
          maintainAspectRatio: false
        }
      };
    } catch (error) {
      console.error('チャートデータ抽出エラー:', error);
      return null;
    }
  }

  /**
   * レスポンスから集計データを抽出
   */
  extractAggregatedData(response, endpoint) {
    try {
      const sourceApi = this.getSourceApiFromEndpoint(endpoint);
      
      return {
        sourceApi: sourceApi,
        aggregationType: this.detectAggregationType(response),
        data: response.data || response.results || response,
        metadata: {
          endpoint: endpoint,
          timestamp: new Date().toISOString(),
          dataCount: Array.isArray(response.data) ? response.data.length : 1
        }
      };
    } catch (error) {
      console.error('集計データ抽出エラー:', error);
      return null;
    }
  }

  /**
   * チャートタイプを検出
   */
  detectChartType(response) {
    // データの構造からチャートタイプを推定
    if (response.chartType) return response.chartType;
    
    const data = response.data || response.results || [];
    
    if (Array.isArray(data) && data.length > 0) {
      const firstItem = data[0];
      
      // 時系列データ
      if (firstItem.date || firstItem.timestamp || firstItem.period) {
        return 'line';
      }
      
      // カテゴリデータ
      if (firstItem.category || firstItem.name) {
        return 'bar';
      }
      
      // 比率データ
      if (firstItem.percentage || firstItem.ratio) {
        return 'pie';
      }
    }
    
    return 'bar'; // デフォルト
  }

  /**
   * 集計タイプを検出
   */
  detectAggregationType(response) {
    if (response.aggregationType) return response.aggregationType;
    
    const data = response.data || response.results || [];
    
    if (Array.isArray(data) && data.length > 0) {
      const firstItem = data[0];
      
      if (firstItem.daily || firstItem.day) return 'daily';
      if (firstItem.monthly || firstItem.month) return 'monthly';
      if (firstItem.yearly || firstItem.year) return 'yearly';
    }
    
    return 'none';
  }

  /**
   * エンドポイントからソースAPIを取得
   */
  getSourceApiFromEndpoint(endpoint) {
    if (endpoint.includes('shopify')) return 'shopify';
    if (endpoint.includes('smaregi')) return 'smaregi';
    if (endpoint.includes('rakuten')) return 'rakuten';
    if (endpoint.includes('ga4')) return 'google-analytics';
    if (endpoint.includes('aggregate')) return 'multiple';
    
    return 'unknown';
  }

  /**
   * 結果をデータポイントに変換
   */
  convertResultsToDataPoints(results) {
    if (!Array.isArray(results)) return [];
    
    return results.map((item, index) => {
      // 一般的なデータ構造に変換
      return {
        x: item.label || item.name || item.category || `Item ${index + 1}`,
        y: item.value || item.count || item.total || 0,
        ...item
      };
    });
  }
}

module.exports = BigQueryAutoSaveMiddleware;