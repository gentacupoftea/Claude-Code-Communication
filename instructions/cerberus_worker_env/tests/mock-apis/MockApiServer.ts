/**
 * テスト用モックAPIサーバー
 * 各APIの動作をシミュレートし、統合テスト環境を提供
 */
export class MockApiServer {
  private responseDelay: number = 100;
  private errorRate: number = 0;
  private downtime: boolean = false;
  private requestCount: Map<string, number> = new Map();

  /**
   * レスポンス遅延を設定（ミリ秒）
   */
  setResponseDelay(ms: number): void {
    this.responseDelay = ms;
  }

  /**
   * エラー率を設定（0-1の範囲）
   */
  setErrorRate(rate: number): void {
    this.errorRate = Math.max(0, Math.min(1, rate));
  }

  /**
   * サーバーダウンタイムをシミュレート
   */
  setDowntime(isDown: boolean): void {
    this.downtime = isDown;
  }

  /**
   * リクエストカウンターをリセット
   */
  resetRequestCount(): void {
    this.requestCount.clear();
  }

  /**
   * リクエスト統計を取得
   */
  getRequestStats(): Record<string, number> {
    return Object.fromEntries(this.requestCount);
  }

  /**
   * Shopify APIのモック
   */
  async mockShopifyApi(endpoint: string, method: string = 'GET', data?: any): Promise<any> {
    const key = `shopify_${method}_${endpoint}`;
    this.incrementRequestCount(key);

    await this.simulateDelay();
    this.simulateError('Shopify API Error');

    if (endpoint.includes('products')) {
      return this.createShopifyProductsResponse();
    } else if (endpoint.includes('orders')) {
      return this.createShopifyOrdersResponse();
    } else if (endpoint.includes('shop.json')) {
      return { shop: { name: 'Test Shop', domain: 'test.myshopify.com' } };
    }

    return { data: `Mock response for ${endpoint}` };
  }

  /**
   * POS APIのモック
   */
  async mockPosApi(endpoint: string, method: string = 'GET', data?: any): Promise<any> {
    const key = `pos_${method}_${endpoint}`;
    this.incrementRequestCount(key);

    await this.simulateDelay();
    this.simulateError('POS API Error');

    if (endpoint.includes('transactions')) {
      return this.createPosTransactionsResponse();
    } else if (endpoint.includes('health')) {
      return { status: 'healthy', timestamp: new Date().toISOString() };
    }

    return { data: `Mock POS response for ${endpoint}` };
  }

  /**
   * Analytics APIのモック
   */
  async mockAnalyticsApi(endpoint: string, method: string = 'GET', data?: any): Promise<any> {
    const key = `analytics_${method}_${endpoint}`;
    this.incrementRequestCount(key);

    await this.simulateDelay();
    this.simulateError('Analytics API Error');

    if (endpoint.includes('reports')) {
      return this.createAnalyticsResponse();
    } else if (endpoint.includes('projects')) {
      return { project: { id: 'test-project', name: 'Test Project' } };
    }

    return { data: `Mock Analytics response for ${endpoint}` };
  }

  /**
   * Weather APIのモック
   */
  async mockWeatherApi(endpoint: string, method: string = 'GET', data?: any): Promise<any> {
    const key = `weather_${method}_${endpoint}`;
    this.incrementRequestCount(key);

    await this.simulateDelay();
    this.simulateError('Weather API Error');

    if (endpoint.includes('weather')) {
      return this.createWeatherResponse();
    } else if (endpoint.includes('forecast')) {
      return this.createWeatherForecastResponse();
    }

    return { data: `Mock Weather response for ${endpoint}` };
  }

