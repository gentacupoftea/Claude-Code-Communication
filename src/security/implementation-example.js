/**
 * Security Implementation Example
 * 
 * Shopify MCP Serverのセキュリティ機能の実装例
 */

import express from 'express';
import SecurityManager from './security-manager';
import SecurityMiddleware from './security-middleware';
import VulnerabilityScanner from './vulnerability-scanner';

/**
 * セキュアなExpressアプリケーションの設定例
 */
function createSecureApp() {
  const app = express();
  
  // セキュリティマネージャーの初期化
  const securityManager = new SecurityManager({
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: '1h',
    encryptionKey: process.env.ENCRYPTION_KEY,
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379
    }
  });
  
  // セキュリティミドルウェアの初期化
  const securityMiddleware = new SecurityMiddleware(securityManager);
  
  // 基本的なミドルウェアの設定
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  
  // セキュリティヘッダーの設定
  app.use(securityMiddleware.helmetMiddleware());
  
  // CORS設定
  app.use(securityMiddleware.corsMiddleware());
  
  // レート制限
  app.use('/api/', securityMiddleware.rateLimit({
    windowMs: 15 * 60 * 1000, // 15分
    max: 100
  }));
  
  // ログイン用の特別なレート制限
  app.use('/api/auth/login', securityMiddleware.rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    keyGenerator: (req) => req.body.username || req.ip
  }));
  
  // セキュリティモニタリング
  app.use(securityMiddleware.securityMonitoring());
  
  // SQLインジェクション対策
  app.use(securityMiddleware.sqlInjectionProtection());
  
  // XSS対策
  app.use(securityMiddleware.xssProtection());
  
  // 認証エンドポイント
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { username, password, email } = req.body;
      
      // パスワード強度の検証
      const passwordCheck = securityManager.validatePasswordStrength(password);
      if (!passwordCheck.valid) {
        return res.status(400).json({
          error: 'Weak password',
          details: passwordCheck.errors
        });
      }
      
      // パスワードのハッシュ化
      const _hashedPassword = await securityManager.hashPassword(password);
      
      // ユーザー作成（実際のデータベース処理は省略）
      const userId = 'user_' + Date.now();
      
      // JWTトークンの生成
      const accessToken = securityManager.generateAccessToken({
        userId,
        username,
        roles: ['user'],
        permissions: ['read:own_data']
      });
      
      // リフレッシュトークンの生成
      const { _tokenId, token } = securityManager.generateRefreshToken(userId);
      
      // TOTP秘密鍵の生成（2FA用）
      const totpSecret = securityManager.generateTOTPSecret(userId);
      
      // セキュリティイベントのログ
      await securityManager.logSecurityEvent({
        type: 'user_registration',
        userId,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        details: { username, email }
      });
      
      res.json({
        accessToken,
        refreshToken: token,
        totpQrCode: totpSecret.qrCode
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  });
  
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password, totpToken } = req.body;
      
      // レート制限のチェック
      const rateLimitResult = await securityManager.checkRateLimit(username, 'login');
      if (!rateLimitResult.allowed) {
        return res.status(429).json({
          error: 'Too many login attempts',
          retryAfter: rateLimitResult.retryAfter
        });
      }
      
      // ユーザー認証（実際のデータベース処理は省略）
      const user = { 
        id: 'user_123',
        username,
        passwordHash: '$2a$10$...',
        totpEnabled: true
      };
      
      // パスワード検証
      const isValidPassword = await securityManager.verifyPassword(password, user.passwordHash);
      if (!isValidPassword) {
        await securityManager.recordSuspiciousActivity(req.ip, 'Invalid login attempt');
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // 2FA検証
      if (user.totpEnabled) {
        const isValidTotp = await securityManager.verifyTOTP(user.id, totpToken);
        if (!isValidTotp) {
          return res.status(401).json({ error: 'Invalid 2FA token' });
        }
      }
      
      // トークン生成
      const accessToken = securityManager.generateAccessToken({
        userId: user.id,
        username: user.username,
        roles: ['user'],
        permissions: ['read:own_data', 'write:own_data']
      });
      
      // セッション作成
      const sessionId = await securityManager.createSession(user.id, {
        userAgent: req.get('user-agent'),
        ip: req.ip
      });
      
      // セキュリティイベントのログ
      await securityManager.logSecurityEvent({
        type: 'successful_login',
        userId: user.id,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        details: { username }
      });
      
      res.json({
        accessToken,
        sessionId
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  });
  
  // 保護されたエンドポイント
  app.get('/api/profile',
    securityMiddleware.authenticate(),
    securityMiddleware.authorize(['user'], ['read:own_data']),
    async (req, res) => {
      // CSRFトークンの生成
      const csrfToken = securityManager.generateCSRFToken();
      
      res.json({
        userId: req.user.userId,
        username: 'example_user',
        csrfToken
      });
    }
  );
  
  // データ暗号化の例
  app.post('/api/secure-data',
    securityMiddleware.authenticate(),
    securityMiddleware.csrfProtection(),
    async (req, res) => {
      try {
        const { sensitiveData } = req.body;
        
        // データの暗号化
        const _encryptedData = securityManager.encrypt(sensitiveData);
        
        // 保存（実際のデータベース処理は省略）
        
        res.json({
          message: 'Data securely stored',
          dataId: 'data_' + Date.now()
        });
      } catch (error) {
        console.error('Data encryption error:', error);
        res.status(500).json({ error: 'Failed to store data' });
      }
    }
  );
  
  // 脆弱性スキャンエンドポイント（管理者のみ）
  app.post('/api/admin/security-scan',
    securityMiddleware.authenticate(),
    securityMiddleware.authorize(['admin'], ['security:scan']),
    async (req, res) => {
      try {
        const scanner = new VulnerabilityScanner({
          targetUrl: req.body.targetUrl || 'http://localhost:3000'
        });
        
        const report = await scanner.runFullScan();
        
        res.json(report);
      } catch (error) {
        console.error('Security scan error:', error);
        res.status(500).json({ error: 'Scan failed' });
      }
    }
  );
  
  // セキュリティヘルスチェック
  app.get('/api/health/security', async (req, res) => {
    try {
      const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        checks: {
          redis: await checkRedisConnection(securityManager.redis),
          rateLimit: await checkRateLimitStatus(securityManager),
          ssl: req.secure,
          headers: checkSecurityHeaders(res)
        }
      };
      
      res.json(health);
    } catch (error) {
      res.status(500).json({
        status: 'error',
        error: error.message
      });
    }
  });
  
  // エラーハンドラー
  app.use(securityMiddleware.errorHandler());
  
  return app;
}

