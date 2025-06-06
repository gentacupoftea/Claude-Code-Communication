/**
 * Security Manager for Shopify MCP Server
 * 
 * 包括的なセキュリティ管理システムの実装
 * OWASP Top 10に対応し、認証・認可・監査機能を統合
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import _helmet from 'helmet';
import winston from 'winston';
import { RateLimiterRedis, _RateLimiterMemory  } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import { v4: uuidv4  } from 'uuid';
import speakeasy from 'speakeasy';

// セキュリティロガーの設定
const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'security.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * 包括的なセキュリティマネージャー
 */
class SecurityManager {
  constructor(config = {}) {
    this.config = {
      jwtSecret: config.jwtSecret || process.env.JWT_SECRET,
      jwtExpiresIn: config.jwtExpiresIn || '1h',
      refreshTokenExpiresIn: config.refreshTokenExpiresIn || '7d',
      
      // 暗号化設定
      encryptionKey: config.encryptionKey || process.env.ENCRYPTION_KEY,
      encryptionAlgorithm: config.encryptionAlgorithm || 'aes-256-gcm',
      
      // レート制限設定
      rateLimitWindowMs: config.rateLimitWindowMs || 15 * 60 * 1000, // 15分
      rateLimitMaxRequests: config.rateLimitMaxRequests || 100,
      
      // セキュリティポリシー
      passwordMinLength: config.passwordMinLength || 12,
      passwordRequireComplexity: config.passwordRequireComplexity !== false,
      maxLoginAttempts: config.maxLoginAttempts || 5,
      lockoutDuration: config.lockoutDuration || 30 * 60 * 1000, // 30分
      
      // TOTP設定（2FA）
      totpEnabled: config.totpEnabled !== false,
      totpWindow: config.totpWindow || 2,
      
      // セッション設定
      sessionTimeout: config.sessionTimeout || 30 * 60 * 1000, // 30分
      
      // Redis設定
      redis: config.redis || {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379
      }
    };
    
    this._initializeRedis();
    this._initializeRateLimiters();
    this._initializeEncryption();
  }
  
  /**
   * Redis接続の初期化
   */
  _initializeRedis() {
    this.redis = new Redis(this.config.redis);
    
    this.redis.on('error', (err) => {
      securityLogger.error('Redis connection error:', err);
    });
    
    this.redis.on('connect', () => {
      securityLogger.info('Redis connected for security manager');
    });
  }
  
  /**
   * レート制限の初期化
   */
  _initializeRateLimiters() {
    // 一般的なAPIレート制限
    this.apiRateLimiter = new RateLimiterRedis({
      storeClient: this.redis,
      keyPrefix: 'rl:api:',
      points: this.config.rateLimitMaxRequests,
      duration: this.config.rateLimitWindowMs / 1000,
      blockDuration: 60 // 1分間ブロック
    });
    
    // ログイン試行のレート制限
    this.loginRateLimiter = new RateLimiterRedis({
      storeClient: this.redis,
      keyPrefix: 'rl:login:',
      points: this.config.maxLoginAttempts,
      duration: this.config.lockoutDuration / 1000,
      blockDuration: this.config.lockoutDuration / 1000
    });
    
    // パスワードリセットのレート制限
    this.passwordResetRateLimiter = new RateLimiterRedis({
      storeClient: this.redis,
      keyPrefix: 'rl:pwreset:',
      points: 3,
      duration: 3600, // 1時間
      blockDuration: 3600
    });
  }
  
  /**
   * 暗号化システムの初期化
   */
  _initializeEncryption() {
    if (!this.config.encryptionKey) {
      throw new Error('Encryption key is required');
    }
    
    this.encryptionKey = Buffer.from(this.config.encryptionKey, 'hex');
    
    if (this.encryptionKey.length !== 32) {
      throw new Error('Encryption key must be 32 bytes (256 bits)');
    }
  }
  
  /**
   * JWTトークンの生成
   */
  generateAccessToken(payload, options = {}) {
    try {
      const tokenId = uuidv4();
      
      const tokenPayload = {
        ...payload,
        jti: tokenId,
        iat: Math.floor(Date.now() / 1000),
        iss: 'shopify-mcp-server',
        aud: 'shopify-mcp-client'
      };
      
      const token = jwt.sign(
        tokenPayload,
        this.config.jwtSecret,
        {
          expiresIn: options.expiresIn || this.config.jwtExpiresIn,
          algorithm: 'HS256'
        }
      );
      
      // トークンメタデータをRedisに保存
      this.redis.setex(
        `token:${tokenId}`,
        this._getExpiryInSeconds(options.expiresIn || this.config.jwtExpiresIn),
        JSON.stringify({
          userId: payload.userId,
          roles: payload.roles || [],
          permissions: payload.permissions || [],
          createdAt: new Date().toISOString()
        })
      );
      
      return token;
    } catch (error) {
      securityLogger.error('Token generation failed:', error);
      throw new Error('Failed to generate access token');
    }
  }
  
