/**
 * 認証関連サービス
 */
import api from './api';
import { User, APIResponse } from '@/types';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

interface LoginResponse extends TokenResponse {
  user?: User;
}

interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

class AuthService {
  /**
   * ログイン
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    // Check if we're in mock mode
    if (process.env.REACT_APP_USE_MOCK_AUTH === 'true') {
      // In mock mode, accept any email/password or use demo credentials
      const mockUser: User = {
        id: '1',
        email: email,
        full_name: email.split('@')[0], // Use email prefix as name
        is_active: true,
        is_superuser: false,
        created_at: new Date().toISOString(),
        role: 'user',
      };
      
      // Store mock user data
      localStorage.setItem('user', JSON.stringify(mockUser));
      
      // Return mock tokens
      const mockTokens = {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'Bearer',
      };
      
      localStorage.setItem('auth_tokens', JSON.stringify({
        access_token: mockTokens.access_token,
        refresh_token: mockTokens.refresh_token,
      }));
      
      return {
        ...mockTokens,
        user: mockUser,
      };
    }
    
    // Backend expects OAuth2PasswordRequestForm format
    const formData = new URLSearchParams();
    formData.append('username', email); // Backend expects 'username' field
    formData.append('password', password);
    
    // Backend returns TokenResponse directly (not wrapped in APIResponse)
    const tokenResponse = await api.post<TokenResponse>('/api/v1/auth/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    
    // Store tokens
    localStorage.setItem('auth_tokens', JSON.stringify({
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token,
    }));
    
    // Get user info from /me endpoint
    const user = await this.getCurrentUser();
    
    // Return TokenResponse with user
    return {
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token,
      token_type: tokenResponse.token_type,
      user,
    };
  }

  /**
   * ユーザー登録
   */
  async register(data: RegisterRequest): Promise<LoginResponse> {
    // Check if we're in mock mode
    if (process.env.REACT_APP_USE_MOCK_AUTH === 'true') {
      // In mock mode, create a mock user and return success
      const mockUser: User = {
        id: '1',
        email: data.email,
        full_name: data.name,
        is_active: true,
        is_superuser: false,
        created_at: new Date().toISOString(),
        role: 'user',
      };
      
      // Store mock user data
      localStorage.setItem('user', JSON.stringify(mockUser));
      
      // Return mock tokens
      const mockTokens = {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'Bearer',
      };
      
      localStorage.setItem('auth_tokens', JSON.stringify({
        access_token: mockTokens.access_token,
        refresh_token: mockTokens.refresh_token,
      }));
      
      return {
        ...mockTokens,
        user: mockUser,
      };
    }
    
    // For real backend - try different endpoint patterns
    try {
      // Try /api/v1/users/register first
      const user = await api.post<User>('/api/v1/users/register', {
        email: data.email,
        password: data.password,
        full_name: data.name,
      });
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Try alternative endpoint /api/v1/users
        const user = await api.post<User>('/api/v1/users', {
          email: data.email,
          password: data.password,
          full_name: data.name,
        });
      } else {
        throw error;
      }
    }
    
    // After registration, login to get tokens
    return this.login(data.email, data.password);
  }

  /**
   * ログアウト
   */
  async logout(): Promise<void> {
    try {
      await api.post('/api/v1/auth/logout');
    } catch (error) {
      // ログアウトエラーは無視
      console.error('Logout error:', error);
    } finally {
      // Clear local tokens
      localStorage.removeItem('auth_tokens');
    }
  }

  /**
   * 現在のユーザー情報取得
   */
  async getCurrentUser(): Promise<User> {
    // Check if we're in mock mode
    if (process.env.REACT_APP_USE_MOCK_AUTH === 'true') {
      // Return mock user from localStorage
      const mockUserStr = localStorage.getItem('user');
      if (mockUserStr) {
        return JSON.parse(mockUserStr);
      }
      // Return default mock user
      return {
        id: '1',
        email: 'demo@conea.ai',
        full_name: 'Demo User',
        is_active: true,
        is_superuser: false,
        created_at: new Date().toISOString(),
        role: 'user',
      };
    }
    
    // Backend returns User directly (not wrapped in APIResponse)
    const user = await api.get<User>('/api/v1/auth/me');
    return user;
  }

  /**
   * パスワードリセット要求
   */
  async forgotPassword(email: string): Promise<void> {
    const response = await api.post<{ message: string; success: boolean }>('/api/v1/auth/forgot-password', {
      email,
    });
    
    if (!response.success) {
      throw new Error('パスワードリセットリクエストに失敗しました');
    }
  }

  /**
   * パスワードリセット実行
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const response = await api.post<{ message: string; success: boolean }>('/api/v1/auth/reset-password', {
      token,
      new_password: newPassword,
    });
    
    if (!response.success) {
      throw new Error('パスワードリセットに失敗しました');
    }
  }

  /**
   * リセットトークン検証
   */
  async verifyResetToken(token: string): Promise<boolean> {
    try {
      const response = await api.get<{ message: string; success: boolean }>(
        `/api/v1/auth/verify-reset-token?token=${encodeURIComponent(token)}`
      );
      return response.success;
    } catch (error) {
      return false;
    }
  }

  /**
   * パスワード変更
   */
  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const response = await api.post<APIResponse<void>>('/api/v1/auth/change-password', {
      currentPassword,
      newPassword,
    });
    
    if (!response.success) {
      throw new Error(response.error?.message || 'パスワード変更に失敗しました');
    }
  }

  /**
   * トークンリフレッシュ
   */
  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    // Backend returns TokenResponse directly
    const tokenResponse = await api.post<TokenResponse>('/api/v1/auth/refresh', {
      refresh_token: refreshToken,
    });
    
    // Store new tokens
    localStorage.setItem('auth_tokens', JSON.stringify({
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token,
    }));
    
    // Get user info
    const user = await this.getCurrentUser();
    
    return {
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token,
      token_type: tokenResponse.token_type,
      user,
    };
  }

  /**
   * メール確認
   */
  async verifyEmail(token: string): Promise<void> {
    const response = await api.post<APIResponse<void>>('/api/v1/auth/verify-email', {
      token,
    });
    
    if (!response.success) {
      throw new Error(response.error?.message || 'メール確認に失敗しました');
    }
  }

  /**
   * 2FA設定
   */
  async setupTwoFactor(): Promise<{ qrCode: string; secret: string }> {
    const response = await api.post<APIResponse<{ qrCode: string; secret: string }>>(
      '/api/v1/auth/2fa/setup'
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || '2FA設定に失敗しました');
  }

  /**
   * 2FA確認
   */
  async verifyTwoFactor(code: string): Promise<void> {
    const response = await api.post<APIResponse<void>>('/api/v1/auth/2fa/verify', {
      code,
    });
    
    if (!response.success) {
      throw new Error(response.error?.message || '2FA確認に失敗しました');
    }
  }

  /**
   * 2FA無効化
   */
  async disableTwoFactor(password: string): Promise<void> {
    const response = await api.post<APIResponse<void>>('/api/v1/auth/2fa/disable', {
      password,
    });
    
    if (!response.success) {
      throw new Error(response.error?.message || '2FA無効化に失敗しました');
    }
  }
}

export default new AuthService();