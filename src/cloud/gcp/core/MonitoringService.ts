import { Monitoring, MetricServiceClient, AlertPolicyServiceClient, UptimeCheckServiceClient } from '@google-cloud/monitoring';
import { Logging } from '@google-cloud/logging';
import { ErrorReporting } from '@google-cloud/error-reporting';
import { Trace } from '@google-cloud/trace-agent';
import { Profiler } from '@google-cloud/profiler';
import { logger } from '../config/logger';

interface MonitoringConfig {
  projectId: string;
  region: string;
  serviceName: string;
  environment: string;
  alertingWebhook?: string;
  slackWebhook?: string;
}

interface MetricDefinition {
  name: string;
  type: 'GAUGE' | 'CUMULATIVE';
  unit: string;
  description: string;
  labels: string[];
}

interface AlertPolicy {
  name: string;
  condition: unknown;
  notificationChannels: string[];
  documentation?: string;
}

interface SLO {
  name: string;
  target: number; // percentage
  window: number; // seconds
  metric: string;
}

interface HealthCheck {
  name: string;
  type: 'HTTP' | 'HTTPS' | 'TCP';
  path?: string;
  port: number;
  interval: number;
  timeout: number;
  hosts: string[];
}

export class MonitoringService {
  private monitoring: Monitoring;
  private metricClient: MetricServiceClient;
  private alertClient: AlertPolicyServiceClient;
  private uptimeClient: UptimeCheckServiceClient;
  private logging: Logging;
  private errorReporting: ErrorReporting;
  private config: MonitoringConfig;
  private metrics: Map<string, MetricDefinition> = new Map();
  private customMetrics: Map<string, MetricDescriptor> = new Map();
  private alerts: Map<string, AlertPolicy> = new Map();
  private slos: Map<string, SLO> = new Map();
  private healthChecks: Map<string, HealthCheck> = new Map();

  constructor(config: MonitoringConfig) {
    this.config = config;
    
    // Initialize clients
    this.monitoring = new Monitoring({ projectId: config.projectId });
    this.metricClient = new MetricServiceClient();
    this.alertClient = new AlertPolicyServiceClient();
    this.uptimeClient = new UptimeCheckServiceClient();
    this.logging = new Logging({ projectId: config.projectId });
    this.errorReporting = new ErrorReporting({
      projectId: config.projectId,
      serviceContext: {
        service: config.serviceName,
        version: process.env.SERVICE_VERSION || '1.0.0'
      }
    });

    this.initializeDefaultMetrics();
    this.initializeDefaultAlerts();
    this.initializeProfiler();
    this.initializeTracing();
  }

  private initializeDefaultMetrics(): void {
    // Define default metrics
    const defaultMetrics: MetricDefinition[] = [
      {
        name: 'request_count',
        type: 'CUMULATIVE',
        unit: '1',
        description: 'Total number of requests',
        labels: ['method', 'path', 'status']
      },
      {
        name: 'request_duration',
        type: 'GAUGE',
        unit: 'ms',
        description: 'Request duration in milliseconds',
        labels: ['method', 'path', 'status']
      },
      {
        name: 'error_count',
        type: 'CUMULATIVE',
        unit: '1',
        description: 'Total number of errors',
        labels: ['type', 'service']
      },
      {
        name: 'active_connections',
        type: 'GAUGE',
        unit: '1',
        description: 'Number of active connections',
        labels: ['service']
      },
      {
        name: 'queue_size',
        type: 'GAUGE',
        unit: '1',
        description: 'Size of the message queue',
        labels: ['queue_name']
      },
      {
        name: 'cache_hit_ratio',
        type: 'GAUGE',
        unit: '%',
        description: 'Cache hit ratio percentage',
        labels: ['cache_name']
      }
    ];

    for (const metric of defaultMetrics) {
      this.registerMetric(metric);
    }
  }

