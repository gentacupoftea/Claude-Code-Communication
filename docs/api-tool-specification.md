# 統一APIツール仕様書

## 1. 概要

本仕様書は、Conea統合システムにおける全APIサービス（EC、POS、分析、天気）の共通インターフェースを定義し、統一的な実装基準を提供します。

## 2. 基本原則

### 2.1 設計思想
- **統一性**: すべてのAPIサービスは同一のインターフェースを実装
- **拡張性**: 新規APIの追加が容易な構造
- **独立性**: 各APIは独立して動作し、相互に影響しない
- **可観測性**: 統一的なロギング、メトリクス、ヘルスチェック

### 2.2 技術スタック
- 言語: TypeScript/JavaScript
- 設定形式: YAML
- バリデーション: JSON Schema
- 通信: RESTful API / GraphQL

## 3. 共通インターフェース定義

### 3.1 必須メソッド

```typescript
interface APIService {
  // 初期化メソッド
  init(config: APIConfig): Promise<void>;
  
  // ヘルスチェック
  healthCheck(): Promise<HealthCheckResult>;
  
  // API実行
  execute(request: APIRequest): Promise<APIResponse>;
  
  // リソース解放
  dispose(): Promise<void>;
}
```

### 3.2 設定インターフェース

```typescript
interface APIConfig {
  // 基本設定
  service: {
    name: string;
    version: string;
    description: string;
  };
  
  // 認証設定
  auth: {
    type: 'api_key' | 'oauth2' | 'basic' | 'custom';
    credentials: Record<string, any>;
  };
  
  // エンドポイント設定
  endpoints: {
    base: string;
    timeout: number;
    retryPolicy: RetryPolicy;
  };
  
  // ロギング設定
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    format: 'json' | 'text';
  };
}
```

## 4. YAMLスキーマ定義

### 4.1 基本スキーマ

```yaml
# api-service.schema.yaml
type: object
required:
  - service
  - auth
  - endpoints
properties:
  service:
    type: object
    required:
      - name
      - version
    properties:
      name:
        type: string
        pattern: '^[a-z0-9-]+$'
        maxLength: 50
      version:
        type: string
        pattern: '^\\d+\\.\\d+\\.\\d+$'
      description:
        type: string
        maxLength: 200
  
  auth:
    type: object
    required:
      - type
    properties:
      type:
        type: string
        enum: ['api_key', 'oauth2', 'basic', 'custom']
      credentials:
        type: object
        additionalProperties: true
  
  endpoints:
    type: object
    required:
      - base
    properties:
      base:
        type: string
        format: uri
      timeout:
        type: integer
        minimum: 1000
        maximum: 60000
        default: 30000
      retryPolicy:
        type: object
        properties:
          maxRetries:
            type: integer
            minimum: 0
            maximum: 5
            default: 3
          backoffMultiplier:
            type: number
            minimum: 1
            maximum: 5
            default: 2
```

### 4.2 サービス別スキーマ例

```yaml
# ec-api-config.yaml
service:
  name: shopify-api
  version: 1.0.0
  description: Shopify EC API統合サービス

auth:
  type: api_key
  credentials:
    apiKey: ${SHOPIFY_API_KEY}
    apiSecret: ${SHOPIFY_API_SECRET}
    shopDomain: ${SHOPIFY_DOMAIN}

endpoints:
  base: https://myshop.myshopify.com/admin/api/2024-01
  timeout: 30000
  retryPolicy:
    maxRetries: 3
    backoffMultiplier: 2

rateLimit:
  requests: 40
  window: 60000

features:
  - products
  - orders
  - customers
  - inventory
```

## 5. エラーハンドリング標準

### 5.1 エラーコード体系

```typescript
enum APIErrorCode {
  // 認証エラー (1xxx)
  AUTH_INVALID = 1001,
  AUTH_EXPIRED = 1002,
  AUTH_INSUFFICIENT = 1003,
  
  // リクエストエラー (2xxx)
  REQUEST_INVALID = 2001,
  REQUEST_TIMEOUT = 2002,
  REQUEST_RATE_LIMIT = 2003,
  
  // サーバーエラー (3xxx)
  SERVER_INTERNAL = 3001,
  SERVER_UNAVAILABLE = 3002,
  SERVER_MAINTENANCE = 3003,
  
  // ビジネスロジックエラー (4xxx)
  BUSINESS_VALIDATION = 4001,
  BUSINESS_CONFLICT = 4002,
  BUSINESS_NOT_FOUND = 4003
}
```

### 5.2 統一エラーレスポンス

```typescript
interface APIError {
  code: APIErrorCode;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
  traceId: string;
  service: string;
}
```

## 6. レスポンス形式の統一

### 6.1 成功レスポンス

```typescript
interface APIResponse<T = any> {
  success: true;
  data: T;
  metadata: {
    timestamp: string;
    requestId: string;
    service: string;
    version: string;
    executionTime: number;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
  };
}
```

### 6.2 エラーレスポンス

```typescript
interface APIErrorResponse {
  success: false;
  error: APIError;
  metadata: {
    timestamp: string;
    requestId: string;
    service: string;
    version: string;
  };
}
```

## 7. バリデーション規則

### 7.1 入力バリデーション

```typescript
interface ValidationRule {
  field: string;
  rules: {
    required?: boolean;
    type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
    pattern?: string;
    min?: number;
    max?: number;
    enum?: any[];
    custom?: (value: any) => boolean | string;
  };
}
```

### 7.2 バリデーション実装例

```typescript
class APIValidator {
  static validate(data: any, rules: ValidationRule[]): ValidationResult {
    const errors: ValidationError[] = [];
    
    for (const rule of rules) {
      const value = this.getFieldValue(data, rule.field);
      const fieldErrors = this.validateField(value, rule);
      errors.push(...fieldErrors);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}
```

## 8. 実装例

### 8.1 基本実装

```typescript
abstract class BaseAPIService implements APIService {
  protected config: APIConfig;
  protected logger: Logger;
  
  async init(config: APIConfig): Promise<void> {
    // 設定検証
    await this.validateConfig(config);
    this.config = config;
    
    // ロガー初期化
    this.logger = this.createLogger(config.logging);
    
    // サービス固有の初期化
    await this.onInit();
  }
  
  async healthCheck(): Promise<HealthCheckResult> {
    try {
      const checks = await Promise.all([
        this.checkConnectivity(),
        this.checkAuthentication(),
        this.checkRateLimit()
      ]);
      
      return {
        status: checks.every(c => c.healthy) ? 'healthy' : 'unhealthy',
        checks,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  abstract execute(request: APIRequest): Promise<APIResponse>;
  
  async dispose(): Promise<void> {
    await this.onDispose();
    this.logger.info('Service disposed');
  }
  
  protected abstract onInit(): Promise<void>;
  protected abstract onDispose(): Promise<void>;
}
```

## 9. 今後の拡張計画

### 9.1 機能拡張
- WebSocket対応
- GraphQL統合
- バッチ処理API
- イベント駆動型API

### 9.2 セキュリティ強化
- API署名検証
- リクエスト暗号化
- IPホワイトリスト
- DDoS対策

### 9.3 パフォーマンス最適化
- 接続プーリング
- レスポンスキャッシング
- 並列処理最適化
- CDN統合