# Optimized GraphQL Client for Shopify MCP Server

高性能なShopify GraphQLクライアントの実装。バッチクエリ、高度なキャッシング、レート制限対応を含む。

## 機能

- 🚀 **バッチクエリ**: 複数のクエリを効率的に実行
- 💾 **Redisキャッシング**: 頻繁にアクセスされるデータの高速化
- 🔒 **レート制限対応**: Shopify APIレート制限の自動処理
- 🔄 **自動リトライ**: エラー時の指数バックオフ
- 📊 **パフォーマンス監視**: 詳細な統計情報の提供
- 🌐 **エラーハンドリング**: 包括的なエラー処理

## インストール

```bash
npm install @apollo/client ioredis winston limiter
```

## 使用方法

### 基本的な使用

```javascript
const { OptimizedShopifyGraphQLClient, Queries } = require('./optimized-client');

const client = new OptimizedShopifyGraphQLClient({
  shopDomain: 'your-shop.myshopify.com',
  accessToken: 'your-access-token'
});

// 商品を取得
const result = await client.query(Queries.GET_PRODUCTS, { first: 10 });
console.log(result.data.products);
```

### バッチクエリ

```javascript
const results = await client.batchQuery([
  {
    name: 'products',
    query: Queries.GET_PRODUCTS,
    variables: { first: 10 }
  },
  {
    name: 'orders',
    query: Queries.GET_ORDERS,
    variables: { first: 5 }
  }
]);

// 結果の取得
const products = results.get('products').result;
const orders = results.get('orders').result;
```

### カスタム設定

```javascript
const client = new OptimizedShopifyGraphQLClient({
  shopDomain: 'your-shop.myshopify.com',
  accessToken: 'your-access-token',
  
  // バッチ設定
  batchInterval: 20, // ms
  batchMax: 10,
  
  // キャッシュ設定
  cacheEnabled: true,
  cacheTTL: 600, // 10分
  
  // レート制限
  maxRequestsPerSecond: 4, // Shopify Plus
  
  // Redis設定
  redisConfig: {
    host: 'localhost',
    port: 6379
  }
});
```

## パフォーマンス最適化

### 1. 効率的なクエリ設計

```javascript
// 良い例: 必要なフィールドのみを取得
const efficientQuery = gql`
  query GetProducts($first: Int!) {
    products(first: $first) {
      edges {
        node {
          id
          title
          variants(first: 1) {
            edges {
              node {
                price
              }
            }
          }
        }
      }
    }
  }
`;

// 悪い例: 不要なフィールドを含む
const inefficientQuery = gql`
  query GetProducts($first: Int!) {
    products(first: $first) {
      edges {
        node {
          id
          title
          description
          handle
          productType
          vendor
          tags
          # ... 他の多くのフィールド
        }
      }
    }
  }
`;
```

### 2. キャッシング戦略

```javascript
// 静的データはキャッシュ
const shopInfo = await client.query(SHOP_QUERY);

// 動的データはキャッシュをスキップ
const recentOrders = await client.query(
  ORDERS_QUERY,
  { first: 10 },
  { 
    fetchPolicy: 'network-only',
    context: { skipCache: true }
  }
);
```

### 3. ページネーション

```javascript
async function* paginateProducts(client, pageSize = 50) {
  let cursor = null;
  let hasNextPage = true;
  
  while (hasNextPage) {
    const result = await client.query(
      Queries.GET_PRODUCTS,
      { first: pageSize, after: cursor }
    );
    
    const products = result.data.products;
    yield products.edges;
    
    hasNextPage = products.pageInfo.hasNextPage;
    cursor = products.pageInfo.endCursor;
  }
}

// 使用例
for await (const products of paginateProducts(client)) {
  console.log(`Processing ${products.length} products`);
}
```

## テスト

```bash
# ユニットテストの実行
npm test

# パフォーマンスベンチマーク
node performance-benchmark.js
```

## ベストプラクティス

1. **適切なバッチサイズ**: 10-20クエリが最適
2. **キャッシュTTL**: データの更新頻度に基づいて設定
3. **レート制限**: Shopify標準は2 req/s、Plusは4 req/s
4. **エラーハンドリング**: 429エラーには自動リトライ
5. **メモリ管理**: 大量データの場合はストリーミング処理

## トラブルシューティング

### Redis接続エラー

```javascript
// Redisが利用できない場合のフォールバック
const client = new OptimizedShopifyGraphQLClient({
  cacheEnabled: false // キャッシュを無効化
});
```

### レート制限エラー

```javascript
// レート制限の調整
const client = new OptimizedShopifyGraphQLClient({
  maxRequestsPerSecond: 1, // より保守的な設定
  retryDelay: 5000 // リトライ遅延を増加
});
```

### GraphQLエラー

```javascript
try {
  const result = await client.query(query);
} catch (error) {
  if (error.graphQLErrors) {
    error.graphQLErrors.forEach(err => {
      console.error('GraphQL error:', err.message);
    });
  }
  
  if (error.networkError) {
    console.error('Network error:', error.networkError);
  }
}
```

## 貢献

プルリクエストを歓迎します。大きな変更の場合は、まずissueを作成して変更内容を議論してください。

## ライセンス

MIT