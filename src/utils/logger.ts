import winston from 'winston';

// ログレベルの定義
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// 環境に応じたログレベルの設定
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'info';
};

// ログフォーマットの定義
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// トランスポートの定義
const transports = [
  // コンソール出力
  new winston.transports.Console(),
  // エラーログファイル
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
  }),
  // 全ログファイル
  new winston.transports.File({ filename: 'logs/all.log' }),
];

// Loggerインスタンスの作成
const logger = winston.createLogger({
  level: level(),
  levels: logLevels,
  format,
  transports,
});

export default logger;