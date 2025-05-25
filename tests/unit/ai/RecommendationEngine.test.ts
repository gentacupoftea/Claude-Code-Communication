/**
 * 推薦エンジンのユニットテスト
 */

import { RecommendationEngine } from '../../../src/ai/recommendation/RecommendationEngine';
import { Product, Order, Customer } from '../../../src/types';

describe('RecommendationEngine', () => {
  let engine: RecommendationEngine;
  let mockProducts: Product[];
  let mockOrders: Order[];
  let mockCustomers: Customer[];

  beforeEach(() => {
    engine = new RecommendationEngine({
      minInteractionCount: 3,
      similarityThreshold: 0.5,
      maxRecommendations: 5
    });

    // モックデータの準備
    mockProducts = [
      {
        id: 'prod1',
        title: 'シャツ A',
        product_type: 'シャツ',
        vendor: 'ブランドA',
        tags: 'カジュアル,メンズ',
        variants: [{ id: 'var1', price: '3000', inventory_quantity: 100 }],
        images: [],
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        published_at: '2024-01-01'
      },
      {
        id: 'prod2',
        title: 'パンツ B',
        product_type: 'パンツ',
        vendor: 'ブランドB',
        tags: 'カジュアル,メンズ',
        variants: [{ id: 'var2', price: '5000', inventory_quantity: 50 }],
        images: [],
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        published_at: '2024-01-01'
      }
    ];

    mockOrders = [
      {
        id: 'order1',
        email: 'user1@example.com',
        total_price: '8000',
        subtotal_price: '8000',
        total_tax: '0',
        currency: 'JPY',
        financial_status: 'paid',
        fulfillment_status: 'fulfilled',
        created_at: '2024-01-15',
        customer: { id: 'cust1' },
        line_items: [
          { product_id: 'prod1', price: '3000', quantity: 1 },
          { product_id: 'prod2', price: '5000', quantity: 1 }
        ]
      }
    ];

    mockCustomers = [
      {
        id: 'cust1',
        email: 'user1@example.com',
        first_name: '太郎',
        last_name: '山田',
        orders_count: 1,
        total_spent: '8000',
        tags: 'VIP',
        created_at: '2024-01-01'
      }
    ];
  });

  describe('initialize', () => {
    it('正常に初期化できること', async () => {
      await expect(engine.initialize({
        orders: mockOrders,
        products: mockProducts,
        customers: mockCustomers
      })).resolves.not.toThrow();
    });

    it('空のデータでも初期化できること', async () => {
      await expect(engine.initialize({
        orders: [],
        products: [],
        customers: []
      })).resolves.not.toThrow();
    });
  });

  describe('getRecommendations', () => {
    beforeEach(async () => {
      await engine.initialize({
        orders: mockOrders,
        products: mockProducts,
        customers: mockCustomers
      });
    });

    it('推薦を生成できること', async () => {
      const recommendations = await engine.getRecommendations('cust1');
      
      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeLessThanOrEqual(5);
    });

    it('推薦結果の形式が正しいこと', async () => {
      const recommendations = await engine.getRecommendations('cust1');
      
      if (recommendations.length > 0) {
        const recommendation = recommendations[0];
        expect(recommendation).toHaveProperty('productId');
        expect(recommendation).toHaveProperty('score');
        expect(recommendation).toHaveProperty('reason');
        expect(recommendation).toHaveProperty('confidence');
        expect(recommendation.score).toBeGreaterThanOrEqual(0);
        expect(recommendation.score).toBeLessThanOrEqual(1);
      }
    });

    it('コンテキスト付き推薦ができること', async () => {
      const recommendations = await engine.getRecommendations('cust1', {
        currentProductId: 'prod1',
        cartItems: ['prod2'],
        browsingHistory: ['prod1', 'prod2']
      });
      
      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('存在しない顧客IDでも動作すること', async () => {
      const recommendations = await engine.getRecommendations('nonexistent');
      
      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
    });
  });

  describe('runABTest', () => {
    beforeEach(async () => {
      await engine.initialize({
        orders: mockOrders,
        products: mockProducts,
        customers: mockCustomers
      });
    });

    it('A/Bテストを実行できること', async () => {
      const result = await engine.runABTest(
        'cust1',
        {
          control: async () => [
            { productId: 'prod1', score: 0.8, reason: 'control', confidence: 0.9 }
          ],
          treatment: async () => [
            { productId: 'prod2', score: 0.9, reason: 'treatment', confidence: 0.95 }
          ]
        },
        0.5
      );

      expect(result).toHaveProperty('variant');
      expect(['control', 'treatment']).toContain(result.variant);
      expect(result).toHaveProperty('recommendations');
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('分割比率が機能すること', async () => {
      const results = await Promise.all(
        Array(100).fill(null).map(() => 
          engine.runABTest(
            'cust1',
            {
              control: async () => [],
              treatment: async () => []
            },
            0.3 // 30% control, 70% treatment
          )
        )
      );

      const controlCount = results.filter(r => r.variant === 'control').length;
      const treatmentCount = results.filter(r => r.variant === 'treatment').length;

      // 統計的な範囲内であることを確認（許容誤差20%）
      expect(controlCount).toBeGreaterThan(10);
      expect(controlCount).toBeLessThan(50);
      expect(treatmentCount).toBeGreaterThan(50);
      expect(treatmentCount).toBeLessThan(90);
    });
  });

  describe('エッジケース', () => {
    it('大量のデータでもメモリエラーが発生しないこと', async () => {
      const largeProducts = Array(1000).fill(null).map((_, i) => ({
        ...mockProducts[0],
        id: `prod${i}`,
        title: `商品 ${i}`
      }));

      await expect(engine.initialize({
        orders: [],
        products: largeProducts,
        customers: []
      })).resolves.not.toThrow();
    });

    it('重複商品IDがある場合でも動作すること', async () => {
      const duplicateProducts = [
        ...mockProducts,
        { ...mockProducts[0] } // 同じIDの商品を追加
      ];

      await expect(engine.initialize({
        orders: mockOrders,
        products: duplicateProducts,
        customers: mockCustomers
      })).resolves.not.toThrow();
    });
  });
});