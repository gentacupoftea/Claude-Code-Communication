# APIアダプターパターン実装（キャッシュ機能付き）

## 概要

このプロジェクトは、Shopify、POS、分析、天気の各APIに対して統一されたインターフェースを提供するアダプターパターンの実装です。Redis/メモリキャッシュ層を含み、既存コードへの影響を最小化しながら、型安全性とエラーハンドリングを確保します。

## 特徴

- **統一インターフェース**: すべてのAPIが同じインターフェース（IApiAdapter）を実装
- **型安全性**: TypeScriptによる完全な型定義
- **エラーハンドリング**: 統一されたエラー形式とリトライ可能性の判定
- **非同期対応**: すべての操作がPromiseベース
- **タイムアウト制御**: 各APIごとに設定可能
- **ヘルスチェック**: APIの接続状態を確認
- **キャッシュ機能**: Redis/メモリによる高速化とAPI呼び出し削減
- **TTL管理**: API種別に応じた適切なキャッシュ期間
- **キャッシュ無効化**: 更新操作時の自動キャッシュクリア

## プロジェクト構造

```
src/
├── interfaces/
│   ├── IApiAdapter.ts         # 統一インターフェース定義
│   └── ICache.ts              # キャッシュインターフェース
├── adapters/
│   ├── BaseApiAdapter.ts      # 基底クラス（共通機能）
│   ├── CachedApiAdapter.ts    # キャッシュ対応基底クラス
│   ├── ShopifyAdapter.ts      # Shopify API実装
│   ├── PosAdapter.ts          # POS API実装
│   ├── AnalyticsAdapter.ts    # 分析API実装
│   └── WeatherAdapter.ts      # 天気API実装
├── cache/
│   ├── RedisCache.ts          # Redisキャッシュ実装
│   ├── MemoryCache.ts         # メモリキャッシュ実装
│   ├── CacheManager.ts        # キャッシュマネージャー
│   └── strategies/
│       └── ApiCacheStrategies.ts  # API別キャッシュ戦略
├── types/
│   ├── api-configs.ts         # 各API設定の型定義
│   └── api-responses.ts       # レスポンスデータの型定義
├── services/
│   └── ApiManager.ts          # APIアダプター統合管理
└── index.ts                   # エクスポート定義
```

## 使用方法

### 1. 初期化

```typescript
import { apiManager } from './src';

await apiManager.initialize({
  // API設定
  shopify: {
    shopDomain: 'your-shop.myshopify.com',
    accessToken: 'your-access-token',
    apiVersion: '2023-10'
  },
  pos: {
    endpoint: 'https://pos-api.example.com',
    apiKey: 'your-api-key',
    secretKey: 'your-secret-key'
  },
  analytics: {
    endpoint: 'https://analytics-api.example.com',
    apiKey: 'your-api-key',
    projectId: 'your-project-id'
  },
  weather: {
    endpoint: 'https://api.openweathermap.org/data/2.5',
    apiKey: 'your-api-key'
  },
  
  // キャッシュ設定（オプション）
  cache: {
    cacheConfig: {
      defaultTTL: 600,        // デフォルト10分
      keyPrefix: 'api',       // キープレフィックス
      enableCompression: true // 圧縮有効
    },
    redis: {
      host: 'localhost',
      port: 6379
    },
    enableMemoryFallback: true
  }
});
```

### 2. データ取得

```typescript
// Shopify商品取得
const shopifyResponse = await apiManager.fetchShopifyData({
  resource: 'products',
  query: { limit: '10' }
});

// POS取引取得
const posResponse = await apiManager.fetchPosData({
  type: 'transactions',
  filters: { date_from: '2024-01-01' }
});

// 分析データ取得
const analyticsResponse = await apiManager.fetchAnalyticsData({
  reportType: 'standard',
  metrics: ['pageviews', 'users'],
  dateRange: {
    startDate: '2024-01-01',
    endDate: '2024-01-31'
  }
});

// 天気予報取得
const weatherResponse = await apiManager.fetchWeatherData({
  type: 'forecast',
  location: { city: 'Tokyo' }
});
```

### 3. エラーハンドリング

```typescript
const response = await apiManager.fetch('shopify', params);

if (response.success) {
  // 成功時の処理
  console.log('Data:', response.data);
} else {
  // エラー時の処理
  console.error('Error:', response.error.message);
  
  if (response.error.retryable) {
    // リトライ可能なエラー
    console.log('Retrying...');
  }
}
```

