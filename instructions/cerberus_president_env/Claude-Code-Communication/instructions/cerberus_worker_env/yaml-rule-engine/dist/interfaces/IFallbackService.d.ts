/**
 * 5段階フォールバックシステムのインターフェース定義
 */
export interface IFallbackStage {
    name: string;
    priority: number;
    timeout: number;
    retryCount: number;
    execute: (input: any) => Promise<FallbackResult>;
}
export interface FallbackResult {
    success: boolean;
    data?: any;
    error?: Error;
    stage: string;
    duration: number;
    metadata?: {
        source: string;
        cacheHit?: boolean;
        fallbackReason?: string;
    };
}
export interface FallbackConfig {
    stages: IFallbackStage[];
    circuitBreakerThreshold: number;
    circuitBreakerTimeout: number;
    cacheConfig: CacheConfig;
    metrics: MetricsConfig;
}
export interface CacheConfig {
    ttl: number;
    maxSize: number;
    strategy: 'LRU' | 'LFU' | 'FIFO';
}
export interface MetricsConfig {
    enabled: boolean;
    sampleRate: number;
    exportInterval: number;
}
export interface CircuitBreakerState {
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    failures: number;
    lastFailureTime: number;
    nextRetryTime: number;
    successCount: number;
}
export interface IFallbackService {
    execute(input: any): Promise<FallbackResult>;
    getHealthStatus(): HealthStatus;
    resetCircuitBreaker(stageName: string): void;
    clearCache(): void;
    getMetrics(): FallbackMetrics;
}
export interface HealthStatus {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    stages: StageHealth[];
    lastCheck: Date;
}
export interface StageHealth {
    name: string;
    available: boolean;
    circuitBreaker: CircuitBreakerState;
    latency: number;
    successRate: number;
}
export interface FallbackMetrics {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    cacheHitRate: number;
    averageLatency: number;
    stageMetrics: Map<string, StageMetric>;
}
export interface StageMetric {
    invocations: number;
    successes: number;
    failures: number;
    averageLatency: number;
    p95Latency: number;
    p99Latency: number;
}
//# sourceMappingURL=IFallbackService.d.ts.map