/**
 * Shopify商品情報
 */
export interface ShopifyProduct {
  id: number;
  title: string;
  vendor: string;
  product_type: string;
  created_at: string;
  updated_at: string;
  status: string;
  variants: ShopifyVariant[];
}

export interface ShopifyVariant {
  id: number;
  product_id: number;
  title: string;
  price: string;
  sku: string;
  inventory_quantity: number;
}

/**
 * Shopify注文情報
 */
export interface ShopifyOrder {
  id: number;
  email: string;
  created_at: string;
  updated_at: string;
  total_price: string;
  currency: string;
  financial_status: string;
  fulfillment_status: string;
  line_items: ShopifyLineItem[];
}

export interface ShopifyLineItem {
  id: number;
  variant_id: number;
  title: string;
  quantity: number;
  price: string;
}

/**
 * POS取引情報
 */
export interface PosTransaction {
  id: string;
  timestamp: string;
  amount: number;
  items: PosItem[];
  payment_method: string;
  status: string;
}

export interface PosItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

/**
 * 分析データ
 */
export interface AnalyticsData {
  date: string;
  metrics: {
    pageviews: number;
    unique_visitors: number;
    bounce_rate: number;
    avg_session_duration: number;
  };
  dimensions: {
    source: string;
    medium: string;
    device: string;
  };
}

/**
 * 天気情報
 */
export interface WeatherData {
  location: {
    name: string;
    lat: number;
    lon: number;
  };
  current: {
    temp: number;
    feels_like: number;
    humidity: number;
    weather: string;
    description: string;
  };
  forecast: WeatherForecast[];
}

export interface WeatherForecast {
  date: string;
  temp_min: number;
  temp_max: number;
  weather: string;
  precipitation: number;
}