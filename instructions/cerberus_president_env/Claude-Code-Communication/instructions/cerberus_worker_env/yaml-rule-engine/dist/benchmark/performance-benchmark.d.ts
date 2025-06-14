interface BenchmarkResult {
    testName: string;
    totalEvaluations: number;
    totalTime: number;
    averageTime: number;
    minTime: number;
    maxTime: number;
    throughput: number;
    memoryUsage: {
        heapUsed: number;
        heapTotal: number;
        external: number;
    };
}
export declare class PerformanceBenchmark {
    private engine;
    private results;
    constructor();
    initialize(): Promise<void>;
    runAllBenchmarks(): Promise<BenchmarkResult[]>;
    private benchmarkSimpleEvaluation;
    private benchmarkComplexEvaluation;
    private benchmarkParallelEvaluation;
    private benchmarkLLMEvaluation;
    private benchmarkRuleUpdate;
    private benchmarkMemoryUsage;
    private runBenchmark;
    private printResults;
    private analyzePerformance;
}
export {};
//# sourceMappingURL=performance-benchmark.d.ts.map