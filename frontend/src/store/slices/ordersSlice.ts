/**
 * 注文状態管理スライス
 */
import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { Order, PaginationParams, FilterParams } from '../../types';
import ordersService from '../../services/ordersService';

interface OrdersState {
  items: Order[];
  selectedOrder: Order | null;
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

const initialState: OrdersState = {
  items: [],
  selectedOrder: null,
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
export const fetchOrders = createAsyncThunk(
  'orders/fetchOrders',
  async ({
    pagination,
    filters,
  }: {
    pagination: PaginationParams;
    filters: FilterParams;
  }) => {
    const response = await ordersService.getOrders(pagination, filters);
    return response;
  }
);

export const fetchOrderById = createAsyncThunk(
  'orders/fetchOrderById',
  async (id: string) => {
    const response = await ordersService.getOrderById(id);
    return response;
  }
);

export const updateOrderStatus = createAsyncThunk(
  'orders/updateOrderStatus',
  async ({ id, status }: { id: string; status: string }) => {
    const response = await ordersService.updateOrderStatus(id, status);
    return response;
  }
);

export const syncOrders = createAsyncThunk(
  'orders/syncOrders',
  async (platform: string) => {
    const response = await ordersService.syncOrders(platform);
    return response;
  }
);

const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<FilterParams>) => {
      state.filters = action.payload;
    },
    clearFilters: (state) => {
      state.filters = {};
    },
    setSelectedOrder: (state, action: PayloadAction<Order | null>) => {
      state.selectedOrder = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // 注文一覧取得
      .addCase(fetchOrders.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchOrders.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchOrders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || '注文の取得に失敗しました';
      })
      // 注文詳細取得
      .addCase(fetchOrderById.fulfilled, (state, action) => {
        state.selectedOrder = action.payload;
      })
      // 注文ステータス更新
      .addCase(updateOrderStatus.fulfilled, (state, action) => {
        const index = state.items.findIndex(
          (item) => item.id === action.payload.id
        );
        if (index !== -1) {
          state.items[index] = action.payload;
        }
        if (state.selectedOrder?.id === action.payload.id) {
          state.selectedOrder = action.payload;
        }
      })
      // 注文同期
      .addCase(syncOrders.pending, (state) => {
        state.loading = true;
      })
      .addCase(syncOrders.fulfilled, (state, action) => {
        state.loading = false;
        state.items = [...state.items, ...action.payload.items];
      })
      .addCase(syncOrders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || '注文の同期に失敗しました';
      });
  },
});

export const { setFilters, clearFilters, setSelectedOrder } =
  ordersSlice.actions;
export default ordersSlice.reducer;