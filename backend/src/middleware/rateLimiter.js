/**
 * Rate Limiter Middleware for Shopify API
 * 
 * Implements Shopify API rate limiting:
 * - Standard: 2 requests/second
 * - Burst: 40 requests/minute
 */

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');

// Redis client for rate limiting
const redisClient = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

// Shopify API rate limiter
const shopifyRateLimiter = rateLimit({
  // Use Redis store if available, otherwise use memory store
  store: redisClient ? new RedisStore({
    client: redisClient,
    prefix: 'shopify-api-rl:',
  }) : undefined,
  
  // Shopify allows 2 requests per second
  windowMs: 1000, // 1 second
  max: 2, // 2 requests per windowMs
  
  // Response when rate limit is exceeded
  message: {
    error: 'Too many requests to Shopify API',
    retryAfter: 1,
    message: 'Shopify API rate limit exceeded. Please retry after 1 second.'
  },
  
  // Headers to send
  standardHeaders: true,
  legacyHeaders: false,
  
  // Skip rate limiting in test environment
  skip: (req) => process.env.NODE_ENV === 'test',
  
  // Custom key generator (per IP + API endpoint)
  keyGenerator: (req) => {
    return `${req.ip}:${req.originalUrl}`;
  },
  
  // Handler for rate limit exceeded
  handler: (req, res) => {
    console.warn(`Rate limit exceeded for ${req.ip} on ${req.originalUrl}`);
    res.status(429).json({
      error: 'Too many requests',
      message: 'Shopify API rate limit exceeded',
      retryAfter: res.getHeader('Retry-After'),
      limit: res.getHeader('X-RateLimit-Limit'),
      remaining: res.getHeader('X-RateLimit-Remaining'),
      reset: res.getHeader('X-RateLimit-Reset')
    });
  }
});

// Burst limiter (40 requests per minute)
const shopifyBurstLimiter = rateLimit({
  store: redisClient ? new RedisStore({
    client: redisClient,
    prefix: 'shopify-burst-rl:',
  }) : undefined,
  windowMs: 60 * 1000, // 1 minute
  max: 40, // 40 requests per minute
  skip: (req) => process.env.NODE_ENV === 'test',
});

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