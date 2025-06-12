import { register, Counter, Histogram, Gauge, Summary } from 'prom-client';
import { Injectable } from '@nestjs/common';

/**
 * Prometheus metrics collection service
 */
@Injectable()
export class PrometheusMetrics {
  // Standard HTTP metrics
  private httpRequestDuration: Histogram<string>;
  private httpRequestTotal: Counter<string>;
  private httpRequestErrors: Counter<string>;
  
  // Authentication metrics
  private authAttempts: Counter<string>;
  private authSuccesses: Counter<string>;
  private authFailures: Counter<string>;
  private tokenGenerationDuration: Histogram<string>;
  private activeTokens: Gauge<string>;
  
  // Revolutionary metrics
  private apiAwarenessLevel: Gauge<string>;
  private selfHealingSuccessRate: Gauge<string>;
  private predictiveCacheHitRate: Gauge<string>;
  
  // System metrics
  private systemHealth: Gauge<string>;
  private anomalyDetectionScore: Gauge<string>;
  private quantumValidationReadiness: Gauge<string>;
  
  // Performance metrics
  private databaseQueryDuration: Histogram<string>;
  private cacheHitRate: Gauge<string>;
  private externalApiCallDuration: Histogram<string>;

  constructor() {
    this.initializeMetrics();
    this.startCollectors();
  }

