/**
 * 認証状態管理スライス
 */
import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { User } from '../../types';
import authService from '../../services/authService';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: false,
  loading: false,
  error: null,
};

// 非同期アクション
export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }: { email: string; password: string }) => {
    const response = await authService.login(email, password);
    // Store tokens in localStorage
    if (response.access_token) {
      localStorage.setItem('auth_access_token', response.access_token);
      localStorage.setItem('auth_refresh_token', response.refresh_token);
      localStorage.setItem('auth_token_type', response.token_type || 'Bearer');
    }
    return response;
  }
);

export const logout = createAsyncThunk('auth/logout', async () => {
  await authService.logout();
  localStorage.removeItem('auth_access_token');
  localStorage.removeItem('auth_refresh_token');
  localStorage.removeItem('auth_token_type');
  localStorage.removeItem('auth_user');
});

export const fetchCurrentUser = createAsyncThunk(
  'auth/fetchCurrentUser',
  async () => {
    const response = await authService.getCurrentUser();
    return response;
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // ログイン
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.token = action.payload.access_token;
        // The user data comes from a separate API call after login
        // For now, we'll set basic user info from the login response if available
        if (action.payload.user) {
          state.user = action.payload.user;
        }
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'ログインに失敗しました';
      })
      // ログアウト
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
      })
      // 現在のユーザー取得
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        const apiUser = action.payload as any;
        state.user = {
          id: apiUser.id,
          email: apiUser.email,
          full_name: apiUser.full_name || apiUser.name || apiUser.email,
          is_active: apiUser.is_active !== undefined ? apiUser.is_active : true,
          is_superuser: apiUser.is_superuser || false,
          created_at: apiUser.created_at || new Date().toISOString(),
          last_login: apiUser.last_login,
          role: apiUser.is_superuser ? 'admin' as const : 'user' as const,
          language: 'ja' as const,
          theme: 'light' as const,
          permissions: apiUser.permissions || []
        };
        state.isAuthenticated = true;
      })
      .addCase(fetchCurrentUser.rejected, (state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.token = null;
        localStorage.removeItem('token');
      });
  },
});

export const { setUser, clearError } = authSlice.actions;
export default authSlice.reducer;