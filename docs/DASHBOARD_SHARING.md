# ダッシュボード保存・管理・共有機能 実装ガイド

## 概要

Coneaプロジェクトにダッシュボードの保存、管理、共有機能を実装し、分析ページにダッシュボード一覧を統合しました。ユーザーはカスタムダッシュボードを作成・保存し、他のユーザーと安全に共有できます。

## 機能概要

### 1. ダッシュボード保存機能
- 作成済みダッシュボードの永続化
- メタデータ（名前、説明、タグ）の管理
- 公開設定（公開/非公開/限定公開）
- バージョン管理とお気に入り機能

### 2. ダッシュボード管理機能
- 一覧表示（カード形式）
- 高度な検索・フィルタリング
- ソート機能（更新日、作成日、名前、アクセス数）
- お気に入り・テンプレート絞り込み

### 3. 共有機能
- 公開リンク生成（UUID v4ベース）
- パスワード保護オプション
- SNS共有（Twitter、Facebook、LinkedIn等）
- ウェブサイト埋め込み用iframeコード
- QRコード生成

### 4. アクセス管理
- 共有リンクの有効期限設定
- アクセス統計（閲覧数、ユニークビジター）
- アクセスログの記録

## アーキテクチャ

### データベース設計

#### メインテーブル

**dashboards**
```sql
- id (UUID, PK)
- name (VARCHAR(255), NOT NULL)
- description (TEXT)
- config (JSONB) -- ダッシュボード設定
- tags (TEXT[])
- visibility (ENUM: public/private/limited)
- share_token (UUID, UNIQUE)
- share_expires_at (TIMESTAMP)
- password_hash (VARCHAR(255))
- access_count (INTEGER)
- unique_visitors (INTEGER)
- created_by (UUID)
- created_at, updated_at (TIMESTAMP)
- is_template (BOOLEAN)
- template_category (VARCHAR(100))
- version (INTEGER)
```

#### 関連テーブル

- **dashboard_versions**: バージョン履歴管理
- **dashboard_permissions**: ユーザー権限管理
- **dashboard_access_logs**: アクセスログ
- **dashboard_favorites**: お気に入り管理
- **dashboard_comments**: コラボレーション機能

### バックエンドAPI

**エンドポイント**
```
POST   /api/v2/dashboards              # ダッシュボード作成
GET    /api/v2/dashboards              # 一覧取得
GET    /api/v2/dashboards/:id          # 個別取得
PUT    /api/v2/dashboards/:id          # 更新
DELETE /api/v2/dashboards/:id          # 削除
POST   /api/v2/dashboards/:id/share    # 共有トークン生成
DELETE /api/v2/dashboards/:id/share    # 共有トークン無効化
GET    /api/v2/dashboards/public/:token # 公開ダッシュボード取得
POST   /api/v2/dashboards/:id/favorite # お気に入り切り替え
GET    /api/v2/dashboards/:id/comments # コメント一覧
POST   /api/v2/dashboards/:id/comments # コメント追加
```

### フロントエンド構成

**主要コンポーネント**

1. **DashboardBuilder** (`/frontend/src/features/dashboard/components/DashboardBuilder/`)
   - ダッシュボード編集・作成
   - 保存ボタンとダイアログの統合

2. **DashboardSaveDialog** (`/frontend/src/features/dashboard/components/DashboardSaveDialog/`)
   - 保存時の設定入力UI
   - タグ、公開設定、カテゴリ選択

3. **DashboardList** (`/frontend/src/features/dashboard/components/DashboardList/`)
   - ダッシュボード一覧表示
   - 検索・フィルタリング・ソート機能

4. **ShareDialog** (`/frontend/src/features/dashboard/components/ShareDialog/`)
   - 多機能共有ダイアログ
   - SNS共有、埋め込みコード、アクセス分析

5. **PublicDashboard** (`/frontend/src/pages/PublicDashboard/`)
   - 認証不要の公開ダッシュボード表示
   - パスワード保護対応

## 実装詳細

### 1. ダッシュボード保存

**保存フロー**
1. ユーザーがDashboardBuilderで「保存」をクリック
2. DashboardSaveDialogが開く
3. メタデータと公開設定を入力
4. バックエンドAPIにPOST/PUT送信
5. データベースに永続化
6. バージョン履歴テーブルに記録

**保存データ構造**
```typescript
interface DashboardSaveData {
  name: string;
  description: string;
  tags: string[];
  visibility: 'public' | 'private' | 'limited';
  password?: string;
  templateCategory?: string;
  config: {
    widgets: Widget[];
    layout: GridLayout;
    settings: DashboardSettings;
  };
}
```

### 2. 検索・フィルタリング

**実装された機能**
- **テキスト検索**: 名前・説明での部分一致
- **タグフィルター**: 複数タグでのAND検索
- **公開設定フィルター**: 全て/公開/非公開/限定公開
- **カテゴリフィルター**: テンプレートカテゴリ別
- **ソート**: 8種類のソートオプション
- **特殊フィルター**: お気に入りのみ、テンプレートのみ

**パフォーマンス最適化**
- データベースインデックスの適切な設定
- ページネーション（デフォルト12件/ページ）
- 遅延読み込み（Lazy Loading）対応

### 3. 共有機能

**共有トークン生成**
```typescript
// UUID v4を使用したセキュアなトークン生成
const shareToken = uuidv4();
const shareUrl = `${baseUrl}/public/dashboard/${shareToken}`;
```

