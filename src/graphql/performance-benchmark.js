/**
 * GraphQLクライアントのパフォーマンスベンチマーク
 * 
 * 最適化されたクライアントのパフォーマンスを測定し、
 * ベストプラクティスを実証します。
 */

const { OptimizedShopifyGraphQLClient, Queries } = require('./optimized-client');
const { gql } = require('@apollo/client');
const Table = require('cli-table3');
const { performance } = require('perf_hooks');

/**
 * ベンチマーク結果を記録するクラス
 */
class BenchmarkRecorder {
  constructor() {
    this.results = [];
  }
  
  record(name, duration, metadata = {}) {
    this.results.push({
      name,
      duration,
      timestamp: new Date(),
      ...metadata
    });
  }
  
  getReport() {
    const table = new Table({
      head: ['Test Name', 'Duration (ms)', 'Requests', 'Avg per Request', 'Notes'],
      colWidths: [30, 15, 10, 20, 40]
    });
    
    this.results.forEach(result => {
      const avgPerRequest = result.requests 
        ? (result.duration / result.requests).toFixed(2) 
        : '-';
      
      table.push([
        result.name,
        result.duration.toFixed(2),
        result.requests || 1,
        avgPerRequest,
        result.notes || ''
      ]);
    });
    
    return table.toString();
  }
  
  getSummary() {
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    const totalRequests = this.results.reduce((sum, r) => sum + (r.requests || 1), 0);
    
    return {
      totalTests: this.results.length,
      totalDuration: totalDuration.toFixed(2),
      totalRequests,
      averageDuration: (totalDuration / this.results.length).toFixed(2),
      averagePerRequest: (totalDuration / totalRequests).toFixed(2)
    };
  }
}

/**
 * ベンチマークテストスイート
 */
class GraphQLBenchmark {
  constructor(client) {
    this.client = client;
    this.recorder = new BenchmarkRecorder();
  }
  
  /**
   * 単一クエリのパフォーマンステスト
   */
  async testSingleQuery() {
    const query = Queries.GET_PRODUCTS;
    const variables = { first: 50 };
    
    // キャッシュなし
    const start1 = performance.now();
    await this.client.query(query, variables, { 
      context: { skipCache: true },
      fetchPolicy: 'network-only'
    });
    const duration1 = performance.now() - start1;
    
    this.recorder.record('Single Query (No Cache)', duration1, {
      notes: 'Direct network request, no caching'
    });
    
    // キャッシュあり（最初のリクエスト）
    await this.client.clearCache();
    const start2 = performance.now();
    await this.client.query(query, variables);
    const duration2 = performance.now() - start2;
    
    this.recorder.record('Single Query (Cache Miss)', duration2, {
      notes: 'First request, populates cache'
    });
    
    // キャッシュあり（キャッシュヒット）
    const start3 = performance.now();
    await this.client.query(query, variables);
    const duration3 = performance.now() - start3;
    
    this.recorder.record('Single Query (Cache Hit)', duration3, {
      notes: 'Second request, served from cache'
    });
    
    console.log(`Cache speedup: ${(duration2 / duration3).toFixed(1)}x faster`);
  }
  
  /**
   * バッチクエリのパフォーマンステスト
   */
  async testBatchQueries() {
    const queries = [];
    for (let i = 0; i < 10; i++) {
      queries.push({
        name: `products_${i}`,
        query: Queries.GET_PRODUCTS,
        variables: { first: 10, after: `cursor_${i}` }
      });
    }
    
    // バッチなし（個別実行）
    await this.client.clearCache();
    const start1 = performance.now();
    for (const q of queries) {
      await this.client.query(q.query, q.variables, {
        context: { skipCache: true }
      });
    }
    const duration1 = performance.now() - start1;
    
    this.recorder.record('Sequential Queries', duration1, {
      requests: 10,
      notes: 'Individual requests executed sequentially'
    });
    
    // バッチあり
    await this.client.clearCache();
    const start2 = performance.now();
    await this.client.batchQuery(queries.map(q => ({
      ...q,
      options: { context: { skipCache: true } }
    })));
    const duration2 = performance.now() - start2;
    
    this.recorder.record('Batch Query', duration2, {
      requests: 10,
      notes: 'All requests batched together'
    });
    
    console.log(`Batch speedup: ${(duration1 / duration2).toFixed(1)}x faster`);
  }
  
