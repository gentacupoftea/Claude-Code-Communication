/**
 * オフラインモード管理サービス
 * IndexedDBを使用したデータの永続化と同期機能を提供します
 */

// オフライン設定のデフォルト値
const DEFAULT_SETTINGS = {
  enabled: false,
  storageLimitMB: 100,
  syncIntervalMinutes: 15,
};

// IndexedDBデータベース名とバージョン
const DB_NAME = 'conea_offline_db';
const DB_VERSION = 1;

// ストアの名前
const STORES = {
  SETTINGS: 'settings',
  PENDING_ACTIONS: 'pendingActions',
  CACHE: 'cache',
  SYNC_LOG: 'syncLog',
};

// データベース接続を初期化
const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      reject(new Error('IndexedDBの初期化中にエラーが発生しました'));
    };

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 設定ストア
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'id' });
      }

      // 保留中アクションストア
      if (!db.objectStoreNames.contains(STORES.PENDING_ACTIONS)) {
        const pendingStore = db.createObjectStore(STORES.PENDING_ACTIONS, { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        pendingStore.createIndex('timestamp', 'timestamp', { unique: false });
        pendingStore.createIndex('type', 'type', { unique: false });
      }

      // キャッシュストア
      if (!db.objectStoreNames.contains(STORES.CACHE)) {
        const cacheStore = db.createObjectStore(STORES.CACHE, { keyPath: 'key' });
        cacheStore.createIndex('timestamp', 'timestamp', { unique: false });
        cacheStore.createIndex('expire', 'expire', { unique: false });
      }

      // 同期ログストア
      if (!db.objectStoreNames.contains(STORES.SYNC_LOG)) {
        const syncLogStore = db.createObjectStore(STORES.SYNC_LOG, { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        syncLogStore.createIndex('timestamp', 'timestamp', { unique: false });
        syncLogStore.createIndex('status', 'status', { unique: false });
      }
    };
  });
};

// データベースへの保存
const saveToStore = <T>(storeName: string, data: T, key?: string): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDB();
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      const request = key 
        ? store.put({ key, value: data, timestamp: Date.now() })
        : store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`${storeName}ストアへの保存中にエラーが発生しました`));

      transaction.oncomplete = () => db.close();
    } catch (error) {
      reject(error);
    }
  });
};

// データベースからの取得
const getFromStore = <T>(storeName: string, key: string): Promise<T | null> => {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDB();
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? (result.value || result) : null);
      };

      request.onerror = () => reject(new Error(`${storeName}ストアからの取得中にエラーが発生しました`));

      transaction.oncomplete = () => db.close();
    } catch (error) {
      reject(error);
    }
  });
};

// ストアの全データを取得
const getAllFromStore = <T>(storeName: string): Promise<T[]> => {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDB();
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result.map(item => item.value || item);
        resolve(results);
      };

      request.onerror = () => reject(new Error(`${storeName}ストアからのデータ取得中にエラーが発生しました`));

      transaction.oncomplete = () => db.close();
    } catch (error) {
      reject(error);
    }
  });
};

// ストアのデータ数を取得
const countFromStore = (storeName: string): Promise<number> => {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDB();
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`${storeName}ストアのカウント中にエラーが発生しました`));

      transaction.oncomplete = () => db.close();
    } catch (error) {
      reject(error);
    }
  });
};

// ストアのすべてのデータを削除
const clearStore = (storeName: string): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDB();
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`${storeName}ストアのクリア中にエラーが発生しました`));

      transaction.oncomplete = () => db.close();
    } catch (error) {
      reject(error);
    }
  });
};

// すべてのストアを削除
const clearAllStores = async (): Promise<void> => {
  for (const store of Object.values(STORES)) {
    await clearStore(store);
  }
};

// IndexedDBの使用量を取得（概算）
const calculateStorageUsage = async (): Promise<number> => {
  try {
    // @ts-ignore - 実験的なAPI
    if (navigator.storage && navigator.storage.estimate) {
      const estimation = await navigator.storage.estimate();
      const usedMB = estimation.usage ? Math.round(estimation.usage / (1024 * 1024) * 100) / 100 : 0;
      return usedMB;
    }
    
    // 使用したキーの数と平均サイズからストレージ使用量を推定
    const db = await initDB();
    
    let totalSize = 0;
    for (const storeName of Object.values(STORES)) {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const countReq = store.count();
      
      await new Promise<void>((resolve) => {
        countReq.onsuccess = () => {
          // 各レコードの平均サイズを2KBと仮定
          totalSize += countReq.result * 2048;
          resolve();
        };
      });
    }
    
    db.close();
    return Math.round(totalSize / (1024 * 1024) * 100) / 100; // MBに変換して小数点2桁まで
  } catch (error) {
    console.error('ストレージ使用量の計算中にエラーが発生しました', error);
    return 0;
  }
};

