import { useState, useCallback } from 'react';
import { CacheService, CacheSettings } from '../api/cacheService';
import { useAuth } from './useAuth';

interface UseCacheManagementResult {
  settings: CacheSettings | null;
  loading: boolean;
  error: Error | null;
  updateSettings: (newSettings: Partial<CacheSettings>) => Promise<CacheSettings | null>;
  clearCache: (options?: {
    platform?: string;
    endpoint?: string;
    keys?: string[];
    olderThan?: string;
  }) => Promise<{ success: boolean; clearedItems: number } | null>;
  invalidateEndpoint: (endpoint: string) => Promise<{ success: boolean } | null>;
  fetchSettings: () => Promise<void>;
  checkStatus: () => Promise<{
    healthy: boolean;
    connected: boolean;
    version: string;
    uptime: number;
    errors: string[];
  } | null>;
}

/**
 * キャッシュ管理用カスタムフック
 */
export function useCacheManagement(): UseCacheManagementResult {
  const [settings, setSettings] = useState<CacheSettings | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const { user, hasPermission } = useAuth();

  // キャッシュ設定を取得
  const fetchSettings = useCallback(async () => {
    if (!user || !hasPermission('view:cache')) {
      setError(new Error('アクセス権限がありません'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const cacheSettings = await CacheService.getSettings();
      setSettings(cacheSettings);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('キャッシュ設定の取得に失敗しました'));
      console.error('キャッシュ設定取得エラー:', err);
    } finally {
      setLoading(false);
    }
  }, [user, hasPermission]);

  // キャッシュ設定を更新
  const updateSettings = useCallback(async (newSettings: Partial<CacheSettings>): Promise<CacheSettings | null> => {
    if (!user || !hasPermission('manage:cache')) {
      setError(new Error('キャッシュ設定の更新権限がありません'));
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const updatedSettings = await CacheService.updateSettings(newSettings);
      setSettings(updatedSettings);
      return updatedSettings;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'キャッシュ設定の更新に失敗しました';
      setError(new Error(errorMessage));
      console.error('キャッシュ設定更新エラー:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, hasPermission]);

  // キャッシュをクリア
  const clearCache = useCallback(async (options?: {
    platform?: string;
    endpoint?: string;
    keys?: string[];
    olderThan?: string;
  }): Promise<{ success: boolean; clearedItems: number } | null> => {
    if (!user || !hasPermission('manage:cache')) {
      setError(new Error('キャッシュクリアの権限がありません'));
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await CacheService.clearCache(options);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'キャッシュのクリアに失敗しました';
      setError(new Error(errorMessage));
      console.error('キャッシュクリアエラー:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, hasPermission]);

  // 特定のエンドポイントのキャッシュを無効化
  const invalidateEndpoint = useCallback(async (endpoint: string): Promise<{ success: boolean } | null> => {
    if (!user || !hasPermission('manage:cache')) {
      setError(new Error('キャッシュ無効化の権限がありません'));
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await CacheService.invalidateEndpoint(endpoint);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'エンドポイントのキャッシュ無効化に失敗しました';
      setError(new Error(errorMessage));
      console.error('キャッシュ無効化エラー:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, hasPermission]);

  // キャッシュの状態を確認
  const checkStatus = useCallback(async () => {
    if (!user || !hasPermission('view:cache')) {
      setError(new Error('アクセス権限がありません'));
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const status = await CacheService.getStatus();
      return status;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'キャッシュ状態の確認に失敗しました';
      setError(new Error(errorMessage));
      console.error('キャッシュ状態確認エラー:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, hasPermission]);

  return {
    settings,
    loading,
    error,
    updateSettings,
    clearCache,
    invalidateEndpoint,
    fetchSettings,
    checkStatus
  };
}

export default useCacheManagement;