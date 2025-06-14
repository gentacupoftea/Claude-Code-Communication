"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FallbackService = void 0;
const events_1 = require("events");
const logger_1 = require("../utils/logger");
const CacheService_1 = require("./CacheService");
const CircuitBreaker_1 = require("../utils/CircuitBreaker");
const MetricsCollector_1 = require("../utils/MetricsCollector");
class FallbackService extends events_1.EventEmitter {
    stages;
    circuitBreakers;
    cache;
    metrics;
    config;
    stageOrder;
    constructor(config) {
        super();
        this.config = config;
        this.stages = new Map();
        this.circuitBreakers = new Map();
        this.stageOrder = [];
        // Initialize services
        this.cache = new CacheService_1.CacheService(config.cacheConfig);
        this.metrics = new MetricsCollector_1.MetricsCollector(config.metrics);
        // Register stages
        this.registerStages(config.stages);
    }
    registerStages(stages) {
        // Sort stages by priority
        const sortedStages = stages.sort((a, b) => a.priority - b.priority);
        for (const stage of sortedStages) {
            this.stages.set(stage.name, stage);
            this.stageOrder.push(stage.name);
            // Create circuit breaker for each stage
            this.circuitBreakers.set(stage.name, new CircuitBreaker_1.CircuitBreaker({
                threshold: this.config.circuitBreakerThreshold,
                timeout: this.config.circuitBreakerTimeout,
                resetTimeout: 60000 // 1分後にリセット
            }));
        }
        logger_1.logger.info('Fallback stages registered', { stages: this.stageOrder });
    }
    async execute(input) {
        const startTime = Date.now();
        const executionId = this.generateExecutionId();
        logger_1.logger.info('Starting fallback execution', { executionId, input });
        this.emit('execution:start', { executionId, input });
        // Check cache first (if not stage 1 or 2)
        const cacheKey = this.generateCacheKey(input);
        const cachedResult = await this.cache.get(cacheKey);
        if (cachedResult) {
            const result = {
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
            const stage = this.stages.get(stageName);
            const circuitBreaker = this.circuitBreakers.get(stageName);
            // Check circuit breaker
            if (!circuitBreaker.canExecute()) {
                logger_1.logger.warn('Circuit breaker open for stage', { stage: stageName });
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
                    const finalResult = {
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
            }
            catch (error) {
                logger_1.logger.error('Stage execution failed', {
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
        const failureResult = {
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
    async executeStageWithRetry(stage, input) {
        let lastError;
        for (let attempt = 0; attempt <= stage.retryCount; attempt++) {
            try {
                // Create timeout promise
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Stage timeout')), stage.timeout);
                });
                // Race between execution and timeout
                const result = await Promise.race([
                    stage.execute(input),
                    timeoutPromise
                ]);
                return result;
            }
            catch (error) {
                lastError = error;
                if (attempt < stage.retryCount) {
                    // Exponential backoff
                    const delay = Math.pow(2, attempt) * 100;
                    await this.sleep(delay);
                    logger_1.logger.debug('Retrying stage', {
                        stage: stage.name,
                        attempt: attempt + 1,
                        delay
                    });
                }
            }
        }
        throw lastError || new Error('Stage execution failed');
    }
    getHealthStatus() {
        const stageHealths = [];
        for (const [stageName, stage] of this.stages) {
            const circuitBreaker = this.circuitBreakers.get(stageName);
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
    calculateSuccessRate(metrics) {
        if (!metrics || metrics.invocations === 0) {
            return 0;
        }
        return (metrics.successes / metrics.invocations) * 100;
    }
    calculateOverallHealth(stages) {
        const availableStages = stages.filter(s => s.available).length;
        const totalStages = stages.length;
        if (availableStages === totalStages) {
            return 'healthy';
        }
        else if (availableStages >= Math.ceil(totalStages / 2)) {
            return 'degraded';
        }
        else {
            return 'unhealthy';
        }
    }
    resetCircuitBreaker(stageName) {
        const circuitBreaker = this.circuitBreakers.get(stageName);
        if (circuitBreaker) {
            circuitBreaker.reset();
            logger_1.logger.info('Circuit breaker reset', { stage: stageName });
        }
    }
    clearCache() {
        this.cache.clear();
        logger_1.logger.info('Cache cleared');
    }
    getMetrics() {
        return this.metrics.getMetrics();
    }
    generateCacheKey(input) {
        // Create a deterministic cache key from input
        const inputStr = JSON.stringify(input, Object.keys(input).sort());
        return `fallback:${this.hash(inputStr)}`;
    }
    generateExecutionId() {
        return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    hash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    // Graceful shutdown
    async shutdown() {
        logger_1.logger.info('Shutting down fallback service');
        // Export final metrics
        await this.metrics.export();
        // Clear resources
        this.cache.shutdown();
        this.removeAllListeners();
    }
}
exports.FallbackService = FallbackService;
