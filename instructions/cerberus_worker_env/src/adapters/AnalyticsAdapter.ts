import { CachedApiAdapter } from './CachedApiAdapter';
import { AnalyticsConfig } from '../types/api-configs';
import { AnalyticsData } from '../types/api-responses';

/**
 * 分析APIアダプター
 * Google AnalyticsやカスタムAnalytics APIとの通信を統一インターフェースで提供（キャッシュ対応）
 */
export class AnalyticsAdapter extends CachedApiAdapter<AnalyticsConfig, AnalyticsData> {
  private baseUrl?: string;
  private headers?: Record<string, string>;

  constructor() {
    super('Analytics');
  }

  /**
   * 分析APIの初期化
   */
  protected async doInitialize(config: AnalyticsConfig): Promise<void> {
    this.baseUrl = config.endpoint;
    this.headers = {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'X-Project-ID': config.projectId
    };

    // 接続テスト
    const response = await this.makeRequest('GET', `${this.baseUrl}/v1/projects/${config.projectId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to connect to Analytics API: ${response.statusText}`);
    }
  }

  /**
   * 分析データを取得
   */
  protected async doFetch<T extends AnalyticsData>(params: AnalyticsFetchParams): Promise<T> {
    const url = this.buildUrl(params);
    const response = await this.makeRequest('POST', url, JSON.stringify(params));

    if (!response.ok) {
      throw this.createHttpError(response);
    }

    const data = await response.json();
    return this.transformAnalyticsData(data);
  }

  /**
   * 分析データを送信（イベントトラッキングなど）
   */
  protected async doSend<T extends AnalyticsData>(data: AnalyticsSendData): Promise<T> {
    const url = `${this.baseUrl}/v1/collect`;
    const body = JSON.stringify({
      project_id: this.config?.projectId,
      events: data.events,
      timestamp: new Date().toISOString()
    });

    const response = await this.makeRequest('POST', url, body);

    if (!response.ok) {
      throw this.createHttpError(response);
    }

    const responseData = await response.json();
    return responseData as T;
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
  private buildUrl(params: AnalyticsFetchParams): string {
    const endpoint = params.reportType === 'realtime' ? 'realtime' : 'reports';
    return `${this.baseUrl}/v1/${endpoint}/query`;
  }

  /**
   * 分析データの変換
   */
  private transformAnalyticsData(data: any): AnalyticsData {
    // API固有のデータ形式を統一形式に変換
    return {
      date: data.date || data.dimensions?.date || new Date().toISOString(),
      metrics: {
        pageviews: data.metrics?.pageviews || data.pageViews || 0,
        unique_visitors: data.metrics?.users || data.uniqueVisitors || 0,
        bounce_rate: data.metrics?.bounceRate || data.bounceRate || 0,
        avg_session_duration: data.metrics?.avgSessionDuration || data.avgDuration || 0
      },
      dimensions: {
        source: data.dimensions?.source || 'direct',
        medium: data.dimensions?.medium || 'none',
        device: data.dimensions?.deviceCategory || 'desktop'
      }
    };
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
 * 分析データ取得パラメータ
 */
export interface AnalyticsFetchParams {
  reportType: 'standard' | 'realtime' | 'custom';
  metrics: string[];
  dimensions?: string[];
  dateRange: {
    startDate: string;
    endDate: string;
  };
  filters?: Array<{
    dimension: string;
    operator: 'equals' | 'contains' | 'startsWith';
    value: string;
  }>;
  orderBy?: Array<{
    field: string;
    direction: 'asc' | 'desc';
  }>;
  limit?: number;
}

/**
 * 分析データ送信パラメータ
 */
export interface AnalyticsSendData {
  events: Array<{
    name: string;
    parameters: Record<string, any>;
    timestamp?: string;
  }>;
}