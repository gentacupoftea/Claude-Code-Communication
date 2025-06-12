/**
 * フォールバックシステムの使用例
 */

import { createFallbackSystem } from '../src/fallback-system';
import { logger } from '../src/utils/logger';

async function main() {
  // フォールバックシステムを作成
  const fallbackSystem = createFallbackSystem();

  // イベントリスナーの設定
  fallbackSystem.on('execution:start', ({ executionId, input }) => {
    logger.info(`Execution started: ${executionId}`, { input });
  });

  fallbackSystem.on('execution:complete', ({ executionId, result }) => {
    logger.info(`Execution completed: ${executionId}`, {
      stage: result.stage,
      duration: result.duration,
      success: result.success
    });
  });

  fallbackSystem.on('execution:failed', ({ executionId, result }) => {
    logger.error(`Execution failed: ${executionId}`, {
      error: result.error?.message,
      duration: result.duration
    });
  });

  // 使用例1: シンプルなAPIエンドポイントリクエスト
  console.log('\n=== Example 1: Simple API Request ===');
  const result1 = await fallbackSystem.execute('/users/123');
  console.log('Result:', JSON.stringify(result1, null, 2));

  // 使用例2: 構造化リクエスト
  console.log('\n=== Example 2: Structured Request ===');
  const result2 = await fallbackSystem.execute({
    endpoint: '/products',
    method: 'GET',
    params: {
      category: 'electronics',
      limit: 10
    }
  });
  console.log('Result:', JSON.stringify(result2, null, 2));

  // 使用例3: POSTリクエスト
  console.log('\n=== Example 3: POST Request ===');
  const result3 = await fallbackSystem.execute({
    endpoint: '/orders',
    method: 'POST',
    data: {
      items: [
        { productId: '123', quantity: 2 },
        { productId: '456', quantity: 1 }
      ],
      customerId: 'customer-001'
    }
  });
  console.log('Result:', JSON.stringify(result3, null, 2));

  // 使用例4: LLMプロンプト
  console.log('\n=== Example 4: LLM Prompt ===');
  const result4 = await fallbackSystem.execute({
    prompt: 'Generate a product description for a wireless bluetooth headphone with noise cancellation feature'
  });
  console.log('Result:', JSON.stringify(result4, null, 2));

  // ヘルスステータスの確認
  console.log('\n=== Health Status ===');
  const health = fallbackSystem.getHealthStatus();
  console.log('Health:', JSON.stringify(health, null, 2));

  // メトリクスの確認
  console.log('\n=== Metrics ===');
  const metrics = fallbackSystem.getMetrics();
  console.log('Metrics:', {
    totalRequests: metrics.totalRequests,
    successRate: ((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2) + '%',
    cacheHitRate: metrics.cacheHitRate.toFixed(2) + '%',
    averageLatency: metrics.averageLatency.toFixed(2) + 'ms'
  });

  // ステージごとのメトリクス
  console.log('\n=== Stage Metrics ===');
  for (const [stage, metric] of metrics.stageMetrics) {
    console.log(`${stage}:`, {
      invocations: metric.invocations,
      successRate: ((metric.successes / metric.invocations) * 100).toFixed(2) + '%',
      avgLatency: metric.averageLatency.toFixed(2) + 'ms',
      p95: metric.p95Latency.toFixed(2) + 'ms',
      p99: metric.p99Latency.toFixed(2) + 'ms'
    });
  }

  // エラーシミュレーション
  console.log('\n=== Error Simulation ===');
  
  // プライマリAPIを強制的に失敗させる
  process.env.PRIMARY_API_URL = 'http://invalid-url-that-will-fail';
  
  const errorResult = await fallbackSystem.execute('/test-error');
  console.log('Error simulation result:', {
    success: errorResult.success,
    stage: errorResult.stage,
    duration: errorResult.duration
  });

  // キャッシュのクリア
  console.log('\n=== Cache Clear ===');
  fallbackSystem.clearCache();
  console.log('Cache cleared');

  // サーキットブレーカーのリセット
  console.log('\n=== Circuit Breaker Reset ===');
  fallbackSystem.resetCircuitBreaker('primary-api');
  console.log('Circuit breaker reset for primary-api');

  // シャットダウン
  await fallbackSystem.shutdown();
  console.log('\n=== Shutdown Complete ===');
}

// エラーハンドリング
main().catch((error) => {
  logger.error('Example execution failed', error);
  process.exit(1);
});