import React, { createContext, useContext, useEffect, useState } from 'react';
import offlineService from '../services/offlineService';

// Type definitions
interface PendingAction {
  id: string;
  type: string;
  entity: string;
  entityType: string;
  entityId: string;
  action: string;
  data: any;
  timestamp: Date;
}

interface CachedData {
  id: string;
  type: string;
  data: any;
  timestamp: Date;
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
    const handleOnline = () => {
      setIsOffline(false);
      loadPendingActions();
    };
    
    const handleOffline = () => {
      setIsOffline(true);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadPendingActions = async () => {
    const actions = await offlineService.getPendingActions();
    setPendingActions(actions as PendingAction[]);
  };

  const loadCachedEntities = async () => {
    // TODO: Implement getCachedEntityTypes in offlineService
    setCachedEntities([]);
  };

  const syncNow = async () => {
    if (isSyncing || isOffline) return;
    
    setIsSyncing(true);
    try {
      // TODO: Implement processPendingActions in offlineService
      await loadPendingActions();
      setLastSyncTime(new Date());
    } finally {
      setIsSyncing(false);
    }
  };

  const clearCache = async (entityType?: string) => {
    // TODO: Implement clearCache in offlineService
    await loadCachedEntities();
  };

  const clearPendingActions = async () => {
    // TODO: Implement clearPendingActions in offlineService
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