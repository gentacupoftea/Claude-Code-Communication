import { Injectable } from '@nestjs/common';
import { PrometheusMetrics } from './prometheus-metrics';

interface APIEndpointUsage {
  endpoint: string;
  method: string;
  usageCount: number;
  lastUsed: Date;
  averageResponseTime: number;
  errorRate: number;
}

interface SelfHealingEvent {
  timestamp: Date;
  issueType: string;
  detectionMethod: string;
  healingAction: string;
  success: boolean;
  timeTaken: number;
}

interface PredictiveEvent {
  timestamp: Date;
  predictedResource: string;
  actualUsed: boolean;
  confidence: number;
}

/**
 * Revolutionary metrics implementation
 */
@Injectable()
export class RevolutionaryMetrics {
  private endpointUsageMap = new Map<string, APIEndpointUsage>();
  private selfHealingEvents: SelfHealingEvent[] = [];
  private predictiveEvents: PredictiveEvent[] = [];
  private readonly historyLimit = 10000;

  constructor(private readonly prometheusMetrics: PrometheusMetrics) {
    this.startMetricsCalculation();
  }

  /**
   * Start periodic metrics calculation
   */
  private startMetricsCalculation() {
    // Calculate API awareness every 30 seconds
    setInterval(() => {
      this.calculateAPIAwarenessLevel();
    }, 30000);

    // Calculate self-healing success rate every minute
    setInterval(() => {
      this.calculateSelfHealingSuccessRate();
    }, 60000);

    // Calculate predictive hit rate every 2 minutes
    setInterval(() => {
      this.calculatePredictiveHitRate();
    }, 120000);
  }

  /**
   * Track API endpoint usage
   */
  trackEndpointUsage(
    endpoint: string,
    method: string,
    responseTime: number,
    statusCode: number
  ) {
    const key = `${method}:${endpoint}`;
    const usage = this.endpointUsageMap.get(key) || {
      endpoint,
      method,
      usageCount: 0,
      lastUsed: new Date(),
      averageResponseTime: 0,
      errorRate: 0
    };

    // Update usage statistics
    usage.usageCount++;
    usage.lastUsed = new Date();
    
    // Update average response time
    usage.averageResponseTime = 
      (usage.averageResponseTime * (usage.usageCount - 1) + responseTime) / usage.usageCount;
    
    // Update error rate
    const isError = statusCode >= 400;
    const previousErrors = usage.errorRate * (usage.usageCount - 1);
    usage.errorRate = (previousErrors + (isError ? 1 : 0)) / usage.usageCount;

    this.endpointUsageMap.set(key, usage);
  }

  /**
   * Record self-healing event
   */
  recordSelfHealingEvent(event: Omit<SelfHealingEvent, 'timestamp'>) {
    this.selfHealingEvents.push({
      ...event,
      timestamp: new Date()
    });

    // Maintain history limit
    if (this.selfHealingEvents.length > this.historyLimit) {
      this.selfHealingEvents.shift();
    }
  }

  /**
   * Record predictive event
   */
  recordPredictiveEvent(
    predictedResource: string,
    actualUsed: boolean,
    confidence: number
  ) {
    this.predictiveEvents.push({
      timestamp: new Date(),
      predictedResource,
      actualUsed,
      confidence
    });

    // Maintain history limit
    if (this.predictiveEvents.length > this.historyLimit) {
      this.predictiveEvents.shift();
    }
  }

  /**
   * Calculate API Awareness Level
   * Measures how well the system understands its own API usage patterns
   */
  private calculateAPIAwarenessLevel() {
    const components = {
      endpointCoverage: this.calculateEndpointCoverage(),
      usagePatternRecognition: this.calculateUsagePatternRecognition(),
      errorHandlingAwareness: this.calculateErrorHandlingAwareness(),
      performanceAwareness: this.calculatePerformanceAwareness()
    };

    // Weighted average
    const weights = {
      endpointCoverage: 0.25,
      usagePatternRecognition: 0.25,
      errorHandlingAwareness: 0.25,
      performanceAwareness: 0.25
    };

    const overallAwareness = Object.entries(components).reduce(
      (sum, [key, value]) => sum + value * weights[key as keyof typeof weights],
      0
    );

    // Update Prometheus metrics
    this.prometheusMetrics.updateApiAwarenessLevel('overall', overallAwareness);
    
    // Update component metrics
    Object.entries(components).forEach(([component, level]) => {
      this.prometheusMetrics.updateApiAwarenessLevel(component, level);
    });

    return overallAwareness;
  }

