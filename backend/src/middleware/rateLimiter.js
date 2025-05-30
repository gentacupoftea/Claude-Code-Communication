/**
 * Rate Limiter Middleware for Shopify API
 * 
 * Implements Shopify API rate limiting:
 * - Standard: 2 requests/second
 * - Burst: 40 requests/minute
 */

const rateLimit = require('express-rate-limit');
const Redis = require('ioredis');

// より安全で保守しやすいRedisStore初期化
let RedisStore = null;
let redisStoreAvailable = false;

try {
  // rate-limit-redis v4以降の標準的なインポート方法
  const rateLimit = require('rate-limit-redis');
  RedisStore = rateLimit.RedisStore || rateLimit.default || rateLimit;
  redisStoreAvailable = true;
  console.log('Redis rate limiting enabled');
} catch (error) {
  console.warn('Redis rate limiting unavailable, falling back to memory store:', error.message);
  redisStoreAvailable = false;
}

// Redis client for rate limiting
const redisClient = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

// より堅牢なShopify API rate limiter
const createShopifyRateLimiter = () => {
  const config = {
    windowMs: 1000, // 1 second
    max: 2, // 2 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => process.env.NODE_ENV === 'test',
    
    keyGenerator: (req) => {
      // IPアドレスとエンドポイントを組み合わせたキー
      return `${req.ip || 'unknown'}:${req.originalUrl}`;
    },
    
    handler: (req, res) => {
      console.warn(`Shopify rate limit exceeded for ${req.ip} on ${req.originalUrl}`);
      res.status(429).json({
        error: 'Too many requests',
        message: 'Shopify API rate limit exceeded',
        retryAfter: res.getHeader('Retry-After'),
        limit: res.getHeader('X-RateLimit-Limit'),
        remaining: res.getHeader('X-RateLimit-Remaining'),
        reset: res.getHeader('X-RateLimit-Reset')
      });
    }
  };

  // Redisが利用可能な場合のみRedisStoreを使用
  if (redisClient && redisStoreAvailable && RedisStore) {
    try {
      config.store = new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
        prefix: 'shopify-api-rl:',
      });
    } catch (error) {
      console.warn('Failed to initialize Redis store for rate limiting:', error.message);
    }
  }

  return rateLimit(config);
};

const shopifyRateLimiter = createShopifyRateLimiter();

// より堅牢なBurst limiter (40 requests per minute)
const createShopifyBurstLimiter = () => {
  const config = {
    windowMs: 60 * 1000, // 1 minute
    max: 40, // 40 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => process.env.NODE_ENV === 'test',
    keyGenerator: (req) => `${req.ip || 'unknown'}:burst`,
  };

  // Redisが利用可能な場合のみRedisStoreを使用
  if (redisClient && redisStoreAvailable && RedisStore) {
    try {
      config.store = new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
        prefix: 'shopify-burst-rl:',
      });
    } catch (error) {
      console.warn('Failed to initialize Redis store for burst limiting:', error.message);
    }
  }

  return rateLimit(config);
};

const shopifyBurstLimiter = createShopifyBurstLimiter();

// Combined middleware
const shopifyRateLimitMiddleware = (req, res, next) => {
  // Apply both rate limiters
  shopifyRateLimiter(req, res, (err) => {
    if (err) return next(err);
    shopifyBurstLimiter(req, res, next);
  });
};

module.exports = {
  shopifyRateLimiter,
  shopifyBurstLimiter,
  shopifyRateLimitMiddleware
};