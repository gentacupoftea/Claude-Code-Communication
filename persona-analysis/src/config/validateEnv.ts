import { logger } from '../utils/logger';

interface RequiredEnvVars {
  [key: string]: {
    required: boolean;
    type: 'string' | 'number' | 'boolean';
    default?: any;
  };
}

const requiredEnvVars: RequiredEnvVars = {
  NODE_ENV: {
    required: false,
    type: 'string',
    default: 'development'
  },
  PORT: {
    required: false,
    type: 'number',
    default: 8002
  },
  REDIS_URL: {
    required: true,
    type: 'string'
  },
  OPENAI_API_KEY: {
    required: true,
    type: 'string'
  },
  ANTHROPIC_API_KEY: {
    required: true,
    type: 'string'
  },
  FRONTEND_URL: {
    required: false,
    type: 'string',
    default: 'http://localhost:3000'
  },
  LOG_LEVEL: {
    required: false,
    type: 'string',
    default: 'info'
  },
  MAX_FILE_SIZE: {
    required: false,
    type: 'number',
    default: 524288000 // 500MB
  },
  RATE_LIMIT_WINDOW_MS: {
    required: false,
    type: 'number',
    default: 900000 // 15分
  },
  RATE_LIMIT_MAX_REQUESTS: {
    required: false,
    type: 'number',
    default: 100
  }
};

export const validateEnv = (): void => {
  const missingVars: string[] = [];
  const invalidVars: string[] = [];

  for (const [key, config] of Object.entries(requiredEnvVars)) {
    const value = process.env[key];

    // 必須チェック
    if (config.required && !value) {
      missingVars.push(key);
      continue;
    }

    // デフォルト値の設定
    if (!value && config.default !== undefined) {
      process.env[key] = String(config.default);
      continue;
    }

    // 型チェック
    if (value) {
      switch (config.type) {
        case 'number':
          if (isNaN(Number(value))) {
            invalidVars.push(`${key} must be a number`);
          }
          break;
        case 'boolean':
          if (value !== 'true' && value !== 'false') {
            invalidVars.push(`${key} must be 'true' or 'false'`);
          }
          break;
      }
    }
  }

  // エラーがある場合は終了
  if (missingVars.length > 0 || invalidVars.length > 0) {
    if (missingVars.length > 0) {
      logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
    if (invalidVars.length > 0) {
      logger.error(`Invalid environment variables: ${invalidVars.join(', ')}`);
    }
    
    // 開発環境では警告のみ、本番環境ではエラーで終了
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      logger.warn('Running in development mode with missing/invalid environment variables');
    }
  }

  logger.info('Environment variables validated successfully');
};