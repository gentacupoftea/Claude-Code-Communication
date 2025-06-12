import { EventEmitter } from 'events';

interface EvaluationMetric {
  ruleId: string;
  processingTime: number;
  matched: boolean;
  neuralScore: number;
}

interface SystemMetrics {
  totalEvaluations: number;
  averageProcessingTime: number;
  matchRate: number;
  neuralConfidence: number;
  rulePerformance: Map<string, RuleMetrics>;
  anomalies: AnomalyEvent[];
  trends: TrendData[];
}

interface RuleMetrics {
  evaluationCount: number;
  matchCount: number;
  averageTime: number;
  neuralScores: number[];
  successRate: number;
}

interface AnomalyEvent {
  timestamp: Date;
  type: 'performance' | 'accuracy' | 'pattern';
  severity: 'low' | 'medium' | 'high';
  description: string;
  ruleId?: string;
  value: number;
  threshold: number;
}

interface TrendData {
  metric: string;
  period: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  changeRate: number;
  prediction: number;
}

export class MetricsCollector extends EventEmitter {
  private metrics: SystemMetrics = {
    totalEvaluations: 0,
    averageProcessingTime: 0,
    matchRate: 0,
    neuralConfidence: 0,
    rulePerformance: new Map(),
    anomalies: [],
    trends: []
  };

  private evaluationHistory: EvaluationMetric[] = [];
  private collectionStartTime: number = Date.now();
  private anomalyDetector: AnomalyDetector;
  private trendAnalyzer: TrendAnalyzer;

  // Grafana用のメトリクスエクスポート形式
  private prometheusMetrics: Map<string, number> = new Map();

  constructor() {
    super();
    this.anomalyDetector = new AnomalyDetector();
    this.trendAnalyzer = new TrendAnalyzer();
    this.startMetricsExport();
  }

  startCollection(config: { ruleCount: number; neuralEnabled: boolean }): void {
    this.collectionStartTime = Date.now();
    this.emit('collectionStarted', config);
  }

  recordEvaluation(metric: EvaluationMetric): void {
    this.evaluationHistory.push(metric);
    this.updateMetrics(metric);
    this.detectAnomalies(metric);
    this.updatePrometheusMetrics(metric);
  }

  private updateMetrics(metric: EvaluationMetric): void {
    // 全体メトリクスの更新
    this.metrics.totalEvaluations++;
    this.metrics.averageProcessingTime = this.calculateMovingAverage(
      this.metrics.averageProcessingTime,
      metric.processingTime,
      this.metrics.totalEvaluations
    );

    // ルール別メトリクスの更新
    let ruleMetrics = this.metrics.rulePerformance.get(metric.ruleId);
    if (!ruleMetrics) {
      ruleMetrics = {
        evaluationCount: 0,
        matchCount: 0,
        averageTime: 0,
        neuralScores: [],
        successRate: 0
      };
      this.metrics.rulePerformance.set(metric.ruleId, ruleMetrics);
    }

    ruleMetrics.evaluationCount++;
    if (metric.matched) {
      ruleMetrics.matchCount++;
    }
    ruleMetrics.averageTime = this.calculateMovingAverage(
      ruleMetrics.averageTime,
      metric.processingTime,
      ruleMetrics.evaluationCount
    );
    ruleMetrics.neuralScores.push(metric.neuralScore);
    ruleMetrics.successRate = ruleMetrics.matchCount / ruleMetrics.evaluationCount;

    // 全体のマッチ率と神経網信頼度の更新
    this.updateGlobalMetrics();
  }

  private updateGlobalMetrics(): void {
    let totalMatches = 0;
    let totalNeuralScore = 0;
    let count = 0;

    for (const [_, ruleMetrics] of this.metrics.rulePerformance) {
      totalMatches += ruleMetrics.matchCount;
      const avgScore = ruleMetrics.neuralScores.reduce((a, b) => a + b, 0) / ruleMetrics.neuralScores.length;
      totalNeuralScore += avgScore;
      count++;
    }

    this.metrics.matchRate = totalMatches / this.metrics.totalEvaluations;
    this.metrics.neuralConfidence = count > 0 ? totalNeuralScore / count : 0;
  }

