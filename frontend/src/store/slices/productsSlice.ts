/**
 * 商品状態管理スライス
 */
import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { Product, PaginationParams, FilterParams } from '../../types';
import productsService from '../../services/productsService';

interface ProductsState {
  items: Product[];
  selectedProduct: Product | null;
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
  filters: FilterParams;
  loading: boolean;
  error: string | null;
}

const initialState: ProductsState = {
  items: [],
  selectedProduct: null,
  pagination: {
    page: 1,
    perPage: 20,
    total: 0,
    totalPages: 0,
  },
  filters: {},
  loading: false,
  error: null,
};

// 非同期アクション
export const fetchProducts = createAsyncThunk(
  'products/fetchProducts',
  async ({
    pagination,
    filters,
  }: {
    pagination: PaginationParams;
    filters: FilterParams;
  }) => {
    const response = await productsService.getProducts(pagination, filters);
    return response;
  }
);

export const fetchProductById = createAsyncThunk(
  'products/fetchProductById',
  async (id: string) => {
    const response = await productsService.getProductById(id);
    return response;
  }
);

export const updateProduct = createAsyncThunk(
  'products/updateProduct',
  async ({ id, data }: { id: string; data: Partial<Product> }) => {
    const response = await productsService.updateProduct(id, data);
    return response;
  }
);

export const deleteProduct = createAsyncThunk(
  'products/deleteProduct',
  async (id: string) => {
    await productsService.deleteProduct(id);
    return id;
  }
);

export const syncProducts = createAsyncThunk(
  'products/syncProducts',
  async (platform: string) => {
    const response = await productsService.syncProducts(platform);
    return response;
  }
);

const productsSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<FilterParams>) => {
      state.filters = action.payload;
    },
    clearFilters: (state) => {
      state.filters = {};
    },
    setSelectedProduct: (state, action: PayloadAction<Product | null>) => {
      state.selectedProduct = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // 商品一覧取得
      .addCase(fetchProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || '商品の取得に失敗しました';
      })
      // 商品詳細取得
      .addCase(fetchProductById.fulfilled, (state, action) => {
        state.selectedProduct = action.payload;
      })
      // 商品更新
      .addCase(updateProduct.fulfilled, (state, action) => {
        const index = state.items.findIndex(
          (item) => item.id === action.payload.id
        );
        if (index !== -1) {
          state.items[index] = action.payload;
        }
        if (state.selectedProduct?.id === action.payload.id) {
          state.selectedProduct = action.payload;
        }
      })
      // 商品削除
      .addCase(deleteProduct.fulfilled, (state, action) => {
        state.items = state.items.filter((item) => item.id !== action.payload);
        if (state.selectedProduct?.id === action.payload) {
          state.selectedProduct = null;
        }
      })
      // 商品同期
      .addCase(syncProducts.pending, (state) => {
        state.loading = true;
      })
      .addCase(syncProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.items = [...state.items, ...action.payload.items];
      })
      .addCase(syncProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || '商品の同期に失敗しました';
      });
  },
});

export const { setFilters, clearFilters, setSelectedProduct } =
  productsSlice.actions;
export default productsSlice.reducer;