import { CachedApiAdapter } from './CachedApiAdapter';
import { WeatherConfig } from '../types/api-configs';
import { WeatherData } from '../types/api-responses';

/**
 * 天気APIアダプター
 * OpenWeatherMapなどの天気APIとの通信を統一インターフェースで提供（キャッシュ対応）
 */
export class WeatherAdapter extends CachedApiAdapter<WeatherConfig, WeatherData> {
  private baseUrl?: string;
  private headers?: Record<string, string>;

  constructor() {
    super('Weather');
  }

  /**
   * 天気APIの初期化
   */
  protected async doInitialize(config: WeatherConfig): Promise<void> {
    this.baseUrl = config.endpoint;
    this.headers = {
      'Content-Type': 'application/json'
    };

    // APIキーをURLパラメータとして使用する場合が多い
    // 接続テスト
    const testUrl = this.buildApiUrl('/weather', {
      appid: config.apiKey,
      lat: config.defaultLocation?.lat || 35.6762,
      lon: config.defaultLocation?.lon || 139.6503
    });

    const response = await this.makeRequest('GET', testUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to connect to Weather API: ${response.statusText}`);
    }
  }

  /**
   * 天気データを取得
   */
  protected async doFetch<T extends WeatherData>(params: WeatherFetchParams): Promise<T> {
    const endpoint = this.getEndpoint(params.type);
    const queryParams = this.buildQueryParams(params);
    const url = this.buildApiUrl(endpoint, queryParams);

    const response = await this.makeRequest('GET', url);

    if (!response.ok) {
      throw this.createHttpError(response);
    }

    const data = await response.json();
    return this.transformWeatherData(data, params.type);
  }

  /**
   * 天気APIは通常送信機能を持たない
   */
  protected async doSend<T extends WeatherData>(data: any): Promise<T> {
    throw new Error('Weather API does not support data sending');
  }

  /**
   * ヘルスチェック
   */
  protected async doHealthCheck(): Promise<boolean> {
    try {
      const url = this.buildApiUrl('/weather', {
        appid: this.config?.apiKey,
        lat: 35.6762,
        lon: 139.6503
      });
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
   * APIエンドポイントの取得
   */
  private getEndpoint(type: WeatherFetchType): string {
    switch (type) {
      case 'current':
        return '/weather';
      case 'forecast':
        return '/forecast';
      case 'hourly':
        return '/forecast/hourly';
      default:
        return '/weather';
    }
  }

  /**
   * クエリパラメータの構築
   */
  private buildQueryParams(params: WeatherFetchParams): Record<string, string> {
    const queryParams: Record<string, string> = {
      appid: this.config?.apiKey || '',
      units: params.units || 'metric',
      lang: params.lang || 'ja'
    };

    if (params.location) {
      if ('lat' in params.location) {
        queryParams.lat = params.location.lat.toString();
        queryParams.lon = params.location.lon.toString();
      } else if ('city' in params.location) {
        queryParams.q = params.location.city;
      } else if ('zip' in params.location) {
        queryParams.zip = params.location.zip;
      }
    }

    if (params.type === 'forecast' && params.cnt) {
      queryParams.cnt = params.cnt.toString();
    }

    return queryParams;
  }

  /**
   * APIのURLを構築
   */
  private buildApiUrl(endpoint: string, params: Record<string, string>): string {
    const queryString = new URLSearchParams(params).toString();
    return `${this.baseUrl}${endpoint}?${queryString}`;
  }

  /**
   * 天気データの変換
   */
  private transformWeatherData(data: any, type: WeatherFetchType): WeatherData {
    const baseData: WeatherData = {
      location: {
        name: data.name || data.city?.name || 'Unknown',
        lat: data.coord?.lat || data.city?.coord?.lat || 0,
        lon: data.coord?.lon || data.city?.coord?.lon || 0
      },
      current: {
        temp: 0,
        feels_like: 0,
        humidity: 0,
        weather: '',
        description: ''
      },
      forecast: []
    };

    if (type === 'current') {
      baseData.current = {
        temp: data.main?.temp || 0,
        feels_like: data.main?.feels_like || 0,
        humidity: data.main?.humidity || 0,
        weather: data.weather?.[0]?.main || '',
        description: data.weather?.[0]?.description || ''
      };
    } else if (type === 'forecast') {
      baseData.current = this.extractCurrentFromForecast(data);
      baseData.forecast = this.extractForecast(data);
    }

    return baseData;
  }

  /**
   * 予報データから現在の天気を抽出
   */
  private extractCurrentFromForecast(data: any): WeatherData['current'] {
    const firstItem = data.list?.[0];
    return {
      temp: firstItem?.main?.temp || 0,
      feels_like: firstItem?.main?.feels_like || 0,
      humidity: firstItem?.main?.humidity || 0,
      weather: firstItem?.weather?.[0]?.main || '',
      description: firstItem?.weather?.[0]?.description || ''
    };
  }

  /**
   * 予報データの抽出
   */
  private extractForecast(data: any): WeatherData['forecast'] {
    if (!data.list || !Array.isArray(data.list)) {
      return [];
    }

    // 日ごとの予報にグループ化
    const dailyForecast = new Map<string, any[]>();
    
    data.list.forEach((item: any) => {
      const date = new Date(item.dt * 1000).toISOString().split('T')[0];
      if (!dailyForecast.has(date)) {
        dailyForecast.set(date, []);
      }
      dailyForecast.get(date)?.push(item);
    });

    // 各日の予報をまとめる
    return Array.from(dailyForecast.entries()).map(([date, items]) => {
      const temps = items.map(item => item.main?.temp || 0);
      const precipitations = items.map(item => item.rain?.['3h'] || item.snow?.['3h'] || 0);
      
      return {
        date,
        temp_min: Math.min(...temps),
        temp_max: Math.max(...temps),
        weather: items[0]?.weather?.[0]?.main || '',
        precipitation: precipitations.reduce((sum, val) => sum + val, 0)
      };
    });
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
 * 天気データ取得タイプ
 */
export type WeatherFetchType = 'current' | 'forecast' | 'hourly';

/**
 * 天気データ取得パラメータ
 */
export interface WeatherFetchParams {
  type: WeatherFetchType;
  location: 
    | { lat: number; lon: number }
    | { city: string }
    | { zip: string };
  units?: 'metric' | 'imperial' | 'kelvin';
  lang?: string;
  cnt?: number;  // 予報の件数
}