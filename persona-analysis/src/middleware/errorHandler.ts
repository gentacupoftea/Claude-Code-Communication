import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const isOperational = err.isOperational || false;

  // エラーログの記録
  logger.error({
    message: err.message,
    statusCode,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    isOperational
  });

  // 本番環境では詳細なエラー情報を隠す
  const response = {
    success: false,
    error: {
      message: process.env.NODE_ENV === 'production' && !isOperational
        ? 'Internal Server Error'
        : message,
      statusCode
    }
  };

  // 開発環境ではスタックトレースも含める
  if (process.env.NODE_ENV !== 'production') {
    response.error['stack'] = err.stack;
  }

  res.status(statusCode).json(response);
};