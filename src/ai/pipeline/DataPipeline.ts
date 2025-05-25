/**
 * AIデータパイプライン
 * 
 * Shopifyデータの収集、前処理、変換、および機械学習モデルへの供給を管理
 */

import { EventEmitter } from 'events';
import * as tf from '@tensorflow/tfjs';
import { Product, Order, Customer } from '../../types';
import { ShopifyService } from '../../services/ShopifyService';

interface PipelineConfig {
  batchSize: number;
  updateInterval: number; // ミリ秒
  enableRealTimeSync: boolean;
  dataRetentionDays: number;
  enableDataValidation: boolean;
  enableAnomalyDetection: boolean;
}

interface DataBatch {
  id: string;
  timestamp: Date;
  type: 'products' | 'orders' | 'customers' | 'mixed';
  data: any[];
  metadata: {
    source: string;
    processingTime: number;
    recordCount: number;
    errors: any[];
  };
}

interface ProcessingMetrics {
  totalRecordsProcessed: number;
  successfulRecords: number;
  failedRecords: number;
  averageProcessingTime: number;
  lastUpdateTime: Date;
}

export class DataPipeline extends EventEmitter {
  private config: PipelineConfig;
  private shopifyService: ShopifyService;
  private processingMetrics: ProcessingMetrics;
  private isRunning: boolean = false;
  private updateTimer: NodeJS.Timer | null = null;
  private dataCache: Map<string, any> = new Map();

  constructor(shopifyService: ShopifyService, config: Partial<PipelineConfig> = {}) {
    super();
    this.shopifyService = shopifyService;
    this.config = {
      batchSize: 100,
      updateInterval: 300000, // 5分
      enableRealTimeSync: true,
      dataRetentionDays: 30,
      enableDataValidation: true,
      enableAnomalyDetection: true,
      ...config
    };
    
    this.processingMetrics = {
      totalRecordsProcessed: 0,
      successfulRecords: 0,
      failedRecords: 0,
      averageProcessingTime: 0,
      lastUpdateTime: new Date()
    };
  }

  /**
   * パイプラインの開始
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('データパイプラインは既に実行中です');
      return;
    }

    console.log('データパイプラインを開始します...');
    this.isRunning = true;
    
    // 初期データの読み込み
    await this.initialDataLoad();
    
    // リアルタイム同期の設定
    if (this.config.enableRealTimeSync) {
      this.setupRealTimeSync();
    }
    
    // 定期更新の設定
    this.updateTimer = setInterval(() => {
      this.performScheduledUpdate();
    }, this.config.updateInterval);
    
    this.emit('pipeline:started');
  }

  /**
   * パイプラインの停止
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('データパイプラインを停止します...');
    this.isRunning = false;
    
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
    
    this.emit('pipeline:stopped');
  }

  /**
   * データの収集（Extract）
   */
  async extractData(dataType: 'products' | 'orders' | 'customers'): Promise<DataBatch> {
    const startTime = Date.now();
    const batch: DataBatch = {
      id: this.generateBatchId(),
      timestamp: new Date(),
      type: dataType,
      data: [],
      metadata: {
        source: 'shopify',
        processingTime: 0,
        recordCount: 0,
        errors: []
      }
    };

    try {
      switch (dataType) {
        case 'products':
          batch.data = await this.extractProducts();
          break;
        case 'orders':
          batch.data = await this.extractOrders();
          break;
        case 'customers':
          batch.data = await this.extractCustomers();
          break;
      }
      
      batch.metadata.recordCount = batch.data.length;
      batch.metadata.processingTime = Date.now() - startTime;
      
      this.emit('data:extracted', batch);
      return batch;
      
    } catch (error) {
      batch.metadata.errors.push(error);
      this.emit('extraction:error', error);
      throw error;
    }
  }

  /**
   * データの変換（Transform）
   */
  async transformData(batch: DataBatch): Promise<DataBatch> {
    const startTime = Date.now();
    const transformedBatch = { ...batch };
    
    try {
      switch (batch.type) {
        case 'products':
          transformedBatch.data = await this.transformProducts(batch.data);
          break;
        case 'orders':
          transformedBatch.data = await this.transformOrders(batch.data);
          break;
        case 'customers':
          transformedBatch.data = await this.transformCustomers(batch.data);
          break;
      }
      
      // データ検証
      if (this.config.enableDataValidation) {
        await this.validateTransformedData(transformedBatch);
      }
      
      // 異常検知
      if (this.config.enableAnomalyDetection) {
        await this.detectAnomalies(transformedBatch);
      }
      
      transformedBatch.metadata.processingTime += Date.now() - startTime;
      this.emit('data:transformed', transformedBatch);
      
      return transformedBatch;
      
    } catch (error) {
      transformedBatch.metadata.errors.push(error);
      this.emit('transformation:error', error);
      throw error;
    }
  }