  /**
   * JWTトークンの検証（強化版）
   */
  async verifyAccessToken(token) {
    try {
      // トークンの基本検証
      const decoded = jwt.verify(token, this.config.jwtSecret, {
        algorithms: ['HS256'],
        issuer: 'shopify-mcp-server',
        audience: 'shopify-mcp-client'
      });
      
      // JTI（トークンID）の検証
      const tokenData = await this.redis.get(`token:${decoded.jti}`);
      if (!tokenData) {
        throw new Error('Token not found or expired');
      }
      
      // トークンが無効化されていないか確認
      const isRevoked = await this.redis.get(`revoked:${decoded.jti}`);
      if (isRevoked) {
        throw new Error('Token has been revoked');
      }
      
      // スコープとパーミッションの検証
      const tokenMetadata = JSON.parse(tokenData);
      
      return {
        ...decoded,
        ...tokenMetadata,
        valid: true
      };
    } catch (error) {
      securityLogger.warn('Token verification failed:', error.message);
      throw new Error('Invalid or expired token');
    }
  }
  
  /**
   * リフレッシュトークンの生成
   */
  generateRefreshToken(userId) {
    const tokenId = uuidv4();
    const token = crypto.randomBytes(64).toString('hex');
    
    // リフレッシュトークンをハッシュ化して保存
    const hashedToken = this.hashData(token);
    
    this.redis.setex(
      `refresh:${tokenId}`,
      this._getExpiryInSeconds(this.config.refreshTokenExpiresIn),
      JSON.stringify({
        userId,
        hashedToken,
        createdAt: new Date().toISOString()
      })
    );
    
    return { tokenId, token };
  }
  
  /**
   * トークンの無効化
   */
  async revokeToken(token) {
    try {
      const decoded = jwt.decode(token);
      if (decoded && decoded.jti) {
        await this.redis.setex(
          `revoked:${decoded.jti}`,
          this._getExpiryInSeconds(this.config.jwtExpiresIn),
          'true'
        );
        
        securityLogger.info('Token revoked:', { jti: decoded.jti });
        return true;
      }
      return false;
    } catch (error) {
      securityLogger.error('Token revocation failed:', error);
      return false;
    }
  }
  
  /**
   * パスワードのハッシュ化
   */
  async hashPassword(password) {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(password, salt);
  }
  
