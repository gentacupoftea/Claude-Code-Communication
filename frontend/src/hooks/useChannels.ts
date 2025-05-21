/**
 * チャネル一覧と状態を取得するフック
 */
import { useState, useEffect, useCallback } from 'react';
import channelService, { Channel } from '../api/channelService';
import { useAuth } from '../contexts/AuthContext';

interface UseChannelsResult {
  channels: Channel[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  getChannelById: (id: string) => Channel | undefined;
}

export const useChannels = (): UseChannelsResult => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const { isAuthenticated } = useAuth();

  const fetchChannels = useCallback(async () => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await channelService.getChannels();
      setChannels(data);
    } catch (err) {
      console.error('Failed to fetch channels:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch channels'));
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // 初回とisAuthenticatedの変更時にチャネル一覧を取得
  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // ID指定でチャネルを取得
  const getChannelById = useCallback(
    (id: string) => channels.find(channel => channel.id === id),
    [channels]
  );

  return {
    channels,
    loading,
    error,
    refetch: fetchChannels,
    getChannelById
  };
};

/**
 * 特定のチャネルタイプのみを取得するフック
 */
export const useChannelsByType = (
  type: 'shopify' | 'rakuten' | 'amazon' | 'google'
): Omit<UseChannelsResult, 'channels'> & { channels: Channel[] } => {
  const { channels, loading, error, refetch, getChannelById } = useChannels();
  
  // 指定タイプのチャネルのみをフィルタリング
  const filteredChannels = channels.filter(channel => channel.type === type);

  return {
    channels: filteredChannels,
    loading,
    error,
    refetch,
    getChannelById
  };
};

/**
 * アクティブな(接続済み)チャネルのみを取得するフック
 */
export const useActiveChannels = (): Omit<UseChannelsResult, 'channels'> & { channels: Channel[] } => {
  const { channels, loading, error, refetch, getChannelById } = useChannels();
  
  // アクティブチャネルのみをフィルタリング
  const activeChannels = channels.filter(
    channel => channel.isActive && channel.status === 'connected'
  );

  return {
    channels: activeChannels,
    loading,
    error,
    refetch,
    getChannelById
  };
};