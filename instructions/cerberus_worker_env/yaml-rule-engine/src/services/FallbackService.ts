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
import { logger } from '../utils/logger';
import {
  IFallbackService,
  IFallbackStage,
  FallbackResult,
  FallbackConfig,
  CircuitBreakerState,
  HealthStatus,
  FallbackMetrics,
  StageMetric,
  StageHealth
} from '../interfaces/IFallbackService';
import { CacheService } from './CacheService';
import { CircuitBreaker } from '../utils/CircuitBreaker';
import { MetricsCollector } from '../utils/MetricsCollector';

export class FallbackService extends EventEmitter implements IFallbackService {
  private stages: Map<string, IFallbackStage>;
  private circuitBreakers: Map<string, CircuitBreaker>;
  private cache: CacheService;
  private metrics: MetricsCollector;
  private config: FallbackConfig;
  private stageOrder: string[];

  constructor(config: FallbackConfig) {
    super();
    this.config = config;
    this.stages = new Map();
    this.circuitBreakers = new Map();
    this.stageOrder = [];

    // Initialize services
    this.cache = new CacheService(config.cacheConfig);
    this.metrics = new MetricsCollector(config.metrics);

    // Register stages
    this.registerStages(config.stages);
  }

  private registerStages(stages: IFallbackStage[]): void {
    // Sort stages by priority
    const sortedStages = stages.sort((a, b) => a.priority - b.priority);

    for (const stage of sortedStages) {
      this.stages.set(stage.name, stage);
      this.stageOrder.push(stage.name);

      // Create circuit breaker for each stage
      this.circuitBreakers.set(stage.name, new CircuitBreaker({
        threshold: this.config.circuitBreakerThreshold,
        timeout: this.config.circuitBreakerTimeout,
        resetTimeout: 60000 // 1分後にリセット
      }));
    }

    logger.info('Fallback stages registered', { stages: this.stageOrder });
  }

  async execute(input: any): Promise<FallbackResult> {
    const startTime = Date.now();
    const executionId = this.generateExecutionId();

    logger.info('Starting fallback execution', { executionId, input });
    this.emit('execution:start', { executionId, input });

    // Check cache first (if not stage 1 or 2)
    const cacheKey = this.generateCacheKey(input);
    const cachedResult = await this.cache.get(cacheKey);
    
    if (cachedResult) {
      const result: FallbackResult = {
        success: true,
        data: cachedResult,
        stage: 'cache',
        duration: Date.now() - startTime,
        metadata: {
          source: 'cache',
          cacheHit: true
        }
      };

      this.metrics.recordRequest(result);
      this.emit('execution:complete', { executionId, result });
      return result;
    }

    // Execute stages in order
    for (const stageName of this.stageOrder) {
      const stage = this.stages.get(stageName)!;
      const circuitBreaker = this.circuitBreakers.get(stageName)!;

      // Check circuit breaker
      if (!circuitBreaker.canExecute()) {
        logger.warn('Circuit breaker open for stage', { stage: stageName });
        continue;
      }

      try {
        const stageStartTime = Date.now();
        
        // Execute with timeout and retry
        const result = await this.executeStageWithRetry(stage, input);
        
        const stageDuration = Date.now() - stageStartTime;

        if (result.success) {
          // Record success
          circuitBreaker.recordSuccess();
          
          // Cache successful results from stages 1 and 2
          if (stage.priority <= 2) {
            await this.cache.set(cacheKey, result.data);
          }

          const finalResult: FallbackResult = {
            ...result,
            stage: stageName,
            duration: Date.now() - startTime,
            metadata: {
              ...result.metadata,
              source: stageName,
              stageDuration
            }
          };

          this.metrics.recordRequest(finalResult);
          this.metrics.recordStageMetric(stageName, true, stageDuration);
          this.emit('execution:complete', { executionId, result: finalResult });

          return finalResult;
        }
      } catch (error) {
        logger.error('Stage execution failed', { 
          stage: stageName, 
          error: error.message 
        });

        // Record failure
        circuitBreaker.recordFailure();
        this.metrics.recordStageMetric(stageName, false, 0);

        // Continue to next stage
        continue;
      }
    }

    // All stages failed
    const failureResult: FallbackResult = {
      success: false,
      error: new Error('All fallback stages failed'),
      stage: 'none',
      duration: Date.now() - startTime,
      metadata: {
        source: 'failure',
        fallbackReason: 'All stages exhausted'
      }
    };

    this.metrics.recordRequest(failureResult);
    this.emit('execution:failed', { executionId, result: failureResult });

    return failureResult;
  }

  private async executeStageWithRetry(
    stage: IFallbackStage, 
    input: any
  ): Promise<FallbackResult> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= stage.retryCount; attempt++) {
      try {
        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Stage timeout')), stage.timeout);
        });

        // Race between execution and timeout
        const result = await Promise.race([
          stage.execute(input),
          timeoutPromise
        ]);

        return result;
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < stage.retryCount) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 100;
          await this.sleep(delay);
          
          logger.debug('Retrying stage', { 
            stage: stage.name, 
            attempt: attempt + 1,
            delay 
          });
        }
      }
    }

    throw lastError || new Error('Stage execution failed');
  }

  getHealthStatus(): HealthStatus {
    const stageHealths: StageHealth[] = [];

    for (const [stageName, stage] of this.stages) {
      const circuitBreaker = this.circuitBreakers.get(stageName)!;
      const metrics = this.metrics.getStageMetrics(stageName);

      stageHealths.push({
        name: stageName,
        available: circuitBreaker.getState().state !== 'OPEN',
        circuitBreaker: circuitBreaker.getState(),
        latency: metrics?.averageLatency || 0,
        successRate: this.calculateSuccessRate(metrics)
      });
    }

    const overall = this.calculateOverallHealth(stageHealths);

    return {
      overall,
      stages: stageHealths,
      lastCheck: new Date()
    };
  }

  private calculateSuccessRate(metrics: StageMetric | undefined): number {
    if (!metrics || metrics.invocations === 0) {
      return 0;
    }
    return (metrics.successes / metrics.invocations) * 100;
  }

  private calculateOverallHealth(stages: StageHealth[]): 'healthy' | 'degraded' | 'unhealthy' {
    const availableStages = stages.filter(s => s.available).length;
    const totalStages = stages.length;

    if (availableStages === totalStages) {
      return 'healthy';
    } else if (availableStages >= Math.ceil(totalStages / 2)) {
      return 'degraded';
    } else {
      return 'unhealthy';
    }
  }

  resetCircuitBreaker(stageName: string): void {
    const circuitBreaker = this.circuitBreakers.get(stageName);
    if (circuitBreaker) {
      circuitBreaker.reset();
      logger.info('Circuit breaker reset', { stage: stageName });
    }
  }

  clearCache(): void {
    this.cache.clear();
    logger.info('Cache cleared');
  }

  getMetrics(): FallbackMetrics {
    return this.metrics.getMetrics();
  }

  private generateCacheKey(input: any): string {
    // Create a deterministic cache key from input
    const inputStr = JSON.stringify(input, Object.keys(input).sort());
    return `fallback:${this.hash(inputStr)}`;
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private hash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    logger.info('Shutting down fallback service');
    
    // Export final metrics
    await this.metrics.export();
    
    // Clear resources
    this.cache.shutdown();
    this.removeAllListeners();
  }
}