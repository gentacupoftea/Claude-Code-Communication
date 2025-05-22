/**
 * チャネル接続・設定管理APIサービス
 */
import api from '../services/api';
import { APIResponse } from '../types';

export interface Channel {
  id: string;
  name: string;
  type: 'shopify' | 'rakuten' | 'amazon' | 'google';
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastSyncAt?: string;
  credentials?: Record<string, any>;
  settings?: ChannelSettings;
  connectionError?: string;
}

export interface ChannelSettings {
  syncFrequency: number; // minutes
  syncEnabled: boolean;
  productSync: boolean;
  orderSync: boolean;
  inventorySync: boolean;
  customerSync: boolean;
  analyticsEnabled: boolean;
  webhooksEnabled: boolean;
  customFields?: Record<string, any>;
}

export interface ChannelCredentials {
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  storeUrl?: string;
  shopId?: string;
  applicationId?: string;
  serviceAccountKey?: string;
  // 他のチャネル固有の認証情報
  [key: string]: any;
}

export interface OAuthRedirectParams {
  channelType: 'shopify' | 'rakuten' | 'amazon' | 'google';
  redirectUri: string;
  state?: string;
  scopes?: string[];
}

export interface ConnectChannelParams {
  type: 'shopify' | 'rakuten' | 'amazon' | 'google';
  name: string;
  credentials: ChannelCredentials;
  settings?: Partial<ChannelSettings>;
}

class ChannelService {
  /**
   * チャネル一覧を取得
   */
  async getChannels(): Promise<Channel[]> {
    const response = await api.get<APIResponse<Channel[]>>('/api/v1/channels');
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || 'チャネル一覧の取得に失敗しました');
  }

  /**
   * チャネル詳細を取得
   */
  async getChannel(id: string): Promise<Channel> {
    const response = await api.get<APIResponse<Channel>>(`/api/v1/channels/${id}`);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || 'チャネル情報の取得に失敗しました');
  }

  /**
   * 新しいチャネルを接続（APIキー認証）
   */
  async connectChannel(params: ConnectChannelParams): Promise<Channel> {
    const response = await api.post<APIResponse<Channel>>('/api/v1/channels', params);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || 'チャネル接続に失敗しました');
  }

  /**
   * OAuth認証URL取得
   */
  async getOAuthUrl(params: OAuthRedirectParams): Promise<{ authUrl: string }> {
    const response = await api.post<APIResponse<{ authUrl: string }>>('/api/v1/channels/oauth/url', params);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || 'OAuth URL取得に失敗しました');
  }

  /**
   * OAuthコールバック処理
   */
  async handleOAuthCallback(code: string, state: string): Promise<Channel> {
    const response = await api.post<APIResponse<Channel>>('/api/v1/channels/oauth/callback', {
      code,
      state
    });
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || 'OAuth認証に失敗しました');
  }

  /**
   * チャネル設定更新
   */
  async updateChannelSettings(id: string, settings: Partial<ChannelSettings>): Promise<Channel> {
    const response = await api.patch<APIResponse<Channel>>(`/api/v1/channels/${id}/settings`, settings);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || 'チャネル設定の更新に失敗しました');
  }

  /**
   * チャネル認証情報更新
   */
  async updateChannelCredentials(id: string, credentials: Partial<ChannelCredentials>): Promise<Channel> {
    const response = await api.patch<APIResponse<Channel>>(`/api/v1/channels/${id}/credentials`, credentials);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || '認証情報の更新に失敗しました');
  }

  /**
   * チャネル接続テスト
   */
  async testConnection(id: string): Promise<{ success: boolean; message?: string }> {
    const response = await api.post<APIResponse<{ success: boolean; message?: string }>>(`/api/v1/channels/${id}/test`);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || '接続テストに失敗しました');
  }

  /**
   * チャネル無効化/有効化
   */
  async toggleChannelStatus(id: string, isActive: boolean): Promise<Channel> {
    const response = await api.patch<APIResponse<Channel>>(`/api/v1/channels/${id}/status`, {
      isActive
    });
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || 'ステータス変更に失敗しました');
  }

  /**
   * チャネル削除
   */
  async deleteChannel(id: string): Promise<void> {
    const response = await api.delete<APIResponse<void>>(`/api/v1/channels/${id}`);
    
    if (!response.success) {
      throw new Error(response.error?.message || 'チャネル削除に失敗しました');
    }
  }

  /**
   * 手動同期実行
   */
  async syncChannel(id: string, options?: { 
    syncProducts?: boolean;
    syncOrders?: boolean;
    syncInventory?: boolean;
    syncCustomers?: boolean;
  }): Promise<{ jobId: string }> {
    const response = await api.post<APIResponse<{ jobId: string }>>(`/api/v1/channels/${id}/sync`, options);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || '同期の開始に失敗しました');
  }

  /**
   * 同期ジョブのステータス確認
   */
  async getSyncStatus(jobId: string): Promise<{
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress: number;
    message?: string;
    error?: string;
    result?: Record<string, any>;
  }> {
    const response = await api.get<APIResponse<{
      status: 'pending' | 'running' | 'completed' | 'failed';
      progress: number;
      message?: string;
      error?: string;
      result?: Record<string, any>;
    }>>(`/api/v1/sync/jobs/${jobId}`);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || '同期ステータスの取得に失敗しました');
  }
}

export default new ChannelService();