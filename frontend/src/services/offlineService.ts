/**
 * オフラインサポートサービス
 * 
 * オフラインモード時のデータキャッシュと同期機能を提供します。
 * IndexedDBを使用してローカルキャッシュを管理し、オンラインに戻ったときの同期を処理します。
 */

import { openDB, IDBPDatabase } from 'idb';
import { v4 as uuidv4 } from 'uuid';

// データベース設定
const DB_NAME = 'conea_offline_cache';
const DB_VERSION = 1;

// キャッシュするストアの名前（エンティティタイプ）
const STORES = [
  'products',
  'orders',
  'customers',
  'settings',
  'pending_actions',
];

// オフライン操作の種類
export type OfflineActionType = 'create' | 'update' | 'delete';

// 保留中のオフラインアクション
export interface PendingAction {
  id: string;
  entityType: string;
  entityId: string;
  action: OfflineActionType;
  data: any;
  timestamp: number;
  synced: boolean;
  retryCount: number;
  error?: string;
}

// オフラインサービスのインターフェース
export interface OfflineServiceInterface {
  // データベース初期化
  initialize(): Promise<boolean>;
  
  // オフラインステータスのチェック
  isOffline(): boolean;
  
  // ネットワークステータスの監視開始
  startMonitoring(): void;
  
  // ネットワークステータスの監視停止
  stopMonitoring(): void;
  
  // データのキャッシュ
  cacheData(entityType: string, data: any[]): Promise<void>;
  
  // エンティティのキャッシュ
  cacheEntity(entityType: string, entity: any): Promise<void>;
  
  // キャッシュからのデータ取得
  getCachedData<T>(entityType: string): Promise<T[]>;
  
  // キャッシュからのエンティティ取得
  getCachedEntity<T>(entityType: string, id: string): Promise<T | undefined>;
  
  // 保留中のアクションの登録
  registerPendingAction(
    entityType: string,
    entityId: string,
    action: OfflineActionType,
    data: any
  ): Promise<string>;
  
  // 保留中のアクションの処理
  processPendingActions(): Promise<{
    succeeded: PendingAction[];
    failed: PendingAction[];
  }>;
  
  // キャッシュデータのクリア
  clearCache(entityType?: string): Promise<void>;
  
  // キャッシュデータの有効期限チェック
  isCacheValid(entityType: string, maxAgeMs: number): Promise<boolean>;
  
  // リスナー登録
  addListener(listener: (status: boolean) => void): void;
  
  // リスナー削除
  removeListener(listener: (status: boolean) => void): void;
}

class OfflineService implements OfflineServiceInterface {
  private db: IDBPDatabase | null = null;
  private _isOffline: boolean = false;
  private listeners: ((status: boolean) => void)[] = [];
  private networkCheckInterval: number | null = null;
  private lastSyncTimestamps: Record<string, number> = {};
  
