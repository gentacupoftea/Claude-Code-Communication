import { MetricsCollector } from '../metrics/metrics-collector';
import { YAMLRuleEngine } from '../core/rule-engine';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface AnomalyDetectionMetrics {
  totalAnomalies: number;
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1Score: number;
  accuracy: number;
  detectionLatency: number[];
  anomalyTypes: Record<string, number>;
}

interface TestCase {
  context: Record<string, any>;
  expectedAnomaly: boolean;
  anomalyType?: 'performance' | 'accuracy' | 'pattern';
  description: string;
}

export class AnomalyDetectionAnalyzer {
  private engine: YAMLRuleEngine;
  private metricsCollector: MetricsCollector;
  private testCases: TestCase[] = [];
  private results: AnomalyDetectionMetrics = {
    totalAnomalies: 0,
    truePositives: 0,
    falsePositives: 0,
    trueNegatives: 0,
    falseNegatives: 0,
    precision: 0,
    recall: 0,
    f1Score: 0,
    accuracy: 0,
    detectionLatency: [],
    anomalyTypes: {}
  };

  constructor() {
    this.engine = new YAMLRuleEngine();
    this.metricsCollector = new MetricsCollector();
    this.generateTestCases();
  }

  // テストケースの生成
  private generateTestCases(): void {
    // 正常ケース
    for (let i = 0; i < 100; i++) {
      this.testCases.push({
        context: {
          request: { path: '/api/users', responseTime: 50 + Math.random() * 50 },
          metrics: { cpuUsage: 30 + Math.random() * 20 }
        },
        expectedAnomaly: false,
        description: `正常ケース ${i + 1}`
      });
    }

    // パフォーマンス異常ケース
    for (let i = 0; i < 30; i++) {
      this.testCases.push({
        context: {
          request: { path: '/api/heavy-operation', responseTime: 3000 + Math.random() * 2000 },
          metrics: { cpuUsage: 90 + Math.random() * 10 }
        },
        expectedAnomaly: true,
        anomalyType: 'performance',
        description: `パフォーマンス異常 ${i + 1}`
      });
    }

    // 精度異常ケース
    for (let i = 0; i < 20; i++) {
      this.testCases.push({
        context: {
          neuralScore: 0.1 + Math.random() * 0.2,
          matchRate: 0.1 + Math.random() * 0.1
        },
        expectedAnomaly: true,
        anomalyType: 'accuracy',
        description: `精度異常 ${i + 1}`
      });
    }

    // パターン異常ケース
    for (let i = 0; i < 20; i++) {
      this.testCases.push({
        context: {
          request: { 
            path: '/admin/delete-all',
            headers: { 'X-Forwarded-For': `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}` }
          },
          unusualPattern: true
        },
        expectedAnomaly: true,
        anomalyType: 'pattern',
        description: `パターン異常 ${i + 1}`
      });
    }

    // エッジケース
    this.testCases.push({
      context: {
        request: { responseTime: 999 }, // 閾値ギリギリ
        metrics: { cpuUsage: 79 }
      },
      expectedAnomaly: false,
      description: 'エッジケース - 閾値境界'
    });
  }

  async analyze(): Promise<void> {
    console.log('🔍 異常検知精度分析開始\n');

    // エンジン初期化
    await this.initializeEngine();

    // 各テストケースを実行
    for (const testCase of this.testCases) {
      await this.evaluateTestCase(testCase);
    }

    // メトリクス計算
    this.calculateMetrics();

    // レポート生成
    this.generateReport();
  }

  private async initializeEngine(): Promise<void> {
    const rulesPath = join(__dirname, '../../examples/sample-rules.yaml');
    const yamlContent = readFileSync(rulesPath, 'utf-8');
    await this.engine.loadRulesFromYAML(yamlContent);

    // メトリクスコレクターのイベントリスナー設定
    let anomalyDetected = false;
    this.metricsCollector.on('anomalyDetected', (anomaly) => {
      anomalyDetected = true;
      this.results.anomalyTypes[anomaly.type] = (this.results.anomalyTypes[anomaly.type] || 0) + 1;
    });
  }

  private async evaluateTestCase(testCase: TestCase): Promise<void> {
    const startTime = Date.now();
    
    // 異常検知をリセット
    let anomalyDetected = false;
    const anomalyListener = () => { anomalyDetected = true; };
    this.metricsCollector.once('anomalyDetected', anomalyListener);

    // 評価実行
    await this.engine.evaluate(testCase.context);

    // 検出時間を記録
    const detectionTime = Date.now() - startTime;
    this.results.detectionLatency.push(detectionTime);

    // 結果の分類
    if (testCase.expectedAnomaly && anomalyDetected) {
      this.results.truePositives++;
    } else if (!testCase.expectedAnomaly && !anomalyDetected) {
      this.results.trueNegatives++;
    } else if (!testCase.expectedAnomaly && anomalyDetected) {
      this.results.falsePositives++;
      console.log(`❌ 誤検知: ${testCase.description}`);
    } else if (testCase.expectedAnomaly && !anomalyDetected) {
      this.results.falseNegatives++;
      console.log(`❌ 見逃し: ${testCase.description}`);
    }

    if (anomalyDetected) {
      this.results.totalAnomalies++;
    }

    // リスナーを削除
    this.metricsCollector.removeListener('anomalyDetected', anomalyListener);
  }

