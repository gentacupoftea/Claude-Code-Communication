import { useState, useEffect, useCallback } from 'react';
import { useOffline } from '../contexts/OfflineContext';
import offlineService from '../services/offlineService';
import { apiClient } from '../services/apiClient';

interface UseOfflineDataOptions<T> {
  entityType: string;
  endpoint: string;
  idField?: string;
  queryParams?: Record<string, string>;
  initialData?: T[];
  forceOnline?: boolean;
}

export function useOfflineData<T extends Record<string, any>>(
  options: UseOfflineDataOptions<T>
) {
  const { 
    entityType, 
    endpoint, 
    idField = 'id', 
    queryParams = {},
    initialData = [],
    forceOnline = false 
  } = options;
  
  const { isOffline } = useOffline();
  const [data, setData] = useState<T[]>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);

  // Load data considering offline status
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Try to fetch from API if online or if forced
      if (!isOffline || forceOnline) {
        try {
          const response = await apiClient.get(endpoint, { params: queryParams });
          const fetchedData = response.data;
          
          setData(fetchedData);
          setIsFromCache(false);
          setLastUpdated(new Date());
          
          // Cache the fetched data for offline use
          await offlineService.cacheData(entityType, fetchedData);
          return;
        } catch (err) {
          // If forced online but failed, don't fall back to cache
          if (forceOnline) {
            throw err;
          }
          // Otherwise continue to try loading from cache
        }
      }
      
      // If offline or API request failed, try to load from cache
      const cachedData = await offlineService.getCachedData(entityType);
      if (cachedData && cachedData.data) {
        setData(cachedData.data as T[]);
        setIsFromCache(true);
        setLastUpdated(new Date(cachedData.timestamp));
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [isOffline, entityType, endpoint, queryParams, forceOnline]);

  // Create, update, delete operations with offline support
  const createItem = useCallback(async (item: Omit<T, typeof idField>) => {
    try {
      if (!isOffline) {
        // Online: Send directly to API
        const response = await apiClient.post(endpoint, item);
        const newItem = response.data;
        
        setData(prev => [...prev, newItem]);
        return newItem;
      } else {
        // Offline: Register as pending action
        const tempId = `temp_${Date.now()}`;
        const tempItem = { ...item, [idField]: tempId } as T;
        
        // Register the pending action
        await offlineService.registerPendingAction(
          entityType,
          tempId,
          'create',
          item
        );
        
        // Update the local state
        setData(prev => [...prev, tempItem]);
        return tempItem;
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }, [isOffline, entityType, endpoint, idField]);

  const updateItem = useCallback(async (id: string, updates: Partial<T>) => {
    try {
      // Find the item in the current data
      const currentItem = data.find(item => item[idField] === id);
      if (!currentItem) {
        throw new Error(`Item with id ${id} not found`);
      }
      
      const updatedItem = { ...currentItem, ...updates };
      
      if (!isOffline) {
        // Online: Send directly to API
        const response = await apiClient.put(`${endpoint}/${id}`, updates);
        const serverUpdatedItem = response.data;
        
        setData(prev => prev.map(item => 
          item[idField] === id ? serverUpdatedItem : item
        ));
        return serverUpdatedItem;
      } else {
        // Offline: Register as pending action
        await offlineService.registerPendingAction(
          entityType,
          id,
          'update',
          updates
        );
        
        // Update the local state
        setData(prev => prev.map(item => 
          item[idField] === id ? updatedItem : item
        ));
        return updatedItem;
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }, [isOffline, data, entityType, endpoint, idField]);

  const deleteItem = useCallback(async (id: string) => {
    try {
      if (!isOffline) {
        // Online: Send directly to API
        await apiClient.delete(`${endpoint}/${id}`);
      } else {
        // Offline: Register as pending action
        await offlineService.registerPendingAction(
          entityType,
          id,
          'delete',
          null
        );
      }
      
      // Update the local state
      setData(prev => prev.filter(item => item[idField] !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }, [isOffline, entityType, endpoint, idField]);

  // Refresh data
  const refresh = useCallback(() => {
    return loadData();
  }, [loadData]);

  // Load data on mount and when dependencies change
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Subscribe to offline status changes
  useEffect(() => {
    const unsubscribe = offlineService.subscribeToOfflineStatus((status) => {
      // When coming back online, refresh data
      if (!status) {
        loadData();
      }
    });
    
    return unsubscribe;
  }, [loadData]);

  return {
    data,
    loading,
    error,
    isFromCache,
    lastUpdated,
    refresh,
    createItem,
    updateItem,
    deleteItem
  };
}