  /**
   * レート制限のパフォーマンステスト
   */
  async testRateLimiting() {
    const queries = [];
    for (let i = 0; i < 20; i++) {
      queries.push(
        this.client.query(
          Queries.GET_PRODUCTS,
          { first: 1 },
          { context: { skipCache: true } }
        )
      );
    }
    
    const start = performance.now();
    await Promise.all(queries);
    const duration = performance.now() - start;
    
    this.recorder.record('Rate Limited Requests', duration, {
      requests: 20,
      notes: `${this.client.config.maxRequestsPerSecond} req/sec limit`
    });
    
    const expectedMinDuration = (20 / this.client.config.maxRequestsPerSecond) * 1000;
    console.log(`Rate limiting effective: ${duration >= expectedMinDuration}`);
  }
  
  /**
   * ページネーションのパフォーマンステスト
   */
  async testPagination() {
    let cursor = null;
    let pageCount = 0;
    const pageSize = 50;
    const maxPages = 5;
    
    const start = performance.now();
    
    while (pageCount < maxPages) {
      const result = await this.client.query(
        Queries.GET_PRODUCTS,
        { first: pageSize, after: cursor }
      );
      
      const products = result.data.products;
      cursor = products.pageInfo.endCursor;
      pageCount++;
      
      if (!products.pageInfo.hasNextPage) break;
    }
    
    const duration = performance.now() - start;
    
    this.recorder.record('Paginated Query', duration, {
      requests: pageCount,
      notes: `${pageCount} pages × ${pageSize} items`
    });
  }
  
  /**
   * キャッシュ戦略のパフォーマンステスト
   */
  async testCachingStrategies() {
    const queries = [
      { name: 'frequent', query: Queries.GET_PRODUCTS, variables: { first: 10 } },
      { name: 'moderate', query: Queries.GET_ORDERS, variables: { first: 10 } },
      { name: 'rare', query: gql`query { shop { name } }`, variables: {} }
    ];
    
    // 異なるキャッシュTTLでのテスト
    const ttlValues = [60, 300, 900]; // 1分、5分、15分
    
    for (const ttl of ttlValues) {
      // 一時的に異なるTTLのクライアントを作成
      const ttlClient = new OptimizedShopifyGraphQLClient({
        ...this.client.config,
        cacheTTL: ttl
      });
      
      const start = performance.now();
      
      // 各クエリを3回実行
      for (let i = 0; i < 3; i++) {
        for (const q of queries) {
          await ttlClient.query(q.query, q.variables);
        }
        // TTLの10%の時間待機
        await new Promise(resolve => setTimeout(resolve, ttl * 100));
      }
      
      const duration = performance.now() - start;
      
      this.recorder.record(`Cache TTL ${ttl}s`, duration, {
        requests: 9,
        notes: `3 queries × 3 iterations, TTL=${ttl}s`
      });
      
      await ttlClient.close();
    }
  }
  
  /**
   * エラー回復のパフォーマンステスト
   */
  async testErrorRecovery() {
    // 無効なクエリでエラーを発生させる
    const invalidQuery = gql`
      query InvalidQuery {
        invalidField {
          id
        }
      }
    `;
    
    const start = performance.now();
    let errorCount = 0;
    
    for (let i = 0; i < 5; i++) {
      try {
        await this.client.query(invalidQuery);
      } catch (error) {
        errorCount++;
      }
    }
    
    const duration = performance.now() - start;
    
    this.recorder.record('Error Recovery', duration, {
      requests: 5,
      notes: `${errorCount} errors handled`
    });
  }
  
  /**
   * 全ベンチマークの実行
   */
  async runAll() {
    console.log('🚀 Starting GraphQL Performance Benchmark\n');
    
    const tests = [
      { name: 'Single Query Performance', method: this.testSingleQuery },
      { name: 'Batch Query Performance', method: this.testBatchQueries },
      { name: 'Rate Limiting Performance', method: this.testRateLimiting },
      { name: 'Pagination Performance', method: this.testPagination },
      { name: 'Caching Strategies', method: this.testCachingStrategies },
      { name: 'Error Recovery', method: this.testErrorRecovery }
    ];
    
    for (const test of tests) {
      console.log(`\n📊 Testing: ${test.name}`);
      try {
        await test.method.call(this);
        console.log(`✅ ${test.name} completed`);
      } catch (error) {
        console.error(`❌ ${test.name} failed:`, error.message);
      }
    }
    
    console.log('\n📈 Benchmark Results:\n');
    console.log(this.recorder.getReport());
    
    const summary = this.recorder.getSummary();
    console.log('\n📊 Summary:');
    console.log(`- Total Tests: ${summary.totalTests}`);
    console.log(`- Total Duration: ${summary.totalDuration}ms`);
    console.log(`- Total Requests: ${summary.totalRequests}`);
    console.log(`- Average Duration per Test: ${summary.averageDuration}ms`);
    console.log(`- Average Duration per Request: ${summary.averagePerRequest}ms`);
    
    // パフォーマンス統計
    const stats = await this.client.getPerformanceStats();
    console.log('\n🔧 Client Statistics:');
    console.log(`- Cache Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%`);
    console.log(`- Cache Size: ${stats.cacheSize} entries`);
    console.log(`- Total Commands: ${stats.totalCommands}`);
  }
}

