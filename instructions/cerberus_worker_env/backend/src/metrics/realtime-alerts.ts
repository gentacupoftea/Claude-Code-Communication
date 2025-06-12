import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';
import * as WebSocket from 'ws';

interface Alert {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  description: string;
  timestamp: Date;
  source: string;
  metadata?: Record<string, any>;
  resolved?: boolean;
  resolvedAt?: Date;
}

interface AlertRule {
  id: string;
  name: string;
  condition: (metrics: any) => boolean;
  severity: Alert['severity'];
  cooldown: number; // milliseconds
  lastTriggered?: Date;
  actions: AlertAction[];
}

interface AlertAction {
  type: 'webhook' | 'email' | 'slack' | 'pagerduty' | 'websocket';
  config: Record<string, any>;
}

/**
 * Real-time alert management system
 */
@Injectable()
export class RealtimeAlerts extends EventEmitter {
  private alerts: Map<string, Alert> = new Map();
  private rules: Map<string, AlertRule> = new Map();
  private wsServer: WebSocket.Server | null = null;
  private metricsBuffer: any[] = [];
  private readonly bufferSize = 1000;

  constructor() {
    super();
    this.initializeWebSocketServer();
    this.setupDefaultRules();
    this.startAlertProcessor();
  }

  /**
   * Initialize WebSocket server for real-time alerts
   */
  private initializeWebSocketServer() {
    const port = parseInt(process.env.ALERT_WS_PORT || '8081');
    this.wsServer = new WebSocket.Server({ port });

    this.wsServer.on('connection', (ws) => {
      console.log('New WebSocket client connected for alerts');
      
      // Send current active alerts
      const activeAlerts = Array.from(this.alerts.values())
        .filter(alert => !alert.resolved);
      
      ws.send(JSON.stringify({
        type: 'initial',
        alerts: activeAlerts
      }));

      ws.on('close', () => {
        console.log('WebSocket client disconnected');
      });
    });
  }

  /**
   * Setup default alert rules
   */
  private setupDefaultRules() {
    // High error rate
    this.addRule({
      id: 'high_error_rate',
      name: 'High Error Rate',
      condition: (metrics) => metrics.errorRate > 0.05, // 5% error rate
      severity: 'error',
      cooldown: 5 * 60 * 1000, // 5 minutes
      actions: [
        { type: 'websocket', config: {} },
        { type: 'slack', config: { channel: '#alerts' } }
      ]
    });

    // Critical error rate
    this.addRule({
      id: 'critical_error_rate',
      name: 'Critical Error Rate',
      condition: (metrics) => metrics.errorRate > 0.10, // 10% error rate
      severity: 'critical',
      cooldown: 5 * 60 * 1000,
      actions: [
        { type: 'websocket', config: {} },
        { type: 'pagerduty', config: { serviceKey: process.env.PAGERDUTY_KEY } }
      ]
    });

    // High response time
    this.addRule({
      id: 'high_response_time',
      name: 'High Response Time',
      condition: (metrics) => metrics.avgResponseTime > 1000, // 1 second
      severity: 'warning',
      cooldown: 10 * 60 * 1000,
      actions: [
        { type: 'websocket', config: {} }
      ]
    });

    // Authentication failures spike
    this.addRule({
      id: 'auth_failure_spike',
      name: 'Authentication Failures Spike',
      condition: (metrics) => metrics.authFailureRate > 0.20, // 20% failure rate
      severity: 'error',
      cooldown: 5 * 60 * 1000,
      actions: [
        { type: 'websocket', config: {} },
        { type: 'email', config: { to: 'security@example.com' } }
      ]
    });

    // Low API awareness level
    this.addRule({
      id: 'low_api_awareness',
      name: 'Low API Awareness Level',
      condition: (metrics) => metrics.apiAwarenessLevel < 0.5,
      severity: 'warning',
      cooldown: 30 * 60 * 1000,
      actions: [
        { type: 'websocket', config: {} }
      ]
    });

    // Self-healing failure
    this.addRule({
      id: 'self_healing_failure',
      name: 'Self-Healing System Failure',
      condition: (metrics) => metrics.selfHealingSuccessRate < 0.7,
      severity: 'error',
      cooldown: 15 * 60 * 1000,
      actions: [
        { type: 'websocket', config: {} },
        { type: 'slack', config: { channel: '#engineering' } }
      ]
    });

    // Predictive cache performance
    this.addRule({
      id: 'low_predictive_cache_hit',
      name: 'Low Predictive Cache Hit Rate',
      condition: (metrics) => metrics.predictiveCacheHitRate < 0.6,
      severity: 'info',
      cooldown: 60 * 60 * 1000,
      actions: [
        { type: 'websocket', config: {} }
      ]
    });

    // Anomaly detection alert
    this.addRule({
      id: 'high_anomaly_score',
      name: 'High Anomaly Score Detected',
      condition: (metrics) => metrics.anomalyScore > 0.85,
      severity: 'error',
      cooldown: 5 * 60 * 1000,
      actions: [
        { type: 'websocket', config: {} },
        { type: 'email', config: { to: 'security@example.com' } }
      ]
    });

    // System health degradation
    this.addRule({
      id: 'system_health_degraded',
      name: 'System Health Degraded',
      condition: (metrics) => metrics.systemHealth < 0.7,
      severity: 'warning',
      cooldown: 10 * 60 * 1000,
      actions: [
        { type: 'websocket', config: {} }
      ]
    });

    // Token storage issues
    this.addRule({
      id: 'token_storage_issue',
      name: 'Token Storage Performance Issue',
      condition: (metrics) => metrics.tokenStorageLatency > 100, // 100ms
      severity: 'warning',
      cooldown: 15 * 60 * 1000,
      actions: [
        { type: 'websocket', config: {} }
      ]
    });
  }