/**
 * CSVプロセッサーとの統合例
 */
function integrateWithCSVProcessor(app, securityManager, securityMiddleware) {
  import { CSVProcessor  } from '../csv-processor';
  
  app.post('/api/csv/upload',
    securityMiddleware.authenticate(),
    securityMiddleware.authorize(['user'], ['csv:upload']),
    securityMiddleware.rateLimit({ max: 10, windowMs: 60000 }),
    async (req, res) => {
      try {
        const { csvData } = req.body;
        
        // CSVデータのサニタイゼーション
        const processor = new CSVProcessor({
          securityManager,
          sanitize: true
        });
        
        const result = await processor.process(csvData);
        
        // 機密データのマスキング
        const maskedResult = securityManager.maskSensitiveData(result);
        
        // 監査ログ
        await securityManager.logSecurityEvent({
          type: 'csv_upload',
          userId: req.user.userId,
          ip: req.ip,
          details: {
            rowCount: result.rowCount,
            columnCount: result.columnCount
          }
        });
        
        res.json(maskedResult);
      } catch (error) {
        console.error('CSV processing error:', error);
        res.status(500).json({ error: 'CSV processing failed' });
      }
    }
  );
}

/**
 * GraphQL APIとの統合例
 */
function integrateWithGraphQL(app, securityManager, securityMiddleware) {
  import { OptimizedShopifyGraphQLClient  } from '../graphql/optimized-client';
  
  app.post('/api/graphql',
    securityMiddleware.authenticate(),
    securityMiddleware.rateLimit({ max: 50, windowMs: 60000 }),
    async (req, res) => {
      try {
        const { query, variables } = req.body;
        
        // GraphQLクエリの検証
        if (!isValidGraphQLQuery(query)) {
          return res.status(400).json({ error: 'Invalid GraphQL query' });
        }
        
        // クライアントの初期化（認証情報付き）
        const client = new OptimizedShopifyGraphQLClient({
          shopDomain: process.env.SHOPIFY_SHOP_DOMAIN,
          accessToken: await securityManager.decrypt(req.user.shopifyToken),
          userContext: req.user
        });
        
        // クエリの実行
        const result = await client.query(query, variables);
        
        // レスポンスの検証とサニタイゼーション
        const sanitizedResult = sanitizeGraphQLResponse(result);
        
        res.json(sanitizedResult);
      } catch (error) {
        console.error('GraphQL error:', error);
        res.status(500).json({ error: 'GraphQL execution failed' });
      }
    }
  );
}

// ユーティリティ関数
async function checkRedisConnection(redis) {
  try {
    await redis.ping();
    return 'connected';
  } catch (_error) {
    return 'disconnected';
  }
}

async function checkRateLimitStatus(securityManager) {
  try {
    const testResult = await securityManager.checkRateLimit('test-key', 'api');
    return testResult.allowed ? 'operational' : 'limited';
  } catch (_error) {
    return 'error';
  }
}

function checkSecurityHeaders(res) {
  const requiredHeaders = [
    'strict-transport-security',
    'x-content-type-options',
    'x-frame-options',
    'x-xss-protection',
    'content-security-policy'
  ];
  
  const presentHeaders = requiredHeaders.filter(header => 
    res.getHeader(header) !== undefined
  );
  
  return {
    required: requiredHeaders.length,
    present: presentHeaders.length,
    missing: requiredHeaders.filter(h => !presentHeaders.includes(h))
  };
}

function isValidGraphQLQuery(query) {
  // 簡単な検証（実際にはより詳細な検証が必要）
  return query && typeof query === 'string' && query.includes('{');
}

function sanitizeGraphQLResponse(response) {
  // レスポンスのサニタイゼーション
  return JSON.parse(JSON.stringify(response, (key, value) => {
    // 機密フィールドの除去
    if (['password', 'token', 'secret'].includes(key)) {
      return '[REDACTED]';
    }
    return value;
  }));
}

// エクスポート
module.exports = {
  createSecureApp,
  integrateWithCSVProcessor,
  integrateWithGraphQL
};

// 直接実行時のデモ
if (require.main === module) {
  const app = createSecureApp();
  
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Secure Shopify MCP Server running on port ${PORT}`);
  });
}