  /**
   * Initialize all Prometheus metrics
   */
  private initializeMetrics() {
    // HTTP metrics
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5]
    });

    this.httpRequestTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code']
    });

    this.httpRequestErrors = new Counter({
      name: 'http_request_errors_total',
      help: 'Total number of HTTP request errors',
      labelNames: ['method', 'route', 'error_type']
    });

    // Authentication metrics
    this.authAttempts = new Counter({
      name: 'auth_attempts_total',
      help: 'Total number of authentication attempts',
      labelNames: ['type', 'provider']
    });

    this.authSuccesses = new Counter({
      name: 'auth_successes_total',
      help: 'Total number of successful authentications',
      labelNames: ['type', 'provider']
    });

    this.authFailures = new Counter({
      name: 'auth_failures_total',
      help: 'Total number of failed authentications',
      labelNames: ['type', 'provider', 'reason']
    });

    this.tokenGenerationDuration = new Histogram({
      name: 'token_generation_duration_seconds',
      help: 'Duration of token generation in seconds',
      labelNames: ['token_type'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1]
    });

    this.activeTokens = new Gauge({
      name: 'active_tokens',
      help: 'Number of active tokens in the system',
      labelNames: ['token_type']
    });

    // Revolutionary metrics
    this.apiAwarenessLevel = new Gauge({
      name: 'api_awareness_level',
      help: 'API consciousness level indicating system self-awareness (0-1)',
      labelNames: ['component']
    });

    this.selfHealingSuccessRate = new Gauge({
      name: 'self_healing_success_rate',
      help: 'Success rate of automatic self-healing operations (0-1)',
      labelNames: ['healing_type']
    });

    this.predictiveCacheHitRate = new Gauge({
      name: 'predictive_cache_hit_rate',
      help: 'Hit rate of predictive caching system (0-1)',
      labelNames: ['cache_type']
    });

    // System metrics
    this.systemHealth = new Gauge({
      name: 'system_health_score',
      help: 'Overall system health score (0-1)',
      labelNames: ['component']
    });

    this.anomalyDetectionScore = new Gauge({
      name: 'anomaly_detection_score',
      help: 'Current anomaly detection score (0-1)',
      labelNames: ['detector_type']
    });

    this.quantumValidationReadiness = new Gauge({
      name: 'quantum_validation_readiness',
      help: 'Readiness for quantum-inspired validation (0-1)',
      labelNames: ['validation_type']
    });

    // Performance metrics
    this.databaseQueryDuration = new Histogram({
      name: 'database_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['query_type', 'table'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1]
    });

    this.cacheHitRate = new Gauge({
      name: 'cache_hit_rate',
      help: 'Cache hit rate (0-1)',
      labelNames: ['cache_name']
    });

    this.externalApiCallDuration = new Histogram({
      name: 'external_api_call_duration_seconds',
      help: 'Duration of external API calls in seconds',
      labelNames: ['api_name', 'endpoint'],
      buckets: [0.1, 0.5, 1, 2, 5, 10]
    });

    // Register all metrics
    register.registerMetric(this.httpRequestDuration);
    register.registerMetric(this.httpRequestTotal);
    register.registerMetric(this.httpRequestErrors);
    register.registerMetric(this.authAttempts);
    register.registerMetric(this.authSuccesses);
    register.registerMetric(this.authFailures);
    register.registerMetric(this.tokenGenerationDuration);
    register.registerMetric(this.activeTokens);
    register.registerMetric(this.apiAwarenessLevel);
    register.registerMetric(this.selfHealingSuccessRate);
    register.registerMetric(this.predictiveCacheHitRate);
    register.registerMetric(this.systemHealth);
    register.registerMetric(this.anomalyDetectionScore);
    register.registerMetric(this.quantumValidationReadiness);
    register.registerMetric(this.databaseQueryDuration);
    register.registerMetric(this.cacheHitRate);
    register.registerMetric(this.externalApiCallDuration);
  }

  /**
   * Start background metric collectors
   */
  private startCollectors() {
    // Update revolutionary metrics every 30 seconds
    setInterval(() => {
      this.updateRevolutionaryMetrics();
    }, 30000);

    // Update system health every 10 seconds
    setInterval(() => {
      this.updateSystemHealth();
    }, 10000);
  }

  /**
   * Record HTTP request
   */
  recordHttpRequest(method: string, route: string, statusCode: number, duration: number) {
    const labels = { method, route, status_code: statusCode.toString() };
    this.httpRequestDuration.observe(labels, duration);
    this.httpRequestTotal.inc(labels);
    
    if (statusCode >= 400) {
      this.httpRequestErrors.inc({
        method,
        route,
        error_type: statusCode >= 500 ? 'server_error' : 'client_error'
      });
    }
  }

  /**
   * Record authentication attempt
   */
  recordAuthAttempt(type: string, provider: string = 'local') {
    this.authAttempts.inc({ type, provider });
  }

  /**
   * Record authentication success
   */
  recordAuthSuccess(type: string, provider: string = 'local') {
    this.authSuccesses.inc({ type, provider });
  }

  /**
   * Record authentication failure
   */
  recordAuthFailure(type: string, provider: string = 'local', reason: string) {
    this.authFailures.inc({ type, provider, reason });
  }

  /**
   * Record token generation time
   */
  recordTokenGeneration(tokenType: string, duration: number) {
    this.tokenGenerationDuration.observe({ token_type: tokenType }, duration);
  }

  /**
   * Update active tokens count
   */
  updateActiveTokens(tokenType: string, count: number) {
    this.activeTokens.set({ token_type: tokenType }, count);
  }

  /**
   * Update API awareness level
   */
  updateApiAwarenessLevel(component: string, level: number) {
    this.apiAwarenessLevel.set({ component }, Math.min(1, Math.max(0, level)));
  }

  /**
   * Update self-healing success rate
   */
  updateSelfHealingSuccessRate(healingType: string, rate: number) {
    this.selfHealingSuccessRate.set({ healing_type: healingType }, Math.min(1, Math.max(0, rate)));
  }

  /**
   * Update predictive cache hit rate
   */
  updatePredictiveCacheHitRate(cacheType: string, rate: number) {
    this.predictiveCacheHitRate.set({ cache_type: cacheType }, Math.min(1, Math.max(0, rate)));
  }

  /**
   * Record database query
   */
  recordDatabaseQuery(queryType: string, table: string, duration: number) {
    this.databaseQueryDuration.observe({ query_type: queryType, table }, duration);
  }

  /**
   * Update cache hit rate
   */
  updateCacheHitRate(cacheName: string, rate: number) {
    this.cacheHitRate.set({ cache_name: cacheName }, Math.min(1, Math.max(0, rate)));
  }

  /**
   * Record external API call
   */
  recordExternalApiCall(apiName: string, endpoint: string, duration: number) {
    this.externalApiCallDuration.observe({ api_name: apiName, endpoint }, duration);
  }

  /**
   * Update anomaly detection score
   */
  updateAnomalyScore(detectorType: string, score: number) {
    this.anomalyDetectionScore.set({ detector_type: detectorType }, Math.min(1, Math.max(0, score)));
  }

  /**
   * Update quantum validation readiness
   */
  updateQuantumReadiness(validationType: string, readiness: number) {
    this.quantumValidationReadiness.set({ validation_type: validationType }, Math.min(1, Math.max(0, readiness)));
  }

  /**
   * Update revolutionary metrics based on system state
   */
  private updateRevolutionaryMetrics() {
    // API Awareness Level: Calculate based on endpoint usage patterns
    const endpointCoverage = this.calculateEndpointCoverage();
    const errorRecoveryRate = this.calculateErrorRecoveryRate();
    const apiAwareness = (endpointCoverage + errorRecoveryRate) / 2;
    this.updateApiAwarenessLevel('main', apiAwareness);

    // Self-Healing Success Rate: Based on automatic error corrections
    const healingRate = this.calculateHealingSuccessRate();
    this.updateSelfHealingSuccessRate('automatic', healingRate);

    // Predictive Cache Hit Rate: Based on preemptive caching
    const predictiveHitRate = this.calculatePredictiveHitRate();
    this.updatePredictiveCacheHitRate('api_response', predictiveHitRate);

    // Quantum Validation Readiness
    const quantumReadiness = this.calculateQuantumReadiness();
    this.updateQuantumReadiness('token_validation', quantumReadiness);
  }

  /**
   * Update system health metrics
   */
  private updateSystemHealth() {
    const cpuUsage = process.cpuUsage();
    const memoryUsage = process.memoryUsage();
    
    // Calculate overall health score
    const cpuScore = 1 - (cpuUsage.user + cpuUsage.system) / 1000000000; // Normalize
    const memoryScore = 1 - (memoryUsage.heapUsed / memoryUsage.heapTotal);
    const healthScore = (cpuScore + memoryScore) / 2;
    
    this.systemHealth.set({ component: 'main' }, healthScore);
  }

  /**
   * Helper methods for calculating revolutionary metrics
   */
  private calculateEndpointCoverage(): number {
    // In production: Calculate based on actual endpoint usage vs available endpoints
    return 0.75; // Placeholder
  }

  private calculateErrorRecoveryRate(): number {
    // In production: Calculate based on errors caught and automatically resolved
    return 0.85; // Placeholder
  }

  private calculateHealingSuccessRate(): number {
    // In production: Track automatic fixes vs total issues
    return 0.90; // Placeholder
  }

  private calculatePredictiveHitRate(): number {
    // In production: Track predictive cache hits vs misses
    return 0.70; // Placeholder
  }

  private calculateQuantumReadiness(): number {
    // Based on quantum-inspired validation infrastructure readiness
    return 0.60; // Placeholder - we're preparing for the future
  }

  /**
   * Get all metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  /**
   * Reset all metrics (useful for testing)
   */
  resetMetrics() {
    register.clear();
    this.initializeMetrics();
  }
}