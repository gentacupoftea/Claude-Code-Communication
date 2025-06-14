"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const rule_engine_1 = require("./core/rule-engine");
const fs_1 = require("fs");
const path_1 = require("path");
const app = (0, express_1.default)();
app.use(express_1.default.json());
// ルールエンジンのインスタンス
const ruleEngine = new rule_engine_1.YAMLRuleEngine();
// 初期化
async function initialize() {
    try {
        // サンプルルールをロード
        const rulesPath = (0, path_1.join)(__dirname, '../examples/sample-rules.yaml');
        const yamlContent = (0, fs_1.readFileSync)(rulesPath, 'utf-8');
        await ruleEngine.loadRulesFromYAML(yamlContent);
        console.log('YAMLルールエンジンが初期化されました');
        // イベントリスナー設定
        ruleEngine.on('rulesLoaded', (ruleSet) => {
            console.log(`${ruleSet.rules.length}個のルールがロードされました`);
        });
        ruleEngine.on('ruleUpdated', ({ ruleId, updates }) => {
            console.log(`ルール ${ruleId} が更新されました:`, updates);
        });
        ruleEngine.on('evaluationComplete', ({ results, totalTime }) => {
            console.log(`評価完了: ${results.length}ルール, ${totalTime}ms`);
        });
        ruleEngine.on('anomalyDetected', (anomaly) => {
            console.warn('異常検出:', anomaly);
        });
        // 定期的な最適化
        setInterval(async () => {
            await ruleEngine.optimizeRules();
        }, 60000); // 1分ごと
    }
    catch (error) {
        console.error('初期化エラー:', error);
        process.exit(1);
    }
}
// API エンドポイント
// ルール評価
app.post('/evaluate', async (req, res) => {
    try {
        const context = req.body;
        const results = await ruleEngine.evaluate(context);
        res.json({
            success: true,
            results,
            metrics: ruleEngine.getMetrics()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// ルール更新
app.put('/rules/:ruleId', async (req, res) => {
    try {
        const { ruleId } = req.params;
        const updates = req.body;
        await ruleEngine.updateRule(ruleId, updates);
        res.json({
            success: true,
            message: `ルール ${ruleId} が更新されました`
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// YAMLルールのリロード
app.post('/reload', async (req, res) => {
    try {
        const { yamlContent } = req.body;
        await ruleEngine.loadRulesFromYAML(yamlContent);
        res.json({
            success: true,
            message: 'ルールがリロードされました'
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// メトリクス取得（Prometheus形式）
app.get('/metrics', (req, res) => {
    res.set('Content-Type', 'text/plain');
    res.send(ruleEngine.getMetrics());
});
// Grafanaダッシュボードデータ
app.get('/grafana-data', (req, res) => {
    const metrics = ruleEngine.getMetrics();
    if (metrics.getGrafanaData) {
        res.json(metrics.getGrafanaData());
    }
    else {
        res.status(404).json({ error: 'Grafana data not available' });
    }
});
// ヘルスチェック
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        metrics: {
            totalEvaluations: ruleEngine.getMetrics().totalEvaluations,
            averageProcessingTime: ruleEngine.getMetrics().averageProcessingTime
        }
    });
});
// サーバー起動
const PORT = process.env.PORT || 3456;
initialize().then(() => {
    app.listen(PORT, () => {
        console.log(`YAMLルールエンジンが起動しました: http://localhost:${PORT}`);
        console.log(`メトリクス: http://localhost:${PORT}/metrics`);
        console.log(`Grafanaデータ: http://localhost:${PORT}/grafana-data`);
    });
});
// グレースフルシャットダウン
process.on('SIGTERM', () => {
    console.log('シャットダウンを開始します...');
    process.exit(0);
});