  private initializeDefaultAlerts(): void {
    // High error rate alert
    this.createAlert({
      name: 'high-error-rate',
      condition: {
        displayName: 'High Error Rate',
        conditionThreshold: {
          filter: `resource.type="global" AND metric.type="custom.googleapis.com/${this.config.serviceName}/error_rate"`,
          comparison: 'COMPARISON_GT',
          thresholdValue: 0.05,
          duration: '300s',
          aggregations: [{
            alignmentPeriod: '60s',
            perSeriesAligner: 'ALIGN_RATE'
          }]
        }
      },
      notificationChannels: [],
      documentation: 'Error rate is above 5% for more than 5 minutes'
    });

    // Service down alert
    this.createAlert({
      name: 'service-down',
      condition: {
        displayName: 'Service Down',
        conditionUptime: {
          filter: `resource.type="uptime_url" AND metric.type="monitoring.googleapis.com/uptime_check/check_passed"`,
          comparison: 'COMPARISON_LT',
          thresholdValue: 1,
          duration: '180s'
        }
      },
      notificationChannels: [],
      documentation: 'Service health check is failing'
    });

    // High latency alert
    this.createAlert({
      name: 'high-latency',
      condition: {
        displayName: 'High Latency',
        conditionThreshold: {
          filter: `resource.type="global" AND metric.type="custom.googleapis.com/${this.config.serviceName}/request_duration"`,
          comparison: 'COMPARISON_GT',
          thresholdValue: 1000,
          duration: '300s',
          aggregations: [{
            alignmentPeriod: '60s',
            perSeriesAligner: 'ALIGN_PERCENTILE_95'
          }]
        }
      },
      notificationChannels: [],
      documentation: '95th percentile latency is above 1000ms'
    });
  }

  private async initializeProfiler(): Promise<void> {
    try {
      await Profiler.start({
        projectId: this.config.projectId,
        serviceContext: {
          service: this.config.serviceName,
          version: process.env.SERVICE_VERSION || '1.0.0'
        }
      });
      logger.info('Profiler initialized');
    } catch (error) {
      logger.error('Failed to initialize profiler', { error });
    }
  }

  private initializeTracing(): void {
    Trace.start({
      projectId: this.config.projectId,
      serviceContext: {
        service: this.config.serviceName,
        version: process.env.SERVICE_VERSION || '1.0.0'
      },
      samplingRate: 0.1 // Sample 10% of requests
    });
  }

  // Metric Registration
  registerMetric(metric: MetricDefinition): void {
    this.metrics.set(metric.name, metric);
    logger.info(`Registered metric: ${metric.name}`);
  }

  // Metric Recording
  async recordMetric(
    metricName: string,
    value: number,
    labels: Record<string, string> = {}
  ): Promise<void> {
    try {
      const metric = this.metrics.get(metricName);
      if (!metric) {
        throw new Error(`Metric ${metricName} not registered`);
      }

      const dataPoint = {
        interval: {
          endTime: {
            seconds: Math.floor(Date.now() / 1000)
          }
        },
        value: metric.type === 'GAUGE' 
          ? { doubleValue: value }
          : { int64Value: value }
      };

      const timeSeries = {
        metric: {
          type: `custom.googleapis.com/${this.config.serviceName}/${metricName}`,
          labels
        },
        points: [dataPoint],
        resource: {
          type: 'global',
          labels: {
            project_id: this.config.projectId
          }
        }
      };

      const request = {
        name: this.metricClient.projectPath(this.config.projectId),
        timeSeries: [timeSeries]
      };

      await this.metricClient.createTimeSeries(request);
    } catch (error) {
      logger.error('Failed to record metric', { metricName, error });
    }
  }

  // Batch Metric Recording
  async recordMetricsBatch(
    metrics: Array<{
      name: string;
      value: number;
      labels?: Record<string, string>;
    }>
  ): Promise<void> {
    try {
      const timeSeries = metrics.map(m => {
        const metric = this.metrics.get(m.name);
        if (!metric) {
          throw new Error(`Metric ${m.name} not registered`);
        }

        return {
          metric: {
            type: `custom.googleapis.com/${this.config.serviceName}/${m.name}`,
            labels: m.labels || {}
          },
          points: [{
            interval: {
              endTime: {
                seconds: Math.floor(Date.now() / 1000)
              }
            },
            value: metric.type === 'GAUGE' 
              ? { doubleValue: m.value }
              : { int64Value: m.value }
          }],
          resource: {
            type: 'global',
            labels: {
              project_id: this.config.projectId
            }
          }
        };
      });

      const request = {
        name: this.metricClient.projectPath(this.config.projectId),
        timeSeries
      };

      await this.metricClient.createTimeSeries(request);
    } catch (error) {
      logger.error('Failed to record metrics batch', { error });
    }
  }