  /**
   * 遅延のシミュレート
   */
  private async simulateDelay(): Promise<void> {
    if (this.responseDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.responseDelay));
    }
  }

  /**
   * エラーのシミュレート
   */
  private simulateError(message: string): void {
    if (this.downtime) {
      throw new Error('Service Unavailable - Server is down');
    }

    if (Math.random() < this.errorRate) {
      const errorTypes = [
        { status: 500, message: 'Internal Server Error' },
        { status: 429, message: 'Too Many Requests' },
        { status: 503, message: 'Service Unavailable' },
        { status: 404, message: 'Not Found' }
      ];
      
      const error = errorTypes[Math.floor(Math.random() * errorTypes.length)];
      const apiError = new Error(`${message}: ${error.message}`);
      (apiError as any).response = { status: error.status };
      throw apiError;
    }
  }

  /**
   * リクエストカウンターの増加
   */
  private incrementRequestCount(key: string): void {
    this.requestCount.set(key, (this.requestCount.get(key) || 0) + 1);
  }

  /**
   * Shopify商品レスポンスの作成
   */
  private createShopifyProductsResponse(): any {
    return {
      products: Array.from({ length: 10 }, (_, i) => ({
        id: 1000 + i,
        title: `Test Product ${i + 1}`,
        vendor: 'Test Vendor',
        product_type: 'Test Type',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'active',
        variants: [{
          id: 2000 + i,
          product_id: 1000 + i,
          title: 'Default Title',
          price: '10.00',
          sku: `TEST-SKU-${i}`,
          inventory_quantity: Math.floor(Math.random() * 100)
        }]
      }))
    };
  }

  /**
   * Shopify注文レスポンスの作成
   */
  private createShopifyOrdersResponse(): any {
    return {
      orders: Array.from({ length: 5 }, (_, i) => ({
        id: 3000 + i,
        email: `customer${i}@example.com`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        total_price: (Math.random() * 100 + 10).toFixed(2),
        currency: 'USD',
        financial_status: 'paid',
        fulfillment_status: 'fulfilled',
        line_items: [{
          id: 4000 + i,
          variant_id: 2000 + i,
          title: `Test Product ${i + 1}`,
          quantity: Math.floor(Math.random() * 3) + 1,
          price: '10.00'
        }]
      }))
    };
  }

  /**
   * POS取引レスポンスの作成
   */
  private createPosTransactionsResponse(): any {
    return Array.from({ length: 20 }, (_, i) => ({
      id: `trans_${5000 + i}`,
      timestamp: new Date(Date.now() - i * 3600000).toISOString(),
      amount: Math.floor(Math.random() * 10000) / 100,
      items: [{
        id: `item_${6000 + i}`,
        name: `POS Item ${i + 1}`,
        quantity: Math.floor(Math.random() * 5) + 1,
        unit_price: Math.floor(Math.random() * 1000) / 100,
        total_price: Math.floor(Math.random() * 2000) / 100
      }],
      payment_method: ['cash', 'card', 'mobile'][Math.floor(Math.random() * 3)],
      status: 'completed'
    }));
  }

  /**
   * Analytics レスポンスの作成
   */
  private createAnalyticsResponse(): any {
    return {
      date: new Date().toISOString().split('T')[0],
      metrics: {
        pageviews: Math.floor(Math.random() * 10000),
        users: Math.floor(Math.random() * 1000),
        bounceRate: Math.random(),
        avgSessionDuration: Math.floor(Math.random() * 300)
      },
      dimensions: {
        source: ['organic', 'direct', 'social', 'email'][Math.floor(Math.random() * 4)],
        medium: ['organic', 'none', 'cpc', 'email'][Math.floor(Math.random() * 4)],
        device: ['desktop', 'mobile', 'tablet'][Math.floor(Math.random() * 3)]
      }
    };
  }

  /**
   * 天気レスポンスの作成
   */
  private createWeatherResponse(): any {
    return {
      name: 'Tokyo',
      coord: { lat: 35.6762, lon: 139.6503 },
      main: {
        temp: Math.floor(Math.random() * 20) + 10,
        feels_like: Math.floor(Math.random() * 20) + 8,
        humidity: Math.floor(Math.random() * 40) + 40
      },
      weather: [{
        main: ['Clear', 'Clouds', 'Rain', 'Snow'][Math.floor(Math.random() * 4)],
        description: 'Test weather condition'
      }]
    };
  }

  /**
   * 天気予報レスポンスの作成
   */
  private createWeatherForecastResponse(): any {
    return {
      city: {
        name: 'Tokyo',
        coord: { lat: 35.6762, lon: 139.6503 }
      },
      list: Array.from({ length: 5 }, (_, i) => ({
        dt: Math.floor(Date.now() / 1000) + (i * 86400),
        main: {
          temp: Math.floor(Math.random() * 20) + 10,
          feels_like: Math.floor(Math.random() * 20) + 8,
          humidity: Math.floor(Math.random() * 40) + 40
        },
        weather: [{
          main: ['Clear', 'Clouds', 'Rain', 'Snow'][Math.floor(Math.random() * 4)],
          description: 'Test forecast condition'
        }],
        rain: { '3h': Math.random() * 5 }
      }))
    };
  }
}

// シングルトンインスタンス
export const mockApiServer = new MockApiServer();