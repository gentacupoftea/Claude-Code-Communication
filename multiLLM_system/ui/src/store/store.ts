import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit';

// System State
interface SystemState {
  status: 'healthy' | 'warning' | 'error' | 'unknown';
  uptime: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  lastUpdate: string;
}

const initialSystemState: SystemState = {
  status: 'healthy',
  uptime: '2d 14h 32m',
  version: '1.0.0',
  environment: 'development',
  lastUpdate: new Date().toISOString(),
};

const systemSlice = createSlice({
  name: 'system',
  initialState: initialSystemState,
  reducers: {
    updateStatus: (state, action: PayloadAction<SystemState['status']>) => {
      state.status = action.payload;
      state.lastUpdate = new Date().toISOString();
    },
    updateUptime: (state, action: PayloadAction<string>) => {
      state.uptime = action.payload;
    },
  },
});

// Workers State
interface Worker {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'idle' | 'error' | 'maintenance';
  model: string;
  currentTasks: number;
  maxTasks: number;
  totalTasks: number;
  successRate: number;
  averageLatency: number;
  memoryUsage: number;
  lastActivity: string;
}

interface WorkersState {
  workers: Worker[];
  activeCount: number;
  totalCount: number;
}

const initialWorkersState: WorkersState = {
  workers: [
    {
      id: 'worker-001',
      name: 'Backend Worker',
      type: 'backend',
      status: 'active',
      model: 'gpt-4-turbo',
      currentTasks: 3,
      maxTasks: 5,
      totalTasks: 156,
      successRate: 98.5,
      averageLatency: 1250,
      memoryUsage: 75,
      lastActivity: new Date().toISOString(),
    },
    {
      id: 'worker-002',
      name: 'Frontend Worker',
      type: 'frontend',
      status: 'active',
      model: 'claude-3-sonnet',
      currentTasks: 1,
      maxTasks: 3,
      totalTasks: 89,
      successRate: 97.2,
      averageLatency: 980,
      memoryUsage: 60,
      lastActivity: new Date().toISOString(),
    },
    {
      id: 'worker-003',
      name: 'Review Worker',
      type: 'review',
      status: 'active',
      model: 'gpt-4',
      currentTasks: 2,
      maxTasks: 3,
      totalTasks: 203,
      successRate: 99.1,
      averageLatency: 2100,
      memoryUsage: 85,
      lastActivity: new Date().toISOString(),
    },
    {
      id: 'worker-004',
      name: 'Analytics Worker',
      type: 'analytics',
      status: 'idle',
      model: 'gemini-1.5-pro',
      currentTasks: 0,
      maxTasks: 2,
      totalTasks: 67,
      successRate: 96.8,
      averageLatency: 1800,
      memoryUsage: 45,
      lastActivity: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
    },
  ],
  activeCount: 4,
  totalCount: 4,
};

const workersSlice = createSlice({
  name: 'workers',
  initialState: initialWorkersState,
  reducers: {
    updateWorkerStatus: (state, action: PayloadAction<{ id: string; status: Worker['status'] }>) => {
      const worker = state.workers.find(w => w.id === action.payload.id);
      if (worker) {
        worker.status = action.payload.status;
        worker.lastActivity = new Date().toISOString();
      }
      state.activeCount = state.workers.filter(w => w.status === 'active').length;
    },
    updateWorkerTasks: (state, action: PayloadAction<{ id: string; currentTasks: number }>) => {
      const worker = state.workers.find(w => w.id === action.payload.id);
      if (worker) {
        worker.currentTasks = action.payload.currentTasks;
        worker.lastActivity = new Date().toISOString();
      }
    },
    addWorker: (state, action: PayloadAction<Worker>) => {
      state.workers.push(action.payload);
      state.totalCount += 1;
      if (action.payload.status === 'active') {
        state.activeCount += 1;
      }
    },
  },
});

// Tasks State
interface Task {
  id: string;
  type: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  workerId: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  result?: any;
  error?: string;
}

interface TasksState {
  tasks: Task[];
  activeCount: number;
  completedCount: number;
  failedCount: number;
  totalCount: number;
}