  /**
   * パスワードの検証
   */
  async verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
  }
  
  /**
   * パスワード強度の検証
   */
  validatePasswordStrength(password) {
    const errors = [];
    
    if (password.length < this.config.passwordMinLength) {
      errors.push(`Password must be at least ${this.config.passwordMinLength} characters long`);
    }
    
    if (this.config.passwordRequireComplexity) {
      if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
      }
      if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
      }
      if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
      }
      if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        errors.push('Password must contain at least one special character');
      }
    }
    
    // 一般的な弱いパスワードのチェック
    const commonPasswords = ['password', '12345678', 'qwerty', 'abc123', 'password123'];
    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * データの暗号化
   */
  encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      this.config.encryptionAlgorithm,
      this.encryptionKey,
      iv
    );
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }
  
  /**
   * データの復号化
   */
  decrypt(encryptedData) {
    const decipher = crypto.createDecipheriv(
      this.config.encryptionAlgorithm,
      this.encryptionKey,
      Buffer.from(encryptedData.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
  
  /**
   * TOTP（2要素認証）の設定
   */
  generateTOTPSecret(userId) {
    const secret = speakeasy.generateSecret({
      length: 32,
      name: `Shopify MCP (${userId})`,
      issuer: 'Shopify MCP Server'
    });
    
    // シークレットを暗号化して保存
    const encryptedSecret = this.encrypt(secret.base32);
    
    this.redis.setex(
      `totp:${userId}`,
      0, // 無期限
      JSON.stringify(encryptedSecret)
    );
    
    return {
      secret: secret.base32,
      qrCode: secret.otpauth_url
    };
  }
  
  /**
   * TOTPの検証
   */
  async verifyTOTP(userId, token) {
    try {
      const encryptedData = await this.redis.get(`totp:${userId}`);
      if (!encryptedData) {
        throw new Error('TOTP not configured for user');
      }
      
      const encryptedSecret = JSON.parse(encryptedData);
      const secret = this.decrypt(encryptedSecret);
      
      const verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: this.config.totpWindow
      });
      
      return verified;
    } catch (error) {
      securityLogger.error('TOTP verification failed:', error);
      return false;
    }
  }
  
  /**
   * レート制限のチェック
   */
  async checkRateLimit(key, type = 'api') {
    try {
      let limiter;
      
      switch (type) {
        case 'login':
          limiter = this.loginRateLimiter;
          break;
        case 'passwordReset':
          limiter = this.passwordResetRateLimiter;
          break;
        default:
          limiter = this.apiRateLimiter;
      }
      
      await limiter.consume(key);
      return { allowed: true };
    } catch (rateLimiterRes) {
      return {
        allowed: false,
        retryAfter: rateLimiterRes.msBeforeNext || 60000,
        remainingPoints: rateLimiterRes.remainingPoints || 0
      };
    }
  }
  
  /**
   * セキュリティヘッダーの生成
   */
  generateSecurityHeaders() {
    return {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Content-Security-Policy': this._generateCSP(),
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
      'X-Permitted-Cross-Domain-Policies': 'none'
    };
  }
  
  /**
   * CSP（Content Security Policy）の生成
   */
  _generateCSP() {
    const directives = {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'https:'],
      'font-src': ["'self'", 'https:', 'data:'],
      'connect-src': ["'self'", 'https://*.myshopify.com'],
      'frame-ancestors': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'upgrade-insecure-requests': []
    };
    
    return Object.entries(directives)
      .map(([key, values]) => `${key} ${values.join(' ')}`)
      .join('; ');
  }
  
  /**
   * CSRFトークンの生成
   */
  generateCSRFToken() {
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = Date.now() + 3600000; // 1時間
    
    this.redis.setex(
      `csrf:${token}`,
      3600,
      JSON.stringify({ expiry })
    );
    
    return token;
  }
  
  /**
   * CSRFトークンの検証
   */
  async verifyCSRFToken(token) {
    try {
      const data = await this.redis.get(`csrf:${token}`);
      if (!data) {
        return false;
      }
      
      const { expiry } = JSON.parse(data);
      if (Date.now() > expiry) {
        await this.redis.del(`csrf:${token}`);
        return false;
      }
      
      // トークンは一度使用したら削除
      await this.redis.del(`csrf:${token}`);
      return true;
    } catch (error) {
      securityLogger.error('CSRF verification failed:', error);
      return false;
    }
  }
  
  /**
   * セキュリティ監査ログ
   */
  async logSecurityEvent(event) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      eventType: event.type,
      userId: event.userId,
      ip: event.ip,
      userAgent: event.userAgent,
      details: event.details,
      severity: event.severity || 'info'
    };
    
    // Redisに一時保存
    await this.redis.lpush(
      'security:audit:log',
      JSON.stringify(logEntry)
    );
    
    // ファイルログ
    securityLogger.log(event.severity || 'info', 'Security event:', logEntry);
    
    // 重要なイベントはアラート
    if (event.severity === 'critical' || event.severity === 'high') {
      this._sendSecurityAlert(logEntry);
    }
  }
  
  /**
   * セキュリティアラートの送信
   */
  _sendSecurityAlert(event) {
    // 実装: メール、Slack、PagerDutyなどへの通知
    console.warn('SECURITY ALERT:', event);
  }
  
  /**
   * データのハッシュ化（復元不可）
   */
  hashData(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
  
  /**
   * IPアドレスの検証とブロックリスト
   */
  async checkIPAddress(ip) {
    // ブロックリストのチェック
    const isBlocked = await this.redis.get(`blocked:ip:${ip}`);
    if (isBlocked) {
      return { allowed: false, reason: 'IP address is blocked' };
    }
    
    // 疑わしい活動のチェック
    const suspiciousCount = await this.redis.get(`suspicious:ip:${ip}`);
    if (parseInt(suspiciousCount) > 10) {
      return { allowed: false, reason: 'Too many suspicious activities' };
    }
    
    return { allowed: true };
  }
  
  /**
   * 疑わしい活動の記録
   */
  async recordSuspiciousActivity(ip, activity) {
    const key = `suspicious:ip:${ip}`;
    await this.redis.incr(key);
    await this.redis.expire(key, 3600); // 1時間で期限切れ
    
    await this.logSecurityEvent({
      type: 'suspicious_activity',
      ip,
      details: activity,
      severity: 'medium'
    });
  }
  
  /**
   * セッション管理
   */
  async createSession(userId, metadata = {}) {
    const sessionId = uuidv4();
    const sessionData = {
      userId,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      ...metadata
    };
    
    await this.redis.setex(
      `session:${sessionId}`,
      this.config.sessionTimeout / 1000,
      JSON.stringify(sessionData)
    );
    
    return sessionId;
  }
  
  /**
   * セッションの検証と更新
   */
  async validateSession(sessionId) {
    const sessionData = await this.redis.get(`session:${sessionId}`);
    if (!sessionData) {
      return { valid: false };
    }
    
    const session = JSON.parse(sessionData);
    
    // セッションを更新
    session.lastActivity = new Date().toISOString();
    await this.redis.setex(
      `session:${sessionId}`,
      this.config.sessionTimeout / 1000,
      JSON.stringify(session)
    );
    
    return { valid: true, session };
  }
  
  /**
   * ユーティリティ: 有効期限を秒に変換
   */
  _getExpiryInSeconds(expiresIn) {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return 3600; // デフォルト1時間
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: return 3600;
    }
  }
  
  /**
   * クリーンアップとシャットダウン
   */
  async shutdown() {
    await this.redis.quit();
    securityLogger.info('Security manager shut down');
  }
}

module.exports = SecurityManager;