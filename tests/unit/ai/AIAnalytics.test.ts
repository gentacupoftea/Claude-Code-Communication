/**
 * AI分析エンジンのユニットテスト
 */

import { AIAnalytics } from '../../../src/ai/analytics/AIAnalytics';
import { DataPipeline } from '../../../src/ai/pipeline/DataPipeline';
import * as tf from '@tensorflow/tfjs';

// DataPipelineのモック
jest.mock('../../../src/ai/pipeline/DataPipeline');

// TensorFlow.jsのモック設定
jest.mock('@tensorflow/tfjs', () => ({
  sequential: jest.fn(() => ({
    add: jest.fn(),
    compile: jest.fn(),
    predict: jest.fn(() => ({
      data: jest.fn().mockResolvedValue([100]),
      dispose: jest.fn()
    })),
    fit: jest.fn().mockResolvedValue({})
  })),
  layers: {
    lstm: jest.fn(() => ({})),
    dense: jest.fn(() => ({})),
    dropout: jest.fn(() => ({}))
  },
  train: {
    adam: jest.fn()
  },
  tensor2d: jest.fn(() => ({
    dispose: jest.fn()
  })),
  randomNormal: jest.fn(() => ({})),
  randomUniform: jest.fn(() => ({}))
}));

describe('AIAnalytics', () => {
  let analytics: AIAnalytics;
  let mockDataPipeline: jest.Mocked<DataPipeline>;

  beforeEach(() => {
    mockDataPipeline = new DataPipeline({} as any) as jest.Mocked<DataPipeline>;
    analytics = new AIAnalytics(mockDataPipeline);
  });

  describe('initialize', () => {
    it('分析エンジンを初期化できること', async () => {
      await expect(analytics.initialize()).resolves.not.toThrow();
    });
  });

  describe('forecastSales', () => {
    beforeEach(async () => {
      await analytics.initialize();
    });

    it('売上予測を生成できること', async () => {
      const config = {
        horizon: 7,
        confidence: 0.95,
        seasonality: true,
        trend: true
      };

      const result = await analytics.forecastSales(config);
      
      expect(result).toHaveProperty('predictions');
      expect(result).toHaveProperty('metrics');
      expect(result.predictions).toHaveLength(7);
    });

    it('予測結果の形式が正しいこと', async () => {
      const config = {
        horizon: 1,
        confidence: 0.95,
        seasonality: false,
        trend: false
      };

      const result = await analytics.forecastSales(config);
      const prediction = result.predictions[0];
      
      expect(prediction).toHaveProperty('date');
      expect(prediction).toHaveProperty('value');
      expect(prediction).toHaveProperty('lowerBound');
      expect(prediction).toHaveProperty('upperBound');
      expect(prediction.date).toBeInstanceOf(Date);
      expect(typeof prediction.value).toBe('number');
    });

    it('初期化前はエラーを投げること', async () => {
      const uninitializedAnalytics = new AIAnalytics(mockDataPipeline);
      
      await expect(uninitializedAnalytics.forecastSales({
        horizon: 7,
        confidence: 0.95,
        seasonality: true,
        trend: true
      })).rejects.toThrow('分析エンジンが初期化されていません');
    });
  });

  describe('optimizeInventory', () => {
    beforeEach(async () => {
      await analytics.initialize();
    });

    it('在庫最適化を実行できること', async () => {
      const result = await analytics.optimizeInventory('prod1');
      
      expect(result).toHaveProperty('productId', 'prod1');
      expect(result).toHaveProperty('currentStock');
      expect(result).toHaveProperty('optimalStock');
      expect(result).toHaveProperty('reorderPoint');
      expect(result).toHaveProperty('reorderQuantity');
      expect(result).toHaveProperty('safetyStock');
      expect(result).toHaveProperty('predictions');
    });

    it('予測データが含まれること', async () => {
      const result = await analytics.optimizeInventory('prod1');
      
      expect(result.predictions).toHaveProperty('demandForecast');
      expect(result.predictions).toHaveProperty('leadTimeDays');
      expect(result.predictions).toHaveProperty('stockoutRisk');
      expect(Array.isArray(result.predictions.demandForecast)).toBe(true);
    });
  });

  describe('optimizePrice', () => {
    beforeEach(async () => {
      await analytics.initialize();
    });

    it('価格最適化を実行できること', async () => {
      const result = await analytics.optimizePrice('prod1');
      
      expect(result).toHaveProperty('productId', 'prod1');
      expect(result).toHaveProperty('currentPrice');
      expect(result).toHaveProperty('optimalPrice');
      expect(result).toHaveProperty('elasticity');
      expect(result).toHaveProperty('expectedRevenueLift');
      expect(result).toHaveProperty('pricePoints');
    });

    it('価格ポイントの評価が含まれること', async () => {
      const result = await analytics.optimizePrice('prod1');
      
      expect(Array.isArray(result.pricePoints)).toBe(true);
      if (result.pricePoints.length > 0) {
        const point = result.pricePoints[0];
        expect(point).toHaveProperty('price');
        expect(point).toHaveProperty('expectedDemand');
        expect(point).toHaveProperty('expectedRevenue');
      }
    });
  });

  describe('analyzeCustomerSegments', () => {
    beforeEach(async () => {
      await analytics.initialize();
    });

    it('顧客セグメント分析を実行できること', async () => {
      const result = await analytics.analyzeCustomerSegments();
      
      expect(result).toHaveProperty('segments');
      expect(Array.isArray(result.segments)).toBe(true);
    });

    it('セグメントの形式が正しいこと', async () => {
      const result = await analytics.analyzeCustomerSegments();
      
      if (result.segments.length > 0) {
        const segment = result.segments[0];
        expect(segment).toHaveProperty('id');
        expect(segment).toHaveProperty('name');
        expect(segment).toHaveProperty('size');
        expect(segment).toHaveProperty('characteristics');
        expect(segment).toHaveProperty('recommendations');
      }
    });
  });

  describe('detectAnomalies', () => {
    beforeEach(async () => {
      await analytics.initialize();
    });

    it('売上の異常を検知できること', async () => {
      const result = await analytics.detectAnomalies('sales');
      
      expect(result).toHaveProperty('anomalies');
      expect(Array.isArray(result.anomalies)).toBe(true);
    });

    it('異常データの形式が正しいこと', async () => {
      const result = await analytics.detectAnomalies('traffic');
      
      if (result.anomalies.length > 0) {
        const anomaly = result.anomalies[0];
        expect(anomaly).toHaveProperty('timestamp');
        expect(anomaly).toHaveProperty('value');
        expect(anomaly).toHaveProperty('expectedValue');
        expect(anomaly).toHaveProperty('severity');
        expect(['low', 'medium', 'high']).toContain(anomaly.severity);
        expect(anomaly).toHaveProperty('possibleCauses');
      }
    });
  });

  describe('analyzeTrends', () => {
    beforeEach(async () => {
      await analytics.initialize();
    });

    it('トレンド分析を実行できること', async () => {
      const result = await analytics.analyzeTrends('revenue', 'monthly');
      
      expect(result).toHaveProperty('trend');
      expect(['increasing', 'decreasing', 'stable']).toContain(result.trend);
      expect(result).toHaveProperty('changeRate');
      expect(result).toHaveProperty('forecast');
      expect(result).toHaveProperty('insights');
    });

    it('期間別の分析ができること', async () => {
      const periods: Array<'daily' | 'weekly' | 'monthly'> = ['daily', 'weekly', 'monthly'];
      
      for (const period of periods) {
        const result = await analytics.analyzeTrends('conversions', period);
        expect(result).toBeDefined();
      }
    });
  });

  describe('エラーハンドリング', () => {
    it('無効なメトリクスでエラーを処理すること', async () => {
      await analytics.initialize();
      
      // 実装によってはエラーを投げるか、空の結果を返すか
      const result = await analytics.detectAnomalies('invalid' as any);
      expect(result.anomalies).toBeDefined();
    });

    it('モデルのメモリリークを防ぐこと', async () => {
      await analytics.initialize();
      
      const disposeSpy = jest.fn();
      (tf.tensor2d as jest.Mock).mockReturnValue({
        dispose: disposeSpy
      });

      await analytics.forecastSales({
        horizon: 1,
        confidence: 0.95,
        seasonality: false,
        trend: false
      });

      // テンソルが適切に破棄されることを確認
      expect(disposeSpy).toHaveBeenCalled();
    });
  });
});