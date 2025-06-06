/**
 * API共通の型定義
 */

// APIレスポンスの基本インターフェース
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  errors?: ApiError[];
  meta?: ApiMetadata;
}

// APIエラーの型
export interface ApiError {
  code: string;
  message: string;
  field?: string;
  details?: Record<string, unknown>;
}

// メタデータ情報（ページネーションなど）
export interface ApiMetadata {
  pagination?: PaginationMetadata;
  timestamp?: string;
  requestId?: string;
  processingTime?: number;
}

// ページネーション情報
export interface PaginationMetadata {
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// ページネーションパラメータ
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

// APIリクエストオプション
export interface ApiRequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
  timeout?: number;
  signal?: AbortSignal;
  skipAuthHeader?: boolean;
  skipRefreshToken?: boolean;
}

// 認証関連の型定義
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  error: string | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  shopifyStoreId?: string;
  preferences?: UserPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  dashboardLayout?: string;
  notifications: {
    email: boolean;
    push: boolean;
    inApp: boolean;
  };
}

// ログインリクエスト
export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

// ログインレスポンス
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
}

// トークンリフレッシュレスポンス
export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

// 登録リクエスト
export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  shopifyStoreUrl?: string;
}

// パスワード更新リクエスト
export interface UpdatePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// エラーコード定義
export enum ErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  CANCEL_ERROR = 'CANCEL_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

// Shopify関連の型定義
export interface ShopifyStore {
  id: string;
  name: string;
  domain: string;
  accessToken?: string;
  isConnected: boolean;
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShopifyProduct {
  id: string;
  title: string;
  description: string;
  price: number;
  comparePriceAt?: number;
  sku: string;
  inventory: number;
  images: string[];
  tags: string[];
  vendor: string;
  productType: string;
  publishedAt: string;
  status: 'active' | 'draft' | 'archived';
  variants?: ShopifyProductVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface ShopifyProductVariant {
  id: string;
  title: string;
  price: number;
  sku: string;
  inventory: number;
  option1?: string;
  option2?: string;
  option3?: string;
}

export interface ShopifyOrder {
  id: string;
  orderNumber: string;
  totalPrice: number;
  subtotalPrice: number;
  totalTax: number;
  totalShipping: number;
  totalDiscounts: number;
  financialStatus: string;
  fulfillmentStatus: string;
  customer: {
    id: string;
    email: string;
    name: string;
  };
  lineItems: ShopifyOrderLineItem[];
  shippingAddress?: ShopifyAddress;
  billingAddress?: ShopifyAddress;
  processedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShopifyOrderLineItem {
  id: string;
  title: string;
  price: number;
  quantity: number;
  sku: string;
  variant?: ShopifyProductVariant;
}

export interface ShopifyAddress {
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  city: string;
  province: string;
  zip: string;
  country: string;
  phone?: string;
}

export interface ShopifyCustomer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  totalSpent: number;
  ordersCount: number;
  phone?: string;
  tags: string[];
  defaultAddress?: ShopifyAddress;
  acceptsMarketing: boolean;
  lastOrderId?: string;
  createdAt: string;
  updatedAt: string;
}

// 分析ダッシュボード関連の型定義
export interface AnalyticsDashboard {
  id: string;
  title: string;
  dateRange: {
    start: string;
    end: string;
  };
  kpis: AnalyticsKPI[];
  charts: AnalyticsChart[];
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsKPI {
  id: string;
  title: string;
  value: number;
  previousValue?: number;
  changePercentage?: number;
  trend: 'up' | 'down' | 'neutral';
  format: 'currency' | 'number' | 'percentage';
}

export interface AnalyticsChart {
  id: string;
  title: string;
  type: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
  data: unknown; // チャートデータの構造はチャートタイプによって異なる
  options?: unknown;
}