  /**
   * IndexedDBデータベースの初期化
   */
  public async initialize(): Promise<boolean> {
    try {
      this.db = await openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          // 各エンティティタイプのオブジェクトストアを作成
          STORES.forEach(store => {
            if (!db.objectStoreNames.contains(store)) {
              const objectStore = db.createObjectStore(store, { keyPath: 'id' });
              
              // インデックスの作成
              if (store === 'pending_actions') {
                objectStore.createIndex('synced', 'synced', { unique: false });
                objectStore.createIndex('entityType', 'entityType', { unique: false });
                objectStore.createIndex('timestamp', 'timestamp', { unique: false });
              }
              
              // メタデータの格納用
              if (store === 'settings') {
                objectStore.createIndex('key', 'key', { unique: true });
              }
            }
          });
        },
      });
      
      console.log('Offline database initialized successfully');
      
      // ネットワークステータスの初期チェック
      this._isOffline = !navigator.onLine;
      this.startMonitoring();
      
      return true;
    } catch (error) {
      console.error('Failed to initialize offline database:', error);
      return false;
    }
  }
  
  /**
   * 現在のオフラインステータスを確認
   */
  public isOffline(): boolean {
    return this._isOffline;
  }
  
  /**
   * ネットワークステータスの監視を開始
   */
  public startMonitoring(): void {
    // ブラウザの接続状態イベントをリッスン
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    
    // 定期的な接続チェック（より信頼性の高い検出のため）
    this.networkCheckInterval = window.setInterval(() => {
      this.checkNetworkStatus();
    }, 30000); // 30秒ごとにチェック
    
    // 初期状態をチェック
    this.checkNetworkStatus();
  }
  
  /**
   * ネットワークステータスの監視を停止
   */
  public stopMonitoring(): void {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    
    if (this.networkCheckInterval !== null) {
      clearInterval(this.networkCheckInterval);
      this.networkCheckInterval = null;
    }
  }
  
  /**
   * オンラインになった時の処理
   */
  private handleOnline = async (): Promise<void> => {
    if (this._isOffline) {
      this._isOffline = false;
      this.notifyListeners();
      
      try {
        // オンラインに戻ったら保留中のアクションを同期
        await this.processPendingActions();
      } catch (error) {
        console.error('Error processing pending actions:', error);
      }
    }
  };
  
  /**
   * オフラインになった時の処理
   */
  private handleOffline = (): void => {
    if (!this._isOffline) {
      this._isOffline = true;
      this.notifyListeners();
    }
  };
  
  /**
   * 実際のネットワーク接続状態をチェック
   */
  private async checkNetworkStatus(): Promise<void> {
    try {
      const online = navigator.onLine;
      
      if (online) {
        // ネットワークステータスをより正確に確認するためにAPIエンドポイントへのfetchを試みる
        try {
          const response = await fetch('/api/health', { 
            method: 'HEAD',
            headers: { 'Cache-Control': 'no-cache' },
            // タイムアウトを設定するためのシグナルを使用
            signal: AbortSignal.timeout(5000)
          });
          
          const wasOffline = this._isOffline;
          this._isOffline = !response.ok;
          
          // 状態が変わった場合のみ通知
          if (wasOffline !== this._isOffline) {
            this.notifyListeners();
            
            // オンラインに戻った場合は同期
            if (wasOffline && !this._isOffline) {
              await this.processPendingActions();
            }
          }
        } catch (error) {
          // 接続エラーの場合はオフラインとみなす
          if (!this._isOffline) {
            this._isOffline = true;
            this.notifyListeners();
          }
        }
      } else if (!this._isOffline) {
        // ブラウザがオフラインを報告
        this._isOffline = true;
        this.notifyListeners();
      }
    } catch (error) {
      console.error('Error checking network status:', error);
    }
  }
  
  /**
   * 複数のデータをキャッシュに保存
   */
  public async cacheData(entityType: string, data: any[]): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    if (!STORES.includes(entityType)) {
      throw new Error(`Invalid entity type: ${entityType}`);
    }
    
    const tx = this.db.transaction(entityType, 'readwrite');
    const store = tx.objectStore(entityType);
    
    // 各エンティティを保存
    await Promise.all(data.map(entity => store.put(entity)));
    
    // 最終同期タイムスタンプを更新
    this.lastSyncTimestamps[entityType] = Date.now();
    
    // トランザクションの完了を待つ
    await tx.done;
  }
  
  /**
   * 単一のエンティティをキャッシュに保存
   */
  public async cacheEntity(entityType: string, entity: any): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    if (!STORES.includes(entityType)) {
      throw new Error(`Invalid entity type: ${entityType}`);
    }
    
    const tx = this.db.transaction(entityType, 'readwrite');
    const store = tx.objectStore(entityType);
    
    await store.put(entity);
    await tx.done;
  }
  
  /**
   * キャッシュからすべてのデータを取得
   */
  public async getCachedData<T>(entityType: string): Promise<T[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    if (!STORES.includes(entityType)) {
      throw new Error(`Invalid entity type: ${entityType}`);
    }
    
    const tx = this.db.transaction(entityType, 'readonly');
    const store = tx.objectStore(entityType);
    
    return await store.getAll() as T[];
  }
  
  /**
   * キャッシュから特定のエンティティを取得
   */
  public async getCachedEntity<T>(entityType: string, id: string): Promise<T | undefined> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    if (!STORES.includes(entityType)) {
      throw new Error(`Invalid entity type: ${entityType}`);
    }
    
    const tx = this.db.transaction(entityType, 'readonly');
    const store = tx.objectStore(entityType);
    
    return await store.get(id) as T | undefined;
  }
  
  /**
   * オフラインで行われた操作を保留中アクションとして登録
   */
  public async registerPendingAction(
    entityType: string,
    entityId: string,
    action: OfflineActionType,
    data: any
  ): Promise<string> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    const pendingAction: PendingAction = {
      id: uuidv4(),
      entityType,
      entityId,
      action,
      data,
      timestamp: Date.now(),
      synced: false,
      retryCount: 0
    };
    
    const tx = this.db.transaction('pending_actions', 'readwrite');
    const store = tx.objectStore('pending_actions');
    
    await store.add(pendingAction);
    await tx.done;
    
    return pendingAction.id;
  }
  
  /**
   * 保留中のアクションを処理（サーバーと同期）
   */
  public async processPendingActions(): Promise<{
    succeeded: PendingAction[];
    failed: PendingAction[];
  }> {
    if (!this.db || this._isOffline) {
      return { succeeded: [], failed: [] };
    }
    
    const tx = this.db.transaction('pending_actions', 'readonly');
    const store = tx.objectStore('pending_actions');
    const index = store.index('synced');
    
    // 同期されていないアクションを取得
    const pendingActions = await index.getAll(false);
    
    if (pendingActions.length === 0) {
      return { succeeded: [], failed: [] };
    }
    
    console.log(`Processing ${pendingActions.length} pending actions`);
    
    const succeeded: PendingAction[] = [];
    const failed: PendingAction[] = [];
    
    // タイムスタンプでソート（古い順）
    pendingActions.sort((a, b) => a.timestamp - b.timestamp);
    
    for (const action of pendingActions) {
      try {
        // アクションタイプに応じたAPIリクエストを実行
        let endpoint = `/api/${action.entityType}`;
        let method = 'POST';
        
        if (action.action === 'update') {
          endpoint += `/${action.entityId}`;
          method = 'PUT';
        } else if (action.action === 'delete') {
          endpoint += `/${action.entityId}`;
          method = 'DELETE';
        }
        
        const response = await fetch(endpoint, {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: action.action !== 'delete' ? JSON.stringify(action.data) : undefined,
        });
        
        if (response.ok) {
          // 成功したアクションを更新
          const updateTx = this.db.transaction('pending_actions', 'readwrite');
          const updateStore = updateTx.objectStore('pending_actions');
          
          const updatedAction = { ...action, synced: true };
          await updateStore.put(updatedAction);
          await updateTx.done;
          
          succeeded.push(updatedAction);
        } else {
          // 失敗したアクションを更新（リトライカウント増加）
          const updateTx = this.db.transaction('pending_actions', 'readwrite');
          const updateStore = updateTx.objectStore('pending_actions');
          
          const errorText = await response.text();
          const updatedAction = { 
            ...action, 
            retryCount: action.retryCount + 1,
            error: `HTTP ${response.status}: ${errorText}`
          };
          
          await updateStore.put(updatedAction);
          await updateTx.done;
          
          failed.push(updatedAction);
        }
      } catch (error) {
        // ネットワークエラーなどの例外
        const updateTx = this.db.transaction('pending_actions', 'readwrite');
        const updateStore = updateTx.objectStore('pending_actions');
        
        const updatedAction = { 
          ...action, 
          retryCount: action.retryCount + 1,
          error: (error as Error).message
        };
        
        await updateStore.put(updatedAction);
        await updateTx.done;
        
        failed.push(updatedAction);
      }
    }
    
    return { succeeded, failed };
  }
  
  /**
   * キャッシュデータをクリア
   */
  public async clearCache(entityType?: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    if (entityType) {
      if (!STORES.includes(entityType)) {
        throw new Error(`Invalid entity type: ${entityType}`);
      }
      
      const tx = this.db.transaction(entityType, 'readwrite');
      const store = tx.objectStore(entityType);
      await store.clear();
      await tx.done;
      
      // 最終同期タイムスタンプをクリア
      delete this.lastSyncTimestamps[entityType];
    } else {
      // すべてのストアをクリア（pending_actionsは除く）
      for (const store of STORES) {
        if (store !== 'pending_actions') {
          const tx = this.db.transaction(store, 'readwrite');
          const objectStore = tx.objectStore(store);
          await objectStore.clear();
          await tx.done;
        }
      }
      
      // すべての同期タイムスタンプをクリア
      this.lastSyncTimestamps = {};
    }
  }
  
  /**
   * キャッシュが有効かどうかをチェック（最大有効期限を基に）
   */
  public async isCacheValid(entityType: string, maxAgeMs: number): Promise<boolean> {
    const lastSyncTime = this.lastSyncTimestamps[entityType];
    if (!lastSyncTime) return false;
    
    const now = Date.now();
    return (now - lastSyncTime) < maxAgeMs;
  }
  
  /**
   * オフラインステータスリスナーを追加
   */
  public addListener(listener: (status: boolean) => void): void {
    if (!this.listeners.includes(listener)) {
      this.listeners.push(listener);
      
      // 新しいリスナーに現在の状態を即時通知
      listener(this._isOffline);
    }
  }
  
  /**
   * オフラインステータスリスナーを削除
   */
  public removeListener(listener: (status: boolean) => void): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }
  
  /**
   * すべてのリスナーに通知
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this._isOffline);
      } catch (error) {
        console.error('Error in offline status listener:', error);
      }
    });
  }
}

// オフラインサービスのシングルトンインスタンスをエクスポート
export const offlineService = new OfflineService();