// 公開するサービスメソッド
const offlineService = {
  // 設定関連
  async getSettings() {
    try {
      let settings = await getFromStore<typeof DEFAULT_SETTINGS>(STORES.SETTINGS, 'userSettings');
      if (!settings) {
        settings = DEFAULT_SETTINGS;
        await saveToStore(STORES.SETTINGS, { id: 'userSettings', ...settings });
      }
      return settings;
    } catch (error) {
      console.error('設定の取得中にエラーが発生しました', error);
      return DEFAULT_SETTINGS;
    }
  },

  async setEnabled(enabled: boolean) {
    try {
      const settings = await this.getSettings();
      await saveToStore(STORES.SETTINGS, { id: 'userSettings', ...settings, enabled });
      return true;
    } catch (error) {
      console.error('オフラインモードの有効化中にエラーが発生しました', error);
      throw error;
    }
  },

  async setStorageLimit(storageLimitMB: number) {
    try {
      const settings = await this.getSettings();
      await saveToStore(STORES.SETTINGS, { id: 'userSettings', ...settings, storageLimitMB });
      return true;
    } catch (error) {
      console.error('ストレージ制限の設定中にエラーが発生しました', error);
      throw error;
    }
  },

  async setSyncInterval(syncIntervalMinutes: number) {
    try {
      const settings = await this.getSettings();
      await saveToStore(STORES.SETTINGS, { id: 'userSettings', ...settings, syncIntervalMinutes });
      return true;
    } catch (error) {
      console.error('同期間隔の設定中にエラーが発生しました', error);
      throw error;
    }
  },

  // データ管理
  async getStorageUsage() {
    return calculateStorageUsage();
  },

  async clearAllData() {
    try {
      await clearAllStores();
      await saveToStore(STORES.SETTINGS, { id: 'userSettings', ...DEFAULT_SETTINGS });
      return true;
    } catch (error) {
      console.error('オフラインデータの消去中にエラーが発生しました', error);
      throw error;
    }
  },

  // 保留中アクション
  async addPendingAction(action: { type: string, payload: any, endpoint: string }) {
    try {
      const settings = await this.getSettings();
      if (!settings.enabled) return false;

      await saveToStore(STORES.PENDING_ACTIONS, {
        ...action,
        timestamp: Date.now(),
        status: 'pending',
      });
      return true;
    } catch (error) {
      console.error('保留中アクションの追加中にエラーが発生しました', error);
      throw error;
    }
  },

  async getPendingActionsCount() {
    try {
      return await countFromStore(STORES.PENDING_ACTIONS);
    } catch (error) {
      console.error('保留中アクション数の取得中にエラーが発生しました', error);
      return 0;
    }
  },

  async getPendingActions() {
    try {
      return await getAllFromStore(STORES.PENDING_ACTIONS);
    } catch (error) {
      console.error('保留中アクションの取得中にエラーが発生しました', error);
      return [];
    }
  },

  // キャッシュ
  async cacheData(key: string, data: any, ttl: number = 3600) {
    try {
      const settings = await this.getSettings();
      if (!settings.enabled) return false;

      const expire = Date.now() + ttl * 1000;
      await saveToStore(STORES.CACHE, {
        key,
        value: data,
        timestamp: Date.now(),
        expire,
      });
      return true;
    } catch (error) {
      console.error('データのキャッシュ中にエラーが発生しました', error);
      throw error;
    }
  },

  async getCachedData(key: string) {
    try {
      const data = await getFromStore(STORES.CACHE, key) as any;
      if (!data || (data?.expire && data.expire < Date.now())) {
        return null;
      }
      return data.value || data;
    } catch (error) {
      console.error('キャッシュデータの取得中にエラーが発生しました', error);
      return null;
    }
  },

  // 同期
  async syncAll() {
    try {
      const settings = await this.getSettings();
      if (!settings.enabled) return false;

      // 最終同期時間を更新
      await saveToStore(STORES.SETTINGS, { 
        id: 'lastSync', 
        timestamp: Date.now() 
      });

      // 実際の同期ロジック（APIとの連携）
      // この実装はアプリケーションのAPI設計によって異なります
      console.log('オフラインデータの同期を実行中...');

      // 実装例: 保留中アクションの処理
      const pendingActions = await this.getPendingActions();
      
      // 同期ログに記録
      await saveToStore(STORES.SYNC_LOG, {
        timestamp: Date.now(),
        actionCount: pendingActions.length,
        status: 'success',
      });

      return true;
    } catch (error) {
      console.error('データ同期中にエラーが発生しました', error);
      
      // 同期エラーをログに記録
      await saveToStore(STORES.SYNC_LOG, {
        timestamp: Date.now(),
        error: String(error),
        status: 'failed',
      });
      
      throw error;
    }
  },

  async getLastSyncTime() {
    try {
      const lastSync = await getFromStore<{ timestamp: number }>(STORES.SETTINGS, 'lastSync');
      return lastSync ? new Date(lastSync.timestamp) : null;
    } catch (error) {
      console.error('最終同期時間の取得中にエラーが発生しました', error);
      return null;
    }
  },

  // 初期化
  async initialize() {
    try {
      await initDB();
      const settings = await this.getSettings();
      return settings.enabled;
    } catch (error) {
      console.error('オフラインサービスの初期化中にエラーが発生しました', error);
      return false;
    }
  },
};

export default offlineService;
export { offlineService };