  private detectAnomalies(metric: EvaluationMetric): void {
    const anomalies = this.anomalyDetector.detect(metric, this.metrics);
    
    for (const anomaly of anomalies) {
      this.metrics.anomalies.push(anomaly);
      this.emit('anomalyDetected', anomaly);
    }

    // 古い異常を削除（24時間以上前）
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000;
    this.metrics.anomalies = this.metrics.anomalies.filter(
      a => a.timestamp.getTime() > cutoffTime
    );
  }

  private calculateMovingAverage(
    currentAvg: number,
    newValue: number,
    count: number
  ): number {
    return (currentAvg * (count - 1) + newValue) / count;
  }

  // Grafanaダッシュボード用のデータ取得
  getGrafanaData(): GrafanaDashboardData {
    const trends = this.trendAnalyzer.analyze(this.evaluationHistory);
    this.metrics.trends = trends;

    return {
      // LLM判断の可視化データ
      llmDecisions: {
        totalDecisions: this.metrics.totalEvaluations,
        matchRate: this.metrics.matchRate,
        averageConfidence: this.metrics.neuralConfidence,
        ruleApplicationHistory: this.getRuleApplicationHistory(),
        topPerformingRules: this.getTopPerformingRules(5)
      },

      // 神経網型ツール選択の成功率
      neuralToolSelection: {
        successRate: this.calculateNeuralSuccessRate(),
        activationPatterns: this.getNeuralActivationPatterns(),
        performanceByLayer: this.getPerformanceByLayer()
      },

      // システム進化速度
      evolutionMetrics: {
        learningRate: this.calculateLearningRate(),
        ruleOptimizationRate: this.calculateOptimizationRate(),
        adaptationSpeed: this.calculateAdaptationSpeed(),
        improvementTrend: trends.find(t => t.metric === 'system_performance')
      },

      // 異常検知
      anomalies: {
        recent: this.metrics.anomalies.slice(-10),
        byType: this.groupAnomaliesByType(),
        severity: this.getAnomalySeverityDistribution()
      },

      // 予測分析
      predictions: {
        nextHourLoad: this.predictLoad(60),
        performanceTrend: this.predictPerformanceTrend(),
        anomalyProbability: this.predictAnomalyProbability()
      }
    };
  }

  // Prometheus形式でのメトリクスエクスポート
  getPrometheusMetrics(): string {
    let output = '';
    
    for (const [key, value] of this.prometheusMetrics) {
      output += `# HELP ${key} ${this.getMetricHelp(key)}\n`;
      output += `# TYPE ${key} gauge\n`;
      output += `${key} ${value}\n\n`;
    }

    return output;
  }

  private updatePrometheusMetrics(metric: EvaluationMetric): void {
    this.prometheusMetrics.set('yaml_rule_engine_total_evaluations', this.metrics.totalEvaluations);
    this.prometheusMetrics.set('yaml_rule_engine_avg_processing_time_ms', this.metrics.averageProcessingTime);
    this.prometheusMetrics.set('yaml_rule_engine_match_rate', this.metrics.matchRate);
    this.prometheusMetrics.set('yaml_rule_engine_neural_confidence', this.metrics.neuralConfidence);
    
    // ルール別メトリクス
    const ruleMetrics = this.metrics.rulePerformance.get(metric.ruleId);
    if (ruleMetrics) {
      this.prometheusMetrics.set(
        `yaml_rule_engine_rule_success_rate{rule_id="${metric.ruleId}"}`,
        ruleMetrics.successRate
      );
    }
  }

  private getMetricHelp(key: string): string {
    const helps: Record<string, string> = {
      'yaml_rule_engine_total_evaluations': 'Total number of rule evaluations',
      'yaml_rule_engine_avg_processing_time_ms': 'Average processing time in milliseconds',
      'yaml_rule_engine_match_rate': 'Rate of rules matching (0-1)',
      'yaml_rule_engine_neural_confidence': 'Average neural network confidence score'
    };
    return helps[key] || 'Custom metric';
  }

