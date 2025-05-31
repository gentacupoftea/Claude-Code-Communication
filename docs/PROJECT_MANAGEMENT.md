# Coneaプロジェクト管理システム

## 概要

Coneaプロジェクトに実装されたチャットフォルダ分け機能とプロジェクト管理システムのドキュメントです。

## 機能一覧

### 1. 折りたたみ可能な左サイドバー

#### 特徴
- **サイドバーコンポーネント**: `ProjectSidebar.tsx`
- **フレームワーク**: Material-UIのDrawerコンポーネント使用
- **幅**: 280px（リサイズ可能）
- **操作**: トグルボタンで開閉
- **テーマ**: ダークテーマ対応

#### フォルダツリー構造
- **ライブラリ**: Material-UI TreeView使用
- **機能**:
  - フォルダ作成、名前変更、削除
  - ドラッグ&ドロップ対応（将来実装予定）
  - フォルダアイコンのカスタマイズ
  - 右クリックコンテキストメニュー
  - 階層構造の無制限ネスト

### 2. データ保持機能

#### ファイルアップロード機能
- **対応形式**: CSV, TXT, MD, XLSX, XLS, JSON, PDF
- **アップロード方法**: ドラッグ&ドロップ、ファイル選択
- **制限**: 
  - 複数ファイル同時アップロード対応
  - ファイルサイズ制限: 50MB/ファイル
- **UI**: プログレスバー表示

#### ファイルストレージ
- **バックエンドAPI**:
  - `POST /api/v2/projects/:projectId/files` - ファイルアップロード
  - `GET /api/v2/projects/:projectId/files` - ファイル一覧
  - `GET /api/v2/projects/:projectId/files/:fileId` - ファイル取得
  - `DELETE /api/v2/projects/:projectId/files/:fileId` - ファイル削除
- **ストレージ**: Cloud Storage（GCS使用予定）
- **メタデータ**: PostgreSQLに保存

#### LLMファイル参照機能
- **自動認識**: アップロードしたファイルをLLMが自動認識
- **インデックス**: ファイル内容の自動インデックス作成
- **参照方法**: チャット時に「@ファイル名」で参照可能
- **要約機能**: ファイル内容の自動要約

### 3. プロジェクトプロンプト機能

#### プロンプト設定UI
- **設定ダイアログ**: `ProjectSettings.tsx`
- **機能**:
  - システムプロンプト入力エリア
  - 変数定義（`{{company_name}}`, `{{analysis_type}}`など）
  - プロンプトテンプレート保存
  - プリセットテンプレート選択

#### プロンプト管理
- **デフォルトプロンプト**: 3種類のテンプレート
  1. EC売上分析
  2. マーケティング分析
  3. 在庫管理
- **カスタムプロンプト**: ユーザー独自のプロンプト作成
- **バージョン管理**: プロンプトの履歴管理（将来実装予定）
- **共有機能**: プロンプトの共有（将来実装予定）

### 4. プロジェクト単位API設定

#### API設定管理
- **保存方式**: プロジェクトごとの暗号化保存
- **対応API**:
  - Shopify API（Store URL, API Key, Access Token）
  - Amazon SP-API（Seller ID, Auth Token, Marketplace ID）
  - 楽天RMS API（Service Secret, License Key）
  - NextEngine API（UID, Password）
  - カスタムAPI（URL, Headers）

#### API自動切り替え
- **フォルダ選択時**: 自動でAPI設定を読み込み
- **チャット時**: 適切なAPIを自動使用
- **使用状況**: API使用状況の可視化（将来実装予定）

### 5. チャット保存・履歴機能

#### チャット保存
- **自動保存**: 全チャット履歴を自動保存
- **セッション管理**: チャットセッション単位での管理
- **タイトル自動生成**: 最初のメッセージから自動生成
- **検索機能**: 全文検索対応

#### コンテキスト同期
- **履歴参照**: プロジェクト内の全チャット履歴を参照
- **自動引用**: 関連する過去の会話を自動引用（将来実装予定）
- **コンテキスト管理**: 効率的なコンテキストウィンドウ管理
- **重要情報抽出**: 重要な情報の自動抽出（将来実装予定）

### 6. データベース設計

#### テーブル構造

```sql
-- プロジェクトフォルダ
project_folders (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  parent_id UUID,
  system_prompt TEXT,
  api_settings JSONB,
  prompt_variables JSONB,
  ...
)

-- プロジェクトファイル
project_files (
  id UUID PRIMARY KEY,
  project_id UUID,
  original_name VARCHAR(255),
  file_type VARCHAR(50),
  file_size BIGINT,
  storage_path TEXT,
  metadata JSONB,
  indexed BOOLEAN,
  ...
)

-- チャットセッション
chat_sessions (
  id UUID PRIMARY KEY,
  project_id UUID,
  title VARCHAR(255),
  system_prompt TEXT,
  message_count INTEGER,
  last_activity_at TIMESTAMP,
  ...
)

-- チャットメッセージ
chat_messages (
  id UUID PRIMARY KEY,
  chat_session_id UUID,
  role VARCHAR(20),
  content TEXT,
  metadata JSONB,
  sequence_number INTEGER,
  ...
)
```

#### セキュリティ
- **Row Level Security (RLS)**: 有効化済み
- **暗号化**: API設定情報の暗号化
- **アクセスログ**: ファイルアクセスの詳細ログ
- **権限管理**: ユーザーレベルでの権限制御

