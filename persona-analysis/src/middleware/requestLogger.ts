import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const requestId = Math.random().toString(36).substring(7);

  // リクエスト情報をログ
  logger.info({
    type: 'request',
    requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // レスポンスが終了したときにログを記録
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    logger.info({
      type: 'response',
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('content-length')
    });
  });

  next();
};