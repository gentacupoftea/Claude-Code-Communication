/**
 * 通知システム用カスタムフック
 * トースト通知とスナックバー管理
 */
import { useState, useCallback, useRef } from 'react';

export interface NotificationAction {
  label: string;
  onClick: () => void;
  variant?: 'text' | 'outlined' | 'contained';
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  duration?: number; // 0 for permanent
  actions?: NotificationAction[];
  dismissible?: boolean;
  component?: string;
  timestamp: number;
}

export interface UseNotificationReturn {
  notifications: Notification[];
  showNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => string;
  dismissNotification: (id: string) => void;
  clearAll: () => void;
  getNotificationCount: () => number;
}

const MAX_NOTIFICATIONS = 5;
const DEFAULT_DURATION = 4000;

export function useNotification(): UseNotificationReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  /**
   * 通知を表示
   */
  const showNotification = useCallback((
    notificationData: Omit<Notification, 'id' | 'timestamp'>
  ): string => {
    const id = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const timestamp = Date.now();
    
    const notification: Notification = {
      id,
      timestamp,
      duration: DEFAULT_DURATION,
      dismissible: true,
      ...notificationData
    };

    setNotifications(prev => {
      // 最大表示数を超える場合は古いものを削除
      const filtered = prev.slice(-(MAX_NOTIFICATIONS - 1));
      return [...filtered, notification];
    });

    // 自動削除タイマー設定
    if (notification.duration && notification.duration > 0) {
      const timeoutId = setTimeout(() => {
        dismissNotification(id);
      }, notification.duration);
      
      timeoutRefs.current.set(id, timeoutId);
    }

    return id;
  }, []);

  /**
   * 通知を削除
   */
  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    
    // タイマーをクリア
    const timeoutId = timeoutRefs.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutRefs.current.delete(id);
    }
  }, []);

  /**
   * すべての通知をクリア
   */
  const clearAll = useCallback(() => {
    setNotifications([]);
    
    // すべてのタイマーをクリア
    timeoutRefs.current.forEach(timeoutId => clearTimeout(timeoutId));
    timeoutRefs.current.clear();
  }, []);

  /**
   * 通知数を取得
   */
  const getNotificationCount = useCallback(() => {
    return notifications.length;
  }, [notifications.length]);

  return {
    notifications,
    showNotification,
    dismissNotification,
    clearAll,
    getNotificationCount
  };
}

export default useNotification;