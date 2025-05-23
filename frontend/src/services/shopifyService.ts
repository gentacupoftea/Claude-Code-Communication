/**
 * Shopify Integration Service for Conea Frontend
 * Provides API communication with Shopify backend integration
 */

import axios, { AxiosResponse } from 'axios';
import apiService from './api';

// ================================
// Type Definitions
// ================================

export interface ShopifyStore {
  store_id: string;
  shop_domain: string;
  store_name?: string;
  connected_at: string;
  last_sync?: string;
  sync_enabled: boolean;
}

export interface ShopifyProduct {
  id: number;
  title: string;
  body_html?: string;
  vendor?: string;
  product_type?: string;
  handle?: string;
  status: 'active' | 'archived' | 'draft';
  created_at: string;
  updated_at: string;
  published_at?: string;
  variants: ShopifyVariant[];
  images: ShopifyImage[];
  tags?: string;
}

export interface ShopifyVariant {
  id: number;
  product_id: number;
  title: string;
  price: string;
  sku?: string;
  position?: number;
  inventory_quantity?: number;
  compare_at_price?: string;
  fulfillment_service: string;
  inventory_management?: string;
  option1?: string;
  option2?: string;
  option3?: string;
  created_at: string;
  updated_at: string;
  taxable: boolean;
  barcode?: string;
  grams?: number;
  image_id?: number;
  weight?: number;
  weight_unit: string;
  inventory_item_id?: number;
  requires_shipping: boolean;
}

export interface ShopifyImage {
  id: number;
  product_id: number;
  position?: number;
  created_at: string;
  updated_at: string;
  alt?: string;
  width?: number;
  height?: number;
  src: string;
  variant_ids: number[];
}

export interface ShopifyOrder {
  id: number;
  email?: string;
  closed_at?: string;
  created_at: string;
  updated_at: string;
  number: number;
  note?: string;
  token: string;
  gateway?: string;
  test: boolean;
  total_price: string;
  subtotal_price: string;
  total_weight?: number;
  total_tax: string;
  taxes_included: boolean;
  currency: string;
  financial_status: string;
  confirmed: boolean;
  total_discounts: string;
  total_line_items_price: string;
  cart_token?: string;
  buyer_accepts_marketing: boolean;
  name: string;
  referring_site?: string;
  landing_site?: string;
  cancelled_at?: string;
  cancel_reason?: string;
  total_price_usd?: string;
  checkout_token?: string;
  reference?: string;
  user_id?: number;
  location_id?: number;
  source_identifier?: string;
  source_url?: string;
  processed_at?: string;
  device_id?: number;
  phone?: string;
  customer_locale: string;
  app_id?: number;
  browser_ip?: string;
  landing_site_ref?: string;
  order_number: number;
  fulfillment_status?: string;
  line_items: ShopifyLineItem[];
  customer?: ShopifyCustomer;
  billing_address?: any;
  shipping_address?: any;
  fulfillments: any[];
  refunds: any[];
}

export interface ShopifyLineItem {
  id: number;
  variant_id?: number;
  title: string;
  quantity: number;
  sku?: string;
  variant_title?: string;
  vendor?: string;
  fulfillment_service: string;
  product_id?: number;
  requires_shipping: boolean;
  taxable: boolean;
  gift_card: boolean;
  name: string;
  variant_inventory_management?: string;
  properties: any[];
  product_exists: boolean;
  fulfillable_quantity: number;
  grams?: number;
  price: string;
  total_discount: string;
  fulfillment_status?: string;
  price_set?: any;
  total_discount_set?: any;
  discount_allocations: any[];
  duties: any[];
  admin_graphql_api_id: string;
  tax_lines: any[];
}

export interface ShopifyCustomer {
  id: number;
  email?: string;
  accepts_marketing: boolean;
  created_at: string;
  updated_at: string;
  first_name?: string;
  last_name?: string;
  orders_count: number;
  state: string;
  total_spent: string;
  last_order_id?: number;
  note?: string;
  verified_email: boolean;
  multipass_identifier?: string;
  tax_exempt: boolean;
  phone?: string;
  tags?: string;
  last_order_name?: string;
  currency: string;
  addresses: any[];
  default_address?: any;
}

export interface PaginatedResponse<T> {
  items: T[];
  total_count: number;
  page: number;
  per_page: number;
  has_next: boolean;
  has_previous: boolean;
  next_page_info?: string;
  previous_page_info?: string;
}

export interface SyncStatus {
  store_id: string;
  last_sync?: string;
  sync_in_progress: boolean;
  next_scheduled_sync?: string;
  products_synced: number;
  orders_synced: number;
  customers_synced: number;
  webhook_status: string;
  api_health: string;
}