  private calculateMetrics(): void {
    const { truePositives, falsePositives, trueNegatives, falseNegatives } = this.results;

    // 精度 (Precision) = TP / (TP + FP)
    this.results.precision = truePositives / (truePositives + falsePositives) || 0;

    // 再現率 (Recall) = TP / (TP + FN)
    this.results.recall = truePositives / (truePositives + falseNegatives) || 0;

    // F1スコア = 2 * (Precision * Recall) / (Precision + Recall)
    this.results.f1Score = 2 * (this.results.precision * this.results.recall) / 
                          (this.results.precision + this.results.recall) || 0;

    // 正解率 (Accuracy) = (TP + TN) / Total
    const total = truePositives + falsePositives + trueNegatives + falseNegatives;
    this.results.accuracy = (truePositives + trueNegatives) / total || 0;
  }

  private generateReport(): void {
    const report = `
# 異常検知システム精度レポート
生成日時: ${new Date().toISOString()}

## 📊 全体メトリクス

| メトリクス | 値 | 評価 |
|----------|-----|------|
| **精度 (Precision)** | ${(this.results.precision * 100).toFixed(2)}% | ${this.evaluateMetric(this.results.precision)} |
| **再現率 (Recall)** | ${(this.results.recall * 100).toFixed(2)}% | ${this.evaluateMetric(this.results.recall)} |
| **F1スコア** | ${(this.results.f1Score * 100).toFixed(2)}% | ${this.evaluateMetric(this.results.f1Score)} |
| **正解率 (Accuracy)** | ${(this.results.accuracy * 100).toFixed(2)}% | ${this.evaluateMetric(this.results.accuracy)} |

## 🎯 検出結果詳細

- **総テストケース数**: ${this.testCases.length}
- **検出された異常数**: ${this.results.totalAnomalies}
- **真陽性 (TP)**: ${this.results.truePositives}
- **偽陽性 (FP)**: ${this.results.falsePositives} (誤検知)
- **真陰性 (TN)**: ${this.results.trueNegatives}
- **偽陰性 (FN)**: ${this.results.falseNegatives} (見逃し)

## ⚡ パフォーマンス

- **平均検出遅延**: ${this.calculateAverage(this.results.detectionLatency).toFixed(2)}ms
- **最小検出遅延**: ${Math.min(...this.results.detectionLatency)}ms
- **最大検出遅延**: ${Math.max(...this.results.detectionLatency)}ms

## 📈 異常タイプ別分析

${this.generateAnomalyTypeAnalysis()}

## 💡 改善提案

${this.generateImprovementSuggestions()}

## 🎨 可視化用データ

\`\`\`json
${JSON.stringify({
  confusion_matrix: {
    true_positive: this.results.truePositives,
    false_positive: this.results.falsePositives,
    true_negative: this.results.trueNegatives,
    false_negative: this.results.falseNegatives
  },
  metrics: {
    precision: this.results.precision,
    recall: this.results.recall,
    f1_score: this.results.f1Score,
    accuracy: this.results.accuracy
  },
  latency_distribution: this.generateLatencyDistribution()
}, null, 2)}
\`\`\`
`;

    // レポートをファイルに保存
    const reportPath = join(__dirname, '../../reports/anomaly-detection-report.md');
    writeFileSync(reportPath, report);

    // コンソールにサマリーを表示
    console.log('\n📊 異常検知精度サマリー');
    console.log('━'.repeat(50));
    console.log(`精度 (Precision): ${(this.results.precision * 100).toFixed(2)}%`);
    console.log(`再現率 (Recall): ${(this.results.recall * 100).toFixed(2)}%`);
    console.log(`F1スコア: ${(this.results.f1Score * 100).toFixed(2)}%`);
    console.log(`正解率: ${(this.results.accuracy * 100).toFixed(2)}%`);
    console.log(`誤検知率: ${(this.results.falsePositives / this.testCases.length * 100).toFixed(2)}%`);
    console.log('━'.repeat(50));
    console.log(`\n✅ レポートが保存されました: ${reportPath}`);
  }

  private evaluateMetric(value: number): string {
    if (value >= 0.95) return '🟢 優秀';
    if (value >= 0.85) return '🟡 良好';
    if (value >= 0.75) return '🟠 改善余地あり';
    return '🔴 要改善';
  }

  private calculateAverage(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private generateAnomalyTypeAnalysis(): string {
    const types = Object.entries(this.results.anomalyTypes)
      .map(([type, count]) => `- **${type}**: ${count}件`)
      .join('\n');
    return types || '- 異常タイプ別データなし';
  }

  private generateImprovementSuggestions(): string {
    const suggestions: string[] = [];

    if (this.results.precision < 0.9) {
      suggestions.push('- 誤検知を減らすため、異常判定の閾値を調整することを推奨');
    }
    if (this.results.recall < 0.9) {
      suggestions.push('- 見逃しを減らすため、より多様な異常パターンの学習を推奨');
    }
    if (this.calculateAverage(this.results.detectionLatency) > 100) {
      suggestions.push('- 検出遅延を改善するため、並列処理の最適化を推奨');
    }
    if (this.results.falsePositives > 10) {
      suggestions.push('- 機械学習モデルの再トレーニングを検討');
    }

    return suggestions.length > 0 ? suggestions.join('\n') : '- 現在のパフォーマンスは良好です';
  }

  private generateLatencyDistribution(): Record<string, number> {
    const distribution: Record<string, number> = {
      '0-50ms': 0,
      '50-100ms': 0,
      '100-200ms': 0,
      '200ms+': 0
    };

    for (const latency of this.results.detectionLatency) {
      if (latency < 50) distribution['0-50ms']++;
      else if (latency < 100) distribution['50-100ms']++;
      else if (latency < 200) distribution['100-200ms']++;
      else distribution['200ms+']++;
    }

    return distribution;
  }
}

// スタンドアロン実行
if (require.main === module) {
  const analyzer = new AnomalyDetectionAnalyzer();
  analyzer.analyze().catch(console.error);
}