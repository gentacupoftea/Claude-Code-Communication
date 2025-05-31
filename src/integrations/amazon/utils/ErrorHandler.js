/**
 * Amazon SP-API Error Handler
 * Amazon APIエラーハンドラー
 */

const { logger } = require('../../../utils/logger');

class ErrorHandler {
  constructor() {
    this.errorCodes = {
      // Authentication errors
      'Unauthorized': {
        message: '認証に失敗しました',
        code: 'AUTHENTICATION_FAILED',
        statusCode: 401,
        shouldRetry: false
      },
      'AccessDenied': {
        message: 'アクセスが拒否されました',
        code: 'ACCESS_DENIED',
        statusCode: 403,
        shouldRetry: false
      },
      'InvalidUserInput': {
        message: '無効な入力データです',
        code: 'INVALID_INPUT',
        statusCode: 400,
        shouldRetry: false
      },
      'NotFound': {
        message: 'リソースが見つかりません',
        code: 'RESOURCE_NOT_FOUND',
        statusCode: 404,
        shouldRetry: false
      },
      'TooManyRequests': {
        message: 'リクエスト数が多すぎます',
        code: 'RATE_LIMIT_EXCEEDED',
        statusCode: 429,
        shouldRetry: true
      },
      'InternalServerError': {
        message: 'サーバーエラーが発生しました',
        code: 'SERVER_ERROR',
        statusCode: 500,
        shouldRetry: true
      },
      'ServiceUnavailable': {
        message: 'サービスが利用できません',
        code: 'SERVICE_UNAVAILABLE',
        statusCode: 503,
        shouldRetry: true
      },
      
      // Business logic errors
      'InvalidOrderId': {
        message: '無効な注文IDです',
        code: 'INVALID_ORDER_ID',
        statusCode: 400,
        shouldRetry: false
      },
      'InvalidASIN': {
        message: '無効なASINです',
        code: 'INVALID_ASIN',
        statusCode: 400,
        shouldRetry: false
      },
      'InventoryNotAvailable': {
        message: '在庫がありません',
        code: 'INVENTORY_NOT_AVAILABLE',
        statusCode: 409,
        shouldRetry: false
      },
      'QuotaExceeded': {
        message: 'API使用量が制限を超えました',
        code: 'QUOTA_EXCEEDED',
        statusCode: 429,
        shouldRetry: true
      },
      
      // Report errors
      'ReportNotReady': {
        message: 'レポートがまだ準備できていません',
        code: 'REPORT_NOT_READY',
        statusCode: 202,
        shouldRetry: true
      },
      'ReportProcessingFailed': {
        message: 'レポート処理が失敗しました',
        code: 'REPORT_PROCESSING_FAILED',
        statusCode: 400,
        shouldRetry: false
      },
      
      // Network errors
      'NetworkError': {
        message: 'ネットワークエラー',
        code: 'NETWORK_ERROR',
        statusCode: 0,
        shouldRetry: true
      },
      'Timeout': {
        message: 'リクエストタイムアウト',
        code: 'TIMEOUT',
        statusCode: 408,
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
    logger.error('Handling Amazon API error', error);
    
    // Parse error response
    const errorInfo = this.parseError(error);
    
    // Get error details
    const errorDetails = this.getErrorDetails(errorInfo);
    
    // Log structured error
    logger.error('Amazon API Error', {
      code: errorDetails.code,
      message: errorDetails.message,
      statusCode: errorDetails.statusCode,
      shouldRetry: errorDetails.shouldRetry,
      originalError: error.message,
      requestId: errorInfo.requestId
    });
    
    // Create enhanced error
    const enhancedError = new Error(errorDetails.message);
    enhancedError.code = errorDetails.code;
    enhancedError.statusCode = errorDetails.statusCode;
    enhancedError.shouldRetry = errorDetails.shouldRetry;
    enhancedError.originalError = error;
    enhancedError.requestId = errorInfo.requestId;
    
    // Add retry information
    if (errorDetails.shouldRetry) {
      enhancedError.retryDelay = this.getRetryDelay(error, errorInfo);
    }
    
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
      statusCode: 500,
      requestId: null
    };
    
    // Check if it's an axios error
    if (error.response) {
      errorInfo.statusCode = error.response.status;
      errorInfo.requestId = error.response.headers['x-amzn-requestid'];
      
      // Parse Amazon error response
      if (error.response.data) {
        const data = error.response.data;
        
        // Check for standard error format
        if (data.errors && Array.isArray(data.errors)) {
          const firstError = data.errors[0];
          errorInfo.code = firstError.code;
          errorInfo.message = firstError.message;
          errorInfo.details = firstError.details;
        } else if (data.code) {
          errorInfo.code = data.code;
          errorInfo.message = data.message || data.error_description;
        }
      }
      
      // Extract specific error types from headers
      const errorType = error.response.headers['x-amzn-errortype'];
      if (errorType) {
        errorInfo.code = errorType.split(':')[0];
      }
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      errorInfo.code = 'NetworkError';
      errorInfo.statusCode = 0;
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      errorInfo.code = 'Timeout';
      errorInfo.statusCode = 408;
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
        originalMessage: errorInfo.message,
        details: errorInfo.details
      };
    }
    
    // Map HTTP status codes to error types
    const statusCodeMap = {
      400: 'InvalidUserInput',
      401: 'Unauthorized',
      403: 'AccessDenied',
      404: 'NotFound',
      429: 'TooManyRequests',
      500: 'InternalServerError',
      503: 'ServiceUnavailable'
    };
    
    const mappedCode = statusCodeMap[errorInfo.statusCode];
    if (mappedCode && this.errorCodes[mappedCode]) {
      return {
        ...this.errorCodes[mappedCode],
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
   * Get retry delay based on error
   * @param {Error} error - Error object
   * @param {Object} errorInfo - Error information
   * @returns {number} Retry delay in milliseconds
   */
  getRetryDelay(error, errorInfo) {
    // Check for Retry-After header
    if (error.response?.headers?.['retry-after']) {
      const retryAfter = error.response.headers['retry-after'];
      
      // If it's a number, it's seconds
      if (!isNaN(retryAfter)) {
        return parseInt(retryAfter) * 1000;
      }
      
      // If it's a date, calculate delay
      const retryDate = new Date(retryAfter);
      if (!isNaN(retryDate.getTime())) {
        return Math.max(0, retryDate.getTime() - Date.now());
      }
    }
    
    // Check for rate limit headers
    if (error.response?.headers?.['x-amzn-ratelimit-limit']) {
      const reset = error.response.headers['x-amzn-ratelimit-reset'];
      if (reset) {
        const resetTime = new Date(reset).getTime();
        return Math.max(1000, resetTime - Date.now());
      }
    }
    
    // Use exponential backoff for rate limits
    if (errorInfo.code === 'TooManyRequests' || errorInfo.statusCode === 429) {
      return this.calculateExponentialBackoff(error._retryCount || 0, 60000); // Max 60 seconds
    }
    
    // Default delays based on error type
    const defaultDelays = {
      'SERVICE_UNAVAILABLE': 5000,
      'SERVER_ERROR': 3000,
      'NETWORK_ERROR': 2000,
      'TIMEOUT': 1000
    };
    
    return defaultDelays[errorInfo.code] || 1000;
  }

  /**
   * Calculate exponential backoff
   * @param {number} retryCount - Number of retries
   * @param {number} maxDelay - Maximum delay in milliseconds
   * @returns {number} Delay in milliseconds
   */
  calculateExponentialBackoff(retryCount, maxDelay = 30000) {
    const baseDelay = 1000; // 1 second
    const delay = baseDelay * Math.pow(2, retryCount);
    const jitter = Math.random() * 1000; // Add jitter
    
    return Math.min(delay + jitter, maxDelay);
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
        AUTHENTICATION_FAILED: '認証に失敗しました。APIキーとシークレットを確認してください。',
        ACCESS_DENIED: 'アクセスが拒否されました。権限を確認してください。',
        RATE_LIMIT_EXCEEDED: 'API利用制限に達しました。しばらく待ってから再試行してください。',
        INVALID_ASIN: '無効なASINです。商品IDを確認してください。',
        INVALID_ORDER_ID: '無効な注文IDです。注文番号を確認してください。',
        RESOURCE_NOT_FOUND: '指定されたリソースが見つかりません。',
        SERVER_ERROR: 'サーバーエラーが発生しました。しばらく待ってから再試行してください。',
        NETWORK_ERROR: 'ネットワーク接続に問題があります。接続を確認してください。',
        UNKNOWN_ERROR: 'エラーが発生しました。詳細はログを確認してください。'
      },
      en: {
        AUTHENTICATION_FAILED: 'Authentication failed. Please check your API credentials.',
        ACCESS_DENIED: 'Access denied. Please check your permissions.',
        RATE_LIMIT_EXCEEDED: 'API rate limit exceeded. Please try again later.',
        INVALID_ASIN: 'Invalid ASIN. Please check the product ID.',
        INVALID_ORDER_ID: 'Invalid order ID. Please check the order number.',
        RESOURCE_NOT_FOUND: 'The specified resource was not found.',
        SERVER_ERROR: 'A server error occurred. Please try again later.',
        NETWORK_ERROR: 'Network connection issue. Please check your connection.',
        UNKNOWN_ERROR: 'An error occurred. Please check the logs for details.'
      }
    };
    
    const localeMessages = messages[locale] || messages.en;
    const errorCode = error.code || 'UNKNOWN_ERROR';
    
    return localeMessages[errorCode] || localeMessages.UNKNOWN_ERROR;
  }

  /**
   * Create error response for API
   * @param {Error} error - Error object
   * @returns {Object} Error response
   */
  createErrorResponse(error) {
    const response = {
      error: {
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message,
        statusCode: error.statusCode || 500,
        requestId: error.requestId,
        timestamp: new Date().toISOString()
      }
    };
    
    // Add details in development mode
    if (process.env.NODE_ENV === 'development') {
      response.error.stack = error.stack;
      response.error.originalError = error.originalError?.message;
    }
    
    return response;
  }

  /**
   * Log error to monitoring service
   * @param {Error} error - Error object
   * @param {Object} context - Error context
   */
  async logToMonitoring(error, context = {}) {
    const errorLog = {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      requestId: error.requestId,
      context,
      timestamp: new Date().toISOString(),
      stack: error.stack
    };
    
    // Log to monitoring service (CloudWatch, Datadog, etc.)
    logger.error('Amazon API Error Log', errorLog);
    
    // Here you would typically send to your monitoring service
    // e.g., await cloudwatch.putMetricData(...);
  }
}

module.exports = ErrorHandler;