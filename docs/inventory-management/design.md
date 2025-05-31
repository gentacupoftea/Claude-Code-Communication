# 在庫管理機能 設計ドキュメント

## 概要

Shopify-MCP-Serverの在庫管理機能は、Shopifyストアの在庫をリアルタイムで監視・管理し、在庫切れリスクの低減と効率的な在庫運用を支援します。

## アーキテクチャ

### データフロー

```
Shopify API → Inventory Sync → Database → Cache → API → Frontend
     ↑                                          ↓
     └──────────── User Updates ────────────────┘
```

### コンポーネント構成

1. **バックエンド**
   - `inventory_api.py`: REST APIエンドポイント
   - `inventory_processor.py`: データ処理・分析ロジック
   - `inventory_sync.py`: Shopify APIとの同期
   - `inventory_alerts.py`: アラート管理

2. **フロントエンド**
   - `InventoryDashboard.tsx`: メインダッシュボード
   - `InventoryGrid.tsx`: データグリッド表示
   - `InventoryAlerts.tsx`: アラート管理UI
   - `InventoryAnalytics.tsx`: 分析ツール

## データモデル

### Inventory Table
```sql
CREATE TABLE inventory (
    id UUID PRIMARY KEY,
    product_id VARCHAR(255) NOT NULL,
    variant_id VARCHAR(255) NOT NULL,
    location_id VARCHAR(255),
    available_quantity INTEGER NOT NULL,
    reserved_quantity INTEGER DEFAULT 0,
    on_hand_quantity INTEGER NOT NULL,
    last_updated TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(variant_id, location_id)
);
```

### Inventory History Table
```sql
CREATE TABLE inventory_history (
    id UUID PRIMARY KEY,
    inventory_id UUID REFERENCES inventory(id),
    change_type VARCHAR(50) NOT NULL, -- 'sale', 'restock', 'adjustment', etc.
    quantity_change INTEGER NOT NULL,
    previous_quantity INTEGER NOT NULL,
    new_quantity INTEGER NOT NULL,
    reason TEXT,
    changed_by VARCHAR(255),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Inventory Alerts Table
```sql
CREATE TABLE inventory_alerts (
    id UUID PRIMARY KEY,
    variant_id VARCHAR(255) NOT NULL,
    alert_type VARCHAR(50) NOT NULL, -- 'low_stock', 'out_of_stock', 'overstock'
    threshold_value INTEGER,
    threshold_percentage DECIMAL(5,2),
    notification_channels JSON, -- ['email', 'webhook', 'in_app']
    priority VARCHAR(20) DEFAULT 'medium',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API エンドポイント

### 在庫情報取得
- `GET /api/v1/inventory` - 在庫一覧取得
- `GET /api/v1/inventory/{variant_id}` - 特定バリアントの在庫取得
- `GET /api/v1/inventory/location/{location_id}` - ロケーション別在庫取得

### 在庫更新
- `PUT /api/v1/inventory/{variant_id}` - 在庫数量更新
- `POST /api/v1/inventory/bulk-update` - 複数商品の一括更新
- `POST /api/v1/inventory/adjustment` - 在庫調整

### 在庫履歴
- `GET /api/v1/inventory/{variant_id}/history` - 在庫変動履歴取得
- `GET /api/v1/inventory/reports/turnover` - 在庫回転率レポート

### アラート管理
- `GET /api/v1/inventory/alerts` - アラート一覧取得
- `POST /api/v1/inventory/alerts` - 新規アラート作成
- `PUT /api/v1/inventory/alerts/{id}` - アラート設定更新
- `DELETE /api/v1/inventory/alerts/{id}` - アラート削除

## 機能詳細

### 1. リアルタイム在庫追跡

- Shopify APIからの定期的な在庫同期（5分間隔）
- WebSocketを使用したリアルタイム更新通知
- 在庫変動の即時反映

### 2. 在庫アラート機能

- 低在庫アラート（数量または割合ベース）
- 在庫切れ予測（過去30日間の売上データに基づく）
- 過剰在庫アラート（回転率が低い商品）

### 3. 在庫分析ツール

- 在庫回転率計算
  ```
  回転率 = 売上原価 / 平均在庫金額
  ```
- ABC分析（売上貢献度による商品分類）
- 季節性分析（過去12ヶ月のトレンド）

### 4. 在庫管理アクション

- インライン編集による在庫数量更新
- CSVインポート/エクスポート機能
- 在庫調整理由の記録

## セキュリティ考慮事項

1. **認証・認可**
   - JWT認証必須
   - ロールベースアクセス制御（RBAC）
   - 在庫更新は特定権限ユーザーのみ

2. **データ保護**
   - 通信のHTTPS暗号化
   - 重要な操作のログ記録
   - 在庫履歴の改竄防止

## パフォーマンス最適化

1. **キャッシュ戦略**
   - Redisによる在庫データキャッシュ
   - 分析結果の定期的な事前計算
   - APIレスポンスキャッシュ

2. **バッチ処理**
   - 大量在庫の同期は非同期ジョブ
   - 分析処理のスケジュール実行
   - データベースクエリの最適化

## エラーハンドリング

1. **同期エラー**
   - Shopify API接続エラーの再試行
   - 部分的な同期失敗の処理
   - エラーログの詳細記録

2. **データ整合性**
   - トランザクション処理
   - 楽観的ロックによる並行更新制御
   - データバリデーション

## 監視・ログ

1. **メトリクス**
   - 在庫同期の成功率
   - API応答時間
   - アラート発生頻度

2. **ログレベル**
   - DEBUG: 詳細な処理フロー
   - INFO: 重要な操作記録
   - ERROR: エラー情報
   - CRITICAL: システム障害

## 拡張性

1. **将来の拡張計画**
   - AI予測モデルの統合
   - サプライヤー連携
   - 自動発注機能
   - バーコードスキャン対応

2. **プラグインアーキテクチャ**
   - カスタムアラート条件
   - 外部システム連携
   - カスタムレポート生成