import React, { createContext, useContext, useEffect, useState } from 'react';
import offlineService from '../services/offlineService';

interface CachedData {
  id: string;
  data: any;
  timestamp: Date;
  entityType: string;
}

interface PendingAction {
  id: string;
  type: string;
  data: any;
  timestamp: Date;
  entityType: string;
  action: string;
  entityId: string;
}

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
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [cachedEntities, setCachedEntities] = useState<string[]>([]);

  useEffect(() => {
    // Initialize offline service
    offlineService.initialize().then(() => {
      // Load initial state
      loadPendingActions();
      loadCachedEntities();
    });

    // Subscribe to offline status changes
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => {
      setIsOffline(false);
      loadPendingActions();
    };
    
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const loadPendingActions = async () => {
    const actions = await offlineService.getPendingActions();
    setPendingActions(actions as PendingAction[]);
  };

  const loadCachedEntities = async () => {
    setCachedEntities([]);
  };

  const syncNow = async () => {
    if (isSyncing || isOffline) return;
    
    setIsSyncing(true);
    try {
      await loadPendingActions();
      setLastSyncTime(new Date());
    } finally {
      setIsSyncing(false);
    }
  };

  const clearCache = async (entityType?: string) => {
    await loadCachedEntities();
  };

  const clearPendingActions = async () => {
    setPendingActions([]);
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