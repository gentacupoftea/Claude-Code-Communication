/**
 * チャネル接続操作のフック
 */
import { useState, useCallback } from 'react';
import channelService, { 
  Channel, 
  ConnectChannelParams,
  OAuthRedirectParams,
  ChannelSettings
} from '../api/channelService';

interface UseChannelConnectionResult {
  connecting: boolean;
  testing: boolean;
  syncing: boolean;
  error: Error | null;
  connectChannel: (params: ConnectChannelParams) => Promise<Channel>;
  updateChannelSettings: (id: string, settings: Partial<ChannelSettings>) => Promise<Channel>;
  testConnection: (id: string) => Promise<{ success: boolean; message?: string }>;
  deleteChannel: (id: string) => Promise<void>;
  toggleChannelStatus: (id: string, isActive: boolean) => Promise<Channel>;
  syncChannel: (id: string, options?: { 
    syncProducts?: boolean;
    syncOrders?: boolean;
    syncInventory?: boolean;
    syncCustomers?: boolean;
  }) => Promise<{ jobId: string }>;
  getOAuthUrl: (params: OAuthRedirectParams) => Promise<string>;
  clearError: () => void;
}

export const useChannelConnection = (): UseChannelConnectionResult => {
  const [connecting, setConnecting] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // チャネル接続（APIキー認証）
  const connectChannel = useCallback(async (params: ConnectChannelParams): Promise<Channel> => {
    setConnecting(true);
    setError(null);
    
    try {
      const result = await channelService.connectChannel(params);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'チャネル接続に失敗しました';
      setError(new Error(errorMessage));
      throw err;
    } finally {
      setConnecting(false);
    }
  }, []);

  // チャネル設定更新
  const updateChannelSettings = useCallback(async (
    id: string,
    settings: Partial<ChannelSettings>
  ): Promise<Channel> => {
    setError(null);
    
    try {
      return await channelService.updateChannelSettings(id, settings);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '設定の更新に失敗しました';
      setError(new Error(errorMessage));
      throw err;
    }
  }, []);

  // 接続テスト
  const testConnection = useCallback(async (
    id: string
  ): Promise<{ success: boolean; message?: string }> => {
    setTesting(true);
    setError(null);
    
    try {
      const result = await channelService.testConnection(id);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '接続テストに失敗しました';
      setError(new Error(errorMessage));
      throw err;
    } finally {
      setTesting(false);
    }
  }, []);

  // チャネル削除
  const deleteChannel = useCallback(async (id: string): Promise<void> => {
    setError(null);
    
    try {
      await channelService.deleteChannel(id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'チャネル削除に失敗しました';
      setError(new Error(errorMessage));
      throw err;
    }
  }, []);

  // チャネル有効/無効切り替え
  const toggleChannelStatus = useCallback(async (
    id: string,
    isActive: boolean
  ): Promise<Channel> => {
    setError(null);
    
    try {
      return await channelService.toggleChannelStatus(id, isActive);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'ステータス変更に失敗しました';
      setError(new Error(errorMessage));
      throw err;
    }
  }, []);

  // 手動同期実行
  const syncChannel = useCallback(async (
    id: string,
    options?: { 
      syncProducts?: boolean;
      syncOrders?: boolean;
      syncInventory?: boolean;
      syncCustomers?: boolean;
    }
  ): Promise<{ jobId: string }> => {
    setSyncing(true);
    setError(null);
    
    try {
      const result = await channelService.syncChannel(id, options);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '同期の開始に失敗しました';
      setError(new Error(errorMessage));
      throw err;
    } finally {
      setSyncing(false);
    }
  }, []);

  // OAuth認証URL取得
  const getOAuthUrl = useCallback(async (params: OAuthRedirectParams): Promise<string> => {
    setError(null);
    
    try {
      const { authUrl } = await channelService.getOAuthUrl(params);
      return authUrl;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'OAuth URL取得に失敗しました';
      setError(new Error(errorMessage));
      throw err;
    }
  }, []);

  // エラークリア
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    connecting,
    testing,
    syncing,
    error,
    connectChannel,
    updateChannelSettings,
    testConnection,
    deleteChannel,
    toggleChannelStatus,
    syncChannel,
    getOAuthUrl,
    clearError
  };
};

/**
 * OAuth認証コールバック処理のフック
 */
export const useOAuthCallback = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const handleOAuthCallback = useCallback(async (
    code: string,
    state: string
  ): Promise<Channel> => {
    setLoading(true);
    setError(null);
    
    try {
      const channel = await channelService.handleOAuthCallback(code, state);
      return channel;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'OAuth認証に失敗しました';
      setError(new Error(errorMessage));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    handleOAuthCallback
  };
};