export interface SyncOperation {
  operation_id: string;
  store_id: string;
  operation_type: string;
  status: string;
  started_at: string;
  completed_at?: string;
  total_records?: number;
  processed_records?: number;
  successful_records?: number;
  failed_records?: number;
  errors: any[];
  error_summary?: string;
}

export interface WebhookStatus {
  store_id: string;
  registered_webhooks: number;
  webhook_topics: string[];
  has_event_handler: boolean;
  last_updated: string;
}

// ================================
// API Service Class
// ================================

class ShopifyService {
  private baseUrl = '/api/v1/shopify';

  // ================================
  // Store Connection Management
  // ================================

  /**
   * Get OAuth URL to connect a new Shopify store
   */
  async getConnectUrl(shopDomain: string, redirectUrl?: string): Promise<{
    oauth_url: string;
    state: string;
    shop: string;
  }> {
    const response = await apiService.post(`${this.baseUrl}/stores/connect`, {
      shop_domain: shopDomain,
      redirect_url: redirectUrl
    });
    return response.data;
  }

  /**
   * Get list of connected Shopify stores
   */
  async getStores(): Promise<ShopifyStore[]> {
    const response = await apiService.get(`${this.baseUrl}/stores`);
    return response.data;
  }

  /**
   * Disconnect a Shopify store
   */
  async disconnectStore(storeId: string): Promise<{ success: boolean; message: string }> {
    const response = await apiService.delete(`${this.baseUrl}/stores/${storeId}`);
    return response.data;
  }

  /**
   * Check health of store connection
   */
  async checkStoreHealth(storeId: string): Promise<any> {
    const response = await apiService.get(`${this.baseUrl}/stores/${storeId}/health`);
    return response.data;
  }

  // ================================
  // Product Management
  // ================================

  /**
   * Get products from a store
   */
  async getProducts(
    storeId: string,
    options: {
      limit?: number;
      page_info?: string;
      status?: string;
      vendor?: string;
      product_type?: string;
    } = {}
  ): Promise<PaginatedResponse<ShopifyProduct>> {
    const params = new URLSearchParams();
    
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.page_info) params.append('page_info', options.page_info);
    if (options.status) params.append('status', options.status);
    if (options.vendor) params.append('vendor', options.vendor);
    if (options.product_type) params.append('product_type', options.product_type);

