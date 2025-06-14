/**
 * 5段階フォールバックシステムの実装
 *
 * 段階:
 * 1. プライマリAPI (最速・最新データ)
 * 2. セカンダリAPI (バックアップAPI)
 * 3. キャッシュ (Redis/メモリキャッシュ)
 * 4. ローカルLLM (オフライン推論)
 * 5. 静的デフォルト値 (最終手段)
 */
import { EventEmitter } from 'events';
import { IFallbackService, FallbackResult, FallbackConfig, HealthStatus, FallbackMetrics } from '../interfaces/IFallbackService';
export declare class FallbackService extends EventEmitter implements IFallbackService {
    private stages;
    private circuitBreakers;
    private cache;
    private metrics;
    private config;
    private stageOrder;
    constructor(config: FallbackConfig);
    private registerStages;
    execute(input: any): Promise<FallbackResult>;
    private executeStageWithRetry;
    getHealthStatus(): HealthStatus;
    private calculateSuccessRate;
    private calculateOverallHealth;
    resetCircuitBreaker(stageName: string): void;
    clearCache(): void;
    getMetrics(): FallbackMetrics;
    private generateCacheKey;
    private generateExecutionId;
    private hash;
    private sleep;
    shutdown(): Promise<void>;
}
//# sourceMappingURL=FallbackService.d.ts.map