  /**
   * Start alert processor
   */
  private startAlertProcessor() {
    setInterval(() => {
      this.processAlerts();
    }, 5000); // Process every 5 seconds
  }

  /**
   * Add or update an alert rule
   */
  addRule(rule: AlertRule) {
    this.rules.set(rule.id, rule);
  }

  /**
   * Remove an alert rule
   */
  removeRule(ruleId: string) {
    this.rules.delete(ruleId);
  }

  /**
   * Process metrics and check alert rules
   */
  processAlerts() {
    const currentMetrics = this.calculateCurrentMetrics();
    
    for (const [ruleId, rule] of this.rules) {
      // Check cooldown
      if (rule.lastTriggered) {
        const timeSinceLastTrigger = Date.now() - rule.lastTriggered.getTime();
        if (timeSinceLastTrigger < rule.cooldown) {
          continue;
        }
      }

      // Check condition
      if (rule.condition(currentMetrics)) {
        this.triggerAlert(rule, currentMetrics);
      }
    }

    // Check for resolved alerts
    this.checkResolvedAlerts(currentMetrics);
  }

  /**
   * Trigger an alert
   */
  private triggerAlert(rule: AlertRule, metrics: any) {
    const alert: Alert = {
      id: `${rule.id}_${Date.now()}`,
      severity: rule.severity,
      title: rule.name,
      description: this.generateAlertDescription(rule, metrics),
      timestamp: new Date(),
      source: 'prometheus-metrics',
      metadata: { metrics, ruleId: rule.id }
    };

    // Store alert
    this.alerts.set(alert.id, alert);
    
    // Update rule's last triggered time
    rule.lastTriggered = new Date();

    // Execute actions
    for (const action of rule.actions) {
      this.executeAction(action, alert);
    }

    // Emit event
    this.emit('alert', alert);
  }

  /**
   * Execute alert action
   */
  private async executeAction(action: AlertAction, alert: Alert) {
    switch (action.type) {
      case 'websocket':
        this.broadcastAlert(alert);
        break;
      
      case 'webhook':
        await this.sendWebhook(action.config.url, alert);
        break;
      
      case 'email':
        await this.sendEmail(action.config.to, alert);
        break;
      
      case 'slack':
        await this.sendSlackMessage(action.config.channel, alert);
        break;
      
      case 'pagerduty':
        await this.sendPagerDutyAlert(action.config.serviceKey, alert);
        break;
    }
  }

