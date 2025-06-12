/**
 * メトリクス収集サービス
 * パフォーマンスとエラー率を追跡
 */

import { EventEmitter } from 'events';
import { FallbackResult, MetricsConfig, FallbackMetrics, StageMetric } from '../interfaces/IFallbackService';
import { logger } from './logger';

interface LatencyBucket {
  count: number;
  sum: number;
  values: number[];
}

export class MetricsCollector extends EventEmitter {
  private config: MetricsConfig;
  private totalRequests: number = 0;
  private successfulRequests: number = 0;
  private failedRequests: number = 0;
  private cacheHits: number = 0;
  private latencies: number[] = [];
  private stageMetrics: Map<string, StageMetric>;
  private stageLatencies: Map<string, LatencyBucket>;
  private exportTimer?: NodeJS.Timer;

  constructor(config: MetricsConfig) {
    super();
    this.config = config;
    this.stageMetrics = new Map();
    this.stageLatencies = new Map();

    if (config.enabled && config.exportInterval > 0) {
      this.startAutoExport();
    }
  }

  recordRequest(result: FallbackResult): void {
    if (!this.config.enabled) return;

    // Sample rate check
    if (Math.random() > this.config.sampleRate) return;

    this.totalRequests++;

    if (result.success) {
      this.successfulRequests++;
    } else {
      this.failedRequests++;
    }

    if (result.metadata?.cacheHit) {
      this.cacheHits++;
    }

    this.latencies.push(result.duration);

    // Keep only last 1000 latencies to prevent memory issues
    if (this.latencies.length > 1000) {
      this.latencies.shift();
    }

    this.emit('metric:recorded', {
      type: 'request',
      result
    });
  }

  recordStageMetric(stageName: string, success: boolean, latency: number): void {
    if (!this.config.enabled) return;

    let metric = this.stageMetrics.get(stageName);
    if (!metric) {
      metric = {
        invocations: 0,
        successes: 0,
        failures: 0,
        averageLatency: 0,
        p95Latency: 0,
        p99Latency: 0
      };
      this.stageMetrics.set(stageName, metric);
    }

    metric.invocations++;
    if (success) {
      metric.successes++;
    } else {
      metric.failures++;
    }

    // Update latency metrics
    let latencyBucket = this.stageLatencies.get(stageName);
    if (!latencyBucket) {
      latencyBucket = {
        count: 0,
        sum: 0,
        values: []
      };
      this.stageLatencies.set(stageName, latencyBucket);
    }

    if (latency > 0) {
      latencyBucket.count++;
      latencyBucket.sum += latency;
      latencyBucket.values.push(latency);

      // Keep only last 1000 values
      if (latencyBucket.values.length > 1000) {
        const removed = latencyBucket.values.shift()!;
        latencyBucket.sum -= removed;
        latencyBucket.count--;
      }

      // Update average latency
      metric.averageLatency = latencyBucket.sum / latencyBucket.count;

      // Calculate percentiles
      const sortedLatencies = [...latencyBucket.values].sort((a, b) => a - b);
      metric.p95Latency = this.calculatePercentile(sortedLatencies, 95);
      metric.p99Latency = this.calculatePercentile(sortedLatencies, 99);
    }

    this.emit('metric:stage', {
      stage: stageName,
      success,
      latency
    });
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  getMetrics(): FallbackMetrics {
    const cacheHitRate = this.totalRequests > 0 ? 
      (this.cacheHits / this.totalRequests) * 100 : 0;

    const averageLatency = this.latencies.length > 0 ?
      this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length : 0;

    return {
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      cacheHitRate,
      averageLatency,
      stageMetrics: new Map(this.stageMetrics)
    };
  }

  getStageMetrics(stageName: string): StageMetric | undefined {
    return this.stageMetrics.get(stageName);
  }

  async export(): Promise<void> {
    if (!this.config.enabled) return;

    const metrics = this.getMetrics();
    
    logger.info('Exporting metrics', {
      totalRequests: metrics.totalRequests,
      successRate: (metrics.successfulRequests / metrics.totalRequests) * 100,
      cacheHitRate: metrics.cacheHitRate,
      averageLatency: metrics.averageLatency
    });

    // Stage-specific metrics
    for (const [stage, metric] of metrics.stageMetrics) {
      logger.info('Stage metrics', {
        stage,
        invocations: metric.invocations,
        successRate: (metric.successes / metric.invocations) * 100,
        averageLatency: metric.averageLatency,
        p95Latency: metric.p95Latency,
        p99Latency: metric.p99Latency
      });
    }

    this.emit('metrics:exported', metrics);

    // ここで外部メトリクスサービス（Prometheus、CloudWatch等）に送信
    // await this.sendToExternalService(metrics);
  }

  private startAutoExport(): void {
    this.exportTimer = setInterval(() => {
      this.export().catch(error => {
        logger.error('Failed to export metrics', error);
      });
    }, this.config.exportInterval);
  }

  reset(): void {
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;
    this.cacheHits = 0;
    this.latencies = [];
    this.stageMetrics.clear();
    this.stageLatencies.clear();
    
    logger.info('Metrics reset');
  }

  shutdown(): void {
    if (this.exportTimer) {
      clearInterval(this.exportTimer);
    }
    this.removeAllListeners();
  }

  // ヒストグラム用のバケット生成
  getLatencyHistogram(buckets: number[] = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000]): Map<string, number> {
    const histogram = new Map<string, number>();
    
    for (let i = 0; i < buckets.length; i++) {
      const bucketName = i === 0 ? `<${buckets[i]}ms` : 
        i === buckets.length - 1 ? `>${buckets[i-1]}ms` :
        `${buckets[i-1]}-${buckets[i]}ms`;
      
      histogram.set(bucketName, 0);
    }

    for (const latency of this.latencies) {
      let placed = false;
      for (let i = 0; i < buckets.length - 1; i++) {
        if (latency < buckets[i]) {
          const bucketName = i === 0 ? `<${buckets[i]}ms` : `${buckets[i-1]}-${buckets[i]}ms`;
          histogram.set(bucketName, (histogram.get(bucketName) || 0) + 1);
          placed = true;
          break;
        }
      }
      if (!placed) {
        const bucketName = `>${buckets[buckets.length - 1]}ms`;
        histogram.set(bucketName, (histogram.get(bucketName) || 0) + 1);
      }
    }

    return histogram;
  }
}