### 7. UI/UX改善

#### ショートカットキー
- **Cmd/Ctrl + K**: プロジェクト検索（将来実装予定）
- **Cmd/Ctrl + N**: 新規チャット
- **Cmd/Ctrl + Shift + N**: 新規フォルダ

#### ビジュアル改善
- **プロジェクトアイコン**: カラー設定とアイコン選択
- **ファイルプレビュー**: ファイル内容のプレビュー機能
- **チャット履歴**: タイムライン表示
- **ステータス表示**: プログレスバーとステータスインジケーター

## ファイル構成

### フロントエンド

```
frontend/src/
├── components/chat/
│   ├── ProjectSidebar.tsx          # プロジェクトサイドバー
│   ├── ProjectSettings.tsx         # プロジェクト設定ダイアログ
│   ├── FileUploadManager.tsx       # ファイルアップロード管理
│   └── ProjectManager.tsx          # メインプロジェクト管理
├── stores/
│   └── projectStore.ts             # プロジェクト状態管理（Zustand）
└── features/chat/
    └── components/ChatPanel/
        └── ChatPanel.tsx           # チャットパネル
```

### バックエンド

```
backend/
├── src/routes/
│   └── projectRoutes.js            # プロジェクト関連API
└── migrations/
    └── 007_create_project_management_tables.sql  # データベーススキーマ
```

## API仕様

### プロジェクト管理API

#### フォルダ操作
- `GET /api/v2/folders` - フォルダ一覧取得
- `POST /api/v2/folders` - フォルダ作成
- `PUT /api/v2/folders/:id` - フォルダ更新
- `DELETE /api/v2/folders/:id` - フォルダ削除

#### ファイル管理
- `GET /api/v2/projects/:projectId/files` - ファイル一覧
- `POST /api/v2/projects/:projectId/files` - ファイルアップロード
- `GET /api/v2/files/:fileId/download` - ファイルダウンロード
- `DELETE /api/v2/files/:fileId` - ファイル削除

#### チャット管理
- `GET /api/v2/projects/:projectId/chats` - チャットセッション一覧
- `POST /api/v2/projects/:projectId/chats` - チャットセッション作成
- `GET /api/v2/chats/:chatId/messages` - メッセージ一覧
- `POST /api/v2/chats/:chatId/messages` - メッセージ追加

## 使用技術

### フロントエンド
- **React 18**: UIライブラリ
- **TypeScript**: 型安全性
- **Material-UI v5**: UIコンポーネント
- **Zustand**: 状態管理
- **React Dropzone**: ファイルドロップ機能
- **Date-fns**: 日時処理

### バックエンド
- **Node.js**: サーバーサイド
- **Express**: Webフレームワーク
- **PostgreSQL**: データベース
- **Multer**: ファイルアップロード
- **UUID**: 一意識別子生成

### インフラ
- **Google Cloud Storage**: ファイルストレージ
- **PostgreSQL**: メインデータベース
- **Firebase**: ホスティング（予定）

## セットアップ手順

### 1. データベース設定

```bash
# マイグレーション実行
psql -U username -d database_name -f migrations/007_create_project_management_tables.sql
```

### 2. バックエンド設定

```bash
cd backend
npm install

# 環境変数設定
cp .env.example .env
# 必要な設定を.envに記入

npm start
```

### 3. フロントエンド設定

```bash
cd frontend
npm install

# 開発サーバー起動
npm run dev
```

## 今後の実装予定

### Phase 2
- [ ] ドラッグ&ドロップによるフォルダ整理
- [ ] プロジェクト検索機能
- [ ] ファイル内容の高度な検索
- [ ] チャット履歴の自動要約

### Phase 3
- [ ] プロジェクト共有機能
- [ ] API使用量の詳細分析
- [ ] チームコラボレーション機能
- [ ] カスタムプロンプトマーケットプレイス

### Phase 4
- [ ] AI によるプロジェクト分析
- [ ] 自動タグ付け機能
- [ ] インテリジェントな関連コンテンツ提案
- [ ] 高度なワークフロー自動化

## トラブルシューティング

### よくある問題

1. **ファイルアップロードが失敗する**
   - ファイルサイズが50MBを超えていないか確認
   - 対応形式（CSV, TXT, MD, XLSX, XLS, JSON, PDF）か確認

2. **チャット履歴が表示されない**
   - データベース接続を確認
   - ユーザー認証トークンが有効か確認

3. **プロジェクト設定が保存されない**
   - API設定の形式が正しいか確認
   - データベースの権限設定を確認

### ログの確認

```bash
# バックエンドログ
tail -f backend/logs/app.log

# フロントエンドのコンソールでエラーを確認
# ブラウザの開発者ツールを使用
```

## パフォーマンス最適化

### データベース
- インデックス最適化済み
- 全文検索インデックス設定済み
- 適切なページネーション実装

### フロントエンド
- 仮想化リスト（将来実装予定）
- メモ化による再レンダリング最適化
- 遅延読み込み実装済み

### ファイルストレージ
- CDN配信（将来実装予定）
- 画像最適化（将来実装予定）
- キャッシュ戦略実装済み

---

## サポート

技術的な質問や問題については、プロジェクトのIssueページで報告してください。

**実装日**: 2025年5月30日  
**最終更新**: 2025年5月30日  
**バージョン**: v1.0.0