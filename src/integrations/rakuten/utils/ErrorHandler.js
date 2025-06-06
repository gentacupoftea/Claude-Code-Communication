/**
 * Rakuten API Error Handler
 * 楽天APIエラーハンドラー
 */

import { logger  } from '../../../utils/logger';

class ErrorHandler {
  constructor() {
    this.errorCodes = {
      // Authentication errors
      'AUTH_001': {
        message: '認証に失敗しました',
        code: 'AUTHENTICATION_FAILED',
        statusCode: 401,
        shouldRetry: false
      },
      'AUTH_002': {
        message: 'アクセストークンが期限切れです',
        code: 'TOKEN_EXPIRED',
        statusCode: 401,
        shouldRetry: true
      },
      'AUTH_003': {
        message: '権限がありません',
        code: 'INSUFFICIENT_PERMISSIONS',
        statusCode: 403,
        shouldRetry: false
      },
      
      // API errors
      'API_001': {
        message: 'APIキーが無効です',
        code: 'INVALID_API_KEY',
        statusCode: 401,
        shouldRetry: false
      },
      'API_002': {
        message: 'APIリクエストが無効です',
        code: 'INVALID_REQUEST',
        statusCode: 400,
        shouldRetry: false
      },
      'API_003': {
        message: 'APIレート制限に達しました',
        code: 'RATE_LIMIT_EXCEEDED',
        statusCode: 429,
        shouldRetry: true
      },
      
      // Business logic errors
      'ITEM_001': {
        message: '商品が見つかりません',
        code: 'ITEM_NOT_FOUND',
        statusCode: 404,
        shouldRetry: false
      },
      'ITEM_002': {
        message: '在庫が不足しています',
        code: 'INSUFFICIENT_INVENTORY',
        statusCode: 400,
        shouldRetry: false
      },
      'ITEM_003': {
        message: '商品情報が無効です',
        code: 'INVALID_ITEM_DATA',
        statusCode: 400,
        shouldRetry: false
      },
      
      'ORDER_001': {
        message: '注文が見つかりません',
        code: 'ORDER_NOT_FOUND',
        statusCode: 404,
        shouldRetry: false
      },
      'ORDER_002': {
        message: '注文ステータスが無効です',
        code: 'INVALID_ORDER_STATUS',
        statusCode: 400,
        shouldRetry: false
      },
      'ORDER_003': {
        message: '注文がキャンセルされました',
        code: 'ORDER_CANCELLED',
        statusCode: 400,
        shouldRetry: false
      },
      
      // System errors
      'SYS_001': {
        message: 'システムエラーが発生しました',
        code: 'SYSTEM_ERROR',
        statusCode: 500,
        shouldRetry: true
      },
      'SYS_002': {
        message: 'メンテナンス中です',
        code: 'MAINTENANCE',
        statusCode: 503,
        shouldRetry: true
      },
      'SYS_003': {
        message: 'ネットワークエラー',
        code: 'NETWORK_ERROR',
        statusCode: 0,
        shouldRetry: true
      }
    };
  }

  /**
   * Handle API error
   * @param {Error} error - Error object
   * @returns {Object} Handled error
   */
  async handle(error) {
    logger.error('Handling Rakuten API error', error);
    
    // Parse error response
    const errorInfo = this.parseError(error);
    
    // Get error details
    const errorDetails = this.getErrorDetails(errorInfo);
    
    // Log structured error
    logger.error('Rakuten API Error', {
      code: errorDetails.code,
      message: errorDetails.message,
      statusCode: errorDetails.statusCode,
      shouldRetry: errorDetails.shouldRetry,
      originalError: error.message
    });
    
    // Create enhanced error
    const enhancedError = new Error(errorDetails.message);
    enhancedError.code = errorDetails.code;
    enhancedError.statusCode = errorDetails.statusCode;
    enhancedError.shouldRetry = errorDetails.shouldRetry;
    enhancedError.originalError = error;
    
    return enhancedError;
  }