  /**
   * Calculate endpoint coverage awareness
   */
  private calculateEndpointCoverage(): number {
    const totalEndpoints = 50; // Estimated total endpoints
    const usedEndpoints = this.endpointUsageMap.size;
    
    // Consider recency - endpoints not used in last 24 hours count less
    const recentlyUsedEndpoints = Array.from(this.endpointUsageMap.values())
      .filter(usage => {
        const hoursSinceLastUse = 
          (Date.now() - usage.lastUsed.getTime()) / (1000 * 60 * 60);
        return hoursSinceLastUse < 24;
      }).length;

    const coverage = recentlyUsedEndpoints / totalEndpoints;
    return Math.min(1, coverage);
  }

  /**
   * Calculate usage pattern recognition
   */
  private calculateUsagePatternRecognition(): number {
    const endpoints = Array.from(this.endpointUsageMap.values());
    
    if (endpoints.length < 5) return 0;

    // Analyze usage distribution
    const totalUsage = endpoints.reduce((sum, e) => sum + e.usageCount, 0);
    const usageDistribution = endpoints.map(e => e.usageCount / totalUsage);
    
    // Calculate entropy as a measure of pattern complexity
    const entropy = -usageDistribution
      .filter(p => p > 0)
      .reduce((sum, p) => sum + p * Math.log2(p), 0);
    
    // Normalize entropy (higher entropy = more complex patterns = better awareness)
    const maxEntropy = Math.log2(endpoints.length);
    const normalizedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0;
    
    return normalizedEntropy;
  }

  /**
   * Calculate error handling awareness
   */
  private calculateErrorHandlingAwareness(): number {
    const endpoints = Array.from(this.endpointUsageMap.values());
    
    if (endpoints.length === 0) return 1; // No errors if no usage

    // Calculate how well we handle errors
    const endpointsWithErrors = endpoints.filter(e => e.errorRate > 0);
    const avgErrorRate = endpoints.reduce((sum, e) => sum + e.errorRate, 0) / endpoints.length;
    
    // Lower error rate = better awareness
    const errorAwareness = 1 - avgErrorRate;
    
    // Bonus for diversity in error handling (different error rates suggest nuanced handling)
    const errorRateVariance = this.calculateVariance(endpoints.map(e => e.errorRate));
    const diversityBonus = Math.min(0.2, errorRateVariance * 10);
    
    return Math.min(1, errorAwareness + diversityBonus);
  }

  /**
   * Calculate performance awareness
   */
  private calculatePerformanceAwareness(): number {
    const endpoints = Array.from(this.endpointUsageMap.values());
    
    if (endpoints.length === 0) return 0;

    // Analyze response time patterns
    const avgResponseTimes = endpoints.map(e => e.averageResponseTime);
    const overallAvg = avgResponseTimes.reduce((sum, t) => sum + t, 0) / avgResponseTimes.length;
    
    // Good performance awareness means consistent, low response times
    const consistency = 1 - (this.calculateStandardDeviation(avgResponseTimes) / overallAvg);
    const speed = Math.max(0, 1 - overallAvg / 1000); // Normalize to 1 second
    
    return (consistency + speed) / 2;
  }