  /**
   * データの読み込み（Load）
   */
  async loadData(batch: DataBatch): Promise<void> {
    const startTime = Date.now();
    
    try {
      // キャッシュに保存
      this.dataCache.set(batch.id, batch);
      
      // 古いデータの削除
      this.cleanupOldData();
      
      // メトリクスの更新
      this.updateMetrics(batch);
      
      batch.metadata.processingTime += Date.now() - startTime;
      this.emit('data:loaded', batch);
      
    } catch (error) {
      batch.metadata.errors.push(error);
      this.emit('loading:error', error);
      throw error;
    }
  }

  /**
   * ETLプロセスの実行
   */
  async runETL(dataTypes: Array<'products' | 'orders' | 'customers'>): Promise<void> {
    console.log('ETLプロセスを開始します...');
    
    for (const dataType of dataTypes) {
      try {
        // Extract
        const extractedBatch = await this.extractData(dataType);
        
        // Transform
        const transformedBatch = await this.transformData(extractedBatch);
        
        // Load
        await this.loadData(transformedBatch);
        
        console.log(`${dataType}のETLが完了しました: ${transformedBatch.metadata.recordCount}件`);
        
      } catch (error) {
        console.error(`${dataType}のETLでエラーが発生しました:`, error);
        this.emit('etl:error', { dataType, error });
      }
    }
    
    this.emit('etl:completed');
  }

  /**
   * 機械学習用のデータ準備
   */
  async prepareMLData(config: {
    features: string[];
    targetVariable?: string;
    splitRatio?: number;
  }): Promise<{
    features: tf.Tensor;
    labels?: tf.Tensor;
    trainFeatures?: tf.Tensor;
    trainLabels?: tf.Tensor;
    testFeatures?: tf.Tensor;
    testLabels?: tf.Tensor;
  }> {
    console.log('機械学習用データを準備中...');
    
    // キャッシュからデータを収集
    const allData: any[] = [];
    for (const [, batch] of this.dataCache) {
      allData.push(...batch.data);
    }
    
    // 特徴量の抽出
    const featureData = allData.map(record => 
      config.features.map(feature => this.extractFeature(record, feature))
    );
    
    const features = tf.tensor2d(featureData);
    
    // ラベルデータの準備（教師あり学習の場合）
    let labels: tf.Tensor | undefined;
    if (config.targetVariable) {
      const labelData = allData.map(record => 
        this.extractFeature(record, config.targetVariable)
      );
      labels = tf.tensor1d(labelData);
    }
    
    // トレーニング/テストデータの分割
    if (config.splitRatio && labels) {
      const splitIndex = Math.floor(allData.length * (config.splitRatio || 0.8));
      
      const trainFeatures = features.slice([0, 0], [splitIndex, -1]);
      const testFeatures = features.slice([splitIndex, 0]);
      
      const trainLabels = labels.slice([0], [splitIndex]);
      const testLabels = labels.slice([splitIndex]);
      
      return {
        features,
        labels,
        trainFeatures,
        trainLabels,
        testFeatures,
        testLabels
      };
    }
    
    return { features, labels };
  }

  /**
   * リアルタイムデータストリーミング
   */
  async *streamData(dataType: 'products' | 'orders' | 'customers', options?: {
    batchSize?: number;
    interval?: number;
  }): AsyncGenerator<DataBatch> {
    const batchSize = options?.batchSize || this.config.batchSize;
    const interval = options?.interval || 1000;
    
    while (this.isRunning) {
      try {
        const batch = await this.extractData(dataType);
        const transformedBatch = await this.transformData(batch);
        
        yield transformedBatch;
        
        await new Promise(resolve => setTimeout(resolve, interval));
        
      } catch (error) {
        console.error('ストリーミングエラー:', error);
        this.emit('streaming:error', error);
      }
    }
  }

