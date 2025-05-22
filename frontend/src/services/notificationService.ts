/**
 * 通知サービス
 * 
 * 通知の取得、作成、更新、削除などの機能を提供します。
 * また、WebSocketを使ったリアルタイム通知の購読機能も実装しています。
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  type Notification, 
  CreateNotificationParams, 
  NotificationFilters,
  NotificationSettings,
  DEFAULT_NOTIFICATION_SETTINGS
} from '../types/notification';
import { websocketService } from './websocketService';

// ローカルストレージキー
const NOTIFICATION_STORAGE_KEY = 'conea_notifications';
const NOTIFICATION_SETTINGS_KEY = 'conea_notification_settings';

// モック通知データ（実際のAPIが実装されるまでの仮データ）
const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'order',
    title: '新規注文',
    message: '田中太郎様から新規注文が入りました',
    timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5分前
    read: false,
    category: '注文',
    actionUrl: '/orders/123',
    priority: 'high',
  },
  {
    id: '2',
    type: 'sales',
    title: '売上目標達成',
    message: '今月の売上目標を達成しました',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2時間前
    read: false,
    category: '売上',
  },
  {
    id: '3',
    type: 'warning',
    title: '在庫アラート',
    message: '「商品A」の在庫が残り5個になりました',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1日前
    read: true,
    category: '在庫',
    actionUrl: '/inventory/products/A',
    priority: 'medium',
  },
  {
    id: '4',
    type: 'success',
    title: 'API接続成功',
    message: 'Shopify APIの接続に成功しました',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2日前
    read: true,
    category: 'システム',
  },
  {
    id: '5',
    type: 'error',
    title: 'エラー検出',
    message: '楽天APIの接続でエラーが発生しました',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // 3日前
    read: true,
    category: 'システム',
    priority: 'high',
  },
];

// 通知イベントタイプ
type NotificationEventType = 'create' | 'update' | 'delete' | 'markAsRead' | 'markAllAsRead';

// 通知イベントリスナー
type NotificationEventListener = (
  eventType: NotificationEventType, 
  payload: Notification | Notification[] | string
) => void;

// 通知サービスクラス
class NotificationService {
  private listeners: NotificationEventListener[] = [];
  private webSocketSubscribed = false;

  // ローカルストレージからの通知データ取得
  private getStoredNotifications(): Notification[] {
    try {
      const storedNotifications = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
      if (storedNotifications) {
        const parsed = JSON.parse(storedNotifications);
        return parsed.map((n: any) => ({
          ...n,
          timestamp: new Date(n.timestamp),
          expiresAt: n.expiresAt ? new Date(n.expiresAt) : undefined
        }));
      }
    } catch (error) {
      console.error('Failed to parse stored notifications', error);
    }
    
    // 初回またはエラー時はモックデータを使用
    return [...mockNotifications];
  }

  // 通知データをローカルストレージに保存
  private saveNotifications(notifications: Notification[]): void {
    try {
      localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(notifications));
    } catch (error) {
      console.error('Failed to save notifications', error);
    }
  }

  // 通知設定の取得
  getNotificationSettings(): NotificationSettings {
    try {
      const storedSettings = localStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      if (storedSettings) {
        return JSON.parse(storedSettings);
      }
    } catch (error) {
      console.error('Failed to parse notification settings', error);
    }
    
    return DEFAULT_NOTIFICATION_SETTINGS;
  }

  // 通知設定の保存
  saveNotificationSettings(settings: NotificationSettings): void {
    try {
      localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save notification settings', error);
    }
  }

  // 通知のリスナー登録
  subscribe(listener: NotificationEventListener): () => void {
    this.listeners.push(listener);
    
    // WebSocketの購読開始（初回のみ）
    if (!this.webSocketSubscribed) {
      this.subscribeToWebSocketNotifications();
    }
    
    // アンサブスクライブ関数を返す
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // WebSocketでのリアルタイム通知の購読
  private subscribeToWebSocketNotifications(): void {
    if (this.webSocketSubscribed) return;
    
    try {
      websocketService.subscribe('notifications', (message) => {
        if (message.type === 'notification') {
          const notification: Notification = {
            ...message.data,
            timestamp: new Date(message.data.timestamp),
            read: false,
            id: message.data.id || uuidv4(),
          };
          
          this.addNotification(notification);
          
          // デスクトップ通知の表示
          this.showDesktopNotification(notification);
        }
      });
      
      this.webSocketSubscribed = true;
    } catch (error) {
      console.error('Failed to subscribe to WebSocket notifications', error);
    }
  }

  // リスナーへの通知イベント発火
  private notifyListeners(
    eventType: NotificationEventType, 
    payload: Notification | Notification[] | string
  ): void {
    this.listeners.forEach(listener => {
      try {
        listener(eventType, payload);
      } catch (error) {
        console.error('Error in notification listener', error);
      }
    });
  }

  // 通知の取得（フィルタリング可能）
  getNotifications(filters?: NotificationFilters): Notification[] {
    let notifications = this.getStoredNotifications();
    
    // フィルタリング
    if (filters) {
      if (filters.read !== undefined) {
        notifications = notifications.filter(n => n.read === filters.read);
      }
      
      if (filters.type) {
        notifications = notifications.filter(n => n.type === filters.type);
      }
      
      if (filters.category) {
        notifications = notifications.filter(n => n.category === filters.category);
      }
      
      if (filters.startDate) {
        notifications = notifications.filter(n => n.timestamp >= filters.startDate!);
      }
      
      if (filters.endDate) {
        notifications = notifications.filter(n => n.timestamp <= filters.endDate!);
      }
      
      if (filters.priority) {
        notifications = notifications.filter(n => n.priority === filters.priority);
      }
    }
    
    // タイムスタンプでソート（新しい順）
    return notifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // 未読通知のカウント
  getUnreadCount(): number {
    const notifications = this.getStoredNotifications();
    return notifications.filter(n => !n.read).length;
  }

  // 新規通知の追加
  addNotification(notificationData: CreateNotificationParams): Notification {
    const notifications = this.getStoredNotifications();
    
    // 新規通知の作成
    const newNotification: Notification = {
      ...notificationData,
      id: uuidv4(),
      timestamp: new Date(),
      read: false,
    };
    
    // 通知リストに追加して保存
    const updatedNotifications = [newNotification, ...notifications];
    this.saveNotifications(updatedNotifications);
    
    // リスナーに通知
    this.notifyListeners('create', newNotification);
    
    return newNotification;
  }

  // 通知の既読マーク
  markAsRead(id: string): void {
    const notifications = this.getStoredNotifications();
    const updatedNotifications = notifications.map(n => 
      n.id === id ? { ...n, read: true } : n
    );
    
    this.saveNotifications(updatedNotifications);
    
    // 更新された通知を取得
    const updatedNotification = updatedNotifications.find(n => n.id === id);
    if (updatedNotification) {
      this.notifyListeners('markAsRead', updatedNotification);
    }
  }

  // すべての通知を既読マーク
  markAllAsRead(): void {
    const notifications = this.getStoredNotifications();
    const updatedNotifications = notifications.map(n => ({ ...n, read: true }));
    
    this.saveNotifications(updatedNotifications);
    this.notifyListeners('markAllAsRead', updatedNotifications);
  }

  // 通知の削除
  deleteNotification(id: string): void {
    const notifications = this.getStoredNotifications();
    const updatedNotifications = notifications.filter(n => n.id !== id);
    
    this.saveNotifications(updatedNotifications);
    this.notifyListeners('delete', id);
  }

  // 複数通知の削除
  deleteNotifications(ids: string[]): void {
    const notifications = this.getStoredNotifications();
    const updatedNotifications = notifications.filter(n => !ids.includes(n.id));
    
    this.saveNotifications(updatedNotifications);
    ids.forEach(id => this.notifyListeners('delete', id));
  }

  // すべての通知の削除
  clearAllNotifications(): void {
    const notifications = this.getStoredNotifications();
    const notificationIds = notifications.map(n => n.id);
    
    this.saveNotifications([]);
    notificationIds.forEach(id => this.notifyListeners('delete', id));
  }

  // デスクトップ通知の表示
  private showDesktopNotification(notification: Notification): void {
    const settings = this.getNotificationSettings();
    
    // デスクトップ通知の設定チェック
    if (!settings.enableDesktopNotifications) return;
    
    // カテゴリ別設定チェック
    const categorySetting = settings.categories[notification.category];
    if (!categorySetting?.enabled || !categorySetting?.desktopEnabled) return;
    
    // ブラウザの通知をサポートしているか確認
    if (!('Notification' in window)) return;
    
    // 権限が付与されているか確認
    if (Notification.permission === 'granted') {
      // デスクトップ通知を表示
      const desktopNotification = new Notification(notification.title, {
        body: notification.message,
        icon: '/logo192.png', // 適切なアイコンに変更すること
        tag: notification.id,
      });
      
      // 通知がクリックされたら対応するページに遷移
      desktopNotification.onclick = () => {
        if (notification.actionUrl) {
          window.focus();
          window.location.href = notification.actionUrl;
        }
      };
      
      // 設定された時間後に自動で閉じる
      setTimeout(() => {
        desktopNotification.close();
      }, settings.desktopNotificationDuration);
    }
    // 権限が未設定ならリクエスト
    else if (Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }

  // 通知権限の確認
  requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      return Promise.resolve('denied' as NotificationPermission);
    }
    
    return Notification.requestPermission();
  }

  // テスト通知の作成（開発用）
  createTestNotification(type: Notification['type'] = 'info'): void {
    const typeToTitle: Record<Notification['type'], string> = {
      success: 'テスト成功通知',
      error: 'テストエラー通知',
      warning: 'テスト警告通知',
      info: 'テスト情報通知',
      order: 'テスト注文通知',
      sales: 'テスト売上通知',
      inventory: 'テスト在庫通知',
      system: 'テストシステム通知',
    };
    
    const typeToCategory: Record<Notification['type'], Notification['category']> = {
      success: 'システム',
      error: 'システム',
      warning: 'システム',
      info: 'システム',
      order: '注文',
      sales: '売上',
      inventory: '在庫',
      system: 'システム',
    };
    
    this.addNotification({
      type,
      title: typeToTitle[type],
      message: `これはテスト通知です。タイプ: ${type}`,
      category: typeToCategory[type],
      priority: 'medium',
    });
  }
}

// 通知サービスのインスタンスをエクスポート
export const notificationService = new NotificationService();