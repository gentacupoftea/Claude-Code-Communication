"use strict";
/**
 * 5段階フォールバックシステムのメインエントリーポイント
 */
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFallbackSystem = void 0;
__exportStar(require("./interfaces/IFallbackService"), exports);
__exportStar(require("./services/FallbackService"), exports);
__exportStar(require("./services/CacheService"), exports);
__exportStar(require("./utils/CircuitBreaker"), exports);
__exportStar(require("./utils/MetricsCollector"), exports);
__exportStar(require("./utils/logger"), exports);
// ステージのエクスポート
__exportStar(require("./stages/PrimaryApiStage"), exports);
__exportStar(require("./stages/SecondaryApiStage"), exports);
__exportStar(require("./stages/LocalLLMStage"), exports);
__exportStar(require("./stages/StaticDefaultStage"), exports);
// 設定のエクスポート
__exportStar(require("./config/fallback.config"), exports);
const FallbackService_1 = require("./services/FallbackService");
const PrimaryApiStage_1 = require("./stages/PrimaryApiStage");
const SecondaryApiStage_1 = require("./stages/SecondaryApiStage");
const LocalLLMStage_1 = require("./stages/LocalLLMStage");
const StaticDefaultStage_1 = require("./stages/StaticDefaultStage");
const fallback_config_1 = require("./config/fallback.config");
const logger_1 = require("./utils/logger");
/**
 * フォールバックシステムを作成するファクトリー関数
 */
const createFallbackSystem = () => {
    const config = (0, fallback_config_1.createFallbackConfig)();
    // ステージを作成
    const stages = [
        new PrimaryApiStage_1.PrimaryApiStage(fallback_config_1.apiConfigs.primary),
        new SecondaryApiStage_1.SecondaryApiStage(fallback_config_1.apiConfigs.secondary),
        // Stage 3 (Cache) は FallbackService 内部で自動的に処理される
        new LocalLLMStage_1.LocalLLMStage(fallback_config_1.llmConfig),
        new StaticDefaultStage_1.StaticDefaultStage(fallback_config_1.staticDefaultConfig)
    ];
    // ステージを設定に追加
    config.stages = stages;
    logger_1.logger.info('Creating fallback system', {
        stages: stages.map(s => s.name),
        environment: process.env.NODE_ENV || 'development'
    });
    return new FallbackService_1.FallbackService(config);
};
exports.createFallbackSystem = createFallbackSystem;
/**
 * デフォルトエクスポート
 */
exports.default = {
    createFallbackSystem: exports.createFallbackSystem,
    FallbackService: FallbackService_1.FallbackService,
    PrimaryApiStage: PrimaryApiStage_1.PrimaryApiStage,
    SecondaryApiStage: SecondaryApiStage_1.SecondaryApiStage,
    LocalLLMStage: LocalLLMStage_1.LocalLLMStage,
    StaticDefaultStage: StaticDefaultStage_1.StaticDefaultStage
};