  /**
   * プライベートメソッド：商品データの抽出
   */
  private async extractProducts(): Promise<Product[]> {
    const products: Product[] = [];
    let page = 1;
    
    while (true) {
      const batch = await this.shopifyService.getProducts({ 
        limit: this.config.batchSize,
        page 
      });
      
      if (batch.length === 0) break;
      
      products.push(...batch);
      page++;
      
      // レート制限を考慮
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    
    return products;
  }

  /**
   * プライベートメソッド：注文データの抽出
   */
  private async extractOrders(): Promise<Order[]> {
    const orders: Order[] = [];
    let page = 1;
    
    while (true) {
      const batch = await this.shopifyService.getOrders({ 
        limit: this.config.batchSize,
        page,
        status: 'any'
      });
      
      if (batch.length === 0) break;
      
      orders.push(...batch);
      page++;
      
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    
    return orders;
  }

  /**
   * プライベートメソッド：顧客データの抽出
   */
  private async extractCustomers(): Promise<Customer[]> {
    const customers: Customer[] = [];
    let page = 1;
    
    while (true) {
      const batch = await this.shopifyService.getCustomers({ 
        limit: this.config.batchSize,
        page 
      });
      
      if (batch.length === 0) break;
      
      customers.push(...batch);
      page++;
      
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    
    return customers;
  }

  /**
   * データ変換メソッド群
   */
  private async transformProducts(products: Product[]): Promise<any[]> {
    return products.map(product => ({
      id: product.id,
      title: product.title,
      category: product.product_type || 'uncategorized',
      vendor: product.vendor,
      price: parseFloat(product.variants[0]?.price || '0'),
      inventory: product.variants.reduce((sum, v) => sum + (v.inventory_quantity || 0), 0),
      tags: product.tags ? product.tags.split(',').map(t => t.trim()) : [],
      createdAt: new Date(product.created_at),
      updatedAt: new Date(product.updated_at),
      // 追加の特徴量
      hasImages: product.images.length > 0,
      variantCount: product.variants.length,
      isPublished: product.published_at !== null,
      // 計算されたメトリクス
      averagePrice: this.calculateAveragePrice(product.variants),
      priceRange: this.calculatePriceRange(product.variants)
    }));
  }

  private async transformOrders(orders: Order[]): Promise<any[]> {
    return orders.map(order => ({
      id: order.id,
      customerId: order.customer?.id,
      email: order.email,
      totalPrice: parseFloat(order.total_price),
      subtotalPrice: parseFloat(order.subtotal_price),
      totalTax: parseFloat(order.total_tax),
      currency: order.currency,
      financialStatus: order.financial_status,
      fulfillmentStatus: order.fulfillment_status,
      createdAt: new Date(order.created_at),
      // 計算されたメトリクス
      itemCount: order.line_items?.length || 0,
      averageItemPrice: this.calculateAverageItemPrice(order),
      hasDiscount: order.total_discounts !== '0.00',
      // 顧客セグメント
      customerType: this.determineCustomerType(order),
      // 時間的特徴
      orderHour: new Date(order.created_at).getHours(),
      orderDayOfWeek: new Date(order.created_at).getDay(),
      orderMonth: new Date(order.created_at).getMonth()
    }));
  }

  private async transformCustomers(customers: Customer[]): Promise<any[]> {
    return customers.map(customer => ({
      id: customer.id,
      email: customer.email,
      firstName: customer.first_name,
      lastName: customer.last_name,
      ordersCount: customer.orders_count,
      totalSpent: parseFloat(customer.total_spent),
      tags: customer.tags ? customer.tags.split(',').map(t => t.trim()) : [],
      createdAt: new Date(customer.created_at),
      // 計算されたメトリクス
      averageOrderValue: customer.orders_count > 0 
        ? parseFloat(customer.total_spent) / customer.orders_count 
        : 0,
      // 顧客セグメント
      segment: this.determineCustomerSegment(customer),
      // ライフタイムバリュー予測用
      daysSinceCreation: this.calculateDaysSince(customer.created_at),
      isRepeatCustomer: customer.orders_count > 1
    }));
  }

  /**
   * ヘルパーメソッド群
   */
  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateAveragePrice(variants: any[]): number {
    if (variants.length === 0) return 0;
    const sum = variants.reduce((acc, v) => acc + parseFloat(v.price || '0'), 0);
    return sum / variants.length;
  }

  private calculatePriceRange(variants: any[]): { min: number; max: number } {
    if (variants.length === 0) return { min: 0, max: 0 };
    const prices = variants.map(v => parseFloat(v.price || '0'));
    return {
      min: Math.min(...prices),
      max: Math.max(...prices)
    };
  }

  private calculateAverageItemPrice(order: Order): number {
    if (!order.line_items || order.line_items.length === 0) return 0;
    const total = order.line_items.reduce((sum, item) => 
      sum + parseFloat(item.price) * item.quantity, 0
    );
    return total / order.line_items.length;
  }

  private determineCustomerType(order: Order): string {
    // 簡略化された顧客タイプ判定
    const totalPrice = parseFloat(order.total_price);
    if (totalPrice > 1000) return 'high_value';
    if (totalPrice > 100) return 'medium_value';
    return 'low_value';
  }

  private determineCustomerSegment(customer: Customer): string {
    // RFM分析の簡略版
    const totalSpent = parseFloat(customer.total_spent);
    const ordersCount = customer.orders_count;
    
    if (totalSpent > 5000 && ordersCount > 10) return 'vip';
    if (totalSpent > 1000 && ordersCount > 5) return 'loyal';
    if (ordersCount > 1) return 'returning';
    return 'new';
  }

  private calculateDaysSince(dateString: string): number {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private extractFeature(record: any, featurePath: string): number {
    // ドット記法で深いプロパティにアクセス
    const parts = featurePath.split('.');
    let value = record;
    
    for (const part of parts) {
      value = value?.[part];
      if (value === undefined) return 0;
    }
    
    // 数値に変換
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'string') return parseFloat(value) || 0;
    if (typeof value === 'number') return value;
    
    return 0;
  }

  private async validateTransformedData(batch: DataBatch): Promise<void> {
    // データ検証ロジック
    for (const record of batch.data) {
      if (!record.id) {
        throw new Error('レコードIDが見つかりません');
      }
      // 追加の検証...
    }
  }

  private async detectAnomalies(batch: DataBatch): Promise<void> {
    // 異常検知ロジック（簡略版）
    // 実際の実装では、統計的手法や機械学習モデルを使用
    console.log(`異常検知を実行中: ${batch.type}`);
  }

  private cleanupOldData(): void {
    const cutoffTime = Date.now() - (this.config.dataRetentionDays * 24 * 60 * 60 * 1000);
    
    for (const [batchId, batch] of this.dataCache) {
      if (batch.timestamp.getTime() < cutoffTime) {
        this.dataCache.delete(batchId);
      }
    }
  }

  private updateMetrics(batch: DataBatch): void {
    this.processingMetrics.totalRecordsProcessed += batch.metadata.recordCount;
    this.processingMetrics.successfulRecords += batch.metadata.recordCount - batch.metadata.errors.length;
    this.processingMetrics.failedRecords += batch.metadata.errors.length;
    
    // 平均処理時間の更新
    const currentAvg = this.processingMetrics.averageProcessingTime;
    const newTime = batch.metadata.processingTime;
    const totalCount = this.processingMetrics.totalRecordsProcessed;
    
    this.processingMetrics.averageProcessingTime = 
      (currentAvg * (totalCount - batch.metadata.recordCount) + newTime) / totalCount;
    
    this.processingMetrics.lastUpdateTime = new Date();
  }

  private async initialDataLoad(): Promise<void> {
    console.log('初期データをロード中...');
    await this.runETL(['products', 'orders', 'customers']);
  }

  private setupRealTimeSync(): void {
    // Webhookやポーリングによるリアルタイム同期の設定
    console.log('リアルタイム同期を設定中...');
  }

  private async performScheduledUpdate(): Promise<void> {
    console.log('定期更新を実行中...');
    await this.runETL(['orders', 'customers']); // 商品は変更頻度が低いので除外
  }

  /**
   * パイプラインメトリクスの取得
   */
  getMetrics(): ProcessingMetrics {
    return { ...this.processingMetrics };
  }

  /**
   * キャッシュデータの取得
   */
  getCachedData(batchId?: string): DataBatch | DataBatch[] | null {
    if (batchId) {
      return this.dataCache.get(batchId) || null;
    }
    return Array.from(this.dataCache.values());
  }
}