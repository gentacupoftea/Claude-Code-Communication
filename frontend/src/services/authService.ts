/**
 * 認証関連サービス
 */
import api from './api';
import { User, APIResponse } from '@/types';

interface LoginResponse {
  user: User;
  token: string;
  refreshToken: string;
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
    const response = await api.post<APIResponse<LoginResponse>>('/auth/login', {
      email,
      password,
    });
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || 'ログインに失敗しました');
  }

  /**
   * ユーザー登録
   */
  async register(data: RegisterRequest): Promise<LoginResponse> {
    const response = await api.post<APIResponse<LoginResponse>>('/auth/register', data);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || '登録に失敗しました');
  }

  /**
   * ログアウト
   */
  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      // ログアウトエラーは無視
      console.error('Logout error:', error);
    }
  }

  /**
   * 現在のユーザー情報取得
   */
  async getCurrentUser(): Promise<User> {
    const response = await api.get<APIResponse<User>>('/auth/me');
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || 'ユーザー情報の取得に失敗しました');
  }

  /**
   * パスワードリセット
   */
  async resetPassword(email: string): Promise<void> {
    const response = await api.post<APIResponse<void>>('/auth/reset-password', {
      email,
    });
    
    if (!response.success) {
      throw new Error(response.error?.message || 'パスワードリセットに失敗しました');
    }
  }

  /**
   * パスワード変更
   */
  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const response = await api.post<APIResponse<void>>('/auth/change-password', {
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
    const response = await api.post<APIResponse<LoginResponse>>('/auth/refresh', {
      refreshToken,
    });
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || 'トークンの更新に失敗しました');
  }

  /**
   * メール確認
   */
  async verifyEmail(token: string): Promise<void> {
    const response = await api.post<APIResponse<void>>('/auth/verify-email', {
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
      '/auth/2fa/setup'
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
    const response = await api.post<APIResponse<void>>('/auth/2fa/verify', {
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
    const response = await api.post<APIResponse<void>>('/auth/2fa/disable', {
      password,
    });
    
    if (!response.success) {
      throw new Error(response.error?.message || '2FA無効化に失敗しました');
    }
  }
}

export default new AuthService();