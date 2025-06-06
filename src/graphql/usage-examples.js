/**
 * GraphQL最適化クライアントの使用例
 * 
 * このファイルでは、OptimizedShopifyGraphQLClientの
 * 実践的な使用例を示します。
 */

import { OptimizedShopifyGraphQLClient, Queries  } from './optimized-client';
import { gql  } from '@apollo/client';

/**
 * 基本的な使用例
 */
async function basicUsageExample() {
  // クライアントの初期化
  const client = new OptimizedShopifyGraphQLClient({
    shopDomain: 'your-shop.myshopify.com',
    accessToken: 'your-access-token',
    
    // カスタム設定
    batchInterval: 20, // バッチ間隔を20msに
    cacheTTL: 600, // キャッシュを10分に延長
    maxRequestsPerSecond: 4 // レート制限を調整（Shopify Plusの場合）
  });
  
  try {
    // 単一クエリの実行
    const productsResult = await client.query(
      Queries.GET_PRODUCTS,
      { first: 10 }
    );
    
    console.log('Products:', productsResult.data.products.edges);
    
    // カスタムクエリの実行
    const customQuery = gql`
      query GetShopInfo {
        shop {
          name
          email
          currencyCode
          primaryDomain {
            url
            sslEnabled
          }
        }
      }
    `;
    
    const shopResult = await client.query(customQuery);
    console.log('Shop Info:', shopResult.data.shop);
    
  } finally {
    // リソースのクリーンアップ
    await client.close();
  }
}

/**
 * バッチクエリの使用例
 */
async function batchQueryExample() {
  const client = new OptimizedShopifyGraphQLClient();
  
  try {
    // 複数のクエリをバッチで実行
    const batchResults = await client.batchQuery([
      {
        name: 'products',
        query: Queries.GET_PRODUCTS,
        variables: { first: 5 }
      },
      {
        name: 'orders',
        query: Queries.GET_ORDERS,
        variables: { first: 10, query: 'created_at:>2024-01-01' }
      },
      {
        name: 'customerCount',
        query: gql`
          query GetCustomerCount {
            customers {
              totalCount
            }
          }
        `
      }
    ]);
    
    // 結果の処理
    for (const [name, result] of batchResults) {
      if (result.success) {
        console.log(`${name} succeeded:`, result.result.data);
      } else {
        console.error(`${name} failed:`, result.error);
      }
    }
    
  } finally {
    await client.close();
  }
}

/**
 * ページネーションの実装例
 */
async function paginationExample() {
  const client = new OptimizedShopifyGraphQLClient();
  
  try {
    let hasNextPage = true;
    let cursor = null;
    const allProducts = [];
    
    // すべての商品を取得（ページネーション対応）
    while (hasNextPage) {
      const result = await client.query(
        Queries.GET_PRODUCTS,
        { 
          first: 50,
          after: cursor 
        }
      );
      
      const products = result.data.products;
      allProducts.push(...products.edges);
      
      hasNextPage = products.pageInfo.hasNextPage;
      cursor = products.pageInfo.endCursor;
      
      console.log(`Fetched ${products.edges.length} products, total: ${allProducts.length}`);
      
      // レート制限を考慮した待機
      if (hasNextPage) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`Total products fetched: ${allProducts.length}`);
    
  } finally {
    await client.close();
  }
}

/**
 * キャッシング戦略の例
 */
async function cachingStrategyExample() {
  const client = new OptimizedShopifyGraphQLClient();
  
  try {
    // キャッシュを利用したクエリ
    console.time('First query (cache miss)');
    const _firstResult = await client.query( // eslint-disable-line no-unused-vars
      Queries.GET_PRODUCTS,
      { first: 10 }
    );
    console.timeEnd('First query (cache miss)');
    
    // 同じクエリを再実行（キャッシュヒット）
    console.time('Second query (cache hit)');
    const _secondResult = await client.query( // eslint-disable-line no-unused-vars
      Queries.GET_PRODUCTS,
      { first: 10 }
    );
    console.timeEnd('Second query (cache hit)');
    
    // キャッシュをスキップしてクエリ
    console.time('Third query (skip cache)');
    const _thirdResult = await client.query( // eslint-disable-line no-unused-vars
      Queries.GET_PRODUCTS,
      { first: 10 },
      { fetchPolicy: 'network-only', context: { skipCache: true } }
    );
    console.timeEnd('Third query (skip cache)');
    
    // 特定のキャッシュをクリア
    await client.clearCache('GetProducts:*');
    
    // パフォーマンス統計の取得
    const stats = await client.getPerformanceStats();
    console.log('Performance Stats:', stats);
    
  } finally {
    await client.close();
  }
}

