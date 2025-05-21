/**
 * ステージング環境の設定
 */
module.exports = {
  // アプリケーション全般の設定
  app: {
    name: 'Conea',
    version: process.env.REACT_APP_VERSION || 'staging',
    environment: 'staging',
    baseUrl: 'https://staging.conea.example.com',
    apiUrl: process.env.REACT_APP_API_URL || 'https://staging.conea.example.com/api',
    wsUrl: process.env.REACT_APP_WS_URL || 'wss://staging.conea.example.com/ws',
  },
  
  // サーバーの設定
  server: {
    port: parseInt(process.env.PORT, 10) || 8080,
    cors: {
      origin: process.env.CORS_ORIGIN || 'https://staging.conea.example.com',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true
    },
    rateLimiting: {
      windowMs: 15 * 60 * 1000, // 15分
      max: 100, // IPごとの最大リクエスト数
    }
  },
  
  // データベースの設定
  database: {
    mongodb: {
      uri: process.env.MONGO_URI || 'mongodb://mongo:27017/conea',
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }
    },
    redis: {
      url: process.env.REDIS_URL || 'redis://redis:6379',
      options: {
        enableReadyCheck: true,
        maxRetriesPerRequest: 3
      }
    }
  },
  
  // 認証とセキュリティの設定
  auth: {
    jwt: {
      secret: process.env.JWT_SECRET || 'stagingSecretKey123',
      expiresIn: '1d',
      refreshExpiresIn: '7d'
    },
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true
    }
  },
  
  // ロギングの設定
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: 'json',
    directory: '/app/logs',
    maxFiles: 5,
    maxSize: '10m'
  },
  
  // メールの設定（開発環境では実際にメール送信しない）
  mail: {
    enabled: false,
    from: 'noreply@staging.conea.example.com',
    transport: {
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: {
        user: 'user',
        pass: 'password'
      }
    }
  },
  
  // 監視とメトリクスの設定
  monitoring: {
    enabled: true,
    metricsInterval: 30000, // 30秒
    healthEndpoint: '/health'
  },
  
  // 機能フラグの設定
  features: {
    offlineMode: true,
    analyticsAndReports: true,
    userInvitations: true,
    helpCenter: true,
    productTours: true,
    debugMode: true
  }
};