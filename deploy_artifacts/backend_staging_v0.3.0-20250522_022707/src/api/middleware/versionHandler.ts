/**
 * APIバージョン管理ミドルウェア
 * 
 * APIのバージョニングと後方互換性を管理します。
 * URLパスからバージョンを抽出し、適切なハンドラにルーティングします。
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';

// リクエストにAPIバージョンを追加する型拡張
declare global {
  namespace Express {
    interface Request {
      apiVersion: number;
      isDeprecatedVersion: boolean;
    }
  }
}

// 環境設定
const CURRENT_API_VERSION = parseInt(process.env.CURRENT_API_VERSION || '1', 10);
const MIN_SUPPORTED_VERSION = parseInt(process.env.MIN_SUPPORTED_VERSION || '1', 10);
const MAX_SUPPORTED_VERSION = parseInt(process.env.MAX_SUPPORTED_VERSION || '2', 10);

// コンフィグ
export interface VersionConfig {
  isDeprecated: boolean;
  deprecationDate?: Date;
  sunsetDate?: Date;
}

// APIバージョン設定マップ
const API_VERSION_CONFIG: Record<number, VersionConfig> = {
  1: {
    isDeprecated: true,
    deprecationDate: new Date('2025-07-15'),
    sunsetDate: new Date('2025-12-31')
  },
  2: {
    isDeprecated: false
  }
};

/**
 * APIバージョン管理ミドルウェア
 * URLパスからバージョンを抽出し、リクエストオブジェクトに追加します
 */
export function apiVersionHandler(req: Request, res: Response, next: NextFunction) {
  // URLパスからバージョンを抽出 (例: /api/v1/users)
  const versionMatch = req.path.match(/\/api\/v(\d+)\//);
  const apiVersion = versionMatch ? parseInt(versionMatch[1], 10) : CURRENT_API_VERSION;
  
  // サポートされていないバージョンのチェック
  if (apiVersion < MIN_SUPPORTED_VERSION) {
    return res.status(410).json({
      error: 'API version too old',
      message: `API version v${apiVersion} is no longer supported. Please upgrade to at least v${MIN_SUPPORTED_VERSION}.`,
      currentVersion: CURRENT_API_VERSION
    });
  }
  
  if (apiVersion > MAX_SUPPORTED_VERSION) {
    return res.status(400).json({
      error: 'API version not supported',
      message: `API version v${apiVersion} is not supported. Maximum supported version is v${MAX_SUPPORTED_VERSION}.`,
      currentVersion: CURRENT_API_VERSION
    });
  }
  
  // バージョン情報をリクエストに追加
  req.apiVersion = apiVersion;
  
  // 非推奨バージョンの処理
  const versionConfig = API_VERSION_CONFIG[apiVersion] || { isDeprecated: false };
  req.isDeprecatedVersion = versionConfig.isDeprecated;
  
  // 非推奨バージョンの警告ヘッダー
  if (versionConfig.isDeprecated) {
    res.setHeader('X-API-Deprecated', 'True');
    res.setHeader('X-API-Recommended-Version', `v${CURRENT_API_VERSION}`);
    
    if (versionConfig.deprecationDate) {
      res.setHeader('X-API-Deprecation-Date', versionConfig.deprecationDate.toISOString());
    }
    
    if (versionConfig.sunsetDate) {
      res.setHeader('X-API-Sunset-Date', versionConfig.sunsetDate.toISOString());
    }
    
    // Sunset ヘッダー (RFC 8594)
    if (versionConfig.sunsetDate) {
      res.setHeader('Sunset', versionConfig.sunsetDate.toUTCString());
    }
    
    // 使用状況ロギング（低頻度）
    if (Math.random() < 0.1) { // 10%の確率でロギング
      logger.info(`Deprecated API v${apiVersion} used: ${req.method} ${req.path}`, {
        apiVersion,
        path: req.path,
        method: req.method,
        userAgent: req.headers['user-agent']
      });
    }
  }
  
  next();
}

/**
 * バージョン別レスポンス変換ミドルウェア
 * 複数バージョンのレスポンス形式をサポートします
 */
export function versionedResponse(req: Request, res: Response, next: NextFunction) {
  // オリジナルのjson関数を保存
  const originalJson = res.json;
  
  // json関数をオーバーライドしてレスポンス形式を変換
  res.json = function(body: any): Response {
    const apiVersion = req.apiVersion || CURRENT_API_VERSION;
    let transformedBody = body;
    
    // バージョンに応じたレスポンス変換
    if (apiVersion === 1 && body && typeof body === 'object') {
      // v1形式への変換（例: ネストされたオブジェクトをフラット化）
      if (body.data && body.meta) {
        transformedBody = {
          ...body.data,
          _meta: body.meta
        };
      }
      
      // v1で存在しなかったフィールドを除外
      if (Array.isArray(transformedBody)) {
        transformedBody = transformedBody.map(item => transformV1Item(item));
      } else {
        transformedBody = transformV1Item(transformedBody);
      }
    }
    
    // 変換されたレスポンスを返す
    return originalJson.call(this, transformedBody);
  };
  
  next();
}

/**
 * v1互換性のためのオブジェクト変換
 */
function transformV1Item(item: any): any {
  if (!item || typeof item !== 'object') {
    return item;
  }
  
  const result = { ...item };
  
  // v1で存在しないフィールドを除外
  const v1IncompatibleFields = ['createdById', 'lastModifiedById', 'version', 'schemaVersion'];
  for (const field of v1IncompatibleFields) {
    if (field in result) {
      delete result[field];
    }
  }
  
  // v1での異なるフィールド名を調整
  if ('createdAt' in result) {
    result.created_at = result.createdAt;
    delete result.createdAt;
  }
  
  if ('updatedAt' in result) {
    result.updated_at = result.updatedAt;
    delete result.updatedAt;
  }
  
  return result;
}