/**
 * 環境変数検証システム
 * 本番環境での設定ミスを防ぐためのバリデーション
 */

// 必須環境変数の定義
const REQUIRED_ENV_VARS = {
  development: [
    'NODE_ENV',
    'PORT'
  ],
  production: [
    'NODE_ENV',
    'PORT',
    'JWT_SECRET',
    'CORS_ORIGIN'
  ],
  staging: [
    'NODE_ENV',
    'PORT',
    'JWT_SECRET'
  ]
};

// 環境変数のパターン検証
const ENV_PATTERNS = {
  PORT: /^\d{3,5}$/,
  NODE_ENV: /^(development|production|staging|test)$/,
  JWT_SECRET: /^.{32,}$/, // 最低32文字
  ANTHROPIC_API_KEY: /^sk-ant-/,
  OPENAI_API_KEY: /^sk-/,
  GOOGLE_API_KEY: /^[A-Za-z0-9_-]{39}$/,
  REDIS_URL: /^redis(s)?:\/\/.+/,
  DATABASE_URL: /^postgres(ql)?:\/\/.+/,
  SHOPIFY_API_KEY: /^[a-f0-9]{32}$/,
  SHOPIFY_ACCESS_TOKEN: /^shpat_[a-f0-9]{32}$/
};

// セキュリティ警告が必要な値
const SECURITY_WARNINGS = {
  JWT_SECRET: ['your_jwt_secret_here', 'secret', 'change-this'],
  ANTHROPIC_API_KEY: ['your_anthropic_api_key_here'],
  OPENAI_API_KEY: ['your_openai_api_key_here'],
  CORS_ORIGIN: ['*']
};

/**
 * 環境変数を検証する
 * @param {string} environment - 実行環境 (development, production, staging)
 * @returns {Object} 検証結果
 */
function validateEnvironment(environment = process.env.NODE_ENV || 'development') {
  const results = {
    valid: true,
    errors: [],
    warnings: [],
    missing: [],
    invalid: []
  };

  const requiredVars = REQUIRED_ENV_VARS[environment] || REQUIRED_ENV_VARS.development;
  
  // 必須環境変数のチェック
  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      results.missing.push(varName);
      results.errors.push(`Missing required environment variable: ${varName}`);
      results.valid = false;
    }
  });

  // パターン検証
  Object.entries(ENV_PATTERNS).forEach(([varName, pattern]) => {
    const value = process.env[varName];
    if (value && !pattern.test(value)) {
      results.invalid.push(varName);
      results.errors.push(`Invalid format for ${varName}`);
      results.valid = false;
    }
  });

  // セキュリティ警告チェック
  Object.entries(SECURITY_WARNINGS).forEach(([varName, dangerousValues]) => {
    const value = process.env[varName];
    if (value && dangerousValues.includes(value)) {
      results.warnings.push(`Security warning: ${varName} contains a default/insecure value`);
      if (environment === 'production') {
        results.errors.push(`Production security error: ${varName} must not use default value`);
        results.valid = false;
      }
    }
  });

  // 本番環境固有のチェック
  if (environment === 'production') {
    // HTTPSの確認
    if (process.env.CORS_ORIGIN && process.env.CORS_ORIGIN.startsWith('http://')) {
      results.warnings.push('Production warning: CORS_ORIGIN should use HTTPS');
    }

    // Redis URL の確認
    if (process.env.REDIS_URL && !process.env.REDIS_URL.startsWith('rediss://')) {
      results.warnings.push('Production warning: Redis connection should use SSL (rediss://)');
    }
  }

  return results;
}

/**
 * 環境変数検証を実行し、結果をログ出力
 */
function validateAndLog() {
  const environment = process.env.NODE_ENV || 'development';
  const results = validateEnvironment(environment);
  
  console.log(`🔍 Environment validation for: ${environment}`);
  
  if (results.valid) {
    console.log('✅ All environment variables are valid');
  } else {
    console.log('❌ Environment validation failed');
    results.errors.forEach(error => console.error(`  ❌ ${error}`));
  }
  
  if (results.warnings.length > 0) {
    console.log('⚠️  Warnings:');
    results.warnings.forEach(warning => console.warn(`  ⚠️  ${warning}`));
  }
  
  return results;
}

/**
 * 環境変数の健全性をチェック
 */
function getEnvironmentHealth() {
  const results = validateEnvironment();
  
  return {
    status: results.valid ? 'healthy' : 'unhealthy',
    environment: process.env.NODE_ENV || 'development',
    missingVariables: results.missing.length,
    invalidVariables: results.invalid.length,
    warnings: results.warnings.length,
    details: {
      missing: results.missing,
      invalid: results.invalid,
      warnings: results.warnings
    }
  };
}

module.exports = {
  validateEnvironment,
  validateAndLog,
  getEnvironmentHealth,
  REQUIRED_ENV_VARS,
  ENV_PATTERNS
};