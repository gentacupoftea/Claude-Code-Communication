import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// 基本的なレート制限設定
export const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15分
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // 最大100リクエスト
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true, // `RateLimit-*` ヘッダーを返す
  legacyHeaders: false, // `X-RateLimit-*` ヘッダーを無効化
  keyGenerator: (req: Request) => {
    // IPアドレスとユーザーIDを組み合わせてキーを生成
    const userId = req.user?.id || 'anonymous';
    return `${req.ip}:${userId}`;
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: req.rateLimit?.resetTime
    });
  }
});

// 厳しいレート制限（ファイルアップロード用）
export const strictRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1時間
  max: 10, // 最大10リクエスト
  message: {
    success: false,
    error: 'File upload limit exceeded, please try again later.'
  },
  skipSuccessfulRequests: false
});