/**
 * データパイプラインのユニットテスト
 */

import { DataPipeline } from '../../../src/ai/pipeline/DataPipeline';
import { ShopifyService } from '../../../src/services/ShopifyService';
import { EventEmitter } from 'events';

// ShopifyServiceのモック
jest.mock('../../../src/services/ShopifyService');

describe('DataPipeline', () => {
  let pipeline: DataPipeline;
  let mockShopifyService: jest.Mocked<ShopifyService>;

  beforeEach(() => {
    mockShopifyService = new ShopifyService({} as any) as jest.Mocked<ShopifyService>;
    pipeline = new DataPipeline(mockShopifyService, {
      batchSize: 10,
      updateInterval: 1000,
      enableRealTimeSync: false,
      dataRetentionDays: 7
    });
  });

  afterEach(async () => {
    await pipeline.stop();
  });

  describe('start/stop', () => {
    it('パイプラインを開始できること', async () => {
      const startSpy = jest.fn();
      pipeline.on('pipeline:started', startSpy);

      mockShopifyService.getProducts.mockResolvedValue([]);
      mockShopifyService.getOrders.mockResolvedValue([]);
      mockShopifyService.getCustomers.mockResolvedValue([]);

      await pipeline.start();
      
      expect(startSpy).toHaveBeenCalled();
    });

    it('パイプラインを停止できること', async () => {
      const stopSpy = jest.fn();
      pipeline.on('pipeline:stopped', stopSpy);

      mockShopifyService.getProducts.mockResolvedValue([]);
      mockShopifyService.getOrders.mockResolvedValue([]);
      mockShopifyService.getCustomers.mockResolvedValue([]);

      await pipeline.start();
      await pipeline.stop();
      
      expect(stopSpy).toHaveBeenCalled();
    });

    it('既に開始されている場合は再開始しないこと', async () => {
      mockShopifyService.getProducts.mockResolvedValue([]);
      mockShopifyService.getOrders.mockResolvedValue([]);
      mockShopifyService.getCustomers.mockResolvedValue([]);

      await pipeline.start();
      const consoleSpy = jest.spyOn(console, 'log');
      
      await pipeline.start();
      
      expect(consoleSpy).toHaveBeenCalledWith('データパイプラインは既に実行中です');
    });
  });

  describe('extractData', () => {
    it('商品データを抽出できること', async () => {
      const mockProducts = [
        { id: 'prod1', title: '商品1' },
        { id: 'prod2', title: '商品2' }
      ];
      
      mockShopifyService.getProducts.mockResolvedValueOnce(mockProducts);
      mockShopifyService.getProducts.mockResolvedValueOnce([]);

      const batch = await pipeline.extractData('products');
      
      expect(batch.type).toBe('products');
      expect(batch.data).toEqual(mockProducts);
      expect(batch.metadata.recordCount).toBe(2);
    });

    it('注文データを抽出できること', async () => {
      const mockOrders = [
        { id: 'order1', total_price: '1000' }
      ];
      
      mockShopifyService.getOrders.mockResolvedValueOnce(mockOrders);
      mockShopifyService.getOrders.mockResolvedValueOnce([]);

      const batch = await pipeline.extractData('orders');
      
      expect(batch.type).toBe('orders');
      expect(batch.data).toEqual(mockOrders);
    });

    it('エラー時にイベントを発行すること', async () => {
      const errorSpy = jest.fn();
      pipeline.on('extraction:error', errorSpy);
      
      const error = new Error('API Error');
      mockShopifyService.getProducts.mockRejectedValue(error);

      await expect(pipeline.extractData('products')).rejects.toThrow('API Error');
      expect(errorSpy).toHaveBeenCalledWith(error);
    });
  });

  describe('transformData', () => {
    it('商品データを変換できること', async () => {
      const mockBatch = {
        id: 'batch1',
        timestamp: new Date(),
        type: 'products' as const,
        data: [
          {
            id: 'prod1',
            title: '商品1',
            product_type: 'シャツ',
            vendor: 'ブランドA',
            tags: 'カジュアル,メンズ',
            variants: [{ price: '3000', inventory_quantity: 10 }],
            images: [],
            created_at: '2024-01-01',
            updated_at: '2024-01-01',
            published_at: '2024-01-01'
          }
        ],
        metadata: {
          source: 'shopify',
          processingTime: 0,
          recordCount: 1,
          errors: []
        }
      };

      const transformedBatch = await pipeline.transformData(mockBatch);
      
      expect(transformedBatch.data[0]).toHaveProperty('category');
      expect(transformedBatch.data[0]).toHaveProperty('price');
      expect(transformedBatch.data[0]).toHaveProperty('tags');
    });

    it('変換エラー時にイベントを発行すること', async () => {
      const errorSpy = jest.fn();
      pipeline.on('transformation:error', errorSpy);
      
      const invalidBatch = {
        id: 'batch1',
        timestamp: new Date(),
        type: 'invalid' as any,
        data: [],
        metadata: {
          source: 'shopify',
          processingTime: 0,
          recordCount: 0,
          errors: []
        }
      };

      await expect(pipeline.transformData(invalidBatch)).rejects.toThrow();
    });
  });

  describe('loadData', () => {
    it('データをロードできること', async () => {
      const loadSpy = jest.fn();
      pipeline.on('data:loaded', loadSpy);
      
      const batch = {
        id: 'batch1',
        timestamp: new Date(),
        type: 'products' as const,
        data: [],
        metadata: {
          source: 'shopify',
          processingTime: 100,
          recordCount: 0,
          errors: []
        }
      };

      await pipeline.loadData(batch);
      
      expect(loadSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'batch1' }));
    });
  });

  describe('runETL', () => {
    beforeEach(() => {
      mockShopifyService.getProducts.mockResolvedValue([]);
      mockShopifyService.getOrders.mockResolvedValue([]);
      mockShopifyService.getCustomers.mockResolvedValue([]);
    });

    it('複数のデータタイプに対してETLを実行できること', async () => {
      const completeSpy = jest.fn();
      pipeline.on('etl:completed', completeSpy);

      await pipeline.runETL(['products', 'orders']);
      
      expect(completeSpy).toHaveBeenCalled();
      expect(mockShopifyService.getProducts).toHaveBeenCalled();
      expect(mockShopifyService.getOrders).toHaveBeenCalled();
    });

    it('ETLエラー時にイベントを発行すること', async () => {
      const errorSpy = jest.fn();
      pipeline.on('etl:error', errorSpy);
      
      mockShopifyService.getProducts.mockRejectedValue(new Error('ETL Error'));

      await pipeline.runETL(['products']);
      
      expect(errorSpy).toHaveBeenCalledWith({
        dataType: 'products',
        error: expect.any(Error)
      });
    });
  });

  describe('prepareMLData', () => {
    it('機械学習用データを準備できること', async () => {
      // キャッシュにデータを追加
      await pipeline.loadData({
        id: 'batch1',
        timestamp: new Date(),
        type: 'orders',
        data: [
          { id: 1, price: 100, quantity: 2 },
          { id: 2, price: 200, quantity: 1 }
        ],
        metadata: {
          source: 'test',
          processingTime: 0,
          recordCount: 2,
          errors: []
        }
      });

      const mlData = await pipeline.prepareMLData({
        features: ['price', 'quantity'],
        targetVariable: 'price',
        splitRatio: 0.8
      });

      expect(mlData.features).toBeDefined();
      expect(mlData.labels).toBeDefined();
      expect(mlData.trainFeatures).toBeDefined();
      expect(mlData.testFeatures).toBeDefined();
    });
  });

  describe('streamData', () => {
    it('データをストリーミングできること', async () => {
      mockShopifyService.getProducts.mockResolvedValue([
        { id: 'prod1', title: '商品1' }
      ]);

      await pipeline.start();
      
      const stream = pipeline.streamData('products', {
        batchSize: 1,
        interval: 100
      });

      const batches: any[] = [];
      let count = 0;
      
      for await (const batch of stream) {
        batches.push(batch);
        count++;
        if (count >= 2) break;
      }

      expect(batches.length).toBe(2);
      expect(batches[0].type).toBe('products');
    });
  });

  describe('getMetrics', () => {
    it('メトリクスを取得できること', () => {
      const metrics = pipeline.getMetrics();
      
      expect(metrics).toHaveProperty('totalRecordsProcessed');
      expect(metrics).toHaveProperty('successfulRecords');
      expect(metrics).toHaveProperty('failedRecords');
      expect(metrics).toHaveProperty('averageProcessingTime');
      expect(metrics).toHaveProperty('lastUpdateTime');
    });
  });

  describe('getCachedData', () => {
    it('キャッシュされたデータを取得できること', async () => {
      const batch = {
        id: 'batch1',
        timestamp: new Date(),
        type: 'products' as const,
        data: [{ id: 'prod1' }],
        metadata: {
          source: 'test',
          processingTime: 0,
          recordCount: 1,
          errors: []
        }
      };

      await pipeline.loadData(batch);
      
      const cached = pipeline.getCachedData('batch1');
      expect(cached).toEqual(batch);
    });

    it('全てのキャッシュデータを取得できること', async () => {
      await pipeline.loadData({
        id: 'batch1',
        timestamp: new Date(),
        type: 'products' as const,
        data: [],
        metadata: {
          source: 'test',
          processingTime: 0,
          recordCount: 0,
          errors: []
        }
      });

      const allCached = pipeline.getCachedData();
      expect(Array.isArray(allCached)).toBe(true);
      expect(allCached).toHaveLength(1);
    });
  });
});