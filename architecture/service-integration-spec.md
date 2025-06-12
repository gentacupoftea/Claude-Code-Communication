# サービス間連携詳細仕様書

## 1. イベント駆動アーキテクチャ詳細

### 1.1 イベントカタログ

#### CSVアップロードイベント
```json
{
  "eventType": "csv.upload.initiated",
  "version": "1.0",
  "metadata": {
    "eventId": "uuid-v4",
    "timestamp": "2024-01-15T10:30:00Z",
    "source": "csv-processor-service",
    "correlationId": "req-12345"
  },
  "payload": {
    "fileId": "file-uuid",
    "fileName": "sales_data_2024.csv",
    "fileSize": 1048576,
    "mimeType": "text/csv",
    "userId": "user-123",
    "uploadMethod": "web|api|ftp",
    "processingOptions": {
      "encoding": "UTF-8",
      "delimiter": ",",
      "hasHeader": true,
      "dateFormat": "YYYY-MM-DD"
    }
  }
}
```

#### データ変換完了イベント
```json
{
  "eventType": "csv.transformation.completed",
  "version": "1.0",
  "metadata": {
    "eventId": "uuid-v4",
    "timestamp": "2024-01-15T10:35:00Z",
    "source": "data-transformer-service",
    "correlationId": "req-12345"
  },
  "payload": {
    "fileId": "file-uuid",
    "status": "success",
    "transformationType": "normalize|aggregate|cleanse",
    "statistics": {
      "rowsProcessed": 10000,
      "rowsTransformed": 9950,
      "rowsRejected": 50,
      "processingTimeMs": 5432
    },
    "outputFiles": [
      {
        "fileId": "output-uuid-1",
        "format": "csv",
        "location": "s3://bucket/transformed/output-1.csv"
      }
    ],
    "errors": []
  }
}
```

#### 品質検証完了イベント
```json
{
  "eventType": "csv.quality.validated",
  "version": "1.0",
  "metadata": {
    "eventId": "uuid-v4",
    "timestamp": "2024-01-15T10:40:00Z",
    "source": "quality-validator-service",
    "correlationId": "req-12345"
  },
  "payload": {
    "fileId": "file-uuid",
    "qualityScore": 95.5,
    "validationResults": {
      "dataCompleteness": 98.0,
      "dataAccuracy": 96.5,
      "dataConsistency": 94.0,
      "dataTimeliness": 93.5
    },
    "issues": [
      {
        "severity": "warning",
        "type": "missing_value",
        "column": "email",
        "rowNumbers": [45, 89, 234],
        "suggestion": "デフォルト値を設定するか、行を除外してください"
      }
    ],
    "passed": true
  }
}
```

### 1.2 メッセージルーティング仕様

```javascript
// RabbitMQ Exchange設定
const exchangeConfig = {
  name: 'csv.processing',
  type: 'topic',
  options: {
    durable: true,
    autoDelete: false,
    arguments: {
      'x-message-ttl': 86400000, // 24時間
      'x-max-length': 10000
    }
  }
};

// ルーティングキー設計
const routingKeys = {
  upload: 'csv.upload.*',          // csv.upload.initiated, csv.upload.failed
  transform: 'csv.transform.*',    // csv.transform.started, csv.transform.completed
  validate: 'csv.validate.*',      // csv.validate.started, csv.validate.completed
  notify: 'csv.notify.*'          // csv.notify.email, csv.notify.slack
};

// Queue Binding設定
const queueBindings = [
  {
    queue: 'transformation.queue',
    exchange: 'csv.processing',
    routingKey: 'csv.upload.initiated'
  },
  {
    queue: 'validation.queue',
    exchange: 'csv.processing',
    routingKey: 'csv.transform.completed'
  },
  {
    queue: 'notification.queue',
    exchange: 'csv.processing',
    routingKey: 'csv.#.completed'  // 全ての完了イベント
  }
];
```

### 1.3 Dead Letter Queue戦略

