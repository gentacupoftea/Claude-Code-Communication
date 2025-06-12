import { YAMLRuleEngine } from '../src/core/rule-engine';
import { PrometheusIntegration } from '../src/integrations/prometheus-integration';
import { MetricsCollector } from '../src/metrics/metrics-collector';
import axios from 'axios';

export class IntegrationTestSuite {
  private engine: YAMLRuleEngine;
  private prometheus: PrometheusIntegration;
  private baseURL = 'http://localhost:3456';

  async runFullIntegrationTests(): Promise<void> {
    console.log('🚀 統合テストスイート開始\n');

    try {
      // 1. システム起動テスト
      await this.testSystemStartup();
      
      // 2. エンドツーエンド評価テスト
      await this.testEndToEndEvaluation();
      
      // 3. Prometheus統合テスト
      await this.testPrometheusIntegration();
      
      // 4. 他ワーカーとの連携テスト
      await this.testWorkerIntegration();
      
      // 5. 負荷テスト
      await this.testLoadHandling();
      
      // 6. 障害復旧テスト
      await this.testFailureRecovery();

      console.log('\n✅ すべての統合テストが成功しました！');
    } catch (error) {
      console.error('❌ 統合テストに失敗:', error);
      throw error;
    }
  }

  private async testSystemStartup(): Promise<void> {
    console.log('📋 テスト1: システム起動');
    
    // ヘルスチェック
    const health = await axios.get(`${this.baseURL}/health`);
    if (health.data.status !== 'healthy') {
      throw new Error('システムが正常に起動していません');
    }
    
    console.log('✅ システム起動: OK');
  }

  private async testEndToEndEvaluation(): Promise<void> {
    console.log('\n📋 テスト2: エンドツーエンド評価');
    
    const testCases = [
      {
        name: 'セキュリティ脅威検出',
        context: {
          request: { path: '/admin/delete-all', headers: { 'X-Attack': 'true' } }
        },
        expectedMatch: true
      },
      {
        name: 'パフォーマンス最適化',
        context: {
          metrics: { responseTime: 1500, endpoint: '/api/heavy' }
        },
        expectedMatch: true
      }
    ];

    for (const testCase of testCases) {
      const response = await axios.post(`${this.baseURL}/evaluate`, testCase.context);
      const matched = response.data.results.some((r: any) => r.matched);
      
      if (matched !== testCase.expectedMatch) {
        throw new Error(`${testCase.name}: 期待した結果と異なります`);
      }
    }
    
    console.log('✅ エンドツーエンド評価: OK');
  }

  private async testPrometheusIntegration(): Promise<void> {
    console.log('\n📋 テスト3: Prometheus統合');
    
    // メトリクス取得
    const metrics = await axios.get(`${this.baseURL}/metrics`);
    const requiredMetrics = [
      'yaml_rule_engine_evaluations_total',
      'yaml_rule_engine_neural_confidence'
    ];

    for (const metric of requiredMetrics) {
      if (!metrics.data.includes(metric)) {
        throw new Error(`必須メトリクス ${metric} が見つかりません`);
      }
    }
    
    console.log('✅ Prometheus統合: OK');
  }

  private async testWorkerIntegration(): Promise<void> {
    console.log('\n📋 テスト4: ワーカー連携');
    
    // ワーカー3のPrometheusとの連携をシミュレート
    const mockPrometheusData = {
      source: 'worker3',
      metrics: { cpu_usage: 45, memory_usage: 512 }
    };

    // 評価コンテキストに含める
    const response = await axios.post(`${this.baseURL}/evaluate`, {
      ...mockPrometheusData,
      integration_test: true
    });

    if (!response.data.success) {
      throw new Error('ワーカー連携テストに失敗');
    }
    
    console.log('✅ ワーカー連携: OK');
  }

  private async testLoadHandling(): Promise<void> {
    console.log('\n📋 テスト5: 負荷テスト');
    
    const concurrentRequests = 100;
    const promises = [];

    const startTime = Date.now();
    
    for (let i = 0; i < concurrentRequests; i++) {
      promises.push(
        axios.post(`${this.baseURL}/evaluate`, {
          test_id: i,
          load_test: true
        })
      );
    }

    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;
    const throughput = (concurrentRequests / duration) * 1000;

    console.log(`  - ${concurrentRequests}件の同時リクエスト処理`);
    console.log(`  - 処理時間: ${duration}ms`);
    console.log(`  - スループット: ${throughput.toFixed(1)} req/s`);

    if (throughput < 50) {
      throw new Error('スループットが期待値を下回っています');
    }
    
    console.log('✅ 負荷テスト: OK');
  }

  private async testFailureRecovery(): Promise<void> {
    console.log('\n📋 テスト6: 障害復旧');
    
    // 無効なルールで更新を試みる
    try {
      await axios.put(`${this.baseURL}/rules/invalid-rule`, {
        priority: -1 // 無効な値
      });
    } catch (error) {
      // エラーが期待される
    }

    // システムが正常に動作し続けることを確認
    const health = await axios.get(`${this.baseURL}/health`);
    if (health.data.status !== 'healthy') {
      throw new Error('障害後の復旧に失敗');
    }
    
    console.log('✅ 障害復旧: OK');
  }
}

// Docker Compose用の統合テスト設定
export const dockerComposeConfig = `
version: '3.8'

services:
  yaml-rule-engine:
    build: .
    ports:
      - "3456:3456"
    environment:
      - NODE_ENV=test
      - PROMETHEUS_ENABLED=true
    depends_on:
      - prometheus
      - grafana

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./config/prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - ./config/grafana-dashboard.json:/var/lib/grafana/dashboards/dashboard.json

  test-runner:
    build: .
    command: npm run test:integration
    depends_on:
      - yaml-rule-engine
      - prometheus
      - grafana
`;

// スタンドアロン実行
if (require.main === module) {
  const suite = new IntegrationTestSuite();
  suite.runFullIntegrationTests().catch(console.error);
}