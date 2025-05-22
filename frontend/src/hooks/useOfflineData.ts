import { useState, useEffect, useCallback } from 'react';
import { offlineService } from '../services/offlineService';
import { useConnection } from './useConnection';

/**
 * オフラインデータ管理のためのカスタムフック
 * オフラインモードの設定やデータの管理機能を提供します
 */
export const useOfflineData = () => {
  // オフラインモードの有効/無効状態
  const [isOfflineEnabled, setIsOfflineEnabled] = useState<boolean>(false);
  
  // ストレージ制限（MB単位）
  const [storageLimitMB, setStorageLimitMB] = useState<number>(100);
  
  // 同期間隔（分単位）
  const [syncInterval, setSyncInterval] = useState<number>(15);
  
  // 現在のストレージ使用量（MB単位）
  const [storageUsage, setStorageUsage] = useState<number>(0);
  
  // 保留中のアクション数
  const [pendingActions, setPendingActions] = useState<number>(0);
  
  // 最終同期日時
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  
  // 同期中かどうかのフラグ
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  
  // 接続状態
  const { isOnline } = useConnection();

  // 初期化時に設定を読み込む
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await offlineService.getSettings();
        setIsOfflineEnabled(settings.enabled);
        setStorageLimitMB(settings.storageLimitMB);
        setSyncInterval(settings.syncIntervalMinutes);
        
        // ストレージ使用量を取得
        const usage = await offlineService.getStorageUsage();
        setStorageUsage(usage);
        
        // 保留中のアクション数を取得
        const pending = await offlineService.getPendingActionsCount();
        setPendingActions(pending);
        
        // 最終同期時間を取得
        const lastSync = await offlineService.getLastSyncTime();
        setLastSyncTime(lastSync);
      } catch (error) {
        console.error('オフライン設定の読み込み中にエラーが発生しました', error);
      }
    };
    
    loadSettings();
  }, []);

  // オフラインモードの有効/無効を切り替え
  const setOfflineEnabled = useCallback(async (enabled: boolean) => {
    try {
      await offlineService.setEnabled(enabled);
      setIsOfflineEnabled(enabled);
    } catch (error) {
      console.error('オフラインモードの設定中にエラーが発生しました', error);
      throw error;
    }
  }, []);

  // ストレージ制限を設定
  const handleSetStorageLimitMB = useCallback(async (limitMB: number) => {
    try {
      await offlineService.setStorageLimit(limitMB);
      setStorageLimitMB(limitMB);
    } catch (error) {
      console.error('ストレージ制限の設定中にエラーが発生しました', error);
      throw error;
    }
  }, []);

  // 同期間隔を設定
  const handleSetSyncInterval = useCallback(async (intervalMinutes: number) => {
    try {
      await offlineService.setSyncInterval(intervalMinutes);
      setSyncInterval(intervalMinutes);
    } catch (error) {
      console.error('同期間隔の設定中にエラーが発生しました', error);
      throw error;
    }
  }, []);

  // すべてのオフラインデータを消去
  const clearAllOfflineData = useCallback(async () => {
    try {
      await offlineService.clearAllData();
      setStorageUsage(0);
      setPendingActions(0);
      return true;
    } catch (error) {
      console.error('オフラインデータの消去中にエラーが発生しました', error);
      throw error;
    }
  }, []);

  // 手動同期を実行
  const syncNow = useCallback(async () => {
    if (!isOnline || isSyncing) return false;
    
    try {
      setIsSyncing(true);
      const result = await offlineService.syncAll();
      
      // 同期後に状態を更新
      const pending = await offlineService.getPendingActionsCount();
      setPendingActions(pending);
      
      const lastSync = await offlineService.getLastSyncTime();
      setLastSyncTime(lastSync);
      
      return result;
    } catch (error) {
      console.error('手動同期中にエラーが発生しました', error);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing]);

  // 定期的にストレージ使用量を更新
  useEffect(() => {
    const updateStorageUsage = async () => {
      try {
        const usage = await offlineService.getStorageUsage();
        setStorageUsage(usage);
      } catch (error) {
        console.error('ストレージ使用量の取得中にエラーが発生しました', error);
      }
    };
    
    const interval = setInterval(updateStorageUsage, 60000); // 1分ごとに更新
    return () => clearInterval(interval);
  }, []);

  // オンラインに戻ったときに自動同期
  useEffect(() => {
    if (isOnline && isOfflineEnabled && pendingActions > 0 && !isSyncing) {
      syncNow().catch(console.error);
    }
  }, [isOnline, isOfflineEnabled, pendingActions, isSyncing, syncNow]);

  return {
    isOfflineEnabled,
    setOfflineEnabled,
    storageLimitMB,
    setStorageLimitMB: handleSetStorageLimitMB,
    syncInterval,
    setSyncInterval: handleSetSyncInterval,
    storageUsage,
    pendingActions,
    lastSyncTime,
    isSyncing,
    syncNow,
    clearAllOfflineData
  };
};