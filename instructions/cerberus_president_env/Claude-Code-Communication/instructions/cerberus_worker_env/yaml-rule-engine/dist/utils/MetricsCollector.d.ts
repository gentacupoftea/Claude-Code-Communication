/**
 * メトリクス収集サービス
 * パフォーマンスとエラー率を追跡
 */
import { EventEmitter } from 'events';
import { FallbackResult, MetricsConfig, FallbackMetrics, StageMetric } from '../interfaces/IFallbackService';
export declare class MetricsCollector extends EventEmitter {
    private config;
    private totalRequests;
    private successfulRequests;
    private failedRequests;
    private cacheHits;
    private latencies;
    private stageMetrics;
    private stageLatencies;
    private exportTimer?;
    constructor(config: MetricsConfig);
    recordRequest(result: FallbackResult): void;
    recordStageMetric(stageName: string, success: boolean, latency: number): void;
    private calculatePercentile;
    getMetrics(): FallbackMetrics;
    getStageMetrics(stageName: string): StageMetric | undefined;
    export(): Promise<void>;
    private startAutoExport;
    reset(): void;
    shutdown(): void;
    getLatencyHistogram(buckets?: number[]): Map<string, number>;
}
//# sourceMappingURL=MetricsCollector.d.ts.map