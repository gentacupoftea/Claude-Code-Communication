/**
 * 5段階フォールバックシステムのメインエントリーポイント
 */
export * from './interfaces/IFallbackService';
export * from './services/FallbackService';
export * from './services/CacheService';
export * from './utils/CircuitBreaker';
export * from './utils/MetricsCollector';
export * from './utils/logger';
export * from './stages/PrimaryApiStage';
export * from './stages/SecondaryApiStage';
export * from './stages/LocalLLMStage';
export * from './stages/StaticDefaultStage';
export * from './config/fallback.config';
import { FallbackService } from './services/FallbackService';
import { PrimaryApiStage } from './stages/PrimaryApiStage';
import { SecondaryApiStage } from './stages/SecondaryApiStage';
import { LocalLLMStage } from './stages/LocalLLMStage';
import { StaticDefaultStage } from './stages/StaticDefaultStage';
/**
 * フォールバックシステムを作成するファクトリー関数
 */
export declare const createFallbackSystem: () => FallbackService;
/**
 * デフォルトエクスポート
 */
declare const _default: {
    createFallbackSystem: () => FallbackService;
    FallbackService: typeof FallbackService;
    PrimaryApiStage: typeof PrimaryApiStage;
    SecondaryApiStage: typeof SecondaryApiStage;
    LocalLLMStage: typeof LocalLLMStage;
    StaticDefaultStage: typeof StaticDefaultStage;
};
export default _default;
//# sourceMappingURL=fallback-system.d.ts.map