  /**
   * Broadcast alert via WebSocket
   */
  private broadcastAlert(alert: Alert) {
    if (!this.wsServer) return;

    const message = JSON.stringify({
      type: 'alert',
      alert
    });

    this.wsServer.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  /**
   * Send webhook notification
   */
  private async sendWebhook(url: string, alert: Alert) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alert)
      });
      
      if (!response.ok) {
        console.error(`Webhook failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Webhook error:', error);
    }
  }

  /**
   * Send email notification (placeholder)
   */
  private async sendEmail(to: string, alert: Alert) {
    // In production: Integrate with email service
    console.log(`Email alert to ${to}:`, alert.title);
  }

  /**
   * Send Slack message (placeholder)
   */
  private async sendSlackMessage(channel: string, alert: Alert) {
    // In production: Integrate with Slack API
    console.log(`Slack alert to ${channel}:`, alert.title);
  }

  /**
   * Send PagerDuty alert (placeholder)
   */
  private async sendPagerDutyAlert(serviceKey: string, alert: Alert) {
    // In production: Integrate with PagerDuty API
    console.log(`PagerDuty alert:`, alert.title);
  }

  /**
   * Check for resolved alerts
   */
  private checkResolvedAlerts(currentMetrics: any) {
    for (const [alertId, alert] of this.alerts) {
      if (alert.resolved) continue;

      const rule = this.rules.get(alert.metadata?.ruleId);
      if (rule && !rule.condition(currentMetrics)) {
        // Alert condition no longer met
        alert.resolved = true;
        alert.resolvedAt = new Date();
        
        this.broadcastAlert({
          ...alert,
          type: 'resolved' as any
        });
        
        this.emit('alert-resolved', alert);
      }
    }
  }

  /**
   * Calculate current metrics from buffer
   */
  private calculateCurrentMetrics(): any {
    if (this.metricsBuffer.length === 0) {
      return this.getDefaultMetrics();
    }

    const recentMetrics = this.metricsBuffer.slice(-100); // Last 100 data points
    
    return {
      errorRate: this.calculateErrorRate(recentMetrics),
      avgResponseTime: this.calculateAvgResponseTime(recentMetrics),
      authFailureRate: this.calculateAuthFailureRate(recentMetrics),
      apiAwarenessLevel: this.getLatestMetric(recentMetrics, 'apiAwarenessLevel'),
      selfHealingSuccessRate: this.getLatestMetric(recentMetrics, 'selfHealingSuccessRate'),
      predictiveCacheHitRate: this.getLatestMetric(recentMetrics, 'predictiveCacheHitRate'),
      anomalyScore: this.getLatestMetric(recentMetrics, 'anomalyScore'),
      systemHealth: this.getLatestMetric(recentMetrics, 'systemHealth'),
      tokenStorageLatency: this.getLatestMetric(recentMetrics, 'tokenStorageLatency')
    };
  }

  /**
   * Push metrics to buffer
   */
  pushMetrics(metrics: any) {
    this.metricsBuffer.push({
      ...metrics,
      timestamp: Date.now()
    });

    // Keep buffer size limited
    if (this.metricsBuffer.length > this.bufferSize) {
      this.metricsBuffer.shift();
    }
  }

  /**
   * Helper methods for metric calculations
   */
  private calculateErrorRate(metrics: any[]): number {
    const errors = metrics.filter(m => m.statusCode >= 400).length;
    return errors / metrics.length;
  }

  private calculateAvgResponseTime(metrics: any[]): number {
    const sum = metrics.reduce((acc, m) => acc + (m.responseTime || 0), 0);
    return sum / metrics.length;
  }

  private calculateAuthFailureRate(metrics: any[]): number {
    const authMetrics = metrics.filter(m => m.authAttempt);
    const failures = authMetrics.filter(m => !m.authSuccess).length;
    return authMetrics.length > 0 ? failures / authMetrics.length : 0;
  }

  private getLatestMetric(metrics: any[], key: string): number {
    for (let i = metrics.length - 1; i >= 0; i--) {
      if (metrics[i][key] !== undefined) {
        return metrics[i][key];
      }
    }
    return 0;
  }

  private getDefaultMetrics(): any {
    return {
      errorRate: 0,
      avgResponseTime: 0,
      authFailureRate: 0,
      apiAwarenessLevel: 1,
      selfHealingSuccessRate: 1,
      predictiveCacheHitRate: 0.8,
      anomalyScore: 0,
      systemHealth: 1,
      tokenStorageLatency: 0
    };
  }

  /**
   * Generate alert description
   */
  private generateAlertDescription(rule: AlertRule, metrics: any): string {
    const descriptions: Record<string, string> = {
      high_error_rate: `Error rate is ${(metrics.errorRate * 100).toFixed(2)}%, exceeding threshold of 5%`,
      critical_error_rate: `Critical: Error rate is ${(metrics.errorRate * 100).toFixed(2)}%, exceeding threshold of 10%`,
      high_response_time: `Average response time is ${metrics.avgResponseTime}ms, exceeding threshold of 1000ms`,
      auth_failure_spike: `Authentication failure rate is ${(metrics.authFailureRate * 100).toFixed(2)}%, indicating potential security issue`,
      low_api_awareness: `API awareness level dropped to ${(metrics.apiAwarenessLevel * 100).toFixed(2)}%`,
      self_healing_failure: `Self-healing success rate is only ${(metrics.selfHealingSuccessRate * 100).toFixed(2)}%`,
      low_predictive_cache_hit: `Predictive cache hit rate is ${(metrics.predictiveCacheHitRate * 100).toFixed(2)}%`,
      high_anomaly_score: `Anomaly detection score is ${(metrics.anomalyScore * 100).toFixed(2)}%, indicating unusual activity`,
      system_health_degraded: `System health score dropped to ${(metrics.systemHealth * 100).toFixed(2)}%`,
      token_storage_issue: `Token storage latency is ${metrics.tokenStorageLatency}ms, exceeding threshold`
    };

    return descriptions[rule.id] || 'Alert condition met';
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values())
      .filter(alert => !alert.resolved);
  }

  /**
   * Get all alerts
   */
  getAllAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string) {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.metadata = { ...alert.metadata, acknowledged: true };
      this.broadcastAlert(alert);
    }
  }

  /**
   * Cleanup old resolved alerts
   */
  cleanupOldAlerts(maxAge: number = 24 * 60 * 60 * 1000) {
    const cutoff = Date.now() - maxAge;
    
    for (const [alertId, alert] of this.alerts) {
      if (alert.resolved && alert.resolvedAt && alert.resolvedAt.getTime() < cutoff) {
        this.alerts.delete(alertId);
      }
    }
  }
}