    const response = await apiService.get(
      `${this.baseUrl}/stores/${storeId}/products?${params.toString()}`
    );
    return response.data;
  }

  /**
   * Get a specific product
   */
  async getProduct(storeId: string, productId: number): Promise<ShopifyProduct> {
    const response = await apiService.get(
      `${this.baseUrl}/stores/${storeId}/products/${productId}`
    );
    return response.data;
  }

  /**
   * Create a new product
   */
  async createProduct(storeId: string, product: Partial<ShopifyProduct>): Promise<ShopifyProduct> {
    const response = await apiService.post(
      `${this.baseUrl}/stores/${storeId}/products`,
      product
    );
    return response.data;
  }

  /**
   * Update an existing product
   */
  async updateProduct(
    storeId: string,
    productId: number,
    updates: Partial<ShopifyProduct>
  ): Promise<ShopifyProduct> {
    const response = await apiService.put(
      `${this.baseUrl}/stores/${storeId}/products/${productId}`,
      updates
    );
    return response.data;
  }

  // ================================
  // Order Management
  // ================================

  /**
   * Get orders from a store
   */
  async getOrders(
    storeId: string,
    options: {
      limit?: number;
      page_info?: string;
      status?: string;
      financial_status?: string;
      fulfillment_status?: string;
    } = {}
  ): Promise<PaginatedResponse<ShopifyOrder>> {
    const params = new URLSearchParams();
    
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.page_info) params.append('page_info', options.page_info);
    if (options.status) params.append('status', options.status);
    if (options.financial_status) params.append('financial_status', options.financial_status);
    if (options.fulfillment_status) params.append('fulfillment_status', options.fulfillment_status);

    const response = await apiService.get(
      `${this.baseUrl}/stores/${storeId}/orders?${params.toString()}`
    );
    return response.data;
  }

  /**
   * Get a specific order
   */
  async getOrder(storeId: string, orderId: number): Promise<ShopifyOrder> {
    const response = await apiService.get(
      `${this.baseUrl}/stores/${storeId}/orders/${orderId}`
    );
    return response.data;
  }

  // ================================
  // Customer Management
  // ================================

  /**
   * Get customers from a store
   */
  async getCustomers(
    storeId: string,
    options: {
      limit?: number;
      page_info?: string;
    } = {}
  ): Promise<PaginatedResponse<ShopifyCustomer>> {
    const params = new URLSearchParams();
    
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.page_info) params.append('page_info', options.page_info);

    const response = await apiService.get(
      `${this.baseUrl}/stores/${storeId}/customers?${params.toString()}`
    );
    return response.data;
  }

  // ================================
  // Synchronization
  // ================================

  /**
   * Start data synchronization
   */
  async startSync(
    storeId: string,
    entityType: 'products' | 'orders' | 'customers' | 'inventory',
    fullSync: boolean = false,
    customFilters: Record<string, any> = {}
  ): Promise<{ success: boolean; operation_id: string; message: string }> {
    const response = await apiService.post(`${this.baseUrl}/stores/${storeId}/sync`, {
      entity_type: entityType,
      full_sync: fullSync,
      custom_filters: customFilters
    });
    return response.data;
  }

  /**
   * Get synchronization status
   */
  async getSyncStatus(storeId: string): Promise<SyncStatus> {
    const response = await apiService.get(`${this.baseUrl}/stores/${storeId}/sync/status`);
    return response.data;
  }

  // ================================
  // Webhook Management
  // ================================

  /**
   * Register webhooks for a store
   */
  async registerWebhooks(
    storeId: string,
    forceReregister: boolean = false
  ): Promise<{ success: boolean; registered_webhooks: number; webhooks: any[] }> {
    const response = await apiService.post(`${this.baseUrl}/stores/${storeId}/webhooks/register`, {
      force_reregister: forceReregister
    });
    return response.data;
  }

  /**
   * Get webhook status
   */
  async getWebhookStatus(storeId: string): Promise<WebhookStatus> {
    const response = await apiService.get(`${this.baseUrl}/stores/${storeId}/webhooks/status`);
    return response.data;
  }

  // ================================
  // Analytics & Insights
  // ================================

  /**
   * Get store analytics summary
   */
  async getStoreAnalytics(storeId: string, period: '7d' | '30d' | '90d' = '30d'): Promise<any> {
    const response = await apiService.get(
      `${this.baseUrl}/stores/${storeId}/analytics?period=${period}`
    );
    return response.data;
  }

  /**
   * Get product performance metrics
   */
  async getProductMetrics(storeId: string, productId?: number): Promise<any> {
    const url = productId 
      ? `${this.baseUrl}/stores/${storeId}/products/${productId}/metrics`
      : `${this.baseUrl}/stores/${storeId}/products/metrics`;
    
    const response = await apiService.get(url);
    return response.data;
  }

  /**
   * Get inventory insights
   */
  async getInventoryInsights(storeId: string): Promise<any> {
    const response = await apiService.get(`${this.baseUrl}/stores/${storeId}/inventory/insights`);
    return response.data;
  }

  // ================================
  // Bulk Operations
  // ================================

  /**
   * Bulk update products
   */
  async bulkUpdateProducts(
    storeId: string,
    updates: Array<{ id: number; updates: Partial<ShopifyProduct> }>
  ): Promise<{ success: boolean; results: any[] }> {
    const response = await apiService.post(
      `${this.baseUrl}/stores/${storeId}/products/bulk-update`,
      { updates }
    );
    return response.data;
  }

  /**
   * Bulk export data
   */
  async exportData(
    storeId: string,
    entityType: 'products' | 'orders' | 'customers',
    format: 'csv' | 'json' = 'csv',
    filters: Record<string, any> = {}
  ): Promise<{ download_url: string; expires_at: string }> {
    const response = await apiService.post(
      `${this.baseUrl}/stores/${storeId}/export`,
      {
        entity_type: entityType,
        format,
        filters
      }
    );
    return response.data;
  }

  // ================================
  // Error Handling & Retries
  // ================================

  /**
   * Retry failed operations
   */
  async retryFailedOperations(storeId: string): Promise<{ success: boolean; retry_count: number }> {
    const response = await apiService.post(`${this.baseUrl}/stores/${storeId}/retry-failed`);
    return response.data;
  }

  /**
   * Get operation logs
   */
  async getOperationLogs(
    storeId: string,
    options: {
      limit?: number;
      offset?: number;
      level?: 'info' | 'warning' | 'error';
      operation_type?: string;
    } = {}
  ): Promise<any[]> {
    const params = new URLSearchParams();
    
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());
    if (options.level) params.append('level', options.level);
    if (options.operation_type) params.append('operation_type', options.operation_type);

    const response = await apiService.get(
      `${this.baseUrl}/stores/${storeId}/logs?${params.toString()}`
    );
    return response.data;
  }
}

// ================================
// Export Service Instance
// ================================

export const shopifyService = new ShopifyService();
export default shopifyService;