  private getRuleApplicationHistory(): Array<{ timestamp: number; ruleId: string; matched: boolean }> {
    return this.evaluationHistory.slice(-100).map(e => ({
      timestamp: Date.now() - (this.evaluationHistory.length - this.evaluationHistory.indexOf(e)) * 1000,
      ruleId: e.ruleId,
      matched: e.matched
    }));
  }

  private getTopPerformingRules(count: number): Array<{ ruleId: string; performance: number }> {
    const rules = Array.from(this.metrics.rulePerformance.entries())
      .map(([ruleId, metrics]) => ({
        ruleId,
        performance: metrics.successRate * (1000 / metrics.averageTime)
      }))
      .sort((a, b) => b.performance - a.performance);
    
    return rules.slice(0, count);
  }

  private calculateNeuralSuccessRate(): number {
    // 神経網の予測と実際の結果の一致率
    const recentEvaluations = this.evaluationHistory.slice(-100);
    let matches = 0;
    
    for (const eval of recentEvaluations) {
      if ((eval.neuralScore > 0.5 && eval.matched) || (eval.neuralScore <= 0.5 && !eval.matched)) {
        matches++;
      }
    }
    
    return recentEvaluations.length > 0 ? matches / recentEvaluations.length : 0;
  }

  private getNeuralActivationPatterns(): number[][] {
    // 簡略化: ランダムなアクティベーションパターンを返す
    return Array(5).fill(0).map(() => 
      Array(10).fill(0).map(() => Math.random())
    );
  }

  private getPerformanceByLayer(): Array<{ layer: number; performance: number }> {
    // 各層のパフォーマンスメトリクス
    return [
      { layer: 1, performance: 0.85 },
      { layer: 2, performance: 0.92 },
      { layer: 3, performance: 0.88 }
    ];
  }

  private calculateLearningRate(): number {
    // 時間経過による性能向上率
    const oldMetrics = this.evaluationHistory.slice(0, 100);
    const newMetrics = this.evaluationHistory.slice(-100);
    
    if (oldMetrics.length === 0 || newMetrics.length === 0) return 0;
    
    const oldAvgTime = oldMetrics.reduce((sum, m) => sum + m.processingTime, 0) / oldMetrics.length;
    const newAvgTime = newMetrics.reduce((sum, m) => sum + m.processingTime, 0) / newMetrics.length;
    
    return (oldAvgTime - newAvgTime) / oldAvgTime;
  }

  private calculateOptimizationRate(): number {
    // ルール最適化の頻度
    const recentAnomalies = this.metrics.anomalies.filter(
      a => a.type === 'pattern' && a.timestamp.getTime() > Date.now() - 3600000
    );
    return recentAnomalies.length / 60; // 1分あたりの最適化数
  }

  private calculateAdaptationSpeed(): number {
    // システムの適応速度（新しいパターンへの対応速度）
    return 0.75; // 簡略化
  }

  private groupAnomaliesByType(): Record<string, number> {
    const groups: Record<string, number> = {
      performance: 0,
      accuracy: 0,
      pattern: 0
    };
    
    for (const anomaly of this.metrics.anomalies) {
      groups[anomaly.type]++;
    }
    
    return groups;
  }

  private getAnomalySeverityDistribution(): Record<string, number> {
    const dist: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0
    };
    
    for (const anomaly of this.metrics.anomalies) {
      dist[anomaly.severity]++;
    }
    
    return dist;
  }

  private predictLoad(minutes: number): number {
    // 簡略化された負荷予測
    const currentRate = this.metrics.totalEvaluations / ((Date.now() - this.collectionStartTime) / 1000 / 60);
    return Math.round(currentRate * minutes);
  }

  private predictPerformanceTrend(): 'improving' | 'degrading' | 'stable' {
    const learningRate = this.calculateLearningRate();
    if (learningRate > 0.1) return 'improving';
    if (learningRate < -0.1) return 'degrading';
    return 'stable';
  }

  private predictAnomalyProbability(): number {
    // 最近の異常発生率から予測
    const recentAnomalies = this.metrics.anomalies.filter(
      a => a.timestamp.getTime() > Date.now() - 3600000
    );
    return Math.min(recentAnomalies.length / 10, 1);
  }

  private startMetricsExport(): void {
    // 定期的にメトリクスをエクスポート
    setInterval(() => {
      this.emit('metricsUpdate', this.getGrafanaData());
    }, 5000);
  }

  getMetrics(): SystemMetrics {
    return this.metrics;
  }
}

