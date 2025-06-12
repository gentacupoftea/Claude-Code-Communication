/**
 * 5段階フォールバックシステムのメインエントリーポイント
 */

export * from './interfaces/IFallbackService';
export * from './services/FallbackService';
export * from './services/CacheService';
export * from './utils/CircuitBreaker';
export * from './utils/MetricsCollector';
export * from './utils/logger';

// ステージのエクスポート
export * from './stages/PrimaryApiStage';
export * from './stages/SecondaryApiStage';
export * from './stages/LocalLLMStage';
export * from './stages/StaticDefaultStage';

// 設定のエクスポート
export * from './config/fallback.config';

import { FallbackService } from './services/FallbackService';
import { PrimaryApiStage } from './stages/PrimaryApiStage';
import { SecondaryApiStage } from './stages/SecondaryApiStage';
import { LocalLLMStage } from './stages/LocalLLMStage';
import { StaticDefaultStage } from './stages/StaticDefaultStage';
import { 
  createFallbackConfig, 
  apiConfigs, 
  llmConfig, 
  staticDefaultConfig 
} from './config/fallback.config';
import { logger } from './utils/logger';

/**
 * フォールバックシステムを作成するファクトリー関数
 */
export const createFallbackSystem = (): FallbackService => {
  const config = createFallbackConfig();

  // ステージを作成
  const stages = [
    new PrimaryApiStage(apiConfigs.primary),
    new SecondaryApiStage(apiConfigs.secondary),
    // Stage 3 (Cache) は FallbackService 内部で自動的に処理される
    new LocalLLMStage(llmConfig),
    new StaticDefaultStage(staticDefaultConfig)
  ];

  // ステージを設定に追加
  config.stages = stages;

  logger.info('Creating fallback system', {
    stages: stages.map(s => s.name),
    environment: process.env.NODE_ENV || 'development'
  });

  return new FallbackService(config);
};

/**
 * デフォルトエクスポート
 */
export default {
  createFallbackSystem,
  FallbackService,
  PrimaryApiStage,
  SecondaryApiStage,
  LocalLLMStage,
  StaticDefaultStage
};