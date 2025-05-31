/**
 * Security Middleware for Express/Fastify
 * 
 * 包括的なセキュリティミドルウェアの実装
 */

const helmet = require('helmet');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const SecurityManager = require('./security-manager');
const Joi = require('joi');

/**
 * セキュリティミドルウェアファクトリー
 */
class SecurityMiddleware {
  constructor(securityManager) {
    this.securityManager = securityManager;
    this.logger = securityManager.logger || console;
  }
  
  /**
   * Helmet.jsによる基本的なセキュリティヘッダー
   */
  helmetMiddleware() {
    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'https://*.myshopify.com'],
          fontSrc: ["'self'", 'https:', 'data:'],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    });
  }
  
  /**
   * CORS設定
   */
  corsMiddleware() {
    return cors({
      origin: (origin, callback) => {
        // 許可されたオリジンのリスト
        const allowedOrigins = [
          process.env.FRONTEND_URL,
          'https://admin.shopify.com',
          'https://*.myshopify.com'
        ].filter(Boolean);
        
        // 開発環境では localhost を許可
        if (process.env.NODE_ENV === 'development') {
          allowedOrigins.push('http://localhost:3000');
        }
        
        // オリジンがない場合（同一オリジン）または許可リストに含まれる場合
        if (!origin || allowedOrigins.some(allowed => {
          if (allowed.includes('*')) {
            const regex = new RegExp(allowed.replace('*', '.*'));
            return regex.test(origin);
          }
          return allowed === origin;
        })) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      maxAge: 86400 // 24時間
    });
  }
  
  /**
   * JWT認証ミドルウェア
   */
  authenticate(options = {}) {
    return async (req, res, next) => {
      try {
        // トークンの取得
        const token = this._extractToken(req);
        
        if (!token) {
          return res.status(401).json({
            error: 'Authentication required',
            code: 'MISSING_TOKEN'
          });
        }
        
        // トークンの検証
        const decoded = await this.securityManager.verifyAccessToken(token);
        
        // リクエストにユーザー情報を追加
        req.user = {
          userId: decoded.userId,
          roles: decoded.roles || [],
          permissions: decoded.permissions || [],
          tokenId: decoded.jti
        };
        
        // セキュリティイベントログ
        await this.securityManager.logSecurityEvent({
          type: 'authentication',
          userId: decoded.userId,
          ip: req.ip,
          userAgent: req.get('user-agent'),
          details: { tokenId: decoded.jti }
        });
        
        next();
      } catch (error) {
        // 認証失敗をログ
        await this.securityManager.logSecurityEvent({
          type: 'authentication_failed',
          ip: req.ip,
          userAgent: req.get('user-agent'),
          details: { error: error.message },
          severity: 'medium'
        });
        
        return res.status(401).json({
          error: 'Authentication failed',
          code: 'INVALID_TOKEN'
        });
      }
    };
  }
  
  /**
   * 認可ミドルウェア（ロールベース）
   */
  authorize(requiredRoles = [], requiredPermissions = []) {
    return async (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'NOT_AUTHENTICATED'
        });
      }
      
      // ロールチェック
      if (requiredRoles.length > 0) {
        const hasRole = requiredRoles.some(role => req.user.roles.includes(role));
        if (!hasRole) {
          await this.securityManager.logSecurityEvent({
            type: 'authorization_failed',
            userId: req.user.userId,
            ip: req.ip,
            details: { requiredRoles, userRoles: req.user.roles },
            severity: 'medium'
          });
          
          return res.status(403).json({
            error: 'Insufficient permissions',
            code: 'MISSING_ROLE'
          });
        }
      }
      
      // パーミッションチェック
      if (requiredPermissions.length > 0) {
        const hasPermission = requiredPermissions.every(permission => 
          req.user.permissions.includes(permission)
        );
        
        if (!hasPermission) {
          await this.securityManager.logSecurityEvent({
            type: 'authorization_failed',
            userId: req.user.userId,
            ip: req.ip,
            details: { requiredPermissions, userPermissions: req.user.permissions },
            severity: 'medium'
          });
          
          return res.status(403).json({
            error: 'Insufficient permissions',
            code: 'MISSING_PERMISSION'
          });
        }
      }
      
      next();
    };
  }
  
  /**
   * レート制限ミドルウェア
   */
  rateLimit(options = {}) {
    const {
      windowMs = 15 * 60 * 1000,
      max = 100,
      keyGenerator = (req) => req.ip,
      skip = () => false,
      handler = null
    } = options;
    
    return async (req, res, next) => {
      if (skip(req)) {
        return next();
      }
      
      const key = keyGenerator(req);
      const rateLimitResult = await this.securityManager.checkRateLimit(key, 'api');
      
      // レート制限情報をヘッダーに追加
      res.set({
        'X-RateLimit-Limit': max,
        'X-RateLimit-Remaining': rateLimitResult.remainingPoints || 0,
        'X-RateLimit-Reset': new Date(Date.now() + (rateLimitResult.retryAfter || windowMs)).toISOString()
      });
      
      if (!rateLimitResult.allowed) {
        await this.securityManager.logSecurityEvent({
          type: 'rate_limit_exceeded',
          ip: req.ip,
          userAgent: req.get('user-agent'),
          details: { key, retryAfter: rateLimitResult.retryAfter },
          severity: 'medium'
        });
        
        if (handler) {
          return handler(req, res, next);
        }
        
        return res.status(429).json({
          error: 'Too many requests',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: rateLimitResult.retryAfter
        });
      }
      
      next();
    };
  }
  
  /**
   * CSRF保護ミドルウェア
   */
  csrfProtection(options = {}) {
    const {
      excludePaths = [],
      cookie = false
    } = options;
    
    return async (req, res, next) => {
      // 除外パスのチェック
      if (excludePaths.some(path => req.path.startsWith(path))) {
        return next();
      }
      
      // GETリクエストはスキップ
      if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
        return next();
      }
      
      const token = req.get('X-CSRF-Token') || req.body._csrf;
      
      if (!token) {
        return res.status(403).json({
          error: 'CSRF token missing',
          code: 'CSRF_TOKEN_MISSING'
        });
      }
      
      const isValid = await this.securityManager.verifyCSRFToken(token);
      
      if (!isValid) {
        await this.securityManager.logSecurityEvent({
          type: 'csrf_attack_detected',
          ip: req.ip,
          userAgent: req.get('user-agent'),
          details: { path: req.path, method: req.method },
          severity: 'high'
        });
        
        return res.status(403).json({
          error: 'Invalid CSRF token',
          code: 'CSRF_TOKEN_INVALID'
        });
      }
      
      next();
    };
  }
  
  /**
   * 入力検証ミドルウェア
   */
  validateInput(schema, options = {}) {
    const {
      source = 'body', // body, query, params
      abortEarly = false,
      stripUnknown = true
    } = options;
    
    return async (req, res, next) => {
      try {
        const data = req[source];
        
        const { error, value } = schema.validate(data, {
          abortEarly,
          stripUnknown
        });
        
        if (error) {
          return res.status(400).json({
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: error.details.map(detail => ({
              field: detail.path.join('.'),
              message: detail.message
            }))
          });
        }
        
        // 検証済みデータで置き換え
        req[source] = value;
        next();
      } catch (error) {
        next(error);
      }
    };
  }
  
  /**
   * SQLインジェクション対策
   */
  sqlInjectionProtection() {
    return (req, res, next) => {
      const suspiciousPatterns = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|FROM|WHERE)\b)/i,
        /(-{2}|\/\*|\*\/|;)/,
        /(\'|\"|\`)/
      ];
      
      const checkValue = (value) => {
        if (typeof value === 'string') {
          for (const pattern of suspiciousPatterns) {
            if (pattern.test(value)) {
              return true;
            }
          }
        }
        return false;
      };
      
      const checkObject = (obj) => {
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            const value = obj[key];
            if (typeof value === 'object' && value !== null) {
              if (checkObject(value)) return true;
            } else if (checkValue(value)) {
              return true;
            }
          }
        }
        return false;
      };
      
      if (checkObject(req.query) || checkObject(req.body) || checkObject(req.params)) {
        this.securityManager.recordSuspiciousActivity(req.ip, 'SQL injection attempt');
        
        return res.status(400).json({
          error: 'Invalid input detected',
          code: 'SUSPICIOUS_INPUT'
        });
      }
      
      next();
    };
  }
  
  /**
   * XSS対策
   */
  xssProtection() {
    return (req, res, next) => {
      const xssPatterns = [
        /<script[^>]*>/gi,
        /<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /<iframe[^>]*>/gi,
        /<object[^>]*>/gi,
        /<embed[^>]*>/gi
      ];
      
      const sanitizeValue = (value) => {
        if (typeof value === 'string') {
          for (const pattern of xssPatterns) {
            value = value.replace(pattern, '');
          }
        }
        return value;
      };
      
      const sanitizeObject = (obj) => {
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            const value = obj[key];
            if (typeof value === 'object' && value !== null) {
              sanitizeObject(value);
            } else {
              obj[key] = sanitizeValue(value);
            }
          }
        }
      };
      
      sanitizeObject(req.body);
      sanitizeObject(req.query);
      sanitizeObject(req.params);
      
      next();
    };
  }
  
  /**
   * IPアドレスフィルタリング
   */
  ipFilter(options = {}) {
    const {
      whitelist = [],
      blacklist = [],
      trustProxy = false
    } = options;
    
    return async (req, res, next) => {
      const ip = trustProxy ? req.ips[0] || req.ip : req.ip;
      
      // IPアドレスチェック
      const ipCheckResult = await this.securityManager.checkIPAddress(ip);
      
      if (!ipCheckResult.allowed) {
        await this.securityManager.logSecurityEvent({
          type: 'ip_blocked',
          ip,
          userAgent: req.get('user-agent'),
          details: { reason: ipCheckResult.reason },
          severity: 'high'
        });
        
        return res.status(403).json({
          error: 'Access denied',
          code: 'IP_BLOCKED'
        });
      }
      
      // ホワイトリストチェック
      if (whitelist.length > 0 && !whitelist.includes(ip)) {
        return res.status(403).json({
          error: 'Access denied',
          code: 'IP_NOT_WHITELISTED'
        });
      }
      
      // ブラックリストチェック
      if (blacklist.includes(ip)) {
        return res.status(403).json({
          error: 'Access denied',
          code: 'IP_BLACKLISTED'
        });
      }
      
      next();
    };
  }
  
  /**
   * セキュリティイベントモニタリング
   */
  securityMonitoring() {
    return async (req, res, next) => {
      const startTime = Date.now();
      
      // リクエストIDの生成
      req.id = req.id || uuidv4();
      
      // レスポンスの拡張
      const originalSend = res.send;
      res.send = function(data) {
        // レスポンス時間の計算
        const responseTime = Date.now() - startTime;
        
        // セキュリティログ
        this.securityManager.logSecurityEvent({
          type: 'http_request',
          ip: req.ip,
          userAgent: req.get('user-agent'),
          details: {
            requestId: req.id,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            responseTime,
            userId: req.user?.userId
          },
          severity: res.statusCode >= 400 ? 'medium' : 'info'
        });
        
        return originalSend.call(this, data);
      }.bind(this);
      
      next();
    };
  }
  
  /**
   * トークンの抽出
   */
  _extractToken(req) {
    // Authorizationヘッダーから
    const authHeader = req.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    // クエリパラメータから
    if (req.query.token) {
      return req.query.token;
    }
    
    // クッキーから
    if (req.cookies && req.cookies.access_token) {
      return req.cookies.access_token;
    }
    
    return null;
  }
  
  /**
   * エラーハンドラー
   */
  errorHandler() {
    return async (err, req, res, next) => {
      // ログ記録
      await this.securityManager.logSecurityEvent({
        type: 'error',
        ip: req.ip,
        userAgent: req.get('user-agent'),
        details: {
          error: err.message,
          stack: err.stack,
          path: req.path,
          method: req.method
        },
        severity: 'high'
      });
      
      // 本番環境ではスタックトレースを隠す
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        code: err.code || 'INTERNAL_ERROR',
        ...(isDevelopment && { stack: err.stack })
      });
    };
  }
}

module.exports = SecurityMiddleware;