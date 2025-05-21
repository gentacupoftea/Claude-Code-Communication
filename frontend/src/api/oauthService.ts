/**
 * OAuth関連のAPIサービス
 */
import api from '../services/api';
import { AuthTokens, User } from '../types/auth';
import { APIResponse } from '../types';

export interface OAuthProvider {
  id: string;
  name: string;
  type: 'shopify' | 'google' | 'rakuten' | 'amazon' | 'microsoft';
  icon: string;
  isEnabled: boolean;
  scopes?: string[];
}

export interface OAuthCredentials {
  code: string;
  state?: string;
  provider: string;
  redirectUri: string;
}

export interface OAuthLoginResponse {
  user: User;
  tokens: AuthTokens;
}

class OAuthService {
  /**
   * 利用可能なOAuthプロバイダーを取得
   */
  async getProviders(): Promise<OAuthProvider[]> {
    const response = await api.get<APIResponse<OAuthProvider[]>>('/api/v1/auth/oauth/providers');
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || 'OAuthプロバイダー取得に失敗しました');
  }

  /**
   * OAuth認証URL取得
   */
  async getAuthorizationUrl(provider: string, redirectUri: string, state?: string): Promise<string> {
    const response = await api.post<APIResponse<{ url: string }>>('/api/v1/auth/oauth/url', {
      provider,
      redirectUri,
      state,
    });
    
    if (response.success && response.data) {
      return response.data.url;
    }
    
    throw new Error(response.error?.message || '認証URL取得に失敗しました');
  }

  /**
   * OAuthコールバック処理（ログイン/登録）
   */
  async authenticate(credentials: OAuthCredentials): Promise<OAuthLoginResponse> {
    const response = await api.post<APIResponse<OAuthLoginResponse>>('/api/v1/auth/oauth/callback', credentials);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || 'OAuth認証に失敗しました');
  }

  /**
   * ユーザーアカウントにOAuthプロバイダーを接続
   */
  async connectProvider(credentials: OAuthCredentials): Promise<User> {
    const response = await api.post<APIResponse<User>>('/api/v1/auth/oauth/connect', credentials);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || 'プロバイダー接続に失敗しました');
  }

  /**
   * ユーザーアカウントからOAuthプロバイダーを切断
   */
  async disconnectProvider(provider: string): Promise<User> {
    const response = await api.post<APIResponse<User>>('/api/v1/auth/oauth/disconnect', {
      provider,
    });
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || 'プロバイダー切断に失敗しました');
  }

  /**
   * ユーザーの接続済みOAuthプロバイダーを取得
   */
  async getConnectedProviders(): Promise<{
    provider: string;
    connected_at: string;
    expires_at?: string;
  }[]> {
    const response = await api.get<APIResponse<{
      provider: string;
      connected_at: string;
      expires_at?: string;
    }[]>>('/api/v1/auth/oauth/connected');
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || '接続プロバイダー取得に失敗しました');
  }
}

export default new OAuthService();