  /**
   * Calculate Self-Healing Success Rate
   */
  private calculateSelfHealingSuccessRate() {
    const recentEvents = this.selfHealingEvents.filter(event => {
      const hoursSinceEvent = (Date.now() - event.timestamp.getTime()) / (1000 * 60 * 60);
      return hoursSinceEvent < 24; // Last 24 hours
    });

    if (recentEvents.length === 0) {
      // No healing events = system is healthy
      this.prometheusMetrics.updateSelfHealingSuccessRate('overall', 1);
      return;
    }

    // Calculate success rates by type
    const typeGroups = this.groupBy(recentEvents, 'issueType');
    const typeSuccessRates = new Map<string, number>();

    Object.entries(typeGroups).forEach(([type, events]) => {
      const successCount = events.filter(e => e.success).length;
      const successRate = successCount / events.length;
      typeSuccessRates.set(type, successRate);
      
      this.prometheusMetrics.updateSelfHealingSuccessRate(type, successRate);
    });

    // Overall success rate
    const overallSuccessCount = recentEvents.filter(e => e.success).length;
    const overallSuccessRate = overallSuccessCount / recentEvents.length;
    
    this.prometheusMetrics.updateSelfHealingSuccessRate('overall', overallSuccessRate);

    // Speed bonus - faster healing is better
    const avgHealingTime = recentEvents
      .filter(e => e.success)
      .reduce((sum, e) => sum + e.timeTaken, 0) / overallSuccessCount || 0;
    
    const speedBonus = Math.max(0, 1 - avgHealingTime / 60000); // Normalize to 1 minute
    const adjustedRate = Math.min(1, overallSuccessRate * (1 + speedBonus * 0.2));
    
    this.prometheusMetrics.updateSelfHealingSuccessRate('speed_adjusted', adjustedRate);
  }

  /**
   * Calculate Predictive Cache Hit Rate
   */
  private calculatePredictiveHitRate() {
    const recentEvents = this.predictiveEvents.filter(event => {
      const minutesSinceEvent = (Date.now() - event.timestamp.getTime()) / (1000 * 60);
      return minutesSinceEvent < 60; // Last hour
    });

    if (recentEvents.length === 0) {
      this.prometheusMetrics.updatePredictiveCacheHitRate('overall', 0);
      return;
    }

    // Calculate hit rate
    const hits = recentEvents.filter(e => e.actualUsed).length;
    const hitRate = hits / recentEvents.length;

    // Calculate confidence-weighted hit rate
    const confidenceWeightedHits = recentEvents
      .filter(e => e.actualUsed)
      .reduce((sum, e) => sum + e.confidence, 0);
    const totalConfidence = recentEvents.reduce((sum, e) => sum + e.confidence, 0);
    const confidenceWeightedRate = totalConfidence > 0 ? confidenceWeightedHits / totalConfidence : 0;

    // Group by resource type
    const resourceGroups = this.groupBy(recentEvents, 'predictedResource');
    
    Object.entries(resourceGroups).forEach(([resource, events]) => {
      const resourceHits = events.filter(e => e.actualUsed).length;
      const resourceHitRate = resourceHits / events.length;
      
      this.prometheusMetrics.updatePredictiveCacheHitRate(resource, resourceHitRate);
    });

    // Update overall metrics
    this.prometheusMetrics.updatePredictiveCacheHitRate('overall', hitRate);
    this.prometheusMetrics.updatePredictiveCacheHitRate('confidence_weighted', confidenceWeightedRate);
  }

  /**
   * Get current metrics summary
   */
  getMetricsSummary() {
    const apiAwareness = this.calculateAPIAwarenessLevel();
    
    const recentHealingEvents = this.selfHealingEvents.filter(e => {
      const hoursSince = (Date.now() - e.timestamp.getTime()) / (1000 * 60 * 60);
      return hoursSince < 24;
    });
    
    const healingSuccessRate = recentHealingEvents.length > 0
      ? recentHealingEvents.filter(e => e.success).length / recentHealingEvents.length
      : 1;

    const recentPredictiveEvents = this.predictiveEvents.filter(e => {
      const minutesSince = (Date.now() - e.timestamp.getTime()) / (1000 * 60);
      return minutesSince < 60;
    });
    
    const predictiveHitRate = recentPredictiveEvents.length > 0
      ? recentPredictiveEvents.filter(e => e.actualUsed).length / recentPredictiveEvents.length
      : 0;

    return {
      apiAwarenessLevel: apiAwareness,
      selfHealingSuccessRate: healingSuccessRate,
      predictiveCacheHitRate: predictiveHitRate,
      endpointsCovered: this.endpointUsageMap.size,
      totalHealingEvents: this.selfHealingEvents.length,
      totalPredictiveEvents: this.predictiveEvents.length
    };
  }

  /**
   * Utility functions
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private calculateStandardDeviation(values: number[]): number {
    return Math.sqrt(this.calculateVariance(values));
  }

  private groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce((groups, item) => {
      const group = String(item[key]);
      if (!groups[group]) groups[group] = [];
      groups[group].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }
}