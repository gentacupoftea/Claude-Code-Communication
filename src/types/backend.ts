/**
 * Backend integration type definitions
 */

export interface BackendConfig {
  apiUrl: string;
  apiKey?: string;
  timeout?: number;
  retryAttempts?: number;
  headers?: Record<string, string>;
}

export interface BackendResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  metadata?: {
    timestamp: Date;
    requestId: string;
    duration: number;
  };
}

export interface BackendRequest {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  params?: Record<string, unknown>;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface BackendError extends Error {
  code: string;
  statusCode?: number;
  details?: Record<string, unknown>;
  requestId?: string;
}

export interface AuthToken {
  token: string;
  expiresAt: Date;
  refreshToken?: string;
  tokenType: string;
}

export interface UserSession {
  user: {
    id: string;
    email: string;
    name?: string;
    role?: string;
  };
  auth: AuthToken;
  permissions?: string[];
}

export interface ApiEndpoint {
  path: string;
  method: string;
  authenticated: boolean;
  rateLimit?: {
    requests: number;
    window: number;
  };
  cache?: {
    ttl: number;
    key?: string;
  };
}

export interface WebSocketMessage {
  type: string;
  payload: unknown;
  timestamp: Date;
  id?: string;
}

export interface WebSocketConfig {
  url: string;
  protocols?: string[];
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export interface SyncStatus {
  isConnected: boolean;
  lastSync: Date | null;
  syncInProgress: boolean;
  queueStatus: QueueStatus;
  errors: SyncError[];
  syncedProjects?: number;
  totalProjects?: number;
  pendingChanges?: number;
  conflicts: SyncConflict[];
}

export interface SyncConflict {
  id: string;
  type: string;
  localValue: unknown;
  remoteValue: unknown;
  timestamp: Date;
}

export interface QueueStatus {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  totalItems: number;
}

export interface SyncData {
  id?: string;
  type: string;
  data: unknown;
  priority?: 'low' | 'normal' | 'high';
  timestamp?: Date;
  status?: 'pending' | 'syncing' | 'completed' | 'failed';
  error?: string;
}

export interface SyncError {
  id: string;
  message: string;
  timestamp: Date;
  type: string;
  details?: Record<string, unknown>;
}

export interface BackendIntegrationService {
  getStatus(): SyncStatus;
  syncData(data: SyncData): Promise<void>;
  getQueueStatus(): QueueStatus;
  clearQueue(): Promise<void>;
  retryFailed(): Promise<void>;
  connect(): Promise<void>;
  disconnect(): void;
}

export interface APIHealthResponse {
  status: 'healthy' | 'degraded' | 'down';
  version: string;
  uptime: number;
  services: {
    database: ServiceHealth;
    cache: ServiceHealth;
    queue: ServiceHealth;
    storage?: ServiceHealth;
  };
  timestamp: Date;
}

export interface ServiceHealth {
  status: 'up' | 'down' | 'degraded';
  latency?: number;
  message?: string;
}

export interface ProjectSyncData {
  id: string;
  name: string;
  version?: string;
  lastSync?: Date;
  syncStatus: 'synced' | 'pending' | 'error' | 'syncing' | 'conflict';
  items: {
    total: number;
    synced: number;
    pending: number;
    failed: number;
  };
  error?: string;
}

export interface OfflineCapability {
  enabled: boolean;
  cacheSize: number;
  maxCacheSize: number;
  pendingChanges: number;
  lastOnline?: Date;
  syncOnReconnect: boolean;
  storedData: number;
  storageLimit: number;
  lastOfflineSync?: Date;
  autoSync: boolean;
}

export interface BackendMessage {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  timestamp: Date;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  data?: unknown;
  action?: {
    label: string;
    handler: () => void;
  };
}