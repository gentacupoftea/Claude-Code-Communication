"use strict";
/**
 * ロガーユーティリティ
 * Winston を使用した構造化ログ
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = exports.logError = exports.logPerformance = exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const logDir = process.env.LOG_DIR || path_1.default.join(process.cwd(), 'logs');
// カスタムフォーマット
const customFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
}), winston_1.default.format.errors({ stack: true }), winston_1.default.format.splat(), winston_1.default.format.json(), winston_1.default.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    // メタデータがある場合は整形
    const metaStr = Object.keys(meta).length > 0 ?
        `\n${JSON.stringify(meta, null, 2)}` : '';
    return `${timestamp} [${level.toUpperCase()}] ${message}${metaStr}`;
}));
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
const transports = [
    // コンソール出力
    new winston_1.default.transports.Console({
        format: winston_1.default.format.combine(winston_1.default.format.colorize(), customFormat)
    })
];
// 本番環境ではファイル出力も追加
if (process.env.NODE_ENV === 'production') {
    transports.push(
    // エラーログ
    new winston_1.default.transports.File({
        filename: path_1.default.join(logDir, 'error.log'),
        level: 'error',
        maxsize: 10485760, // 10MB
        maxFiles: 5,
        tailable: true
    }), 
    // 全体ログ
    new winston_1.default.transports.File({
        filename: path_1.default.join(logDir, 'combined.log'),
        maxsize: 10485760, // 10MB
        maxFiles: 10,
        tailable: true
    }));
}
// ロガーインスタンスの作成
exports.logger = winston_1.default.createLogger({
    level,
    levels,
    format: customFormat,
    transports,
    exitOnError: false
});
// エラーハンドリング
exports.logger.on('error', (err) => {
    console.error('Logger error:', err);
});
// ヘルパー関数
const logPerformance = (operation, duration, metadata) => {
    exports.logger.info(`Performance: ${operation}`, {
        duration: `${duration}ms`,
        ...metadata
    });
};
exports.logPerformance = logPerformance;
const logError = (error, context) => {
    exports.logger.error(error.message, {
        stack: error.stack,
        name: error.name,
        ...context
    });
};
exports.logError = logError;
// リクエストロガー
const requestLogger = (req, res, duration) => {
    const level = res.statusCode >= 400 ? 'error' : 'info';
    exports.logger.log(level, 'HTTP Request', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get('user-agent')
    });
};
exports.requestLogger = requestLogger;
// 起動時のログ
exports.logger.info('Logger initialized', {
    level,
    environment: process.env.NODE_ENV || 'development',
    logDir: process.env.NODE_ENV === 'production' ? logDir : 'console only'
});
