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
export declare class MetricsCollector extends EventEmitter {
    private metrics;
    private evaluationHistory;
    private collectionStartTime;
    private anomalyDetector;
    private trendAnalyzer;
    private prometheusMetrics;
    constructor();
    startCollection(config: {
        ruleCount: number;
        neuralEnabled: boolean;
    }): void;
    recordEvaluation(metric: EvaluationMetric): void;
    private updateMetrics;
    private updateGlobalMetrics;
    private detectAnomalies;
    private calculateMovingAverage;
    getGrafanaData(): GrafanaDashboardData;
    getPrometheusMetrics(): string;
    private updatePrometheusMetrics;
    private getMetricHelp;
    private getRuleApplicationHistory;
    private getTopPerformingRules;
    private calculateNeuralSuccessRate;
    private getNeuralActivationPatterns;
    private getPerformanceByLayer;
    private calculateLearningRate;
    private calculateOptimizationRate;
    private calculateAdaptationSpeed;
    private groupAnomaliesByType;
    private getAnomalySeverityDistribution;
    private predictLoad;
    private predictPerformanceTrend;
    private predictAnomalyProbability;
    private startMetricsExport;
    getMetrics(): SystemMetrics;
}
interface GrafanaDashboardData {
    llmDecisions: {
        totalDecisions: number;
        matchRate: number;
        averageConfidence: number;
        ruleApplicationHistory: Array<{
            timestamp: number;
            ruleId: string;
            matched: boolean;
        }>;
        topPerformingRules: Array<{
            ruleId: string;
            performance: number;
        }>;
    };
    neuralToolSelection: {
        successRate: number;
        activationPatterns: number[][];
        performanceByLayer: Array<{
            layer: number;
            performance: number;
        }>;
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
export {};
//# sourceMappingURL=metrics-collector.d.ts.map