// AI駆動の異常検知
class AnomalyDetector {
  private thresholds = {
    processingTime: { mean: 100, stdDev: 50 },
    matchRate: { min: 0.3, max: 0.9 },
    neuralConfidence: { min: 0.4 }
  };

  detect(metric: EvaluationMetric, systemMetrics: SystemMetrics): AnomalyEvent[] {
    const anomalies: AnomalyEvent[] = [];

    // 処理時間の異常
    if (metric.processingTime > this.thresholds.processingTime.mean + 2 * this.thresholds.processingTime.stdDev) {
      anomalies.push({
        timestamp: new Date(),
        type: 'performance',
        severity: metric.processingTime > this.thresholds.processingTime.mean + 3 * this.thresholds.processingTime.stdDev ? 'high' : 'medium',
        description: `Processing time ${metric.processingTime}ms exceeds threshold`,
        ruleId: metric.ruleId,
        value: metric.processingTime,
        threshold: this.thresholds.processingTime.mean + 2 * this.thresholds.processingTime.stdDev
      });
    }

    // 神経網信頼度の異常
    if (metric.neuralScore < this.thresholds.neuralConfidence.min) {
      anomalies.push({
        timestamp: new Date(),
        type: 'accuracy',
        severity: 'low',
        description: `Low neural confidence ${metric.neuralScore}`,
        ruleId: metric.ruleId,
        value: metric.neuralScore,
        threshold: this.thresholds.neuralConfidence.min
      });
    }

    return anomalies;
  }
}

// トレンド分析
class TrendAnalyzer {
  analyze(history: EvaluationMetric[]): TrendData[] {
    const trends: TrendData[] = [];

    // システムパフォーマンスのトレンド
    const performanceTrend = this.analyzePerformanceTrend(history);
    if (performanceTrend) {
      trends.push(performanceTrend);
    }

    return trends;
  }

  private analyzePerformanceTrend(history: EvaluationMetric[]): TrendData | null {
    if (history.length < 100) return null;

    const recent = history.slice(-50);
    const previous = history.slice(-100, -50);

    const recentAvg = recent.reduce((sum, m) => sum + m.processingTime, 0) / recent.length;
    const previousAvg = previous.reduce((sum, m) => sum + m.processingTime, 0) / previous.length;

    const changeRate = (recentAvg - previousAvg) / previousAvg;

    return {
      metric: 'system_performance',
      period: 'last_50_evaluations',
      trend: changeRate < -0.05 ? 'improving' : changeRate > 0.05 ? 'degrading' : 'stable',
      changeRate,
      prediction: recentAvg * (1 + changeRate)
    };
  }
}

// Grafanaダッシュボード用のデータ型
interface GrafanaDashboardData {
  llmDecisions: {
    totalDecisions: number;
    matchRate: number;
    averageConfidence: number;
    ruleApplicationHistory: Array<{ timestamp: number; ruleId: string; matched: boolean }>;
    topPerformingRules: Array<{ ruleId: string; performance: number }>;
  };
  neuralToolSelection: {
    successRate: number;
    activationPatterns: number[][];
    performanceByLayer: Array<{ layer: number; performance: number }>;
  };
  evolutionMetrics: {
    learningRate: number;
    ruleOptimizationRate: number;
    adaptationSpeed: number;
    improvementTrend?: TrendData;
  };
  anomalies: {
    recent: AnomalyEvent[];
    byType: Record<string, number>;
    severity: Record<string, number>;
  };
  predictions: {
    nextHourLoad: number;
    performanceTrend: 'improving' | 'degrading' | 'stable';
    anomalyProbability: number;
  };
}