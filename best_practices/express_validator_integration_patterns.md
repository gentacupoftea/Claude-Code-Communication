# Express-Validator統合パターン（Worker A-1成果物）

## 🎯 バリデーション統合ベストプラクティス

### 1. 基本パターン

```typescript
import { body, query, param, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

// 基本的なバリデーションミドルウェア
export const validateAuthLogin = [
  body('username')
    .isString()
    .notEmpty()
    .withMessage('ユーザー名が必要です'),
  body('password')
    .isString()
    .isLength({ min: 8 })
    .withMessage('パスワードは8文字以上である必要があります'),
];

// エラーハンドリングミドルウェア
export const handleValidationErrors = (
  req: Request, 
  res: Response, 
  next: NextFunction
): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ 
      success: false,
      errors: errors.array() 
    });
    return;
  }
  next();
};
```

### 2. 型安全なバリデーション

```typescript
// 型ガードとの組み合わせ
interface LoginRequest {
  username: string;
  password: string;
}

export const isValidLoginRequest = (obj: any): obj is LoginRequest => {
  return obj && 
    typeof obj.username === 'string' && 
    typeof obj.password === 'string';
};

// 使用例
router.post('/auth/login', 
  validateAuthLogin,
  handleValidationErrors,
  async (req: Request, res: Response): Promise<void> => {
    if (!isValidLoginRequest(req.body)) {
      res.status(400).json({ error: '不正なリクエスト形式です' });
      return;
    }
    
    // 型安全なアクセス
    const { username, password } = req.body;
    // ...
  }
);
```

### 3. カスタムバリデーター

```typescript
// プロジェクト固有のバリデーター
export const customValidators = {
  isSessionId: (value: string) => {
    return /^[a-zA-Z0-9-_]{20,}$/.test(value);
  },
  
  isPresidentRole: (value: string) => {
    return value === 'president';
  },
  
  isValidClaudeToken: async (value: string) => {
    // Claude CLIトークンの検証ロジック
    return value.startsWith('claude-') && value.length > 32;
  }
};

// 使用例
export const validateClaudeAuth = [
  body('sessionId')
    .custom(customValidators.isSessionId)
    .withMessage('無効なセッションIDです'),
  body('claudeToken')
    .custom(customValidators.isValidClaudeToken)
    .withMessage('無効なClaudeトークンです')
];
```

### 4. エラーレスポンス統一

```typescript
// 統一されたエラーレスポンス形式
interface ValidationErrorResponse {
  success: false;
  error: string;
  details?: Array<{
    field: string;
    message: string;
    value?: any;
  }>;
}

export const createValidationErrorResponse = (
  errors: Result<ValidationError>
): ValidationErrorResponse => {
  return {
    success: false,
    error: 'バリデーションエラー',
    details: errors.array().map(err => ({
      field: err.path || 'unknown',
      message: err.msg,
      value: err.value
    }))
  };
};
```

### 5. 再利用可能なバリデーションルール

```typescript
// 共通バリデーションルール
export const commonValidations = {
  email: body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('有効なメールアドレスを入力してください'),
    
  password: body('password')
    .isLength({ min: 8, max: 128 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('パスワードは英大小文字と数字を含む8文字以上である必要があります'),
    
  sessionId: param('sessionId')
    .isLength({ min: 20, max: 50 })
    .isAlphanumeric('en-US', { ignore: '-_' })
    .withMessage('無効なセッションIDです')
};

// 組み合わせパターン
export const validateUserRegistration = [
  commonValidations.email,
  commonValidations.password,
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('パスワードが一致しません');
      }
      return true;
    })
];
```

## 🔒 セキュリティ考慮事項

1. **入力サニタイゼーション**: 全ての入力に対してHTMLエスケープを適用
2. **レート制限**: ログイン試行回数の制限
3. **IPアドレス検証**: 許可されたIPからのアクセスのみ
4. **トークン検証**: JWTの有効性と署名検証

## 📊 パフォーマンス最適化

- バリデーションルールのキャッシュ化
- 非同期バリデーションの並列実行
- エラーメッセージの国際化対応

このパターンにより、型安全で再利用可能なバリデーションシステムを構築できます。