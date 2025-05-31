/**
 * Optimized GraphQL Client for Shopify MCP Server
 * 
 * Features:
 * - Batch query execution
 * - Advanced caching with Redis
 * - Rate limiting with adaptive backoff
 * - Comprehensive error handling
 * - Performance monitoring
 */

const { ApolloClient, InMemoryCache, ApolloLink, gql } = require('@apollo/client');
const { BatchHttpLink } = require('@apollo/client/link/batch-http');
const { RetryLink } = require('@apollo/client/link/retry');
const { onError } = require('@apollo/client/link/error');
const Redis = require('ioredis');
const winston = require('winston');
const { RateLimiter } = require('limiter');

// ロガーの設定
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    }),
    new winston.transports.File({ filename: 'graphql-client.log' })
  ]
});

/**
 * Shopify GraphQL最適化クライアント
 * 
 * バッチ処理、キャッシング、レート制限を統合した高性能クライアント
 */
class OptimizedShopifyGraphQLClient {
  constructor(config = {}) {
    this.config = {
      shopDomain: config.shopDomain || process.env.SHOPIFY_SHOP_DOMAIN,
      accessToken: config.accessToken || process.env.SHOPIFY_ACCESS_TOKEN,
      apiVersion: config.apiVersion || '2024-01',
      
      // バッチ設定
      batchInterval: config.batchInterval || 10, // ms
      batchMax: config.batchMax || 10, // 最大バッチサイズ
      
      // キャッシュ設定
      cacheEnabled: config.cacheEnabled !== false,
      cacheTTL: config.cacheTTL || 300, // 5分
      
      // レート制限設定
      rateLimitEnabled: config.rateLimitEnabled !== false,
      maxRequestsPerSecond: config.maxRequestsPerSecond || 2,
      
      // リトライ設定
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      
      // Redis設定
      redisConfig: config.redisConfig || {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        db: process.env.REDIS_DB || 0
      }
    };
    
    this._initializeRedis();
    this._initializeRateLimiter();
    this._initializeApolloClient();
  }
  
  /**
   * Redisクライアントの初期化
   */
  _initializeRedis() {
    if (!this.config.cacheEnabled) return;
    
    this.redis = new Redis(this.config.redisConfig);
    
    this.redis.on('error', (err) => {
      logger.error('Redis Client Error', err);
    });
    
    this.redis.on('connect', () => {
      logger.info('Redis Client Connected');
    });
  }
  
  /**
   * レート制限の初期化
   */
  _initializeRateLimiter() {
    if (!this.config.rateLimitEnabled) return;
    
    // Shopify APIレート制限: 2リクエスト/秒（標準）
    this.rateLimiter = new RateLimiter({
      tokensPerInterval: this.config.maxRequestsPerSecond,
      interval: 'second',
      fireImmediately: true
    });
  }
  
