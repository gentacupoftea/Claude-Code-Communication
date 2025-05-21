/**
 * 通知関連の型定義
 */

// 通知タイプ
export type NotificationType = 
  | 'success'  // 成功
  | 'error'    // エラー
  | 'warning'  // 警告
  | 'info'     // 情報
  | 'order'    // 注文
  | 'sales'    // 売上
  | 'inventory' // 在庫
  | 'system';  // システム

// 通知カテゴリ
export type NotificationCategory = 
  | '注文'
  | '売上'
  | '在庫'
  | 'システム'
  | 'API接続'
  | 'ユーザー';

// 通知データ型
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
  category: NotificationCategory;
  sender?: string;
  priority?: 'high' | 'medium' | 'low';
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

// 新規通知作成用の型
export type CreateNotificationParams = Omit<Notification, 'id' | 'timestamp' | 'read'>;

// 通知フィルタリング用の型
export interface NotificationFilters {
  read?: boolean;
  type?: NotificationType;
  category?: NotificationCategory;
  startDate?: Date;
  endDate?: Date;
  priority?: 'high' | 'medium' | 'low';
}

// 通知ソート用の型
export interface NotificationSortOptions {
  field: 'timestamp' | 'priority';
  direction: 'asc' | 'desc';
}

// 通知の設定
export interface NotificationSettings {
  enableDesktopNotifications: boolean;
  enableEmailNotifications: boolean;
  emailFrequency: 'immediate' | 'daily' | 'weekly';
  desktopNotificationDuration: number; // ミリ秒
  categories: Record<NotificationCategory, {
    enabled: boolean;
    desktopEnabled: boolean;
    emailEnabled: boolean;
  }>;
}

// デフォルトの通知設定
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enableDesktopNotifications: true,
  enableEmailNotifications: false,
  emailFrequency: 'daily',
  desktopNotificationDuration: 5000,
  categories: {
    '注文': { enabled: true, desktopEnabled: true, emailEnabled: true },
    '売上': { enabled: true, desktopEnabled: true, emailEnabled: true },
    '在庫': { enabled: true, desktopEnabled: true, emailEnabled: false },
    'システム': { enabled: true, desktopEnabled: true, emailEnabled: false },
    'API接続': { enabled: true, desktopEnabled: true, emailEnabled: false },
    'ユーザー': { enabled: true, desktopEnabled: true, emailEnabled: false },
  }
};