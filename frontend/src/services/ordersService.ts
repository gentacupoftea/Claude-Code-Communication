/**
 * 注文関連サービス
 */
import api from './api';
import { Order, PaginationParams, FilterParams, APIResponse } from '@/types';

interface OrdersResponse {
  items: Order[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

class OrdersService {
  /**
   * 注文一覧取得
   */
  async getOrders(
    pagination: PaginationParams,
    filters: FilterParams
  ): Promise<OrdersResponse> {
    const params = {
      page: pagination.page,
      per_page: pagination.perPage,
      sort_by: pagination.sortBy,
      sort_order: pagination.sortOrder,
      ...filters,
    };

    const response = await api.get<APIResponse<OrdersResponse>>('/orders', {
      params,
    });

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(response.error?.message || '注文の取得に失敗しました');
  }

  /**
   * 注文詳細取得
   */
  async getOrderById(id: string): Promise<Order> {
    const response = await api.get<APIResponse<Order>>(`/orders/${id}`);

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(response.error?.message || '注文の取得に失敗しました');
  }

  /**
   * 注文ステータス更新
   */
  async updateOrderStatus(id: string, status: string): Promise<Order> {
    const response = await api.patch<APIResponse<Order>>(
      `/orders/${id}/status`,
      { status }
    );

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(response.error?.message || 'ステータスの更新に失敗しました');
  }

  /**
   * 注文キャンセル
   */
  async cancelOrder(
    id: string,
    reason: string
  ): Promise<Order> {
    const response = await api.post<APIResponse<Order>>(
      `/orders/${id}/cancel`,
      { reason }
    );

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(response.error?.message || '注文のキャンセルに失敗しました');
  }

  /**
   * 注文同期
   */
  async syncOrders(platform: string): Promise<OrdersResponse> {
    const response = await api.post<APIResponse<OrdersResponse>>(
      `/orders/sync/${platform}`
    );

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(response.error?.message || '注文の同期に失敗しました');
  }

  /**
   * 注文エクスポート
   */
  async exportOrders(
    format: 'csv' | 'excel' | 'pdf',
    filters?: FilterParams
  ): Promise<Blob> {
    const response = await api.get('/orders/export', {
      params: {
        format,
        ...filters,
      },
      responseType: 'blob',
    });

    return response as unknown as Blob;
  }

  /**
   * 配送ラベル取得
   */
  async getShippingLabel(orderId: string): Promise<Blob> {
    const response = await api.get(`/orders/${orderId}/shipping-label`, {
      responseType: 'blob',
    });

    return response as unknown as Blob;
  }

  /**
   * トラッキング情報更新
   */
  async updateTracking(
    orderId: string,
    trackingNumber: string,
    carrier: string
  ): Promise<Order> {
    const response = await api.patch<APIResponse<Order>>(
      `/orders/${orderId}/tracking`,
      {
        trackingNumber,
        carrier,
      }
    );

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(response.error?.message || 'トラッキング情報の更新に失敗しました');
  }

  /**
   * 返金処理
   */
  async refundOrder(
    orderId: string,
    amount: number,
    reason: string
  ): Promise<{ refundId: string; status: string }> {
    const response = await api.post<APIResponse<{ refundId: string; status: string }>>(
      `/orders/${orderId}/refund`,
      {
        amount,
        reason,
      }
    );

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(response.error?.message || '返金処理に失敗しました');
  }

  /**
   * 注文メモ追加
   */
  async addOrderNote(
    orderId: string,
    note: string,
    isPrivate: boolean = true
  ): Promise<Order> {
    const response = await api.post<APIResponse<Order>>(
      `/orders/${orderId}/notes`,
      {
        note,
        isPrivate,
      }
    );

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(response.error?.message || 'メモの追加に失敗しました');
  }

  /**
   * 請求書生成
   */
  async generateInvoice(orderId: string): Promise<Blob> {
    const response = await api.get(`/orders/${orderId}/invoice`, {
      responseType: 'blob',
    });

    return response as unknown as Blob;
  }

  /**
   * 一括ステータス更新
   */
  async bulkUpdateStatus(
    orderIds: string[],
    status: string
  ): Promise<{ updated: number }> {
    const response = await api.post<APIResponse<{ updated: number }>>(
      '/orders/bulk/status',
      {
        orderIds,
        status,
      }
    );

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(response.error?.message || 'ステータスの更新に失敗しました');
  }

  /**
   * 売上統計取得
   */
  async getSalesStats(
    dateRange: { start: Date; end: Date },
    groupBy: 'day' | 'week' | 'month'
  ): Promise<any> {
    const response = await api.get<APIResponse<any>>('/orders/stats/sales', {
      params: {
        start_date: dateRange.start.toISOString(),
        end_date: dateRange.end.toISOString(),
        group_by: groupBy,
      },
    });

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(response.error?.message || '売上統計の取得に失敗しました');
  }
}

export default new OrdersService();