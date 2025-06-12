# CSVクレンジングシステム 全体アーキテクチャ仕様書

## 1. システム全体構成図

### 1.1 5層アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────────────┐
│                    プレゼンテーション層                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Web UI     │  │ Mobile App  │  │  Admin UI   │         │
│  │  (React)    │  │(React Native)│  │   (Vue.js)  │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                 │                 │                   │
├─────────┼─────────────────┼─────────────────┼─────────────────┤
│         │     API Gateway層                 │                   │
│  ┌──────▼─────────────────▼─────────────────▼──────┐          │
│  │              Kong API Gateway                    │          │
│  │  - 認証/認可  - レート制限  - ロードバランシング │          │
│  └──────┬─────────────────┬─────────────────┬──────┘          │
│         │                 │                 │                   │
├─────────┼─────────────────┼─────────────────┼─────────────────┤
│     ビジネスロジック層     │                 │                   │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐         │
│  │CSV処理サービス│  │データ変換   │  │品質検証     │         │
│  │(Node.js)     │  │サービス     │  │サービス     │         │
│  │             │  │(Python)     │  │(Go)         │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                 │                 │                   │
│  ┌──────▼─────────────────▼─────────────────▼──────┐          │
│  │           メッセージブローカー (RabbitMQ)        │          │
│  └──────┬─────────────────┬─────────────────┬──────┘          │
│         │                 │                 │                   │
├─────────┼─────────────────┼─────────────────┼─────────────────┤
│    データアクセス層        │                 │                   │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐         │
│  │PostgreSQL   │  │MongoDB      │  │Redis Cache  │         │
│  │(メタデータ) │  │(処理済CSV)  │  │(セッション) │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                        外部API層                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ AWS S3      │  │ Google      │  │ Slack       │         │
│  │(ファイル保存)│  │ Sheets API  │  │ Webhook     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 コンポーネント間通信フロー

```
ユーザー → Web UI → API Gateway → CSV処理サービス
                                      ↓
                              メッセージキューに投入
                                      ↓
                              データ変換サービス
                                      ↓
                              品質検証サービス
                                      ↓
                              結果をDBに保存
                                      ↓
                              通知サービス → Slack/Email
```

### 1.3 セキュリティ境界とネットワークゾーニング

```
┌─────────────────────────────────────────────────────┐
│                  DMZ (公開ゾーン)                    │
│  - ロードバランサー                                 │
│  - WAF (Web Application Firewall)                  │
└───────────────────────┬─────────────────────────────┘
                        │ HTTPS only
┌───────────────────────▼─────────────────────────────┐
│              アプリケーションゾーン                  │
│  - API Gateway (Kong)                              │
│  - 各種マイクロサービス                            │
│  - 内部通信: mTLS                                  │
└───────────────────────┬─────────────────────────────┘
                        │ VPN/Private Link
┌───────────────────────▼─────────────────────────────┐
│               データゾーン                          │
│  - PostgreSQL (暗号化)                             │
│  - MongoDB (暗号化)                                │
│  - Redis (TLS)                                     │
└─────────────────────────────────────────────────────┘
```

## 2. サービス間連携仕様

### 2.1 非同期メッセージング設計

#### イベント駆動アーキテクチャ
```yaml
events:
  csv_upload_initiated:
    publisher: CSV処理サービス
    subscribers:
      - データ変換サービス
    payload:
      file_id: string
      user_id: string
      timestamp: datetime
      
  data_transformation_completed:
    publisher: データ変換サービス
    subscribers:
      - 品質検証サービス
      - 通知サービス
    payload:
      file_id: string
      status: success|failure
      transformed_file_path: string
      
  quality_check_completed:
    publisher: 品質検証サービス
    subscribers:
      - 通知サービス
      - ダッシュボードサービス
    payload:
      file_id: string
      quality_score: number
      issues: array
```

#### メッセージブローカー設定
```javascript
// RabbitMQ設定
const rabbitConfig = {
  exchanges: {
    'csv.processing': {
      type: 'topic',
      durable: true
    }
  },
  queues: {
    'transformation.queue': {
      durable: true,
      arguments: {
        'x-message-ttl': 3600000, // 1時間
        'x-max-retries': 3
      }
    },
    'validation.queue': {
      durable: true,
      prefetch: 10
    }
  }
};
```

### 2.2 API間認証・認可フロー

#### JWT + OAuth2.0実装
```
1. クライアント → API Gateway: 認証リクエスト
2. API Gateway → 認証サービス: 資格情報検証
3. 認証サービス → API Gateway: JWT発行
4. API Gateway → クライアント: JWT返却
5. クライアント → API Gateway: JWT付きAPIリクエスト
6. API Gateway: JWT検証 & サービス転送
```

