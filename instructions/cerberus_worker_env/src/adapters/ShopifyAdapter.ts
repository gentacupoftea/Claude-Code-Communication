import { CachedApiAdapter } from './CachedApiAdapter';
import { ShopifyConfig } from '../types/api-configs';
import { ShopifyProduct, ShopifyOrder } from '../types/api-responses';

/**
 * Shopify APIアダプター
 * Shopify REST APIとの通信を統一インターフェースで提供（キャッシュ対応）
 */
export class ShopifyAdapter extends CachedApiAdapter<ShopifyConfig, ShopifyProduct | ShopifyOrder> {
  private baseUrl?: string;
  private headers?: Record<string, string>;

  constructor() {
    super('Shopify');
  }

  /**
   * Shopify APIの初期化
   */
  protected async doInitialize(config: ShopifyConfig): Promise<void> {
    this.baseUrl = `https://${config.shopDomain}/admin/api/${config.apiVersion}`;
    this.headers = {
      'X-Shopify-Access-Token': config.accessToken,
      'Content-Type': 'application/json'
    };

    // 接続テスト
    const testUrl = `${this.baseUrl}/shop.json`;
    const response = await this.makeRequest('GET', testUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to connect to Shopify: ${response.statusText}`);
    }
  }

  /**
   * Shopifyからデータを取得
   */
  protected async doFetch<T extends ShopifyProduct | ShopifyOrder>(params: ShopifyFetchParams): Promise<T> {
    const url = this.buildUrl(params);
    const response = await this.makeRequest('GET', url);

    if (!response.ok) {
      throw this.createHttpError(response);
    }

    const data = await response.json();
    return this.extractData(data, params.resource);
  }

  /**
   * Shopifyにデータを送信
   */
  protected async doSend<T extends ShopifyProduct | ShopifyOrder>(data: ShopifySendData): Promise<T> {
    const url = this.buildUrl({
      resource: data.resource,
      id: data.id
    });

    const method = data.id ? 'PUT' : 'POST';
    const body = JSON.stringify({ [data.resource]: data.data });

    const response = await this.makeRequest(method, url, body);

    if (!response.ok) {
      throw this.createHttpError(response);
    }

    const responseData = await response.json();
    return this.extractData(responseData, data.resource);
  }

  /**
   * ヘルスチェック
   */
  protected async doHealthCheck(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/shop.json`;
      const response = await this.makeRequest('GET', url);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 切断処理
   */
  protected async doDisconnect(): Promise<void> {
    this.baseUrl = undefined;
    this.headers = undefined;
  }

  /**
   * HTTPリクエストの実行
   */
  private async makeRequest(method: string, url: string, body?: string): Promise<Response> {
    const options: RequestInit = {
      method,
      headers: this.headers,
      body
    };

    if (this.config?.timeout) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
      
      try {
        options.signal = controller.signal;
        const response = await fetch(url, options);
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    }

    return fetch(url, options);
  }

  /**
   * URLの構築
   */
  private buildUrl(params: ShopifyFetchParams): string {
    let url = `${this.baseUrl}/${params.resource}`;
    
    if (params.id) {
      url += `/${params.id}`;
    }
    
    url += '.json';

    if (params.query) {
      const queryString = new URLSearchParams(params.query).toString();
      url += `?${queryString}`;
    }

    return url;
  }

  /**
   * レスポンスデータの抽出
   */
  private extractData(data: any, resource: string): any {
    // 単一リソースの場合
    if (data[resource]) {
      return data[resource];
    }
    
    // 複数リソースの場合（例: products, orders）
    const pluralResource = `${resource}s`;
    if (data[pluralResource]) {
      return data[pluralResource];
    }

    return data;
  }

  /**
   * HTTPエラーの作成
   */
  private createHttpError(response: Response): Error {
    const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
    (error as any).response = response;
    return error;
  }
}

/**
 * Shopify取得パラメータ
 */
export interface ShopifyFetchParams {
  resource: string;  // 'product', 'order', etc.
  id?: string | number;
  query?: Record<string, string>;
}

/**
 * Shopify送信データ
 */
export interface ShopifySendData {
  resource: string;
  id?: string | number;
  data: any;
}