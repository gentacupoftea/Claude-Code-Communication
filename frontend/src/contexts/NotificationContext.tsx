/**
 * 通知コンテキスト
 * 
 * アプリケーション全体で通知の状態を管理し、
 * 通知サービスとの連携を行います。
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  Notification, 
  NotificationFilters, 
  NotificationSettings,
  CreateNotificationParams,
} from '../types/notification';
import { notificationService } from '../services/notificationService';

// コンテキストの型定義
interface NotificationContextType {
  // 通知データ
  notifications: Notification[];
  unreadCount: number;
  
  // 通知の操作メソッド
  addNotification: (notification: CreateNotificationParams) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  deleteNotifications: (ids: string[]) => void;
  clearAllNotifications: () => void;
  
  // フィルタリング
  filters: NotificationFilters;
  setFilters: (filters: NotificationFilters) => void;
  
  // 設定関連
  settings: NotificationSettings;
  updateSettings: (settings: NotificationSettings) => void;
  requestNotificationPermission: () => Promise<NotificationPermission>;
  
  // テスト用
  createTestNotification: (type?: Notification['type']) => void;
}

// コンテキストの作成
export const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// プロバイダーコンポーネント
export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 状態の初期化
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filters, setFilters] = useState<NotificationFilters>({});
  const [settings, setSettings] = useState<NotificationSettings>(
    notificationService.getNotificationSettings()
  );

  // 初期データの読み込み
  useEffect(() => {
    const loadInitialData = () => {
      const loadedNotifications = notificationService.getNotifications(filters);
      setNotifications(loadedNotifications);
      setUnreadCount(notificationService.getUnreadCount());
    };

    loadInitialData();
    
    // 通知サービスのイベントを購読
    const unsubscribe = notificationService.subscribe((eventType, payload) => {
      switch (eventType) {
        case 'create':
          loadInitialData();
          break;
        case 'update':
        case 'markAsRead':
        case 'markAllAsRead':
          loadInitialData();
          break;
        case 'delete':
          loadInitialData();
          break;
      }
    });
    
    // クリーンアップ時に購読解除
    return () => {
      unsubscribe();
    };
  }, [filters]);

  // フィルターが変更されたら通知を再読み込み
  useEffect(() => {
    const loadedNotifications = notificationService.getNotifications(filters);
    setNotifications(loadedNotifications);
  }, [filters]);

  // 通知の追加
  const addNotification = (notification: CreateNotificationParams) => {
    notificationService.addNotification(notification);
  };

  // 通知を既読にする
  const markAsRead = (id: string) => {
    notificationService.markAsRead(id);
  };

  // すべての通知を既読にする
  const markAllAsRead = () => {
    notificationService.markAllAsRead();
  };

  // 通知の削除
  const deleteNotification = (id: string) => {
    notificationService.deleteNotification(id);
  };

  // 複数通知の削除
  const deleteNotifications = (ids: string[]) => {
    notificationService.deleteNotifications(ids);
  };

  // すべての通知をクリア
  const clearAllNotifications = () => {
    notificationService.clearAllNotifications();
  };

  // 通知設定の更新
  const updateSettings = (newSettings: NotificationSettings) => {
    notificationService.saveNotificationSettings(newSettings);
    setSettings(newSettings);
  };

  // 通知権限のリクエスト
  const requestNotificationPermission = async () => {
    return notificationService.requestNotificationPermission();
  };

  // テスト通知の作成
  const createTestNotification = (type?: Notification['type']) => {
    notificationService.createTestNotification(type);
  };

  // コンテキスト値の作成
  const contextValue: NotificationContextType = {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteNotifications,
    clearAllNotifications,
    filters,
    setFilters,
    settings,
    updateSettings,
    requestNotificationPermission,
    createTestNotification,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};

// カスタムフック
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};