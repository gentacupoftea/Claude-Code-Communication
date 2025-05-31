import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import { logger } from '../utils/logger';

// リクエストにユーザー情報を追加するための型定義
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

export const authenticateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // 認証トークンの取得
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'] as string;

    if (!authHeader && !apiKey) {
      throw new AppError('Authentication required', 401);
    }

    // Bearer トークンの検証
    if (authHeader) {
      const [scheme, token] = authHeader.split(' ');
      
      if (scheme !== 'Bearer' || !token) {
        throw new AppError('Invalid authentication format', 401);
      }

      // 本番環境では JWT トークンの検証を実装
      // ここでは開発用の簡易実装
      if (process.env.NODE_ENV === 'development') {
        req.user = {
          id: 'test-user',
          email: 'test@example.com',
          role: 'user'
        };
      } else {
        // JWTトークンの検証
        // const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // req.user = decoded;
        throw new AppError('JWT verification not implemented', 501);
      }
    }

    // API キーの検証
    if (apiKey) {
      // 本番環境では API キーの検証を実装
      if (process.env.NODE_ENV === 'development') {
        req.user = {
          id: 'api-user',
          email: 'api@example.com',
          role: 'api'
        };
      } else {
        // API キーの検証
        throw new AppError('API key verification not implemented', 501);
      }
    }

    logger.info(`Authenticated user: ${req.user?.id}`);
    next();
  } catch (error) {
    next(error);
  }
};

// 管理者権限チェック
export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user || req.user.role !== 'admin') {
    return next(new AppError('Admin access required', 403));
  }
  next();
};

// レート制限（ユーザーごと）
export const userRateLimit = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // ユーザーごとのレート制限を実装
  // Redis を使って実装することを推奨
  next();
};