  // Distributed Tracing
  createSpan(name: string, attributes?: Record<string, unknown>): unknown {
    const tracer = Trace.get();
    const span = tracer.createChildSpan({ name });
    
    if (attributes) {
      for (const [key, value] of Object.entries(attributes)) {
        span.addLabel(key, value);
      }
    }

    return span;
  }

  // Error Reporting
  reportError(error: Error, context?: unknown): void {
    this.errorReporting.report(error, context);
  }

  // Logging
  async log(severity: string, message: string, metadata?: unknown): Promise<void> {
    const log = this.logging.log(this.config.serviceName);
    const entry = log.entry({
      severity,
      jsonPayload: {
        message,
        ...metadata,
        timestamp: new Date().toISOString()
      }
    });

    await log.write(entry);
  }

  // Alert Creation
  async createAlert(policy: AlertPolicy): Promise<void> {
    try {
      const alertPolicy = {
        displayName: policy.name,
        conditions: [policy.condition],
        notificationChannels: policy.notificationChannels,
        documentation: {
          content: policy.documentation || ''
        },
        enabled: true
      };

      const request = {
        name: this.alertClient.projectPath(this.config.projectId),
        alertPolicy
      };

      const [_createdPolicy] = await this.alertClient.createAlertPolicy(request);
      this.alerts.set(policy.name, policy);
      logger.info(`Created alert policy: ${policy.name}`);
    } catch (error) {
      logger.error('Failed to create alert policy', { policy: policy.name, error });
    }
  }

  // Uptime Checks
  async createUptimeCheck(check: HealthCheck): Promise<void> {
    try {
      const uptimeCheckConfig = {
        displayName: check.name,
        monitoredResource: {
          type: 'uptime_url',
          labels: {
            project_id: this.config.projectId,
            host: check.hosts[0]
          }
        },
        httpCheck: check.type === 'HTTP' || check.type === 'HTTPS' ? {
          path: check.path || '/',
          port: check.port,
          requestMethod: 'GET',
          useSsl: check.type === 'HTTPS'
        } : undefined,
        tcpCheck: check.type === 'TCP' ? {
          port: check.port
        } : undefined,
        period: `${check.interval}s`,
        timeout: `${check.timeout}s`
      };

      const request = {
        parent: this.uptimeClient.projectPath(this.config.projectId),
        uptimeCheckConfig
      };

      const [_createdCheck] = await this.uptimeClient.createUptimeCheckConfig(request);
      this.healthChecks.set(check.name, check);
      logger.info(`Created uptime check: ${check.name}`);
    } catch (error) {
      logger.error('Failed to create uptime check', { check: check.name, error });
    }
  }

  // SLO Management
  createSLO(slo: SLO): void {
    this.slos.set(slo.name, slo);
    
    // Create alert for SLO breach
    this.createAlert({
      name: `${slo.name}-breach`,
      condition: {
        displayName: `${slo.name} SLO Breach`,
        conditionThreshold: {
          filter: `resource.type="global" AND metric.type="${slo.metric}"`,
          comparison: 'COMPARISON_LT',
          thresholdValue: slo.target,
          duration: `${slo.window}s`,
          aggregations: [{
            alignmentPeriod: `${Math.floor(slo.window / 10)}s`,
            perSeriesAligner: 'ALIGN_MEAN'
          }]
        }
      },
      notificationChannels: [],
      documentation: `SLO ${slo.name} is below target of ${slo.target}%`
    });
  }

  // Dashboard Creation
  async createDashboard(name: string, widgets: unknown[]): Promise<void> {
    // This would use the Cloud Monitoring Dashboard API
    // For now, we'll just log the intent
    logger.info('Dashboard creation not implemented', { name, widgets });
  }

