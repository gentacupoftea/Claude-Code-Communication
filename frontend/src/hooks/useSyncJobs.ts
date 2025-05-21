import { useState, useEffect, useCallback } from 'react';
import syncService, { SyncJob, SyncJobFilter, SyncStats } from '../api/syncService';
import websocketService from '../services/websocketService';

interface UseSyncJobsResult {
  jobs: SyncJob[];
  stats: SyncStats | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  getJob: (jobId: string) => Promise<SyncJob | null>;
  startJob: (type: string, config?: Record<string, any>) => Promise<SyncJob | null>;
  cancelJob: (jobId: string) => Promise<boolean>;
  retryJob: (jobId: string) => Promise<SyncJob | null>;
  getJobLogs: (jobId: string) => Promise<{ timestamp: string; level: string; message: string }[]>;
}

/**
 * Hook for managing and monitoring sync jobs
 */
export function useSyncJobs(filters?: SyncJobFilter, enableRealtime = true): UseSyncJobsResult {
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch jobs function
  const fetchJobs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const fetchedJobs = await syncService.getJobs(filters);
      setJobs(fetchedJobs);
      
      // Also fetch stats for the same type filter if present
      if (filters?.type) {
        const jobStats = await syncService.getStats(filters.type);
        setStats(jobStats);
      } else {
        const jobStats = await syncService.getStats();
        setStats(jobStats);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch sync jobs'));
      console.error('Error fetching sync jobs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  // Fetch a specific job
  const getJob = useCallback(async (jobId: string): Promise<SyncJob | null> => {
    try {
      return await syncService.getJob(jobId);
    } catch (err) {
      console.error(`Error fetching job ${jobId}:`, err);
      return null;
    }
  }, []);

  // Start a new job
  const startJob = useCallback(async (type: string, config?: Record<string, any>): Promise<SyncJob | null> => {
    try {
      const newJob = await syncService.startJob(type, config);
      // Refresh the job list
      fetchJobs();
      return newJob;
    } catch (err) {
      console.error('Error starting sync job:', err);
      return null;
    }
  }, [fetchJobs]);

  // Cancel a job
  const cancelJob = useCallback(async (jobId: string): Promise<boolean> => {
    try {
      const result = await syncService.cancelJob(jobId);
      if (result.success) {
        // Update the job in our state to reflect the cancellation
        setJobs(prevJobs => 
          prevJobs.map(job => 
            job.id === jobId ? { ...job, status: 'failed', errorMessage: 'Cancelled by user' } : job
          )
        );
        return true;
      }
      return false;
    } catch (err) {
      console.error(`Error cancelling job ${jobId}:`, err);
      return false;
    }
  }, []);

  // Retry a failed job
  const retryJob = useCallback(async (jobId: string): Promise<SyncJob | null> => {
    try {
      const retriedJob = await syncService.retryJob(jobId);
      // Refresh the job list
      fetchJobs();
      return retriedJob;
    } catch (err) {
      console.error(`Error retrying job ${jobId}:`, err);
      return null;
    }
  }, [fetchJobs]);

  // Get job logs
  const getJobLogs = useCallback(async (jobId: string) => {
    try {
      return await syncService.getJobLogs(jobId);
    } catch (err) {
      console.error(`Error fetching logs for job ${jobId}:`, err);
      return [];
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // WebSocket real-time updates
  useEffect(() => {
    if (!enableRealtime) return;

    // Subscribe to job status updates
    const unsubscribeJobUpdate = websocketService.subscribe('sync:job:updated', (updatedJob: SyncJob) => {
      setJobs(prevJobs => 
        prevJobs.map(job => job.id === updatedJob.id ? updatedJob : job)
      );
    });

    // Subscribe to new job notifications
    const unsubscribeJobCreated = websocketService.subscribe('sync:job:created', (newJob: SyncJob) => {
      setJobs(prevJobs => [newJob, ...prevJobs]);
    });

    // Subscribe to stats updates
    const unsubscribeStatsUpdate = websocketService.subscribe('sync:stats:updated', (updatedStats: SyncStats) => {
      setStats(updatedStats);
    });

    return () => {
      unsubscribeJobUpdate();
      unsubscribeJobCreated();
      unsubscribeStatsUpdate();
    };
  }, [enableRealtime]);

  return {
    jobs,
    stats,
    isLoading,
    error,
    refetch: fetchJobs,
    getJob,
    startJob,
    cancelJob,
    retryJob,
    getJobLogs
  };
}

export default useSyncJobs;