/**
 * エラーハンドリングの例
 */
async function errorHandlingExample() {
  const client = new OptimizedShopifyGraphQLClient({
    maxRetries: 5,
    retryDelay: 2000
  });
  
  try {
    // 無効なクエリの実行
    const invalidQuery = gql`
      query InvalidQuery {
        nonExistentField {
          id
        }
      }
    `;
    
    try {
      await client.query(invalidQuery);
    } catch (error) {
      console.error('GraphQL Error:', error.message);
      
      if (error.graphQLErrors) {
        error.graphQLErrors.forEach(err => {
          console.error('- GraphQL Error Detail:', err.message);
        });
      }
      
      if (error.networkError) {
        console.error('- Network Error:', error.networkError.message);
      }
    }
    
    // レート制限のシミュレーション
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        client.query(Queries.GET_PRODUCTS, { first: 1 })
          .then(() => console.log(`Request ${i + 1} succeeded`))
          .catch(err => console.error(`Request ${i + 1} failed:`, err.message))
      );
    }
    
    await Promise.allSettled(promises);
    
  } finally {
    await client.close();
  }
}

/**
 * ミューテーションの例
 */
async function mutationExample() {
  const client = new OptimizedShopifyGraphQLClient();
  
  try {
    // 商品の更新ミューテーション
    const updateProductMutation = gql`
      mutation UpdateProduct($input: ProductInput!) {
        productUpdate(input: $input) {
          product {
            id
            title
            description
          }
          userErrors {
            field
            message
          }
        }
      }
    `;
    
    const result = await client.mutate(
      updateProductMutation,
      {
        input: {
          id: 'gid://shopify/Product/1234567890',
          title: 'Updated Product Title'
        }
      }
    );
    
    if (result.data.productUpdate.userErrors.length > 0) {
      console.error('User Errors:', result.data.productUpdate.userErrors);
    } else {
      console.log('Product Updated:', result.data.productUpdate.product);
    }
    
  } finally {
    await client.close();
  }
}

/**
 * 高度な使用例：分析データの収集
 */
async function analyticsExample() {
  const client = new OptimizedShopifyGraphQLClient();
  
  try {
    const analyticsQuery = gql`
      query GetAnalyticsData($startDate: DateTime!, $endDate: DateTime!) {
        orders(first: 100, query: $query) {
          edges {
            node {
              id
              createdAt
              totalPrice
              lineItems(first: 50) {
                edges {
                  node {
                    quantity
                    product {
                      id
                      productType
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;
    
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');
    
    const result = await client.query(
      analyticsQuery,
      {
        query: `created_at:>='${startDate.toISOString()}' AND created_at:<='${endDate.toISOString()}'`
      }
    );
    
    // 分析データの処理
    const orders = result.data.orders.edges.map(edge => edge.node);
    const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.totalPrice), 0);
    const productTypeSales = {};
    
    orders.forEach(order => {
      order.lineItems.edges.forEach(({ node: item }) => {
        const productType = item.product?.productType || 'Unknown';
        productTypeSales[productType] = (productTypeSales[productType] || 0) + item.quantity;
      });
    });
    
    console.log('Analytics Summary:');
    console.log(`- Total Revenue: $${totalRevenue.toFixed(2)}`);
    console.log(`- Total Orders: ${orders.length}`);
    console.log('- Sales by Product Type:', productTypeSales);
    
  } finally {
    await client.close();
  }
}

// エクスポート
module.exports = {
  basicUsageExample,
  batchQueryExample,
  paginationExample,
  cachingStrategyExample,
  errorHandlingExample,
  mutationExample,
  analyticsExample
};

// 直接実行時のデモ
if (require.main === module) {
  (async () => {
    console.log('=== GraphQL Client Usage Examples ===\n');
    
    try {
      console.log('1. Basic Usage Example');
      await basicUsageExample();
      
      console.log('\n2. Batch Query Example');
      await batchQueryExample();
      
      console.log('\n3. Caching Strategy Example');
      await cachingStrategyExample();
      
    } catch (error) {
      console.error('Example failed:', error);
    }
  })();
}