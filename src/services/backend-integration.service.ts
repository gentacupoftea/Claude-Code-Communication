/**
 * Backend Integration Service
 * 
 * バックエンドとの連携を管理するサービス
 */

import { 
  BackendIntegrationService,
  SyncStatus,
  SyncData,
  QueueStatus,
  SyncError
} from '@/src/types/backend';

class BackendIntegrationServiceImpl implements BackendIntegrationService {
  private status: SyncStatus = {
    isConnected: false,
    lastSync: null,
    syncInProgress: false,
    queueStatus: {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      totalItems: 0
    },
    errors: [],
    syncedProjects: 1,
    totalProjects: 1,
    pendingChanges: 0,
    conflicts: []
  };

  private syncQueue: SyncData[] = [];
  private syncListeners: Array<(status: SyncStatus) => void> = [];
  private healthListeners: Array<(health: any) => void> = [];
  private messageListeners: Array<(message: any) => void> = [];

  getStatus(): SyncStatus {
    return { ...this.status };
  }

  async syncData(data: SyncData): Promise<void> {
    this.syncQueue.push({
      ...data,
      status: 'pending',
      timestamp: new Date()
    });

    this.status.queueStatus.pending++;
    this.status.queueStatus.totalItems++;
    this.notifySyncListeners();

    // Demo: simulate sync after a delay
    setTimeout(() => {
      this.processSyncQueue();
    }, 1000);
  }

  getQueueStatus(): QueueStatus {
    return { ...this.status.queueStatus };
  }

  async clearQueue(): Promise<void> {
    this.syncQueue = [];
    this.status.queueStatus = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      totalItems: 0
    };
  }

  async retryFailed(): Promise<void> {
    const failedItems = this.syncQueue.filter(item => item.status === 'failed');
    failedItems.forEach(item => {
      item.status = 'pending';
      this.status.queueStatus.failed--;
      this.status.queueStatus.pending++;
    });

    setTimeout(() => {
      this.processSyncQueue();
    }, 1000);
  }

  async connect(): Promise<void> {
    // Simulate connection
    return new Promise((resolve) => {
      setTimeout(() => {
        this.status.isConnected = true;
        resolve();
      }, 500);
    });
  }

  disconnect(): void {
    this.status.isConnected = false;
  }

  isOnlineMode(): boolean {
    return this.status.isConnected;
  }

  addSyncListener(listener: (status: SyncStatus) => void): () => void {
    this.syncListeners.push(listener);
    return () => {
      this.syncListeners = this.syncListeners.filter(l => l !== listener);
    };
  }

  addHealthListener(listener: (health: any) => void): () => void {
    this.healthListeners.push(listener);
    return () => {
      this.healthListeners = this.healthListeners.filter(l => l !== listener);
    };
  }

  addMessageListener(listener: (message: any) => void): () => void {
    this.messageListeners.push(listener);
    return () => {
      this.messageListeners = this.messageListeners.filter(l => l !== listener);
    };
  }

  private notifySyncListeners(): void {
    this.syncListeners.forEach(listener => listener(this.getStatus()));
  }

  private notifyHealthListeners(health: any): void {
    this.healthListeners.forEach(listener => listener(health));
  }

  private notifyMessageListeners(message: any): void {
    this.messageListeners.forEach(listener => listener(message));
  }

  async getSyncStatus(): Promise<SyncStatus> {
    return this.getStatus();
  }

  async checkHealth(): Promise<any> {
    return {
      status: 'healthy',
      version: '1.0.0',
      uptime: Date.now(),
      services: {
        database: { status: 'up', latency: 10 },
        cache: { status: 'up', latency: 5 },
        queue: { status: 'up', latency: 15 }
      },
      timestamp: new Date()
    };
  }

  async getBackendConfig(): Promise<any> {
    return {
      apiUrl: 'https://api.example.com',
      timeout: 30000,
      retryAttempts: 3
    };
  }

  async getProjectSyncData(): Promise<any[]> {
    return [
      {
        id: '1',
        name: 'メインプロジェクト',
        version: '1.0.0',
        lastSync: new Date(),
        syncStatus: 'synced',
        items: { total: 100, synced: 100, pending: 0, failed: 0 }
      }
    ];
  }

  async getOfflineCapability(): Promise<any> {
    return {
      enabled: true,
      cacheSize: 1024 * 1024 * 10, // 10MB
      maxCacheSize: 1024 * 1024 * 50, // 50MB
      pendingChanges: 0,
      lastOnline: new Date(),
      syncOnReconnect: true,
      storedData: 1024 * 1024 * 5, // 5MB
      storageLimit: 1024 * 1024 * 100, // 100MB
      lastOfflineSync: new Date(),
      autoSync: true
    };
  }

  async forceSyncNow(): Promise<void> {
    if (!this.status.isConnected) {
      throw new Error('オフライン状態です');
    }
    await this.processSyncQueue();
  }

  setOnlineMode(online: boolean): void {
    if (online && !this.status.isConnected) {
      this.connect();
    } else if (!online && this.status.isConnected) {
      this.disconnect();
    }
  }

  async toggleOfflineMode(): Promise<void> {
    const isOffline = !this.status.isConnected;
    if (isOffline) {
      await this.connect();
    } else {
      this.disconnect();
    }
  }

  async performSync(): Promise<SyncStatus> {
    await this.forceSyncNow();
    return this.getStatus();
  }

  private async processSyncQueue(): Promise<void> {
    if (this.status.syncInProgress || !this.status.isConnected) {
      return;
    }

    const pendingItems = this.syncQueue.filter(item => item.status === 'pending');
    if (pendingItems.length === 0) {
      return;
    }

    this.status.syncInProgress = true;
    const item = pendingItems[0];
    
    item.status = 'syncing';
    this.status.queueStatus.pending--;
    this.status.queueStatus.processing++;

    // Simulate processing
    setTimeout(() => {
      // Randomly succeed or fail for demo
      if (Math.random() > 0.2) {
        item.status = 'completed';
        this.status.queueStatus.processing--;
        this.status.queueStatus.completed++;
        this.status.lastSync = new Date();
      } else {
        item.status = 'failed';
        item.error = 'Simulated sync error';
        this.status.queueStatus.processing--;
        this.status.queueStatus.failed++;
        
        this.status.errors.push({
          id: Date.now().toString(),
          message: 'Failed to sync data',
          timestamp: new Date(),
          type: 'sync_error',
          details: { item }
        });
      }

      this.status.syncInProgress = false;
      this.notifySyncListeners();
      
      // Process next item if any
      if (pendingItems.length > 1) {
        setTimeout(() => {
          this.processSyncQueue();
        }, 100);
      }
    }, 2000);
  }
}

export const backendIntegrationService = new BackendIntegrationServiceImpl();