const initialTasksState: TasksState = {
  tasks: [
    {
      id: 'task-001',
      type: 'PR Review',
      description: 'Review pull request #123',
      status: 'completed',
      workerId: 'worker-003',
      priority: 'high',
      createdAt: new Date(Date.now() - 120000).toISOString(),
      startedAt: new Date(Date.now() - 110000).toISOString(),
      completedAt: new Date(Date.now() - 95000).toISOString(),
      duration: 15000,
    },
    {
      id: 'task-002',
      type: 'Code Generation',
      description: 'Generate API endpoint code',
      status: 'running',
      workerId: 'worker-001',
      priority: 'medium',
      createdAt: new Date(Date.now() - 30000).toISOString(),
      startedAt: new Date(Date.now() - 25000).toISOString(),
    },
    {
      id: 'task-003',
      type: 'Bug Analysis',
      description: 'Analyze bug report #456',
      status: 'completed',
      workerId: 'worker-001',
      priority: 'high',
      createdAt: new Date(Date.now() - 180000).toISOString(),
      startedAt: new Date(Date.now() - 175000).toISOString(),
      completedAt: new Date(Date.now() - 160000).toISOString(),
      duration: 15000,
    },
  ],
  activeCount: 1,
  completedCount: 287,
  failedCount: 4,
  totalCount: 292,
};

const tasksSlice = createSlice({
  name: 'tasks',
  initialState: initialTasksState,
  reducers: {
    addTask: (state, action: PayloadAction<Task>) => {
      state.tasks.unshift(action.payload);
      state.totalCount += 1;
      if (action.payload.status === 'running') {
        state.activeCount += 1;
      }
      // Keep only latest 100 tasks in state
      if (state.tasks.length > 100) {
        state.tasks = state.tasks.slice(0, 100);
      }
    },
    updateTaskStatus: (state, action: PayloadAction<{ id: string; status: Task['status']; result?: any; error?: string }>) => {
      const task = state.tasks.find(t => t.id === action.payload.id);
      if (task) {
        const oldStatus = task.status;
        task.status = action.payload.status;
        
        if (action.payload.status === 'running' && oldStatus !== 'running') {
          task.startedAt = new Date().toISOString();
          state.activeCount += 1;
        }
        
        if (action.payload.status === 'completed') {
          task.completedAt = new Date().toISOString();
          task.result = action.payload.result;
          if (task.startedAt) {
            task.duration = new Date().getTime() - new Date(task.startedAt).getTime();
          }
          if (oldStatus === 'running') {
            state.activeCount -= 1;
          }
          state.completedCount += 1;
        }
        
        if (action.payload.status === 'failed') {
          task.completedAt = new Date().toISOString();
          task.error = action.payload.error;
          if (task.startedAt) {
            task.duration = new Date().getTime() - new Date(task.startedAt).getTime();
          }
          if (oldStatus === 'running') {
            state.activeCount -= 1;
          }
          state.failedCount += 1;
        }
      }
    },
  },
});

// Memory State
interface MemoryState {
  syncStatus: 'synced' | 'syncing' | 'error' | 'disabled';
  lastSync: string;
  totalEntries: number;
  syncInterval: number;
  conflictResolution: 'latest' | 'merge' | 'manual';
}

const initialMemoryState: MemoryState = {
  syncStatus: 'synced',
  lastSync: new Date(Date.now() - 180000).toISOString(), // 3 minutes ago
  totalEntries: 1247,
  syncInterval: 300, // 5 minutes
  conflictResolution: 'latest',
};

const memorySlice = createSlice({
  name: 'memory',
  initialState: initialMemoryState,
  reducers: {
    updateSyncStatus: (state, action: PayloadAction<MemoryState['syncStatus']>) => {
      state.syncStatus = action.payload;
      if (action.payload === 'synced') {
        state.lastSync = new Date().toISOString();
      }
    },
    updateTotalEntries: (state, action: PayloadAction<number>) => {
      state.totalEntries = action.payload;
    },
  },
});

// Analytics State
interface AnalyticsState {
  metrics: {
    totalRequests: number;
    averageLatency: number;
    errorRate: number;
    throughput: number;
  };
  trends: {
    daily: Array<{ date: string; requests: number; latency: number; errors: number }>;
    hourly: Array<{ hour: string; requests: number; latency: number; errors: number }>;
  };
}

const initialAnalyticsState: AnalyticsState = {
  metrics: {
    totalRequests: 2847,
    averageLatency: 1450,
    errorRate: 1.2,
    throughput: 45.6,
  },
  trends: {
    daily: [],
    hourly: [],
  },
};

const analyticsSlice = createSlice({
  name: 'analytics',
  initialState: initialAnalyticsState,
  reducers: {
    updateMetrics: (state, action: PayloadAction<Partial<AnalyticsState['metrics']>>) => {
      state.metrics = { ...state.metrics, ...action.payload };
    },
  },
});

// Root Store
export const store = configureStore({
  reducer: {
    system: systemSlice.reducer,
    workers: workersSlice.reducer,
    tasks: tasksSlice.reducer,
    memory: memorySlice.reducer,
    analytics: analyticsSlice.reducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Action exports
export const systemActions = systemSlice.actions;
export const workersActions = workersSlice.actions;
export const tasksActions = tasksSlice.actions;
export const memoryActions = memorySlice.actions;
export const analyticsActions = analyticsSlice.actions;