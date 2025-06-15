/**
 * プラグインフレームワーク インターフェース定義
 * Version: 1.0.0
 */

// プラグインの状態
export enum PluginState {
  UNLOADED = 'unloaded',
  LOADING = 'loading',
  LOADED = 'loaded',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
  UNLOADING = 'unloading'
}

// プラグインメタデータ
export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  category: 'ec' | 'pos' | 'analytics' | 'utility' | 'custom';
  tags: string[];
  homepage?: string;
  repository?: string;
}

// プラグイン依存関係
export interface PluginDependency {
  id: string;
  version: string;
  optional?: boolean;
}

// プラグインライフサイクル
export interface PluginLifecycle {
  load(): Promise<void>;
  initialize(context: PluginContext): Promise<void>;
  activate(): Promise<void>;
  deactivate(): Promise<void>;
  unload(): Promise<void>;
}

// プラグインコンテキスト
export interface PluginContext {
  logger: Logger;
  config: ConfigManager;
  events: EventEmitter;
  storage: StorageAdapter;
  metrics: MetricsCollector;
  features: FeatureFlags;
}

// ロガーインターフェース
export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

// 設定管理インターフェース
export interface ConfigManager {
  get<T = unknown>(key: string): T;
  set(key: string, value: unknown): void;
  has(key: string): boolean;
  delete(key: string): void;
}

// イベントエミッター
export interface EventEmitter {
  on(event: string, handler: Function): void;
  off(event: string, handler: Function): void;
  emit(event: string, ...args: unknown[]): void;
  once(event: string, handler: Function): void;
}

// ストレージアダプター
export interface StorageAdapter {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  clear(): Promise<void>;
}

// メトリクス収集
export interface MetricsCollector {
  increment(metric: string, value?: number, tags?: Record<string, string>): void;
  gauge(metric: string, value: number, tags?: Record<string, string>): void;
  histogram(metric: string, value: number, tags?: Record<string, string>): void;
  timing(metric: string, duration: number, tags?: Record<string, string>): void;
}

// フィーチャーフラグ
export interface FeatureFlags {
  isEnabled(flag: string, context?: Record<string, unknown>): boolean;
  getVariation<T = unknown>(flag: string, defaultValue: T, context?: Record<string, unknown>): T;
  getAllFlags(): Record<string, boolean>;
}

// APIサービスインターフェース（統一API仕様書から）
export interface APIService {
  init(config: APIConfig): Promise<void>;
  healthCheck(): Promise<HealthCheckResult>;
  execute(request: APIRequest): Promise<APIResponse>;
  dispose(): Promise<void>;
}

// API設定
export interface APIConfig {
  service: {
    name: string;
    version: string;
    description: string;
  };
  auth: {
    type: 'api_key' | 'oauth2' | 'basic' | 'custom';
    credentials: Record<string, unknown>;
  };
  endpoints: {
    base: string;
    timeout: number;
    retryPolicy: RetryPolicy;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    format: 'json' | 'text';
  };
}

// リトライポリシー
export interface RetryPolicy {
  maxRetries: number;
  backoffMultiplier: number;
  initialDelay: number;
}

// ヘルスチェック結果
export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  checks?: HealthCheck[];
  error?: string;
  timestamp: string;
}

// 個別ヘルスチェック
export interface HealthCheck {
  name: string;
  healthy: boolean;
  message?: string;
  duration?: number;
}

// APIリクエスト
export interface APIRequest {
  method: string;
  endpoint: string;
  params?: Record<string, unknown>;
  data?: unknown;
  headers?: Record<string, string>;
}

// APIレスポンス
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: APIError;
  metadata: ResponseMetadata;
  pagination?: PaginationInfo;
}

// APIエラー
export interface APIError {
  code: string | number;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
  traceId: string;
  service: string;
}

// レスポンスメタデータ
export interface ResponseMetadata {
  timestamp: string;
  requestId: string;
  service: string;
  version: string;
  executionTime: number;
}

// ページネーション情報
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
}

// プラグイン本体インターフェース
export interface Plugin {
  metadata: PluginMetadata;
  lifecycle: PluginLifecycle;
  service: APIService;
  configSchema: object;
  dependencies?: PluginDependency[];
}

// プラグインマニフェスト
export interface PluginManifest {
  plugin: {
    id: string;
    name: string;
    version: string;
    description: string;
    author: string;
    license: string;
    category: string;
    tags: string[];
  };
  runtime: {
    engine: string;
    version: string;
  };
  dependencies?: Array<{
    id: string;
    version: string;
  }>;
  permissions?: {
    network?: string;
    filesystem?: string;
    environment?: string[];
  };
  exports: {
    service: string;
    config: string;
  };
}

// プラグインリソース制限
export interface PluginResourceLimits {
  cpu: {
    maxUsage: number;
    throttling: boolean;
  };
  memory: {
    maxHeapSize: number;
    maxRss: number;
  };
  network: {
    maxBandwidth: number;
    maxConnections: number;
  };
  execution: {
    maxDuration: number;
    timeout: number;
  };
}

// プラグインサンドボックス設定
export interface PluginSandbox {
  allowedAPIs: string[];
  filesystem: {
    readPaths: string[];
    writePaths: string[];
  };
  network: {
    allowedHosts: string[];
    blockedPorts: number[];
  };
  environment: {
    allowedVars: string[];
  };
}

// フィーチャーフラグ定義
export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rollout: RolloutStrategy;
  conditions?: FlagCondition[];
}

// ロールアウト戦略
export interface RolloutStrategy {
  type: 'all' | 'percentage' | 'user_list' | 'gradual';
  value: unknown;
  schedule?: {
    start: Date;
    end: Date;
    steps: RolloutStep[];
  };
}

// ロールアウトステップ
export interface RolloutStep {
  percentage: number;
  date: string;
}

// フラグ条件
export interface FlagCondition {
  type: 'user' | 'group' | 'time' | 'custom';
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
  value: unknown;
}

// バリデーション結果
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// バリデーションエラー
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}