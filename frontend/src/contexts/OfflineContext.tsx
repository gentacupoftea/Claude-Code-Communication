import React, { createContext, useContext, useEffect, useState } from 'react';
import offlineService, { CachedData, PendingAction } from '../services/offlineService';

interface OfflineContextType {
  isOffline: boolean;
  pendingActions: PendingAction[];
  pendingActionsCount: number;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  cachedEntities: string[];
  syncNow: () => Promise<void>;
  clearCache: (entityType?: string) => Promise<void>;
  clearPendingActions: () => Promise<void>;
}

export const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export const OfflineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOffline, setIsOffline] = useState(offlineService.isOffline);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [cachedEntities, setCachedEntities] = useState<string[]>([]);

  useEffect(() => {
    // Initialize offline service
    offlineService.initialize().then(() => {
      // Start monitoring network status
      offlineService.startMonitoring();
      
      // Load initial state
      loadPendingActions();
      loadCachedEntities();
    });

    // Subscribe to offline status changes
    const unsubscribeOffline = offlineService.subscribeToOfflineStatus((offline) => {
      setIsOffline(offline);
      
      // When coming back online, update pending actions
      if (!offline) {
        loadPendingActions();
      }
    });

    // Subscribe to pending actions changes
    const unsubscribePending = offlineService.subscribeToPendingActions(() => {
      loadPendingActions();
    });

    // Subscribe to cache changes
    const unsubscribeCache = offlineService.subscribeToCacheChanges(() => {
      loadCachedEntities();
    });

    return () => {
      unsubscribeOffline();
      unsubscribePending();
      unsubscribeCache();
      offlineService.stopMonitoring();
    };
  }, []);

  const loadPendingActions = async () => {
    const actions = await offlineService.getPendingActions();
    setPendingActions(actions);
  };

  const loadCachedEntities = async () => {
    const entities = await offlineService.getCachedEntityTypes();
    setCachedEntities(entities);
  };

  const syncNow = async () => {
    if (isSyncing || isOffline) return;
    
    setIsSyncing(true);
    try {
      const result = await offlineService.processPendingActions();
      await loadPendingActions();
      setLastSyncTime(new Date());
      return result;
    } finally {
      setIsSyncing(false);
    }
  };

  const clearCache = async (entityType?: string) => {
    await offlineService.clearCache(entityType);
    await loadCachedEntities();
  };

  const clearPendingActions = async () => {
    await offlineService.clearPendingActions();
    await loadPendingActions();
  };

  return (
    <OfflineContext.Provider
      value={{
        isOffline,
        pendingActions,
        pendingActionsCount: pendingActions.length,
        isSyncing,
        lastSyncTime,
        cachedEntities,
        syncNow,
        clearCache,
        clearPendingActions
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
};

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (context === undefined) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
};