  // Metric Queries
  async queryMetrics(
    metricType: string,
    startTime: Date,
    endTime: Date,
    aggregation?: unknown
  ): Promise<unknown[]> {
    try {
      const request = {
        name: this.metricClient.projectPath(this.config.projectId),
        filter: `metric.type="${metricType}"`,
        interval: {
          startTime: { seconds: Math.floor(startTime.getTime() / 1000) },
          endTime: { seconds: Math.floor(endTime.getTime() / 1000) }
        },
        aggregation
      };

      const [timeSeries] = await this.metricClient.listTimeSeries(request);
      return timeSeries;
    } catch (error) {
      logger.error('Failed to query metrics', { metricType, error });
      return [];
    }
  }

  // Custom Dashboards
  getMetricsSummary(): unknown {
    const summary: {
      timestamp: string;
      metrics: Record<string, unknown>;
      alerts: Record<string, unknown>;
      slos: Record<string, unknown>;
      healthChecks: Record<string, unknown>;
    } = {
      timestamp: new Date().toISOString(),
      metrics: {},
      alerts: {},
      slos: {},
      healthChecks: {}
    };

    // Add custom metrics
    for (const [name, value] of this.customMetrics) {
      summary.metrics[name] = value;
    }

    // Add alert status
    for (const [name, alert] of this.alerts) {
      summary.alerts[name] = {
        enabled: true,
        condition: alert.condition.displayName
      };
    }

    // Add SLO status
    for (const [name, slo] of this.slos) {
      summary.slos[name] = {
        target: slo.target,
        window: slo.window,
        metric: slo.metric
      };
    }

    // Add health check status
    for (const [name, check] of this.healthChecks) {
      summary.healthChecks[name] = {
        type: check.type,
        hosts: check.hosts,
        interval: check.interval
      };
    }

    return summary;
  }

  // APM Integration
  async recordTransaction(
    name: string,
    duration: number,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    await this.recordMetric('transaction_duration', duration, {
      transaction: name,
      ...metadata
    });

    await this.recordMetric('transaction_count', 1, {
      transaction: name,
      status: metadata.status || 'success'
    });
  }

  // Business Metrics
  async recordBusinessMetric(
    name: string,
    value: number,
    dimensions: Record<string, string> = {}
  ): Promise<void> {
    const metricName = `business_${name}`;
    
    if (!this.metrics.has(metricName)) {
      this.registerMetric({
        name: metricName,
        type: 'GAUGE',
        unit: '1',
        description: `Business metric: ${name}`,
        labels: Object.keys(dimensions)
      });
    }

    await this.recordMetric(metricName, value, dimensions);
  }

  // Performance Monitoring
  createPerformanceTimer(name: string): () => Promise<void> {
    const startTime = Date.now();
    
    return async () => {
      const duration = Date.now() - startTime;
      await this.recordMetric('operation_duration', duration, {
        operation: name
      });
    };
  }

  // Alert Notifications
  async sendAlert(message: string, severity: 'info' | 'warning' | 'error' | 'critical'): Promise<void> {
    // Send to Slack if configured
    if (this.config.slackWebhook) {
      await this.sendSlackNotification({
        text: message,
        color: this.getSeverityColor(severity),
        fields: [
          {
            title: 'Service',
            value: this.config.serviceName,
            short: true
          },
          {
            title: 'Environment',
            value: this.config.environment,
            short: true
          },
          {
            title: 'Severity',
            value: severity.toUpperCase(),
            short: true
          },
          {
            title: 'Time',
            value: new Date().toISOString(),
            short: true
          }
        ]
      });
    }

    // Log the alert
    await this.log(severity, message, {
      alert: true,
      service: this.config.serviceName,
      environment: this.config.environment
    });
  }

  private async sendSlackNotification(payload: unknown): Promise<void> {
    if (!this.config.slackWebhook) {
      return;
    }

    try {
      const response = await fetch(this.config.slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Slack notification failed: ${response.statusText}`);
      }
    } catch (error) {
      logger.error('Failed to send Slack notification', { error });
    }
  }

  private getSeverityColor(severity: string): string {
    const colors = {
      info: '#36a64f',
      warning: '#ffcc00',
      error: '#ff6600',
      critical: '#ff0000'
    };
    return colors[severity as keyof typeof colors] || '#808080';
  }

  // Cleanup
  async close(): Promise<void> {
    // Close clients
    await this.logging.close();
    this.errorReporting.stop();
  }
}