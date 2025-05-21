import { api } from '../services/api';

export interface SyncJob {
  id: string;
  type: 'shopify' | 'rakuten' | 'amazon' | 'custom';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
  dataProcessed?: number;
  totalItems?: number;
  metadata?: Record<string, any>;
}

export interface SyncSchedule {
  id: string;
  type: 'shopify' | 'rakuten' | 'amazon' | 'custom';
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';
  nextRunAt: string;
  lastRunAt?: string;
  lastJobId?: string;
  isActive: boolean;
  cronExpression?: string;
  timeZone: string;
  config?: Record<string, any>;
}

export interface SyncStats {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageJobDuration: number; // in seconds
  totalDataProcessed: number;
  latestJobStatus: 'none' | 'pending' | 'running' | 'completed' | 'failed';
}

export interface SyncJobFilter {
  type?: 'shopify' | 'rakuten' | 'amazon' | 'custom';
  status?: 'pending' | 'running' | 'completed' | 'failed';
  startDate?: string;
  endDate?: string;
  limit?: number;
}

/**
 * API service for sync job management and monitoring
 */
const syncService = {
  /**
   * Get a list of sync jobs with optional filtering
   */
  getJobs: async (filters?: SyncJobFilter): Promise<SyncJob[]> => {
    const response = await api.get('/api/sync/jobs', { params: filters });
    return response.data;
  },

  /**
   * Get a specific sync job by ID
   */
  getJob: async (jobId: string): Promise<SyncJob> => {
    const response = await api.get(`/api/sync/jobs/${jobId}`);
    return response.data;
  },

  /**
   * Get real-time job status
   */
  getJobStatus: async (jobId: string): Promise<{ status: string; progress: number; message?: string }> => {
    const response = await api.get(`/api/sync/jobs/${jobId}/status`);
    return response.data;
  },

  /**
   * Start a new sync job
   */
  startJob: async (type: string, config?: Record<string, any>): Promise<SyncJob> => {
    const response = await api.post('/api/sync/jobs', { type, config });
    return response.data;
  },

  /**
   * Cancel a running sync job
   */
  cancelJob: async (jobId: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.post(`/api/sync/jobs/${jobId}/cancel`);
    return response.data;
  },

  /**
   * Retry a failed sync job
   */
  retryJob: async (jobId: string): Promise<SyncJob> => {
    const response = await api.post(`/api/sync/jobs/${jobId}/retry`);
    return response.data;
  },

  /**
   * Get sync job statistics
   */
  getStats: async (type?: string): Promise<SyncStats> => {
    const response = await api.get('/api/sync/stats', { params: { type } });
    return response.data;
  },

  /**
   * Get sync schedules
   */
  getSchedules: async (): Promise<SyncSchedule[]> => {
    const response = await api.get('/api/sync/schedules');
    return response.data;
  },

  /**
   * Get a specific sync schedule
   */
  getSchedule: async (id: string): Promise<SyncSchedule> => {
    const response = await api.get(`/api/sync/schedules/${id}`);
    return response.data;
  },

  /**
   * Create a new sync schedule
   */
  createSchedule: async (schedule: Omit<SyncSchedule, 'id'>): Promise<SyncSchedule> => {
    const response = await api.post('/api/sync/schedules', schedule);
    return response.data;
  },

  /**
   * Update a sync schedule
   */
  updateSchedule: async (id: string, schedule: Partial<SyncSchedule>): Promise<SyncSchedule> => {
    const response = await api.put(`/api/sync/schedules/${id}`, schedule);
    return response.data;
  },

  /**
   * Delete a sync schedule
   */
  deleteSchedule: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete(`/api/sync/schedules/${id}`);
    return response.data;
  },

  /**
   * Activate a sync schedule
   */
  activateSchedule: async (id: string): Promise<SyncSchedule> => {
    const response = await api.post(`/api/sync/schedules/${id}/activate`);
    return response.data;
  },

  /**
   * Deactivate a sync schedule
   */
  deactivateSchedule: async (id: string): Promise<SyncSchedule> => {
    const response = await api.post(`/api/sync/schedules/${id}/deactivate`);
    return response.data;
  },

  /**
   * Get logs for a specific sync job
   */
  getJobLogs: async (jobId: string): Promise<{ timestamp: string; level: string; message: string }[]> => {
    const response = await api.get(`/api/sync/jobs/${jobId}/logs`);
    return response.data;
  }
};

export default syncService;