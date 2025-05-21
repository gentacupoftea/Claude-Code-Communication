import { useState, useEffect, useCallback } from 'react';
import syncService, { SyncSchedule } from '../api/syncService';
import websocketService from '../services/websocketService';

interface UseSyncScheduleResult {
  schedules: SyncSchedule[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  getSchedule: (id: string) => Promise<SyncSchedule | null>;
  createSchedule: (schedule: Omit<SyncSchedule, 'id'>) => Promise<SyncSchedule | null>;
  updateSchedule: (id: string, schedule: Partial<SyncSchedule>) => Promise<SyncSchedule | null>;
  deleteSchedule: (id: string) => Promise<boolean>;
  activateSchedule: (id: string) => Promise<SyncSchedule | null>;
  deactivateSchedule: (id: string) => Promise<SyncSchedule | null>;
}

/**
 * Hook for managing sync schedules
 */
export function useSyncSchedule(enableRealtime = true): UseSyncScheduleResult {
  const [schedules, setSchedules] = useState<SyncSchedule[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch schedules function
  const fetchSchedules = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const fetchedSchedules = await syncService.getSchedules();
      setSchedules(fetchedSchedules);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch sync schedules'));
      console.error('Error fetching sync schedules:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get a specific schedule
  const getSchedule = useCallback(async (id: string): Promise<SyncSchedule | null> => {
    try {
      return await syncService.getSchedule(id);
    } catch (err) {
      console.error(`Error fetching schedule ${id}:`, err);
      return null;
    }
  }, []);

  // Create a new schedule
  const createSchedule = useCallback(async (schedule: Omit<SyncSchedule, 'id'>): Promise<SyncSchedule | null> => {
    try {
      const newSchedule = await syncService.createSchedule(schedule);
      setSchedules(prev => [...prev, newSchedule]);
      return newSchedule;
    } catch (err) {
      console.error('Error creating sync schedule:', err);
      return null;
    }
  }, []);

  // Update a schedule
  const updateSchedule = useCallback(async (id: string, schedule: Partial<SyncSchedule>): Promise<SyncSchedule | null> => {
    try {
      const updatedSchedule = await syncService.updateSchedule(id, schedule);
      setSchedules(prev => 
        prev.map(item => item.id === id ? updatedSchedule : item)
      );
      return updatedSchedule;
    } catch (err) {
      console.error(`Error updating schedule ${id}:`, err);
      return null;
    }
  }, []);

  // Delete a schedule
  const deleteSchedule = useCallback(async (id: string): Promise<boolean> => {
    try {
      const result = await syncService.deleteSchedule(id);
      if (result.success) {
        setSchedules(prev => prev.filter(schedule => schedule.id !== id));
        return true;
      }
      return false;
    } catch (err) {
      console.error(`Error deleting schedule ${id}:`, err);
      return false;
    }
  }, []);

  // Activate a schedule
  const activateSchedule = useCallback(async (id: string): Promise<SyncSchedule | null> => {
    try {
      const activatedSchedule = await syncService.activateSchedule(id);
      setSchedules(prev => 
        prev.map(item => item.id === id ? activatedSchedule : item)
      );
      return activatedSchedule;
    } catch (err) {
      console.error(`Error activating schedule ${id}:`, err);
      return null;
    }
  }, []);

  // Deactivate a schedule
  const deactivateSchedule = useCallback(async (id: string): Promise<SyncSchedule | null> => {
    try {
      const deactivatedSchedule = await syncService.deactivateSchedule(id);
      setSchedules(prev => 
        prev.map(item => item.id === id ? deactivatedSchedule : item)
      );
      return deactivatedSchedule;
    } catch (err) {
      console.error(`Error deactivating schedule ${id}:`, err);
      return null;
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // WebSocket real-time updates
  useEffect(() => {
    if (!enableRealtime) return;

    // Subscribe to schedule updates
    const unsubscribeScheduleUpdate = websocketService.subscribe('sync:schedule:updated', (updatedSchedule: SyncSchedule) => {
      setSchedules(prevSchedules => 
        prevSchedules.map(schedule => schedule.id === updatedSchedule.id ? updatedSchedule : schedule)
      );
    });

    // Subscribe to new schedule notifications
    const unsubscribeScheduleCreated = websocketService.subscribe('sync:schedule:created', (newSchedule: SyncSchedule) => {
      setSchedules(prevSchedules => [...prevSchedules, newSchedule]);
    });

    // Subscribe to schedule deletion notifications
    const unsubscribeScheduleDeleted = websocketService.subscribe('sync:schedule:deleted', (deletedId: string) => {
      setSchedules(prevSchedules => 
        prevSchedules.filter(schedule => schedule.id !== deletedId)
      );
    });

    return () => {
      unsubscribeScheduleUpdate();
      unsubscribeScheduleCreated();
      unsubscribeScheduleDeleted();
    };
  }, [enableRealtime]);

  return {
    schedules,
    isLoading,
    error,
    refetch: fetchSchedules,
    getSchedule,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    activateSchedule,
    deactivateSchedule
  };
}

export default useSyncSchedule;