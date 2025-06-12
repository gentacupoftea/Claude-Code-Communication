/**
 * Shopify API設定
 */
export interface ShopifyConfig {
  shopDomain: string;
  accessToken: string;
  apiVersion: string;
  timeout?: number;
}

/**
 * POS API設定
 */
export interface PosConfig {
  endpoint: string;
  apiKey: string;
  secretKey: string;
  timeout?: number;
}

/**
 * 分析API設定
 */
export interface AnalyticsConfig {
  endpoint: string;
  apiKey: string;
  projectId: string;
  timeout?: number;
}

/**
 * 天気API設定
 */
export interface WeatherConfig {
  endpoint: string;
  apiKey: string;
  defaultLocation?: {
    lat: number;
    lon: number;
  };
  timeout?: number;
}