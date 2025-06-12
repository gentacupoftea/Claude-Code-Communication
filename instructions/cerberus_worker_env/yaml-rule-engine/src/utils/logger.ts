/**
 * ロガーユーティリティ
 * Winston を使用した構造化ログ
 */

import winston from 'winston';
import path from 'path';

const logDir = process.env.LOG_DIR || path.join(process.cwd(), 'logs');

// カスタムフォーマット
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    
    // メタデータがある場合は整形
    const metaStr = Object.keys(meta).length > 0 ? 
      `\n${JSON.stringify(meta, null, 2)}` : '';
    
    return `${timestamp} [${level.toUpperCase()}] ${message}${metaStr}`;
  })
);

// ログレベルの定義
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6
};

// 環境に応じたログレベル
const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// トランスポートの設定
const transports: winston.transport[] = [
  // コンソール出力
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      customFormat
    )
  })
];

// 本番環境ではファイル出力も追加
if (process.env.NODE_ENV === 'production') {
  transports.push(
    // エラーログ
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    // 全体ログ
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      tailable: true
    })
  );
}

// ロガーインスタンスの作成
export const logger = winston.createLogger({
  level,
  levels,
  format: customFormat,
  transports,
  exitOnError: false
});

// エラーハンドリング
logger.on('error', (err) => {
  console.error('Logger error:', err);
});

// ヘルパー関数
export const logPerformance = (operation: string, duration: number, metadata?: any) => {
  logger.info(`Performance: ${operation}`, {
    duration: `${duration}ms`,
    ...metadata
  });
};

export const logError = (error: Error, context?: any) => {
  logger.error(error.message, {
    stack: error.stack,
    name: error.name,
    ...context
  });
};

// リクエストロガー
export const requestLogger = (req: any, res: any, duration: number) => {
  const level = res.statusCode >= 400 ? 'error' : 'info';
  
  logger.log(level, 'HTTP Request', {
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    duration: `${duration}ms`,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
};

// 起動時のログ
logger.info('Logger initialized', {
  level,
  environment: process.env.NODE_ENV || 'development',
  logDir: process.env.NODE_ENV === 'production' ? logDir : 'console only'
});