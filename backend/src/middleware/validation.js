/**
 * 入力値検証ミドルウェア
 * XSS攻撃、SQLインジェクション、その他の悪意ある入力から保護
 */

const validator = require('validator');
const DOMPurify = require('isomorphic-dompurify');

// 危険なパターンの定義
const DANGEROUS_PATTERNS = {
  // XSS攻撃パターン
  xss: [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe[^>]*>/gi,
    /<object[^>]*>/gi,
    /<embed[^>]*>/gi,
    /<applet[^>]*>/gi,
    /<meta[^>]*>/gi,
    /expression\s*\(/gi,
    /vbscript:/gi,
    /data:text\/html/gi
  ],
  
  // SQLインジェクションパターン
  sql: [
    /(\bUNION\b.*\bSELECT\b)|(\bSELECT\b.*\bFROM\b)|(\bINSERT\b.*\bINTO\b)|(\bUPDATE\b.*\bSET\b)|(\bDELETE\b.*\bFROM\b)|(\bDROP\b.*\bTABLE\b)|(\bCREATE\b.*\bTABLE\b)|(\bALTER\b.*\bTABLE\b)/gi,
    /('|(\\'))+.*(--|\#)/gi,
    /(\b(OR|AND)\b\s+\b\d+\s*=\s*\d+)|(\b(OR|AND)\b\s+['"][^'"]*['"])/gi
  ],
  
  // NoSQLインジェクションパターン
  nosql: [
    /\$where/gi,
    /\$ne/gi,
    /\$gt/gi,
    /\$lt/gi,
    /\$regex/gi,
    /\$or/gi,
    /\$and/gi
  ],
  
  // パストラバーサル攻撃
  pathTraversal: [
    /\.\.\//g,
    /\.\.\\/g,
    /%2e%2e%2f/gi,
    /%2e%2e%5c/gi,
    /\.\.%2f/gi,
    /\.\.%5c/gi
  ],
  
  // LDAPインジェクション
  ldap: [
    /\*|\(|\)|\\|\/|\||&/g
  ]
};

// 許可される文字セット
const ALLOWED_PATTERNS = {
  // 基本的なテキスト（日本語含む）
  text: /^[\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3000-\u303F.,!?;:\-'"\(\)]+$/,
  
  // 英数字のみ
  alphanumeric: /^[a-zA-Z0-9]+$/,
  
  // メールアドレス
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  
  // URL
  url: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
  
  // APIキー形式
  apiKey: /^[a-zA-Z0-9_-]{16,128}$/,
  
  // JSON文字列
  json: /^[\{\[].*[\}\]]$/,
  
  // ファイル名
  filename: /^[a-zA-Z0-9._-]+\.(jpg|jpeg|png|gif|pdf|doc|docx|txt|csv|json|xml)$/i,
  
  // 数値
  number: /^\d+(\.\d+)?$/,
  
  // UUID
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
};

/**
 * 危険なパターンをチェック
 */
function checkDangerousPatterns(input, type = 'all') {
  if (typeof input !== 'string') return [];
  
  const threats = [];
  const patternsToCheck = type === 'all' ? Object.keys(DANGEROUS_PATTERNS) : [type];
  
  patternsToCheck.forEach(patternType => {
    const patterns = DANGEROUS_PATTERNS[patternType];
    patterns.forEach(pattern => {
      if (pattern.test(input)) {
        threats.push({
          type: patternType,
          pattern: pattern.toString(),
          detected: true
        });
      }
    });
  });
  
  return threats;
}

/**
 * HTMLを安全化
 */
function sanitizeHtml(input) {
  if (typeof input !== 'string') return input;
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true
  });
}

/**
 * 文字列をエスケープ
 */
function escapeString(input) {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * 深度のあるオブジェクトを検証
 */
function validateObjectRecursive(obj, maxDepth = 10, currentDepth = 0) {
  if (currentDepth > maxDepth) {
    throw new Error('Object depth exceeded maximum allowed depth');
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => validateObjectRecursive(item, maxDepth, currentDepth + 1));
  }
  
  if (obj && typeof obj === 'object') {
    const validated = {};
    Object.keys(obj).forEach(key => {
      // キー名の検証
      const keyThreats = checkDangerousPatterns(key);
      if (keyThreats.length > 0) {
        throw new Error(`Dangerous pattern detected in object key: ${key}`);
      }
      
      validated[key] = validateObjectRecursive(obj[key], maxDepth, currentDepth + 1);
    });
    return validated;
  }
  
  if (typeof obj === 'string') {
    // 文字列の脅威チェック
    const threats = checkDangerousPatterns(obj);
    if (threats.length > 0) {
      console.warn('Potentially dangerous input detected and sanitized:', threats);
      return sanitizeHtml(obj);
    }
    return obj;
  }
  
  return obj;
}