**公開設定オプション**
- **限定公開**: リンクを知っている人のみ
- **公開**: 誰でもアクセス可能（検索可能）
- **パスワード保護**: 追加のセキュリティ層

**SNS共有対応プラットフォーム**
- Twitter/X
- Facebook
- LinkedIn
- WhatsApp
- Telegram
- メール

### 4. セキュリティ

**実装されたセキュリティ機能**
- JWTベースの認証（既存システム利用）
- パスワードのハッシュ化（SHA-256）
- CSRF保護
- 適切なCORS設定
- 入力値のサニタイゼーション
- SQLインジェクション対策

**アクセス制御**
- 作成者権限チェック
- 公開設定に基づくアクセス制限
- 有効期限チェック
- レート制限（将来実装予定）

## 設定とデプロイ

### 環境変数
```bash
# バックエンド設定
DATABASE_URL=postgresql://user:pass@localhost/conea
FRONTEND_URL=https://stagingapp.conea.ai

# セキュリティ設定
JWT_SECRET=your-jwt-secret
CORS_ORIGINS=https://stagingapp.conea.ai,https://conea.ai
```

### マイグレーション実行
```bash
# PostgreSQLでマイグレーションを実行
psql -U username -d conea -f migrations/006_create_dashboards_table.sql
```

### フロントエンド ビルド・デプロイ
```bash
cd frontend
npm install
npm run build
npm run deploy
```

## API仕様

### ダッシュボード作成
```http
POST /api/v2/dashboards
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "name": "月次売上分析",
  "description": "EC売上の月次トレンドとKPI",
  "tags": ["売上分析", "EC", "KPI"],
  "visibility": "private",
  "config": {
    "widgets": [...],
    "layout": {...},
    "settings": {...}
  }
}
```

### 共有トークン生成
```http
POST /api/v2/dashboards/:id/share
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "expires_in_days": 30,
  "password": "optional-password"
}
```

**レスポンス**
```json
{
  "share_token": "550e8400-e29b-41d4-a716-446655440000",
  "share_url": "https://stagingapp.conea.ai/public/dashboard/550e8400-e29b-41d4-a716-446655440000",
  "expires_at": "2024-02-20T10:30:00Z"
}
```

## 使用方法

### 1. ダッシュボード作成・保存
1. ダッシュボードビルダーでウィジェットを配置
2. 右上のメニューから「保存」を選択
3. 名前、説明、タグを入力
4. 公開設定を選択
5. 「保存」ボタンをクリック

### 2. ダッシュボード共有
1. 分析ページの「ダッシュボード」タブでダッシュボードを選択
2. カードの「共有」ボタンをクリック
3. 共有設定を構成
4. 「共有リンクを生成」をクリック
5. SNS共有またはリンクコピーで共有

### 3. 公開ダッシュボード閲覧
1. 共有リンクにアクセス
2. パスワード保護されている場合はパスワード入力
3. ダッシュボードが読み取り専用で表示

## トラブルシューティング

### よくある問題

**1. 共有リンクが生成されない**
- ダッシュボードの所有者権限を確認
- バックエンドAPIの接続状況をチェック
- データベース接続を確認

**2. パスワード保護が機能しない**
- パスワードのハッシュ化処理を確認
- フロントエンドとバックエンドの連携をチェック

**3. 検索・フィルターが動作しない**
- データベースインデックスの設定を確認
- SQLクエリのパフォーマンスをチェック

### ログ確認
```bash
# バックエンドログ
tail -f /var/log/conea/backend.log

# フロントエンドログ（ブラウザコンソール）
# F12キーでデベロッパーツールを開く
```

## パフォーマンス最適化

### データベース最適化
- 適切なインデックスの設定
- クエリの最適化
- 接続プーリングの活用

### フロントエンド最適化
- 遅延読み込み（Lazy Loading）
- 仮想化（React Window/Virtualized）
- メモ化（React.memo、useMemo）
- コード分割（Dynamic Import）

## 今後の拡張予定

### Phase 2 機能
- リアルタイムコラボレーション
- コメント・レビューシステム
- ダッシュボードテンプレートギャラリー
- 高度なアクセス権限管理

### Phase 3 機能
- カスタムドメイン対応
- ホワイトラベル機能
- API外部連携
- 高度な分析・レポート機能

## 開発者向け情報

### コード構成
```
src/
├── api/dashboard_routes.py          # バックエンドAPI
├── migrations/006_*.sql             # データベースマイグレーション
frontend/src/
├── features/dashboard/
│   ├── components/
│   │   ├── DashboardBuilder/        # メインエディター
│   │   ├── DashboardSaveDialog/     # 保存ダイアログ
│   │   ├── DashboardList/           # 一覧表示
│   │   └── ShareDialog/             # 共有ダイアログ
│   ├── store/                       # Redux状態管理
│   └── types/                       # TypeScript型定義
└── pages/PublicDashboard/           # 公開ページ
```

### 拡張ポイント
- 新しいウィジェットタイプの追加
- カスタムテーマ対応
- 外部API連携
- 高度な権限管理

## ライセンスと著作権

このドキュメントはConeaプロジェクトの一部として作成されました。

---

最終更新: 2024年1月20日
作成者: Claude (Anthropic AI Assistant)
バージョン: 1.0