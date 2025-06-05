// Simple logger implementation (winston dependency temporarily removed)
// TODO: Re-add winston dependency and restore full logging functionality

// ログレベルの定義
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
} as const;

// 環境に応じたログレベルの設定
const getLevel = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'info';
};

// 簡易ロガー実装
const createSimpleLogger = () => {
  const currentLevel = getLevel();
  const currentLevelValue = logLevels[currentLevel as keyof typeof logLevels];

  const shouldLog = (level: keyof typeof logLevels) => {
    return logLevels[level] <= currentLevelValue;
  };

  return {
    error: (message: string, meta?: any) => {
      if (shouldLog('error')) {
        console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, meta || '');
      }
    },
    warn: (message: string, meta?: any) => {
      if (shouldLog('warn')) {
        console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, meta || '');
      }
    },
    info: (message: string, meta?: any) => {
      if (shouldLog('info')) {
        console.info(`[INFO] ${new Date().toISOString()} - ${message}`, meta || '');
      }
    },
    debug: (message: string, meta?: any) => {
      if (shouldLog('debug')) {
        console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, meta || '');
      }
    },
    http: (message: string, meta?: any) => {
      if (shouldLog('http')) {
        console.log(`[HTTP] ${new Date().toISOString()} - ${message}`, meta || '');
      }
    }
  };
};

// Loggerインスタンスの作成
const logger = createSimpleLogger();

export default logger;
export { logger };