  /**
   * Parse error from response
   * @param {Error} error - Original error
   * @returns {Object} Parsed error info
   */
  parseError(error) {
    const errorInfo = {
      code: 'UNKNOWN_ERROR',
      message: error.message,
      statusCode: 500
    };
    
    // Check if it's an axios error
    if (error.response) {
      errorInfo.statusCode = error.response.status;
      
      // Parse Rakuten error response
      if (error.response.data) {
        const data = error.response.data;
        
        // Check for standard error format
        if (data.error) {
          errorInfo.code = data.error.code || data.error.errorCode;
          errorInfo.message = data.error.message || data.error.errorMessage;
        } else if (data.code) {
          errorInfo.code = data.code;
          errorInfo.message = data.message || data.errorMessage;
        }
      }
      
      // Check for specific status codes
      switch (error.response.status) {
        case 401:
          errorInfo.code = errorInfo.code || 'AUTH_001';
          break;
        case 403:
          errorInfo.code = 'AUTH_003';
          break;
        case 404:
          errorInfo.code = errorInfo.code || 'ITEM_001';
          break;
        case 429:
          errorInfo.code = 'API_003';
          break;
        case 500:
          errorInfo.code = 'SYS_001';
          break;
        case 503:
          errorInfo.code = 'SYS_002';
          break;
      }
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      errorInfo.code = 'SYS_003';
      errorInfo.statusCode = 0;
    }
    
    return errorInfo;
  }

  /**
   * Get error details from code
   * @param {Object} errorInfo - Error information
   * @returns {Object} Error details
   */
  getErrorDetails(errorInfo) {
    const errorCode = errorInfo.code;
    const errorConfig = this.errorCodes[errorCode];
    
    if (errorConfig) {
      return {
        ...errorConfig,
        originalMessage: errorInfo.message
      };
    }
    
    // Default error
    return {
      code: errorCode || 'UNKNOWN_ERROR',
      message: errorInfo.message || '不明なエラーが発生しました',
      statusCode: errorInfo.statusCode || 500,
      shouldRetry: false
    };
  }

  /**
   * Check if error should be retried
   * @param {Error} error - Error object
   * @returns {boolean} Should retry
   */
  shouldRetry(error) {
    if (error.shouldRetry !== undefined) {
      return error.shouldRetry;
    }
    
    // Check status code
    const statusCode = error.statusCode || error.response?.status;
    
    // Retry on specific status codes
    const retryableStatusCodes = [429, 500, 502, 503, 504];
    if (retryableStatusCodes.includes(statusCode)) {
      return true;
    }
    
    // Retry on network errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      return true;
    }
    
    return false;
  }

  /**
   * Format error for user display
   * @param {Error} error - Error object
   * @param {string} locale - Locale code
   * @returns {string} Formatted error message
   */
  formatError(error, locale = 'ja') {
    const messages = {
      ja: {
        AUTH_001: '認証に失敗しました。APIキーを確認してください。',
        AUTH_002: 'アクセストークンが期限切れです。再度ログインしてください。',
        API_003: 'APIリクエスト制限に達しました。しばらく待ってから再試行してください。',
        ITEM_001: '指定された商品が見つかりません。',
        ORDER_001: '指定された注文が見つかりません。',
        SYS_001: 'システムエラーが発生しました。管理者にお問い合わせください。',
        UNKNOWN_ERROR: 'エラーが発生しました。しばらく待ってから再試行してください。'
      },
      en: {
        AUTH_001: 'Authentication failed. Please check your API key.',
        AUTH_002: 'Access token has expired. Please login again.',
        API_003: 'API rate limit exceeded. Please try again later.',
        ITEM_001: 'The specified item was not found.',
        ORDER_001: 'The specified order was not found.',
        SYS_001: 'A system error occurred. Please contact support.',
        UNKNOWN_ERROR: 'An error occurred. Please try again later.'
      }
    };
    
    const localeMessages = messages[locale] || messages.en;
    const errorCode = error.code || 'UNKNOWN_ERROR';
    
    return localeMessages[errorCode] || localeMessages.UNKNOWN_ERROR;
  }

  /**
   * Get retry delay based on error
   * @param {Error} error - Error object
   * @param {number} attempt - Current attempt number
   * @returns {number} Retry delay in milliseconds
   */
  getRetryDelay(error, attempt = 1) {
    // Check for Retry-After header
    if (error.response?.headers?.['retry-after']) {
      const retryAfter = error.response.headers['retry-after'];
      return parseInt(retryAfter) * 1000;
    }
    
    // Rate limit errors - longer delay
    if (error.code === 'API_003' || error.statusCode === 429) {
      return Math.min(60000, attempt * 10000); // Max 60 seconds
    }
    
    // System errors - exponential backoff
    if (error.code?.startsWith('SYS_') || error.statusCode >= 500) {
      return Math.min(30000, Math.pow(2, attempt) * 1000); // Max 30 seconds
    }
    
    // Default exponential backoff
    return Math.min(10000, Math.pow(2, attempt) * 500); // Max 10 seconds
  }
}

module.exports = ErrorHandler;
