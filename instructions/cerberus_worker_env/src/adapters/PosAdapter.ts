import { CachedApiAdapter } from './CachedApiAdapter';
import { PosConfig } from '../types/api-configs';
import { PosTransaction } from '../types/api-responses';

/**
 * POS APIアダプター
 * POSシステムとの通信を統一インターフェースで提供（キャッシュ対応）
 */
export class PosAdapter extends CachedApiAdapter<PosConfig, PosTransaction> {
  private baseUrl?: string;
  private headers?: Record<string, string>;

  constructor() {
    super('POS');
  }

  /**
   * POS APIの初期化
   */
  protected async doInitialize(config: PosConfig): Promise<void> {
    this.baseUrl = config.endpoint;
    
    // 認証ヘッダーの設定
    const authToken = this.generateAuthToken(config.apiKey, config.secretKey);
    this.headers = {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
      'X-API-Key': config.apiKey
    };

    // 接続テスト
    const response = await this.makeRequest('GET', `${this.baseUrl}/health`);
    
    if (!response.ok) {
      throw new Error(`Failed to connect to POS API: ${response.statusText}`);
    }
  }

  /**
   * POSからデータを取得
   */
  protected async doFetch<T extends PosTransaction>(params: PosFetchParams): Promise<T> {
    const url = this.buildUrl(params);
    const response = await this.makeRequest('GET', url);

    if (!response.ok) {
      throw this.createHttpError(response);
    }

    const data = await response.json();
    return this.transformResponse(data, params.type);
  }

  /**
   * POSにデータを送信
   */
  protected async doSend<T extends PosTransaction>(data: PosSendData): Promise<T> {
    const url = `${this.baseUrl}/${data.type}`;
    const body = JSON.stringify(data.payload);

    const response = await this.makeRequest('POST', url, body);

    if (!response.ok) {
      throw this.createHttpError(response);
    }

    const responseData = await response.json();
    return this.transformResponse(responseData, data.type);
  }

  /**
   * ヘルスチェック
   */
  protected async doHealthCheck(): Promise<boolean> {
    try {
      const response = await this.makeRequest('GET', `${this.baseUrl}/health`);
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
   * 認証トークンの生成
   */
  private generateAuthToken(apiKey: string, secretKey: string): string {
    // 実際の実装では適切な認証メカニズムを使用
    // ここでは簡易的な実装
    const timestamp = Date.now();
    const payload = `${apiKey}:${timestamp}`;
    const signature = this.createHmacSignature(payload, secretKey);
    return Buffer.from(`${payload}:${signature}`).toString('base64');
  }

  /**
   * HMAC署名の作成（簡易実装）
   */
  private createHmacSignature(payload: string, secret: string): string {
    // 実際の実装ではcryptoモジュールを使用
    return Buffer.from(payload + secret).toString('base64');
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
  private buildUrl(params: PosFetchParams): string {
    let url = `${this.baseUrl}/${params.type}`;
    
    if (params.id) {
      url += `/${params.id}`;
    }

    if (params.filters) {
      const queryString = new URLSearchParams(params.filters).toString();
      url += `?${queryString}`;
    }

    return url;
  }

  /**
   * レスポンスの変換
   */
  private transformResponse(data: any, type: string): any {
    // POSシステムのレスポンス形式を統一形式に変換
    switch (type) {
      case 'transactions':
        return this.transformTransaction(data);
      case 'products':
        return this.transformProduct(data);
      case 'inventory':
        return this.transformInventory(data);
      default:
        return data;
    }
  }

  /**
   * 取引データの変換
   */
  private transformTransaction(data: any): PosTransaction {
    return {
      id: data.transaction_id || data.id,
      timestamp: data.created_at || data.timestamp,
      amount: data.total_amount || data.amount,
      items: (data.line_items || data.items || []).map((item: any) => ({
        id: item.id || item.product_id,
        name: item.name || item.product_name,
        quantity: item.quantity || item.qty,
        unit_price: item.unit_price || item.price,
        total_price: item.total || item.unit_price * item.quantity
      })),
      payment_method: data.payment_method || data.payment_type,
      status: data.status || 'completed'
    };
  }

  /**
   * 商品データの変換
   */
  private transformProduct(data: any): any {
    // 商品データの変換ロジック
    return data;
  }

  /**
   * 在庫データの変換
   */
  private transformInventory(data: any): any {
    // 在庫データの変換ロジック
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
 * POS取得パラメータ
 */
export interface PosFetchParams {
  type: 'transactions' | 'products' | 'inventory';
  id?: string;
  filters?: Record<string, string>;
}

/**
 * POS送信データ
 */
export interface PosSendData {
  type: 'transactions' | 'refunds' | 'adjustments';
  payload: any;
}