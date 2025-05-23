/**
 * 商品関連サービス
 */
import api from './api';
import { Product, PaginationParams, FilterParams, APIResponse } from '@/types';

const isMockMode = process.env.REACT_APP_USE_MOCK_AUTH === 'true';

// Mock products data - empty when in mock mode
const mockProducts: any[] = [];

// Generate total count for pagination
const mockTotalProducts = 0;

interface ProductsResponse {
  products: Product[];
  meta: {
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
    if (isMockMode) {
      // Return empty data in mock mode
      return {
        products: [],
        meta: {
          page: pagination.page,
          perPage: pagination.perPage,
          total: 0,
          totalPages: 0,
        },
      };
    }

    // Real API call
    const params = new URLSearchParams();
    params.append('page', pagination.page.toString());
    params.append('per_page', pagination.perPage.toString());
    
    if (pagination.sortBy) {
      params.append('sort_by', pagination.sortBy);
      params.append('sort_order', pagination.sortOrder || 'asc');
    }
    
    if (filters.search) {
      params.append('search', filters.search);
    }
    
    if (filters.platforms?.length) {
      params.append('platforms', filters.platforms.join(','));
    }
    
    if (filters.status?.length) {
      params.append('status', filters.status.join(','));
    }

    const response = await api.get<APIResponse<ProductsResponse>>(
      `/products?${params.toString()}`
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || '商品一覧の取得に失敗しました');
  }

  /**
   * 商品詳細取得
   */
  async getProduct(id: string): Promise<Product> {
    if (isMockMode) {
      throw new Error('商品が見つかりません');
    }

    const response = await api.get<APIResponse<Product>>(`/products/${id}`);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || '商品情報の取得に失敗しました');
  }

  /**
   * 商品作成
   */
  async createProduct(product: Partial<Product>): Promise<Product> {
    if (isMockMode) {
      const newProduct = {
        id: '1',
        ...product,
        createdAt: new Date(),
        updatedAt: new Date(),
        syncedAt: new Date(),
      } as Product;
      return newProduct;
    }

    const response = await api.post<APIResponse<Product>>('/products', product);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || '商品の作成に失敗しました');
  }

  /**
   * 商品更新
   */
  async updateProduct(id: string, product: Partial<Product>): Promise<Product> {
    if (isMockMode) {
      throw new Error('商品が見つかりません');
    }

    const response = await api.put<APIResponse<Product>>(
      `/products/${id}`,
      product
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || '商品の更新に失敗しました');
  }

  /**
   * 商品削除
   */
  async deleteProduct(id: string): Promise<void> {
    if (isMockMode) {
      throw new Error('商品が見つかりません');
    }

    const response = await api.delete<APIResponse<void>>(`/products/${id}`);
    
    if (!response.success) {
      throw new Error(response.error?.message || '商品の削除に失敗しました');
    }
  }

  /**
   * 商品一括更新
   */
  async updateProducts(
    ids: string[],
    updates: Partial<Product>
  ): Promise<Product[]> {
    if (isMockMode) {
      return [];
    }

    const response = await api.put<APIResponse<Product[]>>('/products/bulk', {
      ids,
      updates,
    });
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || '商品の一括更新に失敗しました');
  }

  /**
   * 在庫更新
   */
  async updateInventory(
    id: string,
    inventory: number
  ): Promise<Product> {
    if (isMockMode) {
      throw new Error('商品が見つかりません');
    }

    const response = await api.patch<APIResponse<Product>>(
      `/products/${id}/inventory`,
      { inventory }
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || '在庫の更新に失敗しました');
  }

  /**
   * 商品画像アップロード
   */
  async uploadImage(
    productId: string,
    file: File
  ): Promise<{ url: string }> {
    if (isMockMode) {
      // Mock: return a placeholder URL
      return {
        url: 'https://via.placeholder.com/500',
      };
    }

    const formData = new FormData();
    formData.append('image', file);

    const response = await api.post<APIResponse<{ url: string }>>(
      `/products/${productId}/images`,
      formData
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || '画像のアップロードに失敗しました');
  }

  /**
   * 商品インポート
   */
  async importProducts(
    file: File,
    platform: string
  ): Promise<{ imported: number; failed: number; errors: string[] }> {
    if (isMockMode) {
      // Return empty result in mock mode
      return {
        imported: 0,
        failed: 0,
        errors: [],
      };
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('platform', platform);

    const response = await api.post<APIResponse<{
      imported: number;
      failed: number;
      errors: string[];
    }>>('/products/import', formData);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || '商品のインポートに失敗しました');
  }

  /**
   * 商品同期
   */
  async syncProducts(platform: string): Promise<{ synced: number; failed: number; errors: string[] }> {
    if (isMockMode) {
      // Return empty result in mock mode
      return {
        synced: 0,
        failed: 0,
        errors: [],
      };
    }

    const response = await api.post<APIResponse<{
      synced: number;
      failed: number;
      errors: string[];
    }>>(`/products/sync/${platform}`);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || '商品の同期に失敗しました');
  }

  /**
   * 商品エクスポート
   */
  async exportProducts(
    filters: FilterParams,
    format: 'csv' | 'excel' = 'csv'
  ): Promise<Blob> {
    if (isMockMode) {
      // Return empty CSV in mock mode
      const csvContent = 'id,title,sku,price,inventory\n';
      return new Blob([csvContent], { type: 'text/csv' });
    }

    const params = new URLSearchParams();
    params.append('format', format);
    
    if (filters.platforms?.length) {
      params.append('platforms', filters.platforms.join(','));
    }
    
    if (filters.status?.length) {
      params.append('status', filters.status.join(','));
    }

    const response = await api.get<Blob>(
      `/products/export?${params.toString()}`,
      { responseType: 'blob' }
    );
    
    return response;
  }
}

export default new ProductsService();