/**
 * ベストプラクティスのデモンストレーション
 */
async function demonstrateBestPractices() {
  console.log('\n🌟 GraphQL Best Practices Demonstration\n');
  
  const client = new OptimizedShopifyGraphQLClient({
    shopDomain: 'demo-shop.myshopify.com',
    accessToken: 'demo-token',
    
    // ベストプラクティス設定
    batchInterval: 20,      // バッチ間隔を調整
    batchMax: 10,          // 適切なバッチサイズ
    cacheTTL: 300,         // 5分のキャッシュ
    maxRequestsPerSecond: 4, // Shopify Plusのレート制限
    maxRetries: 3,         // 適切なリトライ回数
    retryDelay: 2000       // リトライ遅延
  });
  
  // 1. 効率的なクエリ設計
  console.log('1. Efficient Query Design');
  const efficientQuery = gql`
    query GetProductsEfficient($first: Int!, $after: String) {
      products(first: $first, after: $after) {
        edges {
          node {
            id
            title
            # 必要なフィールドのみを要求
            variants(first: 1) {
              edges {
                node {
                  price
                  inventoryQuantity
                }
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;
  
  // 2. スマートなキャッシング
  console.log('\n2. Smart Caching Strategy');
  
  // 頻繁に変更されないデータはキャッシュ
  const staticDataQuery = gql`
    query GetStaticData {
      shop {
        name
        currencyCode
        primaryDomain {
          url
        }
      }
    }
  `;
  
  // 動的データはキャッシュをスキップ
  const dynamicDataQuery = gql`
    query GetDynamicData {
      orders(first: 10, sortKey: CREATED_AT, reverse: true) {
        edges {
          node {
            id
            totalPrice
            createdAt
          }
        }
      }
    }
  `;
  
  await client.query(staticDataQuery); // キャッシュあり
  await client.query(dynamicDataQuery, {}, { 
    fetchPolicy: 'network-only',
    context: { skipCache: true }
  }); // キャッシュなし
  
  // 3. エラーハンドリング
  console.log('\n3. Robust Error Handling');
  
  async function safeQuery(query, variables = {}) {
    try {
      return await client.query(query, variables);
    } catch (error) {
      if (error.networkError?.statusCode === 429) {
        console.log('Rate limit hit, waiting before retry...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        return await client.query(query, variables);
      }
      
      console.error('Query failed:', error.message);
      throw error;
    }
  }
  
  // 4. バッチングの活用
  console.log('\n4. Effective Batching');
  
  const batchedQueries = [
    { name: 'shop', query: staticDataQuery },
    { name: 'products', query: efficientQuery, variables: { first: 10 } },
    { name: 'orders', query: dynamicDataQuery }
  ];
  
  const results = await client.batchQuery(batchedQueries);
  console.log(`Batched ${results.size} queries efficiently`);
  
  // 5. ページネーションの最適化
  console.log('\n5. Optimized Pagination');
  
  async function* paginateProducts(pageSize = 50) {
    let cursor = null;
    let hasNextPage = true;
    
    while (hasNextPage) {
      const result = await client.query(
        efficientQuery,
        { first: pageSize, after: cursor }
      );
      
      const products = result.data.products;
      yield products.edges;
      
      hasNextPage = products.pageInfo.hasNextPage;
      cursor = products.pageInfo.endCursor;
    }
  }
  
  // ページネーションの使用例
  let totalProducts = 0;
  for await (const products of paginateProducts()) {
    totalProducts += products.length;
    console.log(`Fetched ${products.length} products, total: ${totalProducts}`);
    
    // レート制限を考慮
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  
  await client.close();
}

// メイン実行関数
async function main() {
  // ベンチマーククライアントの作成
  const client = new OptimizedShopifyGraphQLClient({
    shopDomain: process.env.SHOPIFY_SHOP_DOMAIN || 'test-shop.myshopify.com',
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN || 'test-token',
    apiVersion: '2024-01',
    
    // ベンチマーク用の設定
    batchInterval: 10,
    batchMax: 10,
    cacheTTL: 300,
    maxRequestsPerSecond: 2,
    cacheEnabled: true
  });
  
  try {
    // ベンチマークの実行
    const benchmark = new GraphQLBenchmark(client);
    await benchmark.runAll();
    
    // ベストプラクティスのデモ
    await demonstrateBestPractices();
    
  } catch (error) {
    console.error('Benchmark failed:', error);
  } finally {
    await client.close();
  }
}

// 直接実行時
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  GraphQLBenchmark,
  BenchmarkRecorder,
  demonstrateBestPractices
};