/**
 * 基本的な入力検証ミドルウェア
 */
function basicValidation(req, res, next) {
  try {
    // Content-Typeチェック
    const contentType = req.get('Content-Type');
    if (contentType && !contentType.startsWith('application/json') && 
        !contentType.startsWith('multipart/form-data') && 
        !contentType.startsWith('application/x-www-form-urlencoded')) {
      return res.status(400).json({
        error: 'Invalid Content-Type',
        message: 'Only JSON, form-data, and URL-encoded content types are allowed'
      });
    }
    
    // リクエストサイズチェック
    const contentLength = parseInt(req.get('Content-Length') || '0');
    if (contentLength > 10 * 1024 * 1024) { // 10MB制限
      return res.status(413).json({
        error: 'Request entity too large',
        message: 'Request size exceeds maximum allowed size'
      });
    }
    
    // ボディの検証（存在する場合）
    if (req.body && Object.keys(req.body).length > 0) {
      req.body = validateObjectRecursive(req.body);
    }
    
    // クエリパラメータの検証
    if (req.query && Object.keys(req.query).length > 0) {
      Object.keys(req.query).forEach(key => {
        const threats = checkDangerousPatterns(req.query[key]);
        if (threats.length > 0) {
          return res.status(400).json({
            error: 'Invalid query parameter',
            message: `Potentially dangerous content detected in parameter: ${key}`,
            threats: threats
          });
        }
      });
    }
    
    // パスパラメータの検証
    if (req.params && Object.keys(req.params).length > 0) {
      Object.keys(req.params).forEach(key => {
        const threats = checkDangerousPatterns(req.params[key]);
        if (threats.length > 0) {
          return res.status(400).json({
            error: 'Invalid path parameter',
            message: `Potentially dangerous content detected in parameter: ${key}`,
            threats: threats
          });
        }
      });
    }
    
    next();
  } catch (error) {
    console.error('Validation error:', error);
    return res.status(400).json({
      error: 'Validation failed',
      message: error.message
    });
  }
}

/**
 * 特定フィールドの検証
 */
function validateField(fieldName, pattern, required = false) {
  return (req, res, next) => {
    const value = req.body[fieldName];
    
    if (required && !value) {
      return res.status(400).json({
        error: 'Missing required field',
        field: fieldName
      });
    }
    
    if (value && !ALLOWED_PATTERNS[pattern].test(value)) {
      return res.status(400).json({
        error: 'Invalid field format',
        field: fieldName,
        pattern: pattern
      });
    }
    
    next();
  };
}

/**
 * メール検証
 */
function validateEmail(fieldName = 'email', required = true) {
  return (req, res, next) => {
    const email = req.body[fieldName];
    
    if (required && !email) {
      return res.status(400).json({
        error: 'Email is required',
        field: fieldName
      });
    }
    
    if (email && !validator.isEmail(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
        field: fieldName
      });
    }
    
    next();
  };
}

/**
 * JSON検証
 */
function validateJSON(fieldName = 'data', required = false) {
  return (req, res, next) => {
    const jsonString = req.body[fieldName];
    
    if (required && !jsonString) {
      return res.status(400).json({
        error: 'JSON data is required',
        field: fieldName
      });
    }
    
    if (jsonString) {
      try {
        JSON.parse(jsonString);
      } catch (error) {
        return res.status(400).json({
          error: 'Invalid JSON format',
          field: fieldName,
          details: error.message
        });
      }
    }
    
    next();
  };
}

/**
 * APIキー検証
 */
function validateApiKey(fieldName = 'apiKey', required = false) {
  return (req, res, next) => {
    const apiKey = req.body[fieldName];
    
    if (required && !apiKey) {
      return res.status(400).json({
        error: 'API key is required',
        field: fieldName
      });
    }
    
    if (apiKey) {
      const threats = checkDangerousPatterns(apiKey);
      if (threats.length > 0) {
        return res.status(400).json({
          error: 'Invalid API key format',
          field: fieldName,
          message: 'API key contains potentially dangerous characters'
        });
      }
    }
    
    next();
  };
}

/**
 * 配列の長さ制限
 */
function limitArrayLength(fieldName, maxLength = 100) {
  return (req, res, next) => {
    const array = req.body[fieldName];
    
    if (array && Array.isArray(array) && array.length > maxLength) {
      return res.status(400).json({
        error: 'Array too long',
        field: fieldName,
        maxLength: maxLength,
        actualLength: array.length
      });
    }
    
    next();
  };
}

module.exports = {
  basicValidation,
  validateField,
  validateEmail,
  validateJSON,
  validateApiKey,
  limitArrayLength,
  checkDangerousPatterns,
  sanitizeHtml,
  escapeString,
  validateObjectRecursive,
  ALLOWED_PATTERNS,
  DANGEROUS_PATTERNS
};