#### サービス間認証 (mTLS)
```yaml
service_certificates:
  csv_processor:
    cert: /certs/csv-processor.crt
    key: /certs/csv-processor.key
    ca: /certs/ca.crt
    
  data_transformer:
    cert: /certs/data-transformer.crt
    key: /certs/data-transformer.key
    ca: /certs/ca.crt
```

### 2.3 サーキットブレーカーとフォールバック

#### Hystrix実装パターン
```javascript
// サーキットブレーカー設定
const circuitBreakerConfig = {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  requestVolumeThreshold: 20
};

// フォールバック実装
async function processCSVWithFallback(data) {
  return hystrix.execute('csv-processor', 
    async () => {
      // メイン処理
      return await csvService.process(data);
    },
    async () => {
      // フォールバック処理
      await messageQueue.enqueue('csv.retry', data);
      return { status: 'queued', message: '処理は後ほど実行されます' };
    }
  );
}
```

## 3. 技術選定根拠

### 3.1 各層の技術スタック選定理由

#### プレゼンテーション層
- **React**: 
  - 豊富なエコシステム
  - 仮想DOMによる高速レンダリング
  - TypeScriptとの親和性
  
- **React Native**:
  - コード共有によるモバイル開発効率化
  - ネイティブパフォーマンス

- **Vue.js** (管理画面):
  - 学習曲線が緩やか
  - 管理画面に適したコンポーネント構造

#### API Gateway層
- **Kong**:
  - プラグイン拡張性
  - 高パフォーマンス (Nginx base)
  - 認証・レート制限の統合管理

#### ビジネスロジック層
- **Node.js** (CSV処理):
  - ストリーム処理に優れる
  - 非同期I/O処理
  
- **Python** (データ変換):
  - pandas等のデータ処理ライブラリ
  - 機械学習統合の容易さ
  
- **Go** (品質検証):
  - 並行処理性能
  - 低レイテンシ要求への対応

#### データアクセス層
- **PostgreSQL**:
  - ACID準拠
  - JSON型サポート
  - 高度なクエリ最適化
  
- **MongoDB**:
  - スキーマレスでCSVデータに適合
  - 水平スケーリング
  
- **Redis**:
  - 高速キャッシュ
  - Pub/Sub機能

### 3.2 スケーラビリティ考慮事項

#### 水平スケーリング戦略
```yaml
scaling_policies:
  csv_processor:
    min_instances: 2
    max_instances: 20
    metrics:
      - cpu_utilization > 70%
      - queue_depth > 100
      
  data_transformer:
    min_instances: 3
    max_instances: 50
    metrics:
      - memory_utilization > 80%
      - processing_time > 5s
```

#### パフォーマンス最適化
1. **CDN配置**: 静的アセットの配信最適化
2. **データベースシャーディング**: ユーザーIDベースの分散
3. **キャッシュ戦略**: 
   - Redis: ホットデータ
   - CDN: 静的コンテンツ
   - アプリケーションキャッシュ: 計算結果

### 3.3 運用監視ポイント

#### メトリクス収集
```yaml
monitoring:
  infrastructure:
    - CPU使用率
    - メモリ使用率
    - ディスクI/O
    - ネットワークスループット
    
  application:
    - API応答時間
    - エラー率
    - リクエスト数/秒
    - キュー深度
    
  business:
    - CSV処理成功率
    - 平均処理時間
    - ユーザー満足度スコア
```

#### アラート設定
```yaml
alerts:
  critical:
    - error_rate > 5%
    - response_time > 3s
    - queue_depth > 1000
    
  warning:
    - cpu_usage > 80%
    - memory_usage > 85%
    - disk_usage > 90%
```

#### ログ集約
- **ELKスタック**:
  - Elasticsearch: ログ保存・検索
  - Logstash: ログ収集・変換
  - Kibana: 可視化・分析

## 4. デプロイメント戦略

### Blue-Greenデプロイメント
```bash
# デプロイメントフロー
1. Green環境に新バージョンデプロイ
2. スモークテスト実行
3. トラフィックを段階的に切り替え
4. 問題発生時は即座にBlueへロールバック
```

### コンテナオーケストレーション
```yaml
# Kubernetes設定例
apiVersion: apps/v1
kind: Deployment
metadata:
  name: csv-processor
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
```

この仕様書は、CSVクレンジングシステムの包括的なアーキテクチャを定義し、実装に必要な全ての技術的詳細を提供します。