### 4. ヘルスチェック

```typescript
const healthStatus = await apiManager.healthCheckAll();
console.log('API Health:', healthStatus);
// 出力例: { shopify: true, pos: true, analytics: false, weather: true }
```

## 既存コードからの移行

### Before（既存コード）
```typescript
const shopifyApi = new ShopifyAPI(config);
const products = await shopifyApi.getProducts();
```

### After（アダプターパターン）
```typescript
await apiManager.initialize({ shopify: config });
const response = await apiManager.fetchShopifyData({
  resource: 'products'
});
const products = response.data;
```

## 統一レスポンス形式

すべてのAPIは以下の形式でレスポンスを返します：

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;                    // 成功時のデータ
  error?: {                    // エラー時の情報
    code: string;
    message: string;
    details?: any;
    retryable: boolean;
  };
  metadata?: {                 // メタデータ
    timestamp: Date;
    duration: number;          // レスポンス時間（ミリ秒）
    source: string;            // APIアダプター名
    cached?: boolean;          // キャッシュから取得したか
    cacheKey?: string;         // 使用されたキャッシュキー
  };
}
```

## キャッシュ機能

### キャッシュ戦略

各APIには最適化されたキャッシュ戦略が適用されます：

| API | TTL | キャッシュ条件 | 無効化タイミング |
|-----|-----|-------------|--------------|
| Shopify | 商品: 1時間<br>注文: 5分<br>在庫: 1分 | GETリクエストのみ | 更新操作時 |
| POS | 取引: 2分<br>商品: 5分<br>在庫: 30秒 | 集計データのみ | 新規取引時 |
| Analytics | 過去: 24時間<br>今日: 1時間<br>リアルタイム: 1分 | すべて | なし |
| Weather | 現在: 10分<br>予報: 1時間 | すべて | なし |

### キャッシュ統計

```typescript
const stats = await apiManager.getCacheStats();
console.log(`ヒット率: ${(stats.global.hitRate * 100).toFixed(2)}%`);
```

### キャッシュ管理

```typescript
// 特定APIのキャッシュをクリア
await apiManager.clearCache('shopify');

// すべてのキャッシュをクリア
await apiManager.clearCache();
```

## カスタムアダプターの追加

新しいAPIアダプターを追加する場合：

1. `CachedApiAdapter`を継承（キャッシュ対応）
2. 必要な抽象メソッドを実装
3. `ApiManager`に登録

```typescript
export class CustomAdapter extends CachedApiAdapter<CustomConfig, CustomResponse> {
  constructor() {
    super('Custom');
  }

  protected async doInitialize(config: CustomConfig): Promise<void> {
    // 初期化処理
  }

  protected async doFetch<T>(params: any): Promise<T> {
    // データ取得処理
  }

  // その他の必須メソッドを実装
}
```

## 統合テストの実行

### 全テストスイートの実行

```bash
# 統合テストスイート全体を実行
npm run test:integration

# または TypeScript で直接実行
npx ts-node tests/IntegrationTestSuite.ts
```

### 個別テストの実行

```bash
# APIアダプター統合テスト
npx ts-node tests/integration/ApiIntegrationTest.ts

# フォールバックシステムテスト
npx ts-node tests/integration/FallbackSystemTest.ts

# キャッシュ層テスト
npx ts-node tests/integration/CacheLayerTest.ts

# 負荷テスト
npx ts-node tests/load/LoadTest.ts

# エラー処理テスト
npx ts-node tests/integration/ErrorHandlingTest.ts
```

### テストレポート

統合テストを実行すると、詳細なレポートが生成されます：

- **テスト結果**: 各テストケースの成功/失敗
- **パフォーマンス指標**: スループット、レスポンス時間
- **キャッシュ効率**: ヒット率、無効化動作
- **エラー処理**: 各種エラーシナリオの対応
- **推奨事項**: システム改善のための提案

## 注意事項

- すべてのAPIアダプターは使用前に初期化が必要です
- タイムアウトはミリ秒単位で指定します
- 使用後は`disconnectAll()`でリソースを解放してください
- エラーハンドリングは各APIの特性に応じて実装されています
- キャッシュ使用時はメモリ使用量に注意してください
- Redisが利用できない場合は自動的にメモリキャッシュにフォールバックします
- メモリキャッシュはLRU方式で古いエントリから削除されます
- 統合テストはモックAPIを使用するため、実際のAPI接続は不要です