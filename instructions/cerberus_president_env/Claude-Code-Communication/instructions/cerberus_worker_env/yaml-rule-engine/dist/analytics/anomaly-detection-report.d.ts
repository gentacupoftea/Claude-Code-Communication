export declare class AnomalyDetectionAnalyzer {
    private engine;
    private metricsCollector;
    private testCases;
    private results;
    constructor();
    private generateTestCases;
    analyze(): Promise<void>;
    private initializeEngine;
    private evaluateTestCase;
    private calculateMetrics;
    private generateReport;
    private evaluateMetric;
    private calculateAverage;
    private generateAnomalyTypeAnalysis;
    private generateImprovementSuggestions;
    private generateLatencyDistribution;
}
//# sourceMappingURL=anomaly-detection-report.d.ts.map