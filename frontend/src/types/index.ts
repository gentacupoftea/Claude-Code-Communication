/**
 * 統合型定義ファイル
 */

// ECプラットフォーム種別
export type ECPlatform = 'shopify' | 'rakuten' | 'amazon' | 'yahoo' | 'base' | 'mercari';

// ユーザー認証
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'user' | 'viewer';
  language: 'ja' | 'en';
  theme: 'light' | 'dark';
  permissions: string[];
  lastLogin: Date;
}

// API認証設定
export interface APIConfig {
  platform: ECPlatform;
  apiKey: string;
  apiSecret?: string;
  accessToken?: string;
  shopUrl?: string;
  lastSync: Date;
  status: 'active' | 'inactive' | 'error';
}

// 商品データ
export interface Product {
  id: string;
  platform: ECPlatform;
  title: string;
  titleJa?: string;
  description?: string;
  price: number;
  currency: string;
  sku: string;
  barcode?: string;
  inventory: number;
  images: string[];
  categories: string[];
  tags: string[];
  status: 'active' | 'draft' | 'archived';
  createdAt: Date;
  updatedAt: Date;
  syncedAt: Date;
}

// 注文データ
export interface Order {
  id: string;
  platform: ECPlatform;
  orderNumber: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
    address: Address;
  };
  items: OrderItem[];
  totalAmount: number;
  currency: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  shippingMethod?: string;
  trackingNumber?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 注文商品
export interface OrderItem {
  productId: string;
  title: string;
  quantity: number;
  price: number;
  discount?: number;
  tax?: number;
}

// 住所情報
export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

// SEOデータ
export interface SEOData {
  platform: 'google' | 'bing';
  impressions: number;
  clicks: number;
  ctr: number; // Click Through Rate
  averagePosition: number;
  keywords: KeywordData[];
  date: Date;
}

// キーワードデータ
export interface KeywordData {
  keyword: string;
  impressions: number;
  clicks: number;
  position: number;
  trend: 'up' | 'down' | 'stable';
}

// ダッシュボードウィジェット
export interface Widget {
  id: string;
  type: 'chart' | 'metric' | 'table' | 'map';
  title: string;
  dataSource: string;
  config: Record<string, any>;
  position: { x: number; y: number };
  size: { width: number; height: number };
  refreshInterval?: number;
}

// チャートデータ
export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string;
    borderColor?: string;
    type?: 'line' | 'bar' | 'pie' | 'doughnut';
  }[];
}

// レポート設定
export interface ReportConfig {
  id: string;
  name: string;
  type: 'sales' | 'inventory' | 'seo' | 'custom';
  platforms: ECPlatform[];
  dateRange: {
    start: Date;
    end: Date;
  };
  metrics: string[];
  format: 'pdf' | 'csv' | 'excel';
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    recipients: string[];
  };
}

// 通知設定
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
}

// APIレスポンス共通型
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

// ページネーション
export interface PaginationParams {
  page: number;
  perPage: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// フィルター条件
export interface FilterParams {
  search?: string;
  platforms?: ECPlatform[];
  status?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  [key: string]: any;
}