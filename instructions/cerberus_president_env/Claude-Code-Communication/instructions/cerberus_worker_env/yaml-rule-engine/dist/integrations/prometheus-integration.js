"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrometheusIntegration = void 0;
exports.setupPrometheusEndpoint = setupPrometheusEndpoint;
const prom_client_1 = require("prom-client");
class PrometheusIntegration {
    registry;
    metrics;
    constructor() {
        this.registry = new prom_client_1.Registry();
        // デフォルトメトリクスの収集
        (0, prom_client_1.collectDefaultMetrics)({ register: this.registry });
        // カスタムメトリクスの定義
        this.metrics = {
            // カウンター
            totalEvaluations: new prom_client_1.Counter({
                name: 'yaml_rule_engine_evaluations_total',
                help: 'Total number of rule evaluations',
                labelNames: ['status'],
                registers: [this.registry]
            }),
            totalMatches: new prom_client_1.Counter({
                name: 'yaml_rule_engine_matches_total',
                help: 'Total number of rule matches',
                labelNames: ['rule_id', 'rule_name'],
                registers: [this.registry]
            }),
            totalAnomalies: new prom_client_1.Counter({
                name: 'yaml_rule_engine_anomalies_total',
                help: 'Total number of detected anomalies',
                labelNames: ['type', 'severity'],
                registers: [this.registry]
            }),
            ruleExecutions: new prom_client_1.Counter({
                name: 'yaml_rule_engine_rule_executions_total',
                help: 'Total number of rule executions',
                labelNames: ['rule_id', 'action_type'],
                registers: [this.registry]
            }),
            // ゲージ
            activeRules: new prom_client_1.Gauge({
                name: 'yaml_rule_engine_active_rules',
                help: 'Number of active rules',
                registers: [this.registry]
            }),
            neuralConfidence: new prom_client_1.Gauge({
                name: 'yaml_rule_engine_neural_confidence',
                help: 'Current neural network confidence level',
                labelNames: ['model'],
                registers: [this.registry]
            }),
            systemLoad: new prom_client_1.Gauge({
                name: 'yaml_rule_engine_system_load',
                help: 'Current system load',
                labelNames: ['type'],
                registers: [this.registry]
            }),
            memoryUsage: new prom_client_1.Gauge({
                name: 'yaml_rule_engine_memory_usage_bytes',
                help: 'Memory usage in bytes',
                labelNames: ['type'],
                registers: [this.registry]
            }),
            // ヒストグラム
            evaluationDuration: new prom_client_1.Histogram({
                name: 'yaml_rule_engine_evaluation_duration_seconds',
                help: 'Duration of rule evaluations',
                labelNames: ['complexity'],
                buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
                registers: [this.registry]
            }),
            ruleProcessingTime: new prom_client_1.Histogram({
                name: 'yaml_rule_engine_rule_processing_seconds',
                help: 'Time taken to process individual rules',
                labelNames: ['rule_id'],
                buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1],
                registers: [this.registry]
            }),
            llmResponseTime: new prom_client_1.Histogram({
                name: 'yaml_rule_engine_llm_response_seconds',
                help: 'LLM API response time',
                labelNames: ['provider', 'operation'],
                buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
                registers: [this.registry]
            })
        };
    }
    // エンジンとの統合
    integrateWithEngine(engine) {
        // ルールロードイベント
        engine.on('rulesLoaded', (ruleSet) => {
            this.metrics.activeRules.set(ruleSet.rules.length);
            console.log(`📊 Prometheus: ${ruleSet.rules.length}個のアクティブルールを記録`);
        });
        // 評価完了イベント
        engine.on('evaluationComplete', ({ results, totalTime }) => {
            this.metrics.totalEvaluations.inc({ status: 'completed' });
            const complexity = results.length > 10 ? 'high' : results.length > 5 ? 'medium' : 'low';
            this.metrics.evaluationDuration.observe({ complexity }, totalTime / 1000);
            // マッチしたルールを記録
            results.forEach(result => {
                if (result.matched) {
                    this.metrics.totalMatches.inc({
                        rule_id: result.ruleId,
                        rule_name: result.ruleId // 実際にはルール名を取得
                    });
                }
                // ルール処理時間を記録
                this.metrics.ruleProcessingTime.observe({ rule_id: result.ruleId }, result.processingTime / 1000);
                // 神経網信頼度を更新
                if (result.score) {
                    this.metrics.neuralConfidence.set({ model: 'default' }, result.score);
                }
            });
        });
        // 異常検知イベント
        engine.on('anomalyDetected', (anomaly) => {
            this.metrics.totalAnomalies.inc({
                type: anomaly.type,
                severity: anomaly.severity
            });
        });
        // アクション実行イベント
        engine.on('actionTrigger', ({ functionName, context }) => {
            this.metrics.ruleExecutions.inc({
                rule_id: context.ruleId || 'unknown',
                action_type: functionName
            });
        });
        // 定期的なシステムメトリクス更新
        setInterval(() => {
            this.updateSystemMetrics();
        }, 5000);
    }
    // システムメトリクスの更新
    updateSystemMetrics() {
        const memUsage = process.memoryUsage();
        this.metrics.memoryUsage.set({ type: 'heap_used' }, memUsage.heapUsed);
        this.metrics.memoryUsage.set({ type: 'heap_total' }, memUsage.heapTotal);
        this.metrics.memoryUsage.set({ type: 'external' }, memUsage.external);
        this.metrics.memoryUsage.set({ type: 'rss' }, memUsage.rss);
        // CPU使用率（簡略化）
        const cpuUsage = process.cpuUsage();
        this.metrics.systemLoad.set({ type: 'cpu_user' }, cpuUsage.user / 1000000);
        this.metrics.systemLoad.set({ type: 'cpu_system' }, cpuUsage.system / 1000000);
    }
    // LLMレスポンス時間の記録
    recordLLMResponse(provider, operation, duration) {
        this.metrics.llmResponseTime.observe({ provider, operation }, duration / 1000);
    }
    // メトリクスのエクスポート
    async getMetrics() {
        return this.registry.metrics();
    }
    // メトリクスのJSON形式取得
    async getMetricsJSON() {
        return this.registry.getMetricsAsJSON();
    }
    // カスタムアラートルールの定義
    getAlertRules() {
        return `
groups:
  - name: yaml_rule_engine_alerts
    interval: 30s
    rules:
      # 高レイテンシアラート
      - alert: HighEvaluationLatency
        expr: histogram_quantile(0.95, rate(yaml_rule_engine_evaluation_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "高い評価レイテンシを検出"
          description: "95パーセンタイルの評価時間が1秒を超えています"

      # 低マッチ率アラート
      - alert: LowMatchRate
        expr: rate(yaml_rule_engine_matches_total[5m]) / rate(yaml_rule_engine_evaluations_total[5m]) < 0.1
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "ルールマッチ率が低下"
          description: "マッチ率が10%未満です"

      # 異常急増アラート
      - alert: AnomalySurge
        expr: rate(yaml_rule_engine_anomalies_total[1m]) > 10
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "異常検知の急増"
          description: "1分あたり10件以上の異常を検出"

      # メモリ使用量アラート
      - alert: HighMemoryUsage
        expr: yaml_rule_engine_memory_usage_bytes{type="heap_used"} > 1073741824
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "高メモリ使用量"
          description: "ヒープメモリ使用量が1GBを超えています"

      # 神経網信頼度低下アラート
      - alert: LowNeuralConfidence
        expr: yaml_rule_engine_neural_confidence < 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "神経網信頼度の低下"
          description: "神経網の信頼度が50%未満です"
    `;
    }
    // Grafanaダッシュボード用のクエリ
    getGrafanaQueries() {
        return {
            // 評価スループット
            evaluationThroughput: 'rate(yaml_rule_engine_evaluations_total[5m])',
            // マッチ率
            matchRate: 'rate(yaml_rule_engine_matches_total[5m]) / rate(yaml_rule_engine_evaluations_total[5m])',
            // レイテンシ分布
            latencyP50: 'histogram_quantile(0.5, rate(yaml_rule_engine_evaluation_duration_seconds_bucket[5m]))',
            latencyP95: 'histogram_quantile(0.95, rate(yaml_rule_engine_evaluation_duration_seconds_bucket[5m]))',
            latencyP99: 'histogram_quantile(0.99, rate(yaml_rule_engine_evaluation_duration_seconds_bucket[5m]))',
            // 異常検知率
            anomalyRate: 'rate(yaml_rule_engine_anomalies_total[5m])',
            // ルール別パフォーマンス
            rulePerformance: 'rate(yaml_rule_engine_rule_executions_total[5m]) by (rule_id)',
            // メモリ使用量
            memoryUsage: 'yaml_rule_engine_memory_usage_bytes',
            // 神経網信頼度の推移
            neuralConfidenceTrend: 'yaml_rule_engine_neural_confidence',
            // LLMレスポンス時間
            llmResponseP95: 'histogram_quantile(0.95, rate(yaml_rule_engine_llm_response_seconds_bucket[5m])) by (provider)'
        };
    }
    // 統合テスト
    async validateIntegration() {
        try {
            // メトリクスが正しく収集されているか確認
            const metrics = await this.getMetricsJSON();
            const requiredMetrics = [
                'yaml_rule_engine_evaluations_total',
                'yaml_rule_engine_matches_total',
                'yaml_rule_engine_evaluation_duration_seconds'
            ];
            for (const metricName of requiredMetrics) {
                const metric = metrics.find((m) => m.name === metricName);
                if (!metric) {
                    console.error(`❌ 必須メトリクス '${metricName}' が見つかりません`);
                    return false;
                }
            }
            console.log('✅ Prometheus統合が正常に動作しています');
            console.log(`📊 ${metrics.length}個のメトリクスが利用可能`);
            return true;
        }
        catch (error) {
            console.error('❌ Prometheus統合の検証に失敗:', error);
            return false;
        }
    }
}
exports.PrometheusIntegration = PrometheusIntegration;
// Express用のメトリクスエンドポイント
function setupPrometheusEndpoint(app, prometheus) {
    app.get('/metrics', async (req, res) => {
        res.set('Content-Type', 'text/plain');
        const metrics = await prometheus.getMetrics();
        res.send(metrics);
    });
    app.get('/metrics/json', async (req, res) => {
        const metrics = await prometheus.getMetricsJSON();
        res.json(metrics);
    });
    app.get('/alerts', (req, res) => {
        res.set('Content-Type', 'text/plain');
        res.send(prometheus.getAlertRules());
    });
    console.log('📊 Prometheusエンドポイントが設定されました:');
    console.log('   - /metrics (Prometheus形式)');
    console.log('   - /metrics/json (JSON形式)');
    console.log('   - /alerts (アラートルール)');
}
