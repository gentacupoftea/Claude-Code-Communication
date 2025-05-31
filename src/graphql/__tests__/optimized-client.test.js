/**
 * OptimizedShopifyGraphQLClient のテストスイート
 * 
 * 単体テストと統合テストを含む包括的なテストケース
 */

const { OptimizedShopifyGraphQLClient, Queries } = require('../optimized-client');
const { gql } = require('@apollo/client');
const Redis = require('ioredis-mock');
const nock = require('nock');

// Redisモックを使用
jest.mock('ioredis', () => require('ioredis-mock'));

describe('OptimizedShopifyGraphQLClient', () => {
  let client;
  let mockShopDomain = 'test-shop.myshopify.com';
  let mockAccessToken = 'test-token';
  let mockApiVersion = '2024-01';
  
  beforeEach(() => {
    // テスト用のクライアントを作成
    client = new OptimizedShopifyGraphQLClient({
      shopDomain: mockShopDomain,
      accessToken: mockAccessToken,
      apiVersion: mockApiVersion,
      batchInterval: 0, // テストではバッチを無効化
      cacheTTL: 60
    });
    
    // nockでHTTPリクエストをモック
    nock(`https://${mockShopDomain}`)
      .persist()
      .post(`/admin/api/${mockApiVersion}/graphql.json`)
      .reply(200, (uri, requestBody) => {
        const { query } = requestBody;
        
        // クエリに基づいてモックレスポンスを返す
        if (query.includes('GetProducts')) {
          return {
            data: {
              products: {
                edges: [
                  {
                    cursor: 'cursor1',
                    node: {
                      id: 'gid://shopify/Product/1',
                      title: 'Test Product',
                      description: 'Test Description',
                      handle: 'test-product',
                      productType: 'Test Type',
                      vendor: 'Test Vendor',
                      tags: ['test', 'product'],
                      variants: { edges: [] },
                      images: { edges: [] }
                    }
                  }
                ],
                pageInfo: {
                  hasNextPage: false,
                  endCursor: 'cursor1'
                }
              }
            }
          };
        }
        
        if (query.includes('shop')) {
          return {
            data: {
              shop: {
                name: 'Test Shop',
                email: 'test@shop.com',
                currencyCode: 'USD',
                primaryDomain: {
                  url: 'https://test-shop.com',
                  sslEnabled: true
                }
              }
            }
          };
        }
        
        return { data: {} };
      });
  });
  
  afterEach(async () => {
    // クライアントをクリーンアップ
    if (client) {
      await client.close();
    }
    
    // nockをクリーンアップ
    nock.cleanAll();
  });
  
  describe('初期化', () => {
    test('正しい設定でクライアントが初期化される', () => {
      expect(client.config.shopDomain).toBe(mockShopDomain);
      expect(client.config.accessToken).toBe(mockAccessToken);
      expect(client.config.apiVersion).toBe(mockApiVersion);
    });
    
    test('デフォルト設定が適用される', () => {
      const defaultClient = new OptimizedShopifyGraphQLClient({
        shopDomain: mockShopDomain,
        accessToken: mockAccessToken
      });
      
      expect(defaultClient.config.batchInterval).toBe(10);
      expect(defaultClient.config.batchMax).toBe(10);
      expect(defaultClient.config.cacheTTL).toBe(300);
      expect(defaultClient.config.maxRetries).toBe(3);
    });
  });
  
  describe('クエリ実行', () => {
    test('シンプルなクエリが実行できる', async () => {
      const query = gql`
        query GetShop {
          shop {
            name
            email
          }
        }
      `;
      
      const result = await client.query(query);
      
      expect(result.data.shop).toBeDefined();
      expect(result.data.shop.name).toBe('Test Shop');
      expect(result.data.shop.email).toBe('test@shop.com');
    });
    
    test('変数付きクエリが実行できる', async () => {
      const result = await client.query(Queries.GET_PRODUCTS, { first: 10 });
      
      expect(result.data.products).toBeDefined();
      expect(result.data.products.edges).toHaveLength(1);
      expect(result.data.products.edges[0].node.title).toBe('Test Product');
    });
    
    test('エラーが適切に処理される', async () => {
      // エラーレスポンスをモック
      nock.cleanAll();
      nock(`https://${mockShopDomain}`)
        .post(`/admin/api/${mockApiVersion}/graphql.json`)
        .reply(400, {
          errors: [
            {
              message: 'Field "invalidField" doesn\'t exist on type "Shop"',
              extensions: { code: 'GRAPHQL_PARSE_FAILED' }
            }
          ]
        });
      
      const invalidQuery = gql`
        query InvalidQuery {
          shop {
            invalidField
          }
        }
      `;
      
      await expect(client.query(invalidQuery)).rejects.toThrow();
    });
  });
  
  describe('バッチクエリ', () => {
    test('複数のクエリがバッチで実行できる', async () => {
      const queries = [
        {
          name: 'shop',
          query: gql`
            query GetShop {
              shop {
                name
              }
            }
          `
        },
        {
          name: 'products',
          query: Queries.GET_PRODUCTS,
          variables: { first: 5 }
        }
      ];
      
      const results = await client.batchQuery(queries);
      
      expect(results.size).toBe(2);
      expect(results.get('shop').success).toBe(true);
      expect(results.get('products').success).toBe(true);
      expect(results.get('shop').result.data.shop.name).toBe('Test Shop');
      expect(results.get('products').result.data.products.edges).toHaveLength(1);
    });
    
    test('バッチクエリのエラーが個別に処理される', async () => {
      const queries = [
        {
          name: 'validQuery',
          query: gql`
            query GetShop {
              shop {
                name
              }
            }
          `
        },
        {
          name: 'invalidQuery',
          query: gql`
            query InvalidQuery {
              shop {
                invalidField
              }
            }
          `
        }
      ];
      
      // 無効なクエリに対してエラーレスポンスを設定
      nock.cleanAll();
      nock(`https://${mockShopDomain}`)
        .post(`/admin/api/${mockApiVersion}/graphql.json`)
        .reply(200, (uri, requestBody) => {
          const { query } = requestBody;
          
          if (query.includes('invalidField')) {
            return {
              errors: [
                {
                  message: 'Field "invalidField" doesn\'t exist',
                  extensions: { code: 'GRAPHQL_VALIDATION_FAILED' }
                }
              ]
            };
          }
          
          return {
            data: {
              shop: {
                name: 'Test Shop'
              }
            }
          };
        })
        .persist();
      
      const results = await client.batchQuery(queries);
      
      expect(results.get('validQuery').success).toBe(true);
      expect(results.get('invalidQuery').success).toBe(false);
      expect(results.get('invalidQuery').error).toBeDefined();
    });
  });
  
  describe('キャッシング', () => {
    test('同じクエリの結果がキャッシュされる', async () => {
      const query = gql`
        query GetShop {
          shop {
            name
          }
        }
      `;
      
      // 最初のクエリ（キャッシュミス）
      const start1 = Date.now();
      const result1 = await client.query(query);
      const duration1 = Date.now() - start1;
      
      // 2回目のクエリ（キャッシュヒット）
      const start2 = Date.now();
      const result2 = await client.query(query);
      const duration2 = Date.now() - start2;
      
      expect(result1.data).toEqual(result2.data);
      expect(duration2).toBeLessThan(duration1); // キャッシュヒットの方が高速
    });
    
    test('キャッシュをスキップできる', async () => {
      const query = gql`
        query GetShop {
          shop {
            name
          }
        }
      `;
      
      // 通常のクエリ（キャッシュに保存）
      await client.query(query);
      
      // キャッシュをスキップ
      const result = await client.query(query, {}, {
        fetchPolicy: 'network-only',
        context: { skipCache: true }
      });
      
      expect(result.data.shop.name).toBe('Test Shop');
    });
    
    test('キャッシュをクリアできる', async () => {
      const query = gql`
        query GetShop {
          shop {
            name
          }
        }
      `;
      
      // クエリを実行してキャッシュに保存
      await client.query(query);
      
      // キャッシュをクリア
      await client.clearCache();
      
      // Redis内のキーを確認（モック環境でのテスト）
      const keys = await client.redis.keys('graphql:*');
      expect(keys).toHaveLength(0);
    });
  });
  
  describe('レート制限', () => {
    test('レート制限が適用される', async () => {
      // レート制限を厳しく設定
      const rateLimitedClient = new OptimizedShopifyGraphQLClient({
        shopDomain: mockShopDomain,
        accessToken: mockAccessToken,
        maxRequestsPerSecond: 1
      });
      
      const query = gql`
        query GetShop {
          shop {
            name
          }
        }
      `;
      
      // 連続してクエリを実行
      const start = Date.now();
      await rateLimitedClient.query(query);
      await rateLimitedClient.query(query);
      const duration = Date.now() - start;
      
      // 2つのリクエストが1秒以上かかることを確認
      expect(duration).toBeGreaterThanOrEqual(1000);
      
      await rateLimitedClient.close();
    });
    
    test('429エラーでリトライが実行される', async () => {
      let requestCount = 0;
      
      // 最初のリクエストで429エラー、2回目で成功
      nock.cleanAll();
      nock(`https://${mockShopDomain}`)
        .post(`/admin/api/${mockApiVersion}/graphql.json`)
        .reply(() => {
          requestCount++;
          if (requestCount === 1) {
            return [429, {}, { 'Retry-After': '1' }];
          }
          return [200, { data: { shop: { name: 'Test Shop' } } }];
        })
        .persist();
      
      const query = gql`
        query GetShop {
          shop {
            name
          }
        }
      `;
      
      const result = await client.query(query);
      
      expect(result.data.shop.name).toBe('Test Shop');
      expect(requestCount).toBe(2); // リトライが実行された
    });
  });
  
  describe('ミューテーション', () => {
    test('ミューテーションが実行できる', async () => {
      nock.cleanAll();
      nock(`https://${mockShopDomain}`)
        .post(`/admin/api/${mockApiVersion}/graphql.json`)
        .reply(200, {
          data: {
            productUpdate: {
              product: {
                id: 'gid://shopify/Product/1',
                title: 'Updated Product'
              },
              userErrors: []
            }
          }
        });
      
      const mutation = gql`
        mutation UpdateProduct($input: ProductInput!) {
          productUpdate(input: $input) {
            product {
              id
              title
            }
            userErrors {
              field
              message
            }
          }
        }
      `;
      
      const result = await client.mutate(mutation, {
        input: {
          id: 'gid://shopify/Product/1',
          title: 'Updated Product'
        }
      });
      
      expect(result.data.productUpdate.product.title).toBe('Updated Product');
      expect(result.data.productUpdate.userErrors).toHaveLength(0);
    });
    
    test('ミューテーションはキャッシュをスキップする', async () => {
      const mutation = gql`
        mutation CreateProduct($input: ProductInput!) {
          productCreate(input: $input) {
            product {
              id
            }
          }
        }
      `;
      
      // Redisのsetexメソッドをスパイ
      const setexSpy = jest.spyOn(client.redis, 'setex');
      
      await client.mutate(mutation, { input: { title: 'New Product' } });
      
      // ミューテーションの結果はキャッシュに保存されない
      expect(setexSpy).not.toHaveBeenCalled();
    });
  });
  
  describe('パフォーマンス統計', () => {
    test('パフォーマンス統計が取得できる', async () => {
      // いくつかのクエリを実行
      const query = gql`
        query GetShop {
          shop {
            name
          }
        }
      `;
      
      await client.query(query);
      await client.query(query); // キャッシュヒット
      
      const stats = await client.getPerformanceStats();
      
      expect(stats.cacheEnabled).toBe(true);
      expect(stats.cacheSize).toBeGreaterThanOrEqual(0);
      expect(stats.hitRate).toBeGreaterThanOrEqual(0);
    });
  });
  
  describe('エラーハンドリング', () => {
    test('ネットワークエラーが適切に処理される', async () => {
      nock.cleanAll();
      nock(`https://${mockShopDomain}`)
        .post(`/admin/api/${mockApiVersion}/graphql.json`)
        .replyWithError('Network error');
      
      const query = gql`
        query GetShop {
          shop {
            name
          }
        }
      `;
      
      await expect(client.query(query)).rejects.toThrow();
    });
    
    test('GraphQLエラーが適切に処理される', async () => {
      nock.cleanAll();
      nock(`https://${mockShopDomain}`)
        .post(`/admin/api/${mockApiVersion}/graphql.json`)
        .reply(200, {
          errors: [
            {
              message: 'Syntax Error GraphQL',
              locations: [{ line: 1, column: 1 }]
            }
          ]
        });
      
      const invalidQuery = gql`
        query {
          invalid syntax
        }
      `;
      
      await expect(client.query(invalidQuery)).rejects.toThrow();
    });
  });
});