  /**
   * Apollo Clientの初期化
   */
  _initializeApolloClient() {
    const httpLink = new BatchHttpLink({
      uri: `https://${this.config.shopDomain}/admin/api/${this.config.apiVersion}/graphql.json`,
      batchInterval: this.config.batchInterval,
      batchMax: this.config.batchMax,
      headers: {
        'X-Shopify-Access-Token': this.config.accessToken,
        'Content-Type': 'application/json',
      },
    });
    
    // エラーハンドリングリンク
    const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
      if (graphQLErrors) {
        graphQLErrors.forEach(({ message, locations, path }) => {
          logger.error(`GraphQL error: ${message}`, {
            locations,
            path,
            operation: operation.operationName
          });
        });
      }
      
      if (networkError) {
        logger.error(`Network error: ${networkError.message}`, {
          operation: operation.operationName
        });
        
        // レート制限エラーの処理
        if (networkError.statusCode === 429) {
          const retryAfter = networkError.headers.get('Retry-After') || '5';
          logger.warn(`Rate limit hit. Retrying after ${retryAfter} seconds`);
          
          return new Observable(observer => {
            setTimeout(() => {
              forward(operation).subscribe(observer);
            }, parseInt(retryAfter) * 1000);
          });
        }
      }
    });
    
    // リトライリンク
    const retryLink = new RetryLink({
      delay: {
        initial: this.config.retryDelay,
        max: this.config.retryDelay * 8,
        jitter: true
      },
      attempts: {
        max: this.config.maxRetries,
        retryIf: (error, _operation) => {
          // ネットワークエラーまたは5xxエラーの場合にリトライ
          return !!error && (
            error.networkError?.statusCode >= 500 ||
            error.networkError?.statusCode === 429
          );
        }
      }
    });
    
    // レート制限リンク
    const rateLimitLink = new ApolloLink((operation, forward) => {
      if (!this.config.rateLimitEnabled) {
        return forward(operation);
      }
      
      return new Observable(observer => {
        this.rateLimiter.removeTokens(1, (err, remainingRequests) => {
          if (err) {
            observer.error(err);
            return;
          }
          
          logger.debug(`Rate limiter: ${remainingRequests} requests remaining`);
          
          forward(operation).subscribe({
            next: observer.next.bind(observer),
            error: observer.error.bind(observer),
            complete: observer.complete.bind(observer)
          });
        });
      });
    });
    
    // キャッシングリンク
    const cacheLink = new ApolloLink((operation, forward) => {
      if (!this.config.cacheEnabled || operation.getContext().skipCache) {
        return forward(operation);
      }
      
      const cacheKey = this._generateCacheKey(operation);
      
      return new Observable(observer => {
        // キャッシュからの読み取りを試行
        this.redis.get(cacheKey).then(cachedData => {
          if (cachedData) {
            logger.debug(`Cache hit for ${operation.operationName}`);
            const parsedData = JSON.parse(cachedData);
            observer.next(parsedData);
            observer.complete();
            return;
          }
          
          // キャッシュミスの場合、リクエストを実行
          logger.debug(`Cache miss for ${operation.operationName}`);
          
          forward(operation).subscribe({
            next: (data) => {
              // レスポンスをキャッシュに保存
              this.redis.setex(
                cacheKey,
                this.config.cacheTTL,
                JSON.stringify(data)
              ).catch(err => {
                logger.error('Failed to cache response', err);
              });
              
              observer.next(data);
            },
            error: observer.error.bind(observer),
            complete: observer.complete.bind(observer)
          });
        }).catch(err => {
          logger.error('Failed to read from cache', err);
          forward(operation).subscribe(observer);
        });
      });
    });
    
    // リンクチェーンの構築
    const link = ApolloLink.from([
      errorLink,
      rateLimitLink,
      cacheLink,
      retryLink,
      httpLink
    ]);
    
    // Apollo Clientの作成
    this.client = new ApolloClient({
      link,
      cache: new InMemoryCache({
        typePolicies: {
          Query: {
            fields: {
              products: {
                keyArgs: ["query", "first", "sortKey"],
                merge(existing = {}, incoming) {
                  return {
                    ...existing,
                    ...incoming,
                    edges: [...(existing.edges || []), ...(incoming.edges || [])]
                  };
                }
              }
            }
          }
        }
      }),
      defaultOptions: {
        watchQuery: {
          fetchPolicy: 'cache-first',
          errorPolicy: 'all',
        },
        query: {
          fetchPolicy: 'cache-first',
          errorPolicy: 'all',
        },
      },
    });
  }
  
  /**
   * キャッシュキーの生成
   */
  _generateCacheKey(operation) {
    const { operationName, variables } = operation;
    const variableString = JSON.stringify(variables || {}, Object.keys(variables || {}).sort());
    return `graphql:${operationName}:${variableString}`;
  }
  
  /**
   * GraphQLクエリの実行
   */
  async query(query, variables = {}, options = {}) {
    const startTime = Date.now();
    
    try {
      const result = await this.client.query({
        query: typeof query === 'string' ? gql(query) : query,
        variables,
        ...options
      });
      
      const duration = Date.now() - startTime;
      logger.info(`Query ${query.definitions?.[0]?.name?.value || 'unnamed'} completed in ${duration}ms`);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Query failed after ${duration}ms`, {
        error: error.message,
        query: query.definitions?.[0]?.name?.value || 'unnamed',
        variables
      });
      
      throw error;
    }
  }
  
  /**
   * GraphQLミューテーションの実行
   */
  async mutate(mutation, variables = {}, options = {}) {
    const startTime = Date.now();
    
    try {
      const result = await this.client.mutate({
        mutation: typeof mutation === 'string' ? gql(mutation) : mutation,
        variables,
        // ミューテーションは常にキャッシュをスキップ
        context: { skipCache: true },
        ...options
      });
      
      const duration = Date.now() - startTime;
      logger.info(`Mutation ${mutation.definitions?.[0]?.name?.value || 'unnamed'} completed in ${duration}ms`);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Mutation failed after ${duration}ms`, {
        error: error.message,
        mutation: mutation.definitions?.[0]?.name?.value || 'unnamed',
        variables
      });
      
      throw error;
    }
  }
  
  /**
   * バッチクエリの実行
   * 
   * 複数のクエリを一度に実行し、結果をマップで返す
   */
  async batchQuery(queries) {
    const startTime = Date.now();
    const results = new Map();
    
    try {
      // クエリをバッチで実行
      const promises = queries.map(({ name, query, variables, options }) => {
        return this.query(query, variables, options)
          .then(result => ({ name, result, success: true }))
          .catch(error => ({ name, error, success: false }));
      });
      
      const batchResults = await Promise.all(promises);
      
      // 結果をマップに格納
      batchResults.forEach(({ name, result, error, success }) => {
        results.set(name, { result, error, success });
      });
      
      const duration = Date.now() - startTime;
      const successCount = batchResults.filter(r => r.success).length;
      
      logger.info(`Batch query completed: ${successCount}/${queries.length} successful in ${duration}ms`);
      
      return results;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Batch query failed after ${duration}ms`, error);
      throw error;
    }
  }
  
  /**
   * キャッシュのクリア
   */
  async clearCache(pattern = '*') {
    if (!this.config.cacheEnabled) return;
    
    try {
      const keys = await this.redis.keys(`graphql:${pattern}`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.info(`Cleared ${keys.length} cache entries`);
      }
    } catch (error) {
      logger.error('Failed to clear cache', error);
      throw error;
    }
  }
  
  /**
   * パフォーマンス統計の取得
   */
  async getPerformanceStats() {
    if (!this.config.cacheEnabled) {
      return { cacheEnabled: false };
    }
    
    try {
      const keys = await this.redis.keys('graphql:*');
      const info = await this.redis.info('stats');
      
      // Redis統計情報をパース
      const stats = info.split('\r\n').reduce((acc, line) => {
        const [key, value] = line.split(':');
        if (key && value) {
          acc[key] = value;
        }
        return acc;
      }, {});
      
      return {
        cacheEnabled: true,
        cacheSize: keys.length,
        hitRate: parseFloat(stats.keyspace_hits) / (parseFloat(stats.keyspace_hits) + parseFloat(stats.keyspace_misses)) || 0,
        totalCommands: parseInt(stats.total_commands_processed),
        connectedClients: parseInt(stats.connected_clients)
      };
    } catch (error) {
      logger.error('Failed to get performance stats', error);
      return { cacheEnabled: true, error: error.message };
    }
  }
  
  /**
   * リソースのクリーンアップ
   */
  async close() {
    if (this.redis) {
      await this.redis.quit();
    }
    
    if (this.client) {
      await this.client.stop();
    }
    
    logger.info('GraphQL client closed');
  }
}

// 共通クエリのヘルパー関数
const Queries = {
  /**
   * 商品一覧の取得
   */
  GET_PRODUCTS: gql`
    query GetProducts($first: Int!, $after: String, $query: String) {
      products(first: $first, after: $after, query: $query) {
        edges {
          cursor
          node {
            id
            title
            description
            handle
            productType
            vendor
            tags
            variants(first: 10) {
              edges {
                node {
                  id
                  title
                  price
                  compareAtPrice
                  sku
                  inventoryQuantity
                }
              }
            }
            images(first: 5) {
              edges {
                node {
                  id
                  url
                  altText
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
  `,
  
  /**
   * 注文一覧の取得
   */
  GET_ORDERS: gql`
    query GetOrders($first: Int!, $after: String, $query: String) {
      orders(first: $first, after: $after, query: $query) {
        edges {
          cursor
          node {
            id
            name
            createdAt
            updatedAt
            customer {
              id
              email
              firstName
              lastName
            }
            totalPrice
            currencyCode
            lineItems(first: 10) {
              edges {
                node {
                  id
                  title
                  quantity
                  price
                }
              }
            }
            fulfillmentStatus
            financialStatus
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `,
  
  /**
   * 顧客情報の取得
   */
  GET_CUSTOMER: gql`
    query GetCustomer($id: ID!) {
      customer(id: $id) {
        id
        email
        firstName
        lastName
        phone
        ordersCount
        totalSpent
        createdAt
        updatedAt
        addresses(first: 5) {
          edges {
            node {
              id
              address1
              address2
              city
              province
              country
              zip
              phone
            }
          }
        }
        metafields(first: 10) {
          edges {
            node {
              id
              namespace
              key
              value
              type
            }
          }
        }
      }
    }
  `
};

// エクスポート
module.exports = {
  OptimizedShopifyGraphQLClient,
  Queries,
  logger
};