/**
 * 商品関連サービス
 */
import api from './api';
import { Product, PaginationParams, FilterParams, APIResponse } from '@/types';

interface ProductsResponse {
  items: Product[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

class ProductsService {
  /**
   * 商品一覧取得
   */
  async getProducts(
    pagination: PaginationParams,
    filters: FilterParams
  ): Promise<ProductsResponse> {
    const params = {
      page: pagination.page,
      per_page: pagination.perPage,
      sort_by: pagination.sortBy,
      sort_order: pagination.sortOrder,
      ...filters,
    };

    const response = await api.get<APIResponse<ProductsResponse>>('/products', {
      params,
    });

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(response.error?.message || '商品の取得に失敗しました');
  }

  /**
   * 商品詳細取得
   */
  async getProductById(id: string): Promise<Product> {
    const response = await api.get<APIResponse<Product>>(`/products/${id}`);

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(response.error?.message || '商品の取得に失敗しました');
  }

  /**
   * 商品作成
   */
  async createProduct(data: Partial<Product>): Promise<Product> {
    const response = await api.post<APIResponse<Product>>('/products', data);

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(response.error?.message || '商品の作成に失敗しました');
  }

  /**
   * 商品更新
   */
  async updateProduct(id: string, data: Partial<Product>): Promise<Product> {
    const response = await api.put<APIResponse<Product>>(`/products/${id}`, data);

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(response.error?.message || '商品の更新に失敗しました');
  }

  /**
   * 商品削除
   */
  async deleteProduct(id: string): Promise<void> {
    const response = await api.delete<APIResponse<void>>(`/products/${id}`);

    if (!response.success) {
      throw new Error(response.error?.message || '商品の削除に失敗しました');
    }
  }

  /**
   * 商品同期
   */
  async syncProducts(platform: string): Promise<ProductsResponse> {
    const response = await api.post<APIResponse<ProductsResponse>>(
      `/products/sync/${platform}`
    );

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(response.error?.message || '商品の同期に失敗しました');
  }

  /**
   * 商品エクスポート
   */
  async exportProducts(format: 'csv' | 'excel', filters?: FilterParams): Promise<Blob> {
    const response = await api.get('/products/export', {
      params: {
        format,
        ...filters,
      },
      responseType: 'blob',
    });

    return response as unknown as Blob;
  }

  /**
   * 商品インポート
   */
  async importProducts(file: File, platform: string): Promise<{ imported: number; errors: any[] }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('platform', platform);

    const response = await api.post<APIResponse<{ imported: number; errors: any[] }>>(
      '/products/import',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(response.error?.message || '商品のインポートに失敗しました');
  }

  /**
   * 商品画像アップロード
   */
  async uploadImage(productId: string, file: File): Promise<string> {
    const formData = new FormData();
    formData.append('image', file);

    const response = await api.post<APIResponse<{ url: string }>>(
      `/products/${productId}/images`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    if (response.success && response.data) {
      return response.data.url;
    }

    throw new Error(response.error?.message || '画像のアップロードに失敗しました');
  }

  /**
   * 商品画像削除
   */
  async deleteImage(productId: string, imageUrl: string): Promise<void> {
    const response = await api.delete<APIResponse<void>>(
      `/products/${productId}/images`,
      {
        data: { imageUrl },
      }
    );

    if (!response.success) {
      throw new Error(response.error?.message || '画像の削除に失敗しました');
    }
  }

  /**
   * 在庫更新
   */
  async updateInventory(
    productId: string,
    inventory: number
  ): Promise<Product> {
    const response = await api.patch<APIResponse<Product>>(
      `/products/${productId}/inventory`,
      { inventory }
    );

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(response.error?.message || '在庫の更新に失敗しました');
  }

  /**
   * 一括ステータス更新
   */
  async bulkUpdateStatus(
    productIds: string[],
    status: 'active' | 'draft' | 'archived'
  ): Promise<{ updated: number }> {
    const response = await api.post<APIResponse<{ updated: number }>>(
      '/products/bulk/status',
      {
        productIds,
        status,
      }
    );

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(response.error?.message || 'ステータスの更新に失敗しました');
  }
}

export default new ProductsService();