describe('統合テスト', () => {
  let client;
  
  beforeEach(() => {
    // 実際の設定に近い環境でテスト
    client = new OptimizedShopifyGraphQLClient({
      shopDomain: 'test-shop.myshopify.com',
      accessToken: 'test-token',
      batchInterval: 10,
      batchMax: 5,
      cacheTTL: 300,
      maxRequestsPerSecond: 2
    });
  });
  
  afterEach(async () => {
    await client.close();
  });
  
  test('複雑なワークフローが実行できる', async () => {
    // 商品リストの取得
    const productsResult = await client.query(Queries.GET_PRODUCTS, { first: 10 });
    expect(productsResult.data.products).toBeDefined();
    
    // バッチクエリの実行
    const batchResults = await client.batchQuery([
      {
        name: 'shop',
        query: gql`
          query GetShop {
            shop {
              name
              currencyCode
            }
          }
        `
      },
      {
        name: 'orders',
        query: Queries.GET_ORDERS,
        variables: { first: 5 }
      }
    ]);
    
    expect(batchResults.size).toBe(2);
    
    // キャッシュ統計の確認
    const stats = await client.getPerformanceStats();
    expect(stats.cacheEnabled).toBe(true);
    
    // キャッシュのクリア
    await client.clearCache();
  });
});