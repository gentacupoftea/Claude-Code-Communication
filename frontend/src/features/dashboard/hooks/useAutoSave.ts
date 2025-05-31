import { useCallback, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { Dashboard } from '../types';

interface AutoSaveOptions {
  interval?: number; // 自動保存間隔（ミリ秒）
  enabled?: boolean;
  onSave?: (dashboard: Dashboard) => Promise<void>;
  onError?: (error: Error) => void;
}

export const useAutoSave = ({
  interval = 30000, // デフォルト30秒
  enabled = true,
  onSave,
  onError,
}: AutoSaveOptions = {}) => {
  const currentDashboard = useSelector((state: RootState) => state.dashboard.currentDashboard);
  const isEditing = useSelector((state: RootState) => state.dashboard.isEditing);
  
  const lastSavedRef = useRef<string>('');
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const isAutosavingRef = useRef(false);

  const performAutoSave = useCallback(async () => {
    if (!currentDashboard || !onSave || isAutosavingRef.current) {
      return;
    }

    const currentState = JSON.stringify(currentDashboard);
    
    // 変更がない場合はスキップ
    if (currentState === lastSavedRef.current) {
      return;
    }

    try {
      isAutosavingRef.current = true;
      await onSave(currentDashboard);
      lastSavedRef.current = currentState;
      
      // 成功通知を表示（オプション）
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('autosave-success', {
          detail: { timestamp: new Date() }
        });
        window.dispatchEvent(event);
      }
    } catch (error) {
      console.error('Auto-save failed:', error);
      onError?.(error as Error);
      
      // エラー通知を表示
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('autosave-error', {
          detail: { error: error as Error }
        });
        window.dispatchEvent(event);
      }
    } finally {
      isAutosavingRef.current = false;
    }
  }, [currentDashboard, onSave, onError]);

  const scheduleAutoSave = useCallback(() => {
    if (!enabled || !isEditing) {
      return;
    }

    // 既存のタイマーをクリア
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // 新しいタイマーを設定
    saveTimeoutRef.current = setTimeout(performAutoSave, interval);
  }, [enabled, isEditing, interval, performAutoSave]);

  const saveNow = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    await performAutoSave();
  }, [performAutoSave]);

  const pauseAutoSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
  }, []);

  // ダッシュボードが変更されたときに自動保存をスケジュール
  useEffect(() => {
    if (enabled && isEditing && currentDashboard) {
      scheduleAutoSave();
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [currentDashboard, enabled, isEditing, scheduleAutoSave]);

  // ページを離れる前に保存
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isEditing && currentDashboard) {
        // 同期的に保存を試行
        const currentState = JSON.stringify(currentDashboard);
        if (currentState !== lastSavedRef.current) {
          event.preventDefault();
          event.returnValue = '保存されていない変更があります。ページを離れますか？';
          return event.returnValue;
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && isEditing && currentDashboard) {
        // バックグラウンドに移行するときに保存
        saveNow();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isEditing, currentDashboard, saveNow]);

  return {
    saveNow,
    pauseAutoSave,
    isAutosaving: isAutosavingRef.current,
  };
};