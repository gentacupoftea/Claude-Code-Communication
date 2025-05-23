import { api } from '../services/api';

const isMockMode = process.env.REACT_APP_USE_MOCK_AUTH === 'true';

// Mock sync data
const mockJobs: SyncJob[] = [
  {
    id: 'job-1',
    type: 'shopify',
    status: 'completed',
    progress: 100,
    startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    dataProcessed: 342,
    totalItems: 342,
    metadata: { store: 'demo-store' },
  },
  {
    id: 'job-2',
    type: 'rakuten',
    status: 'running',
    progress: 65,
    startedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    dataProcessed: 195,
    totalItems: 300,
    metadata: { store: 'rakuten-store' },
  },
  {
    id: 'job-3',
    type: 'amazon',
    status: 'failed',
    progress: 25,
    startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    errorMessage: 'API rate limit exceeded',
    dataProcessed: 50,
    totalItems: 200,
    metadata: { store: 'amazon-store' },
  },
];

const mockSchedules: SyncSchedule[] = [
  {
    id: 'schedule-1',
    type: 'shopify',
    frequency: 'daily',
    nextRunAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    lastRunAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    lastJobId: 'job-1',
    isActive: true,
    timeZone: 'Asia/Tokyo',
  },
  {
    id: 'schedule-2',
    type: 'rakuten',
    frequency: 'hourly',
    nextRunAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    lastRunAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    lastJobId: 'job-2',
    isActive: true,
    timeZone: 'Asia/Tokyo',
  },
];

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
    if (isMockMode) {
      let filteredJobs = [...mockJobs];
      
      if (filters?.type) {
        filteredJobs = filteredJobs.filter(job => job.type === filters.type);
      }
      
      if (filters?.status) {
        filteredJobs = filteredJobs.filter(job => job.status === filters.status);
      }
      
      if (filters?.limit) {
        filteredJobs = filteredJobs.slice(0, filters.limit);
      }
      
      return Promise.resolve(filteredJobs);
    }
    
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
    if (isMockMode) {
      const stats = type ? mockJobs.filter(job => job.type === type) : mockJobs;
      const completed = stats.filter(job => job.status === 'completed').length;
      const failed = stats.filter(job => job.status === 'failed').length;
      
      return Promise.resolve({
        totalJobs: stats.length,
        completedJobs: completed,
        failedJobs: failed,
        averageJobDuration: 3600, // 1 hour in seconds
        totalDataProcessed: stats.reduce((sum, job) => sum + (job.dataProcessed || 0), 0),
        latestJobStatus: stats[0]?.status || 'none',
      });
    }
    
    const response = await api.get('/api/sync/stats', { params: { type } });
    return response.data;
  },

  /**
   * Get sync schedules
   */
  getSchedules: async (): Promise<SyncSchedule[]> => {
    if (isMockMode) {
      return Promise.resolve(mockSchedules);
    }
    
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