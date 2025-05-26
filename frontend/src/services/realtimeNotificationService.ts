import { EventEmitter } from 'events';

export interface NotificationData {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  userId: string;
  read: boolean;
  actions?: NotificationAction[];
  metadata?: Record<string, any>;
}

export interface NotificationAction {
  id: string;
  label: string;
  action: () => void;
  style?: 'primary' | 'secondary' | 'danger';
}

export interface NotificationSettings {
  enablePush: boolean;
  enableSound: boolean;
  enableEmail: boolean;
  categories: {
    orders: boolean;
    inventory: boolean;
    analytics: boolean;
    system: boolean;
  };
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

class RealtimeNotificationService extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnected = false;
  private notificationHistory: NotificationData[] = [];
  private settings: NotificationSettings;
  private userId: string = '';

  constructor() {
    super();
    this.settings = this.loadSettings();
    this.initializeNotificationPermission();
  }

  private loadSettings(): NotificationSettings {
    const saved = localStorage.getItem('notification-settings');
    return saved ? JSON.parse(saved) : {
      enablePush: true,
      enableSound: true,
      enableEmail: false,
      categories: {
        orders: true,
        inventory: true,
        analytics: false,
        system: true
      },
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00'
      }
    };
  }

  private saveSettings(): void {
    localStorage.setItem('notification-settings', JSON.stringify(this.settings));
  }

  private async initializeNotificationPermission(): Promise<void> {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }

  public connect(wsUrl: string, userId: string): void {
    this.userId = userId;
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected for notifications');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // Subscribe to user-specific notifications
        this.send({ 
          type: 'subscribe', 
          userId: this.userId,
          categories: Object.keys(this.settings.categories).filter(
            key => this.settings.categories[key as keyof typeof this.settings.categories]
          )
        });
        
        this.emit('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleNotification(data);
        } catch (error) {
          console.error('Failed to parse notification data:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.isConnected = false;
        this.emit('disconnected');
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', error);
      };

    } catch (error) {
      console.error('Failed to establish WebSocket connection:', error);
      this.attemptReconnect();
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    setTimeout(() => {
      console.log(`Attempting to reconnect (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
      this.reconnectAttempts++;
      // Use the same connection parameters
      if (this.userId) {
        this.connect(
          this.ws?.url || 'ws://localhost:8765/notifications',
          this.userId
        );
      }
    }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts));
  }

  private send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private handleNotification(data: NotificationData): void {
    // Add to history
    this.notificationHistory.unshift(data);
    
    // Limit history size
    if (this.notificationHistory.length > 1000) {
      this.notificationHistory = this.notificationHistory.slice(0, 1000);
    }

    // Check if notification should be shown based on settings
    if (!this.shouldShowNotification(data)) {
      return;
    }

    // Emit to UI components
    this.emit('notification', data);

    // Show browser notification
    if (this.settings.enablePush && 'Notification' in window && Notification.permission === 'granted') {
      this.showBrowserNotification(data);
    }

    // Play sound
    if (this.settings.enableSound) {
      this.playNotificationSound(data.type);
    }
  }

  private shouldShowNotification(notification: NotificationData): boolean {
    // Check quiet hours
    if (this.settings.quietHours.enabled) {
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();
      const [startHour, startMin] = this.settings.quietHours.start.split(':').map(Number);
      const [endHour, endMin] = this.settings.quietHours.end.split(':').map(Number);
      const quietStart = startHour * 60 + startMin;
      const quietEnd = endHour * 60 + endMin;
      
      if (quietStart < quietEnd) {
        if (currentTime >= quietStart && currentTime <= quietEnd) {
          return false;
        }
      } else {
        if (currentTime >= quietStart || currentTime <= quietEnd) {
          return false;
        }
      }
    }

    // Check category settings
    const category = notification.metadata?.category;
    if (category && this.settings.categories[category as keyof typeof this.settings.categories] === false) {
      return false;
    }

    return true;
  }

  private showBrowserNotification(data: NotificationData): void {
    const notification = new Notification(data.title, {
      body: data.message,
      icon: '/favicon.ico',
      tag: data.id,
      requireInteraction: data.type === 'error'
    });

    notification.onclick = () => {
      window.focus();
      this.emit('notificationClick', data);
      notification.close();
    };

    // Auto-close after 5 seconds for non-error notifications
    if (data.type !== 'error') {
      setTimeout(() => notification.close(), 5000);
    }
  }

  private playNotificationSound(type: string): void {
    const audio = new Audio();
    switch (type) {
      case 'error':
        audio.src = '/sounds/error.mp3';
        break;
      case 'warning':
        audio.src = '/sounds/warning.mp3';
        break;
      case 'success':
        audio.src = '/sounds/success.mp3';
        break;
      default:
        audio.src = '/sounds/notification.mp3';
    }
    
    audio.play().catch(e => console.log('Could not play notification sound:', e));
  }

  public getNotificationHistory(limit?: number): NotificationData[] {
    return limit ? this.notificationHistory.slice(0, limit) : [...this.notificationHistory];
  }

  public markAsRead(notificationId: string): void {
    const notification = this.notificationHistory.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      this.emit('notificationUpdated', notification);
    }
  }

  public markAllAsRead(): void {
    this.notificationHistory.forEach(n => n.read = true);
    this.emit('allNotificationsRead');
  }

  public getUnreadCount(): number {
    return this.notificationHistory.filter(n => !n.read).length;
  }

  public updateSettings(newSettings: Partial<NotificationSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
    this.emit('settingsUpdated', this.settings);
  }

  public getSettings(): NotificationSettings {
    return { ...this.settings };
  }

  public sendNotification(notification: Omit<NotificationData, 'id' | 'timestamp' | 'read'>): void {
    this.send({
      type: 'send_notification',
      notification: {
        ...notification,
        id: crypto.randomUUID(),
        timestamp: new Date(),
        read: false
      }
    });
  }

  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

export default new RealtimeNotificationService();