```yaml
dead_letter_configuration:
  main_queue:
    name: transformation.queue
    retry_attempts: 3
    retry_delay: [1000, 5000, 30000]  # ミリ秒
    
  dlq:
    name: transformation.dlq
    retention_days: 7
    alert_threshold: 100
    
  processing:
    - automatic_retry: true
    - manual_intervention_required: true
    - notification_channels: [email, slack]
```

## 2. 同期API仕様

### 2.1 RESTful API設計

#### エンドポイント一覧
```yaml
endpoints:
  # CSVアップロード
  - method: POST
    path: /api/v1/csv/upload
    auth: Bearer JWT
    rate_limit: 100/hour
    
  # 処理状態確認
  - method: GET
    path: /api/v1/csv/{fileId}/status
    auth: Bearer JWT
    cache: 30s
    
  # 結果取得
  - method: GET
    path: /api/v1/csv/{fileId}/result
    auth: Bearer JWT
    pagination: true
    
  # 一括処理
  - method: POST
    path: /api/v1/csv/batch
    auth: Bearer JWT + API Key
    rate_limit: 10/hour
```

#### API応答フォーマット
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata: {
    requestId: string;
    timestamp: string;
    version: string;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
  };
}
```

### 2.2 GraphQL API仕様

```graphql
type Query {
  # CSVファイル情報取得
  csvFile(id: ID!): CsvFile
  
  # ユーザーのCSVファイル一覧
  userCsvFiles(
    userId: ID!
    filter: CsvFileFilter
    pagination: PaginationInput
  ): CsvFileConnection!
  
  # 処理状態のリアルタイム監視
  processingStatus(fileId: ID!): ProcessingStatus!
}

type Mutation {
  # CSVアップロード
  uploadCsv(input: UploadCsvInput!): UploadCsvPayload!
  
  # 処理再実行
  retryProcessing(fileId: ID!): RetryProcessingPayload!
  
  # 処理キャンセル
  cancelProcessing(fileId: ID!): CancelProcessingPayload!
}

type Subscription {
  # 処理進捗のリアルタイム更新
  processingProgress(fileId: ID!): ProcessingProgress!
  
  # エラー通知
  processingErrors(userId: ID!): ProcessingError!
}
```

## 3. セキュリティ仕様

### 3.1 認証フロー詳細

#### OAuth 2.0 + JWT実装
```javascript
// 認証フロー実装
class AuthenticationService {
  async authenticate(credentials) {
    // 1. 資格情報検証
    const user = await this.validateCredentials(credentials);
    
    // 2. JWT生成
    const accessToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        roles: user.roles,
        permissions: user.permissions
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '1h',
        issuer: 'csv-cleansing-system',
        audience: 'api.csv-cleansing.com'
      }
    );
    
    // 3. リフレッシュトークン生成
    const refreshToken = await this.generateRefreshToken(user.id);
    
    return {
      accessToken,
      refreshToken,
      expiresIn: 3600,
      tokenType: 'Bearer'
    };
  }
  
  async refresh(refreshToken) {
    // リフレッシュトークン検証
    const userId = await this.validateRefreshToken(refreshToken);
    
    // 新しいアクセストークン発行
    return this.generateAccessToken(userId);
  }
}
```

### 3.2 サービス間mTLS設定

```yaml
# Kubernetes Service Mesh設定 (Istio)
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: csv-services
spec:
  mtls:
    mode: STRICT
    
---
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: service-access
  namespace: csv-services
spec:
  rules:
  - from:
    - source:
        principals: ["cluster.local/ns/csv-services/sa/csv-processor"]
    to:
    - operation:
        methods: ["POST"]
        paths: ["/transform"]
```

### 3.3 API Gateway セキュリティ設定

```nginx
# Kong セキュリティプラグイン設定
plugins:
  - name: jwt
    config:
      uri_param_names:
        - jwt
      claims_to_verify:
        - exp
        - iss
      secret_is_base64: false
      
  - name: rate-limiting
    config:
      minute: 60
      hour: 1000
      policy: local
      fault_tolerant: true
      
  - name: ip-restriction
    config:
      whitelist:
        - 10.0.0.0/8
        - 172.16.0.0/12
      
  - name: cors
    config:
      origins:
        - https://app.csv-cleansing.com
      methods:
        - GET
        - POST
        - PUT
        - DELETE
      headers:
        - Authorization
        - Content-Type
      exposed_headers:
        - X-Request-Id
      credentials: true
      max_age: 3600
```

## 4. エラーハンドリングとリカバリー

### 4.1 エラー分類と処理戦略

```typescript
enum ErrorCategory {
  TRANSIENT = 'transient',      // 一時的エラー（リトライ可能）
  PERMANENT = 'permanent',      // 恒久的エラー（リトライ不可）
  BUSINESS = 'business',        // ビジネスロジックエラー
  SYSTEM = 'system'            // システムエラー
}

interface ErrorHandlingStrategy {
  category: ErrorCategory;
  retryable: boolean;
  maxRetries: number;
  backoffStrategy: 'exponential' | 'linear' | 'fixed';
  alerting: {
    immediate: boolean;
    channels: string[];
    escalation: {
      after: number;  // 分
      to: string[];   // エスカレーション先
    };
  };
}

// エラー処理マッピング
const errorStrategies: Map<string, ErrorHandlingStrategy> = new Map([
  ['NETWORK_TIMEOUT', {
    category: ErrorCategory.TRANSIENT,
    retryable: true,
    maxRetries: 3,
    backoffStrategy: 'exponential',
    alerting: {
      immediate: false,
      channels: ['log'],
      escalation: { after: 30, to: ['email', 'slack'] }
    }
  }],
  ['INVALID_CSV_FORMAT', {
    category: ErrorCategory.BUSINESS,
    retryable: false,
    maxRetries: 0,
    backoffStrategy: 'fixed',
    alerting: {
      immediate: true,
      channels: ['user_notification'],
      escalation: { after: 0, to: [] }
    }
  }]
]);
```

### 4.2 補償トランザクション設計

```javascript
// Sagaパターン実装
class CsvProcessingSaga {
  constructor() {
    this.steps = [
      {
        name: 'upload',
        action: this.uploadFile,
        compensate: this.deleteFile
      },
      {
        name: 'transform',
        action: this.transformData,
        compensate: this.revertTransformation
      },
      {
        name: 'validate',
        action: this.validateQuality,
        compensate: this.markAsInvalid
      },
      {
        name: 'notify',
        action: this.sendNotification,
        compensate: this.sendFailureNotification
      }
    ];
  }
  
  async execute(context) {
    const executedSteps = [];
    
    try {
      for (const step of this.steps) {
        await step.action(context);
        executedSteps.push(step);
      }
      return { success: true, context };
    } catch (error) {
      // ロールバック処理
      for (const step of executedSteps.reverse()) {
        try {
          await step.compensate(context);
        } catch (compensateError) {
          // 補償失敗のログ記録
          logger.error(`Compensation failed for ${step.name}`, compensateError);
        }
      }
      throw error;
    }
  }
}
```

## 5. パフォーマンス最適化仕様

### 5.1 キャッシング戦略

```yaml
caching_layers:
  cdn:
    provider: CloudFront
    ttl:
      static_assets: 31536000  # 1年
      api_responses: 300       # 5分
    invalidation:
      - on_deploy: true
      - selective: true
      
  application:
    provider: Redis
    strategies:
      - pattern: cache-aside
        ttl: 3600
        keys:
          - user_profiles
          - csv_metadata
      - pattern: write-through
        ttl: 86400
        keys:
          - processing_results
          
  database:
    provider: PostgreSQL
    query_cache: enabled
    prepared_statements: enabled
    connection_pooling:
      min: 10
      max: 100
      idle_timeout: 300
```

### 5.2 負荷分散設定

```yaml
load_balancing:
  algorithm: least_connections
  health_checks:
    interval: 10s
    timeout: 5s
    unhealthy_threshold: 3
    healthy_threshold: 2
    path: /health
    
  session_affinity:
    enabled: true
    type: cookie
    ttl: 3600
    
  traffic_distribution:
    - region: asia-northeast1
      weight: 60
    - region: us-west1
      weight: 30
    - region: europe-west1
      weight: 10
```

この詳細仕様書により、サービス間の連携が明確に定義され、実装時の指針となります。