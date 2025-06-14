"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.NeuralEvaluator = void 0;
const os = __importStar(require("os"));
class NeuralEvaluator {
    config = {
        parallelismLevel: os.cpus().length,
        layerDepth: 3,
        activationThreshold: 0.5,
        learningEnabled: true
    };
    neuralNetwork;
    workers = [];
    evaluationPatterns = new Map();
    constructor() {
        this.neuralNetwork = new NeuralNetwork(this.config.layerDepth);
        this.initializeWorkers();
    }
    configure(config) {
        this.config = { ...this.config, ...config };
        this.neuralNetwork.reconfigure(this.config.layerDepth);
        this.adjustWorkerPool();
    }
    // 並列ルール評価
    async evaluateParallel(rules, context) {
        const chunks = this.chunkRules(rules, this.config.parallelismLevel);
        const promises = [];
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const worker = this.workers[i % this.workers.length];
            promises.push(this.evaluateChunk(worker, chunk, context));
        }
        const results = await Promise.all(promises);
        return results.flat();
    }
    // ルールによる再学習
    async retrainWithRule(rule) {
        if (!this.config.learningEnabled) {
            return;
        }
        // ルールパターンの抽出
        const pattern = this.extractRulePattern(rule);
        // ニューラルネットワークの更新
        this.neuralNetwork.train([{
                input: pattern,
                output: [rule.priority / 100]
            }]);
        // パターンを記録
        this.evaluationPatterns.set(rule.id, pattern);
    }
    // 次のルール予測
    async predictNextRules(currentResults, context, usageStats) {
        // 現在の評価パターンを分析
        const currentPattern = this.extractContextPattern(context, currentResults);
        // 類似パターンを持つルールを検索
        const predictions = [];
        for (const [ruleId, pattern] of this.evaluationPatterns) {
            const similarity = this.calculatePatternSimilarity(currentPattern, pattern);
            const usage = usageStats.get(ruleId) || 0;
            // 使用頻度と類似度を組み合わせたスコア
            const score = similarity * 0.7 + (usage / Math.max(...usageStats.values())) * 0.3;
            if (score > this.config.activationThreshold) {
                predictions.push({ ruleId, score });
            }
        }
        // スコアの高い順にソート
        predictions.sort((a, b) => b.score - a.score);
        return predictions.slice(0, 5).map(p => p.ruleId);
    }
    // 評価履歴からの学習
    async learnFromHistory(history) {
        const optimizations = [];
        // ルールごとの成功率を計算
        const ruleStats = new Map();
        for (const result of history) {
            const stats = ruleStats.get(result.ruleId) || { matches: 0, total: 0, avgTime: 0 };
            stats.total++;
            if (result.matched) {
                stats.matches++;
            }
            stats.avgTime = (stats.avgTime * (stats.total - 1) + result.processingTime) / stats.total;
            ruleStats.set(result.ruleId, stats);
        }
        // 最適化提案を生成
        for (const [ruleId, stats] of ruleStats) {
            const successRate = stats.matches / stats.total;
            const efficiency = 1 / (stats.avgTime / 1000); // 秒単位の逆数
            // 新しい優先度を計算
            const newPriority = Math.round(successRate * 50 + efficiency * 50);
            // ニューラル重みを調整
            const neuralWeight = this.calculateOptimalNeuralWeight(successRate, efficiency);
            optimizations.push({
                ruleId,
                newPriority,
                neuralWeight
            });
        }
        return optimizations;
    }
    // Workerプールの初期化
    initializeWorkers() {
        for (let i = 0; i < this.config.parallelismLevel; i++) {
            // Worker実装は簡略化
            // 実際にはworker-threads.jsファイルを作成する必要あり
        }
    }
    // Workerプールの調整
    adjustWorkerPool() {
        const targetSize = this.config.parallelismLevel;
        const currentSize = this.workers.length;
        if (targetSize > currentSize) {
            // Worker追加
            for (let i = currentSize; i < targetSize; i++) {
                // Worker追加ロジック
            }
        }
        else if (targetSize < currentSize) {
            // Worker削減
            for (let i = targetSize; i < currentSize; i++) {
                // Worker終了ロジック
            }
        }
    }
    // ルールのチャンク分割
    chunkRules(rules, chunkSize) {
        const chunks = [];
        const rulesPerChunk = Math.ceil(rules.length / chunkSize);
        for (let i = 0; i < rules.length; i += rulesPerChunk) {
            chunks.push(rules.slice(i, i + rulesPerChunk));
        }
        return chunks;
    }
    // チャンク評価（実際にはWorkerで実行）
    async evaluateChunk(worker, chunk, context) {
        // 簡略化された実装
        return chunk.map(rule => ({
            confidence: Math.random(), // 実際には神経網で計算
            activation: Array(this.config.layerDepth).fill(0).map(() => Math.random())
        }));
    }
    // ルールパターンの抽出
    extractRulePattern(rule) {
        const pattern = [];
        // 優先度
        pattern.push(rule.priority / 100);
        // 条件数
        pattern.push(rule.conditions.length / 10);
        // アクション数
        pattern.push(rule.actions.length / 10);
        // 条件タイプの分布
        const conditionTypes = ['contains', 'equals', 'regex', 'custom', 'llm_evaluate'];
        for (const type of conditionTypes) {
            const count = rule.conditions.filter(c => c.type === type).length;
            pattern.push(count / rule.conditions.length);
        }
        return pattern;
    }
    // コンテキストパターンの抽出
    extractContextPattern(context, results) {
        const pattern = [];
        // コンテキストのキー数
        pattern.push(Object.keys(context).length / 100);
        // マッチしたルールの割合
        const matchRate = results.filter(r => r.matched).length / results.length;
        pattern.push(matchRate);
        // 平均処理時間
        const avgTime = results.reduce((sum, r) => sum + r.processingTime, 0) / results.length;
        pattern.push(avgTime / 1000);
        // 平均スコア
        const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
        pattern.push(avgScore);
        return pattern;
    }
    // パターン類似度の計算
    calculatePatternSimilarity(pattern1, pattern2) {
        if (pattern1.length !== pattern2.length) {
            return 0;
        }
        // コサイン類似度
        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;
        for (let i = 0; i < pattern1.length; i++) {
            dotProduct += pattern1[i] * pattern2[i];
            norm1 += pattern1[i] * pattern1[i];
            norm2 += pattern2[i] * pattern2[i];
        }
        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }
    // 最適なニューラル重みの計算
    calculateOptimalNeuralWeight(successRate, efficiency) {
        // 成功率が高く、効率も良い場合は神経網への依存を減らす
        // 成功率が低い場合は神経網により依存
        const baseWeight = 1 - successRate;
        const efficiencyFactor = Math.min(efficiency / 10, 1);
        return baseWeight * (1 - efficiencyFactor * 0.3);
    }
}
exports.NeuralEvaluator = NeuralEvaluator;
// 簡略化されたニューラルネットワーク実装
class NeuralNetwork {
    layers;
    weights = [];
    constructor(layers) {
        this.layers = layers;
        this.initializeWeights();
    }
    reconfigure(layers) {
        this.layers = layers;
        this.initializeWeights();
    }
    train(data) {
        // 簡略化された学習ロジック
        // 実際にはバックプロパゲーションなどを実装
    }
    initializeWeights() {
        // 重みの初期化
        this.weights = [];
        for (let i = 0; i < this.layers - 1; i++) {
            this.weights.push([]);
        }
    }
}
