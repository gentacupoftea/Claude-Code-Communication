# 5段階フォールバックシステム

高可用性を実現する5段階フォールバックシステムの実装です。

## 概要

このシステムは、API呼び出しやデータ取得において最大限の可用性を確保するために、5つの段階的なフォールバックメカニズムを提供します。

### 5つのフォールバック段階

1. **プライマリAPI** - 最速・最新のデータソース
2. **セカンダリAPI** - バックアップAPIサービス
3. **キャッシュ** - Redis/メモリキャッシュ
4. **ローカルLLM** - AI による代替データ生成
5. **静的デフォルト値** - 事前定義された安全なデフォルト値

## 主要機能

- **サーキットブレーカー**: 障害の自動検知と回復
- **インテリジェントキャッシング**: LRU/LFU/FIFO戦略
- **メトリクス収集**: パフォーマンスとエラー率の追跡
- **ヘルスチェック**: 各ステージの健全性監視
- **イベント駆動**: リアルタイムの状態通知

## インストール

```bash
npm install
```

## 基本的な使用方法

```typescript
import { createFallbackSystem } from './src/fallback-system';

// システムの作成
const fallbackSystem = createFallbackSystem();

// データの取得
const result = await fallbackSystem.execute({
  endpoint: '/api/users/123',
  method: 'GET'
});

if (result.success) {
  console.log('Data:', result.data);
  console.log('Source:', result.stage);
} else {
  console.error('All fallbacks failed:', result.error);
}
```

## 設定

### 環境変数

```bash
# API設定
PRIMARY_API_URL=https://api.primary.com
PRIMARY_API_KEY=your-primary-key
SECONDARY_API_URL=https://api.secondary.com
SECONDARY_API_KEY=your-secondary-key

# Redis設定
REDIS_URL=redis://localhost:6379

# LLM設定
LLM_PROVIDER=openai  # openai, anthropic, ollama
LLM_API_KEY=your-llm-key
LLM_MODEL=gpt-3.5-turbo
LLM_BASE_URL=http://localhost:11434/v1  # Ollama用

# その他
NODE_ENV=production
LOG_LEVEL=info
```

### カスタム設定

```typescript
import { FallbackService } from './src/services/FallbackService';
import { PrimaryApiStage } from './src/stages/PrimaryApiStage';

const customConfig = {
  stages: [
    new PrimaryApiStage({
      baseUrl: 'https://custom-api.com',
      timeout: 3000,
      apiKey: 'custom-key'
    })
  ],
  circuitBreakerThreshold: 5,
  cacheConfig: {
    ttl: 600,
    maxSize: 1000,
    strategy: 'LRU'
  }
};

const fallbackSystem = new FallbackService(customConfig);
```

## 詳細な使用例

### 1. 構造化リクエスト

```typescript
const result = await fallbackSystem.execute({
  endpoint: '/products',
  method: 'POST',
  data: {
    name: 'New Product',
    price: 100
  },
  params: {
    category: 'electronics'
  }
});
```

### 2. LLMプロンプト

```typescript
const result = await fallbackSystem.execute({
  prompt: 'Generate a product description for wireless headphones'
});
```

### 3. イベントリスナー

```typescript
fallbackSystem.on('execution:start', ({ executionId, input }) => {
  console.log(`Starting execution ${executionId}`);
});

fallbackSystem.on('execution:complete', ({ executionId, result }) => {
  console.log(`Completed ${executionId} using ${result.stage}`);
});
```

### 4. ヘルスチェック

```typescript
const health = fallbackSystem.getHealthStatus();
console.log('System health:', health.overall);
health.stages.forEach(stage => {
  console.log(`${stage.name}: ${stage.available ? '✓' : '✗'}`);
});
```

### 5. メトリクス

```typescript
const metrics = fallbackSystem.getMetrics();
console.log(`Success rate: ${(metrics.successfulRequests / metrics.totalRequests * 100).toFixed(2)}%`);
console.log(`Cache hit rate: ${metrics.cacheHitRate.toFixed(2)}%`);
console.log(`Average latency: ${metrics.averageLatency.toFixed(2)}ms`);
```

## アーキテクチャ

### コンポーネント構成

```
FallbackService (メインコントローラー)
├── Stage Manager (ステージ管理)
│   ├── PrimaryApiStage
│   ├── SecondaryApiStage
│   ├── LocalLLMStage
│   └── StaticDefaultStage
├── CacheService (キャッシング)
│   ├── Memory Cache
│   └── Redis Cache
├── CircuitBreaker (障害管理)
│   ├── State Manager
│   └── Recovery Timer
└── MetricsCollector (監視)
    ├── Request Metrics
    └── Stage Metrics
```

### 実行フロー

1. **リクエスト受信**: 入力データの検証とキャッシュキー生成
2. **キャッシュチェック**: 有効なキャッシュデータがあれば即座に返却
3. **ステージ実行**: 優先順位順に各ステージを試行
   - サーキットブレーカーの状態確認
   - タイムアウトとリトライの制御
   - 成功時はキャッシュに保存
4. **メトリクス記録**: パフォーマンスデータの収集
5. **結果返却**: 成功データまたはエラー情報

## パフォーマンス最適化

### キャッシュ戦略

- **LRU (Least Recently Used)**: 最近使用されていないアイテムを削除
- **LFU (Least Frequently Used)**: 使用頻度が低いアイテムを削除
- **FIFO (First In First Out)**: 古いアイテムから順に削除

### サーキットブレーカー設定

```typescript
{
  threshold: 5,        // 5回失敗でオープン
  timeout: 60000,      // 1分後に再試行
  halfOpenRetries: 3   // ハーフオープン時の最大試行回数
}
```

## トラブルシューティング

### よくある問題

1. **すべてのステージが失敗する**
   ```typescript
   // サーキットブレーカーをリセット
   fallbackSystem.resetCircuitBreaker('primary-api');
   
   // キャッシュをクリア
   fallbackSystem.clearCache();
   ```

2. **レスポンスが遅い**
   - タイムアウト設定を確認
   - メトリクスで各ステージのレイテンシーを確認

3. **キャッシュヒット率が低い**
   - TTL設定を延長
   - キャッシュサイズを増加

## ベストプラクティス

1. **適切なタイムアウト設定**
   - プライマリ: 3-5秒
   - セカンダリ: 5-8秒
   - LLM: 10-15秒

2. **キャッシュ戦略の選択**
   - 頻繁にアクセスされるデータ: LFU
   - 時系列データ: FIFO
   - 一般的な用途: LRU

3. **モニタリング**
   - メトリクスの定期的な確認
   - アラートの設定
   - ログの分析

## ライセンス

ISC