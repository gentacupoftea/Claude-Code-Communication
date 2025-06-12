import { YAMLRuleEngine } from '../core/rule-engine';
import { readFileSync } from 'fs';
import { join } from 'path';

interface BenchmarkResult {
  testName: string;
  totalEvaluations: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  throughput: number; // evaluations per second
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
}

export class PerformanceBenchmark {
  private engine: YAMLRuleEngine;
  private results: BenchmarkResult[] = [];

  constructor() {
    this.engine = new YAMLRuleEngine();
  }

  async initialize(): Promise<void> {
    const rulesPath = join(__dirname, '../../examples/sample-rules.yaml');
    const yamlContent = readFileSync(rulesPath, 'utf-8');
    await this.engine.loadRulesFromYAML(yamlContent);
  }

  async runAllBenchmarks(): Promise<BenchmarkResult[]> {
    console.log('🚀 YAMLルールエンジン パフォーマンスベンチマーク開始\n');

    await this.initialize();

    // ベンチマークテスト実行
    await this.benchmarkSimpleEvaluation();
    await this.benchmarkComplexEvaluation();
    await this.benchmarkParallelEvaluation();
    await this.benchmarkLLMEvaluation();
    await this.benchmarkRuleUpdate();
    await this.benchmarkMemoryUsage();

    this.printResults();
    return this.results;
  }

  // シンプルな評価のベンチマーク
  private async benchmarkSimpleEvaluation(): Promise<void> {
    const testName = 'シンプル評価 (条件マッチングのみ)';
    const iterations = 10000;
    const context = {
      request: { path: '/api/users', method: 'GET' },
      user: { id: '123', role: 'admin' }
    };

    const result = await this.runBenchmark(testName, iterations, async () => {
      await this.engine.evaluate(context);
    });

    this.results.push(result);
  }

  // 複雑な評価のベンチマーク
  private async benchmarkComplexEvaluation(): Promise<void> {
    const testName = '複雑評価 (ネストした条件)';
    const iterations = 5000;
    const context = {
      request: {
        path: '/admin/sensitive-data',
        headers: { 'User-Agent': 'Mozilla/5.0' },
        body: { action: 'delete', items: Array(100).fill({ id: 1 }) }
      },
      user: {
        sessionData: { loginTime: Date.now(), actions: Array(50).fill('read') }
      },
      metrics: {
        responseTime: 1500,
        endpoint: '/api/complex-operation'
      }
    };

    const result = await this.runBenchmark(testName, iterations, async () => {
      await this.engine.evaluate(context);
    });

    this.results.push(result);
  }

  // 並列評価のベンチマーク
  private async benchmarkParallelEvaluation(): Promise<void> {
    const testName = '並列評価 (神経網型)';
    const iterations = 1000;
    const batchSize = 10;
    
    const contexts = Array(batchSize).fill(null).map((_, i) => ({
      request: { path: `/api/endpoint-${i}`, id: i },
      metrics: { value: Math.random() * 1000 }
    }));

    const result = await this.runBenchmark(testName, iterations, async () => {
      const promises = contexts.map(ctx => this.engine.evaluate(ctx));
      await Promise.all(promises);
    });

    // バッチサイズを考慮した実効評価数
    result.totalEvaluations = iterations * batchSize;
    result.throughput = result.totalEvaluations / (result.totalTime / 1000);

    this.results.push(result);
  }

  // LLM評価のベンチマーク（モック）
  private async benchmarkLLMEvaluation(): Promise<void> {
    const testName = 'LLM評価 (モック)';
    const iterations = 100;
    const context = {
      request: {
        path: '/admin/users',
        headers: { 'X-Suspicious': 'true' }
      },
      task: {
        type: 'analysis',
        complexity: 'high',
        data: { content: 'Complex analysis required' }
      }
    };

    const result = await this.runBenchmark(testName, iterations, async () => {
      await this.engine.evaluate(context);
    });

    this.results.push(result);
  }

  // ルール更新のベンチマーク
  private async benchmarkRuleUpdate(): Promise<void> {
    const testName = '動的ルール更新';
    const iterations = 1000;
    
    const result = await this.runBenchmark(testName, iterations, async () => {
      const priority = Math.floor(Math.random() * 100);
      await this.engine.updateRule('security-threat-detection', { priority });
    });

    this.results.push(result);
  }

  // メモリ使用量のベンチマーク
  private async benchmarkMemoryUsage(): Promise<void> {
    const testName = 'メモリ使用量 (大量評価)';
    const iterations = 10000;
    
    // GCを強制実行してベースラインを取得
    global.gc && global.gc();
    const baselineMemory = process.memoryUsage();

    const context = {
      largeData: Array(1000).fill({ key: 'value', nested: { data: 'test' } })
    };

    const result = await this.runBenchmark(testName, iterations, async () => {
      await this.engine.evaluate(context);
    });

    const finalMemory = process.memoryUsage();
    result.memoryUsage = {
      heapUsed: (finalMemory.heapUsed - baselineMemory.heapUsed) / 1024 / 1024,
      heapTotal: finalMemory.heapTotal / 1024 / 1024,
      external: finalMemory.external / 1024 / 1024
    };

    this.results.push(result);
  }

  // ベンチマーク実行ヘルパー
  private async runBenchmark(
    testName: string,
    iterations: number,
    fn: () => Promise<void>
  ): Promise<BenchmarkResult> {
    const times: number[] = [];
    const startMemory = process.memoryUsage();
    const totalStart = Date.now();

    // ウォームアップ
    for (let i = 0; i < 10; i++) {
      await fn();
    }

    // 実際のベンチマーク
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await fn();
      const end = Date.now();
      times.push(end - start);
    }

    const totalTime = Date.now() - totalStart;
    const endMemory = process.memoryUsage();

    return {
      testName,
      totalEvaluations: iterations,
      totalTime,
      averageTime: times.reduce((a, b) => a + b, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      throughput: iterations / (totalTime / 1000),
      memoryUsage: {
        heapUsed: (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024,
        heapTotal: endMemory.heapTotal / 1024 / 1024,
        external: endMemory.external / 1024 / 1024
      }
    };
  }

  // 結果の表示
  private printResults(): void {
    console.log('\n📊 ベンチマーク結果サマリー\n');
    console.log('━'.repeat(100));
    console.log(
      'テスト名'.padEnd(30) +
      '評価数'.padEnd(10) +
      '合計時間'.padEnd(12) +
      '平均時間'.padEnd(12) +
      '最小/最大'.padEnd(15) +
      'スループット'.padEnd(15) +
      'メモリ使用'
    );
    console.log('━'.repeat(100));

    for (const result of this.results) {
      console.log(
        result.testName.padEnd(30) +
        result.totalEvaluations.toString().padEnd(10) +
        `${result.totalTime}ms`.padEnd(12) +
        `${result.averageTime.toFixed(2)}ms`.padEnd(12) +
        `${result.minTime}/${result.maxTime}ms`.padEnd(15) +
        `${result.throughput.toFixed(1)}/s`.padEnd(15) +
        `${result.memoryUsage.heapUsed.toFixed(1)}MB`
      );
    }
    console.log('━'.repeat(100));

    // パフォーマンス評価
    this.analyzePerformance();
  }

  // パフォーマンス分析
  private analyzePerformance(): void {
    console.log('\n🎯 パフォーマンス分析\n');

    const simpleEval = this.results.find(r => r.testName.includes('シンプル評価'));
    const parallelEval = this.results.find(r => r.testName.includes('並列評価'));

    if (simpleEval && parallelEval) {
      const speedup = parallelEval.throughput / simpleEval.throughput;
      console.log(`✅ 並列処理によるスピードアップ: ${speedup.toFixed(2)}倍`);
    }

    const avgThroughput = this.results.reduce((sum, r) => sum + r.throughput, 0) / this.results.length;
    console.log(`✅ 平均スループット: ${avgThroughput.toFixed(1)} evaluations/秒`);

    const memoryEfficiency = this.results.map(r => 
      r.totalEvaluations / r.memoryUsage.heapUsed
    ).reduce((a, b) => a + b, 0) / this.results.length;
    console.log(`✅ メモリ効率: ${memoryEfficiency.toFixed(1)} evaluations/MB`);

    // 推奨事項
    console.log('\n💡 推奨事項:');
    if (avgThroughput < 1000) {
      console.log('- キャッシング戦略の改善を検討してください');
    }
    if (parallelEval && parallelEval.throughput < simpleEval!.throughput * 2) {
      console.log('- 並列処理の最適化余地があります');
    }
    console.log('- 本番環境ではRedisキャッシュの使用を推奨します');
  }
}

// スタンドアロン実行
if (require.main === module) {
  const benchmark = new PerformanceBenchmark();
  benchmark.runAllBenchmarks().catch(console.error);
}