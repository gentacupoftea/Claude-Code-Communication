# Conea Platform 開発者セットアップガイド v1.1.0

このガイドでは、Conea Platform v1.1.0の開発環境セットアップ手順を詳しく説明します。

## 目次

1. [開発環境概要](#開発環境概要)
2. [前提条件](#前提条件)
3. [Claude Code設定](#claude-code設定)
4. [プロジェクトセットアップ](#プロジェクトセットアップ)
5. [Git運用ルール](#git運用ルール)
6. [開発ワークフロー](#開発ワークフロー)
7. [テストとデバッグ](#テストとデバッグ)
8. [トラブルシューティング](#トラブルシューティング)

## 開発環境概要

### アーキテクチャ構成

```
開発者マシン
├── Claude Code (dangerouslySkipPermissions: true)
├── Frontend v2 (Next.js 15.2.3 + React 19)
├── 統合バックエンド (Node.js + Python)
├── PostgreSQL + Redis (Docker)
└── LLMプロバイダー統合 (Claude, GPT-4, Gemini)
```

### 推奨開発環境

- **OS**: macOS 13+ / Ubuntu 22.04+ / Windows 11 + WSL2
- **エディタ**: Claude Code (推奨) / VS Code / WebStorm
- **ターミナル**: iTerm2 / Windows Terminal / GNOME Terminal

## 前提条件

### 必須ソフトウェア

```bash
# Node.js (推奨: v22.15.0)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 22.15.0
nvm use 22.15.0

# Python (3.9+)
pyenv install 3.9.18
pyenv global 3.9.18

# Docker & Docker Compose
# macOS: Docker Desktop をインストール
# Ubuntu: 
sudo apt update
sudo apt install docker.io docker-compose-v2

# Git (2.40+)
git --version
```

### 開発ツール

```bash
# pnpm (高速パッケージマネージャー)
npm install -g pnpm

# Firebase CLI
npm install -g firebase-tools

# Google Cloud CLI
curl https://sdk.cloud.google.com | bash

# Claude Code CLI
npm install -g @anthropic-ai/claude-code
```

## Claude Code設定

### 1. Claude Code インストール

```bash
# Claude Code のインストール
npm install -g @anthropic-ai/claude-code

# バージョン確認
claude-code --version
```

### 2. 設定ファイル作成

#### ~/.claude-code/config.json
```json
{
  "dangerouslySkipPermissions": true,
  "editor": {
    "defaultEditor": "code",
    "enableAutocomplete": true,
    "enableSyntaxHighlighting": true
  },
  "ai": {
    "provider": "anthropic",
    "model": "claude-3-sonnet",
    "maxTokens": 4096
  },
  "workspace": {
    "autoSave": true,
    "gitIntegration": true,
    "liveReload": true
  },
  "security": {
    "allowFileSystem": true,
    "allowNetworking": true,
    "allowShellCommands": true
  },
  "extensions": [
    "typescript",
    "react",
    "nodejs",
    "python",
    "docker",
    "git"
  ]
}
```

### 3. プロジェクト固有設定

#### .claude-code/project.json
```json
{
  "name": "conea-platform",
  "version": "1.1.0",
  "type": "fullstack",
  "framework": {
    "frontend": "nextjs",
    "backend": "nodejs",
    "database": "postgresql"
  },
  "scripts": {
    "dev": "pnpm run dev:all",
    "build": "pnpm run build:all",
    "test": "pnpm run test:all",
    "deploy": "pnpm run deploy:staging"
  },
  "ai": {
    "contextFiles": [
      "README.md",
      "ARCHITECTURE.md",
      "API_REFERENCE.md",
      "package.json",
      "frontend-v2/package.json"
    ],
    "excludePatterns": [
      "node_modules/**",
      "dist/**",
      "build/**",
      ".next/**",
      "*.log"
    ]
  }
}
```

### 4. CLAUDE.md設定

プロジェクトルートに作成：

```markdown
# Claude Code プロジェクト設定

## プロジェクト概要
Conea Platform v1.1.0 - AI統合ECプラットフォーム

## 重要な指示
1. **セキュリティ**: dangerouslySkipPermissions: true は開発環境のみ
2. **コード品質**: TypeScript厳格モード、ESLint、Prettier必須
3. **Git**: コミット前に必ずテスト実行
4. **AI統合**: 複数LLMプロバイダーの適切な使い分け

## 技術スタック
- Frontend: Next.js 15.2.3, React 19, TypeScript 5.6+
- Backend: Node.js 18+, Python 3.9+
- Database: PostgreSQL 14+, Redis 7+
- AI: Claude, GPT-4, Gemini

## 開発ルール
- Pull Requestは必ずレビュー後にマージ
- main ブランチへの直接pushは禁止
- 機能開発は feature/ ブランチで実施
- hotfix は hotfix/ ブランチで実施

## よく使うコマンド
```bash
# 開発サーバー起動
pnpm dev:all

# テスト実行
pnpm test

# ビルド
pnpm build

# デプロイ（ステージング）
pnpm deploy:staging
```
```

## プロジェクトセットアップ

### 1. リポジトリクローン

```bash
# SSH使用（推奨）
git clone git@github.com:your-org/conea-integration.git
cd conea-integration

# HTTPS使用
git clone https://github.com/your-org/conea-integration.git
cd conea-integration
```

### 2. 環境変数設定

```bash
# 開発用環境変数ファイル作成
cp .env.example .env.development

# .env.development 編集
```

#### .env.development の設定例
```bash
# 基本設定
NODE_ENV=development
PORT=3000
API_PORT=8000

# データベース
DATABASE_URL=postgresql://conea:password@localhost:5432/conea_dev
REDIS_URL=redis://localhost:6379

# AI プロバイダー
ANTHROPIC_API_KEY=sk-ant-xxxxx
OPENAI_API_KEY=sk-xxxxx
GOOGLE_AI_API_KEY=xxxxx

# EC API
SHOPIFY_ACCESS_TOKEN=shpat_xxxxx
SHOPIFY_SHOP_NAME=your-dev-shop
RAKUTEN_APP_ID=xxxxx
RAKUTEN_SECRET=xxxxx

# Firebase (開発用)
FIREBASE_PROJECT_ID=conea-dev
FIREBASE_API_KEY=xxxxx
FIREBASE_AUTH_DOMAIN=conea-dev.firebaseapp.com

# セキュリティ
JWT_SECRET=dev-jwt-secret-key
CORS_ORIGIN=http://localhost:3000,http://localhost:8000

# ログレベル
LOG_LEVEL=debug
```

### 3. 依存関係インストール

```bash
# ルートディレクトリ
pnpm install

# フロントエンド
cd frontend-v2
pnpm install
cd ..

# バックエンド依存関係（Python）
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements-dev.txt
```

### 4. データベースセットアップ

```bash
# Docker でローカル開発環境起動
docker-compose -f docker-compose.dev.yml up -d postgres redis

# データベース初期化
pnpm run db:migrate
pnpm run db:seed:dev

# 接続確認
psql postgresql://conea:password@localhost:5432/conea_dev
```

### 5. 開発サーバー起動

```bash
# 全サービス並列起動
pnpm run dev:all

# 個別起動
pnpm run dev:frontend    # http://localhost:3000
pnpm run dev:backend     # http://localhost:8000
pnpm run dev:ai          # http://localhost:8080
```

## Git運用ルール

### ブランチ戦略

```
main
├── develop
│   ├── feature/user-authentication
│   ├── feature/llm-integration  
│   └── feature/analytics-dashboard
├── release/v1.1.0
├── hotfix/critical-security-fix
└── staging
```

### ブランチ命名規則

```bash
# 機能開発
feature/機能名-簡潔な説明
例: feature/user-auth, feature/shopify-integration

# バグ修正
bugfix/issue番号-簡潔な説明
例: bugfix/123-api-timeout

# ホットフィックス
hotfix/重要度-簡潔な説明
例: hotfix/critical-security

# リリース
release/バージョン
例: release/v1.1.0, release/v1.2.0
```

### コミットメッセージ規則

```bash
# 形式: <type>(<scope>): <subject>

# 例:
feat(auth): ユーザー認証機能を追加
fix(api): Shopify API接続タイムアウトを修正
docs(readme): セットアップ手順を更新
style(frontend): ESLintエラーを修正
refactor(backend): データベース接続ロジックを改善
test(integration): E2Eテストケースを追加
chore(deps): 依存関係を更新

# type の種類:
- feat: 新機能
- fix: バグ修正
- docs: ドキュメント
- style: コードフォーマット
- refactor: リファクタリング
- test: テスト追加・修正
- chore: その他のメンテナンス
```

### プルリクエスト手順

```bash
# 1. 機能ブランチ作成
git checkout -b feature/new-dashboard
git push -u origin feature/new-dashboard

# 2. 開発・コミット
git add .
git commit -m "feat(dashboard): 新しいダッシュボード画面を追加"

# 3. プッシュ
git push origin feature/new-dashboard

# 4. プルリクエスト作成
gh pr create --title "新しいダッシュボード機能" --body "説明文"

# 5. レビュー・マージ後
git checkout develop
git pull origin develop
git branch -d feature/new-dashboard
```

### プルリクエストテンプレート

#### .github/pull_request_template.md
```markdown
## 変更内容
<!-- 何を変更したかを簡潔に説明 -->

## 変更理由
<!-- なぜこの変更が必要かを説明 -->

## テスト
- [ ] 単体テストが通る
- [ ] 結合テストが通る
- [ ] 手動テストを実施
- [ ] セキュリティチェック済み

## スクリーンショット（UI変更の場合）
<!-- Before/After のスクリーンショット -->

## チェックリスト
- [ ] TypeScriptエラーなし
- [ ] ESLint/Prettierエラーなし
- [ ] ドキュメント更新済み
- [ ] 破壊的変更がある場合、CHANGELOG.mdを更新

## 関連Issue
<!-- Closes #123 -->

## レビュアー
@team-lead @senior-dev
```

## 開発ワークフロー

### 1. 日常の開発フロー

```bash
# 毎朝の作業開始
git checkout develop
git pull origin develop

# 新機能開発
git checkout -b feature/new-feature
code .  # Claude Code で開発

# テスト実行
pnpm test
pnpm run lint
pnpm run type-check

# コミット
git add .
git commit -m "feat: 新機能を追加"
git push origin feature/new-feature

# プルリクエスト作成
gh pr create
```

### 2. コード品質チェック

```bash
# 手動チェック
pnpm run lint:fix          # ESLint自動修正
pnpm run format           # Prettier自動整形
pnpm run type-check       # TypeScript型チェック
pnpm run test:unit        # 単体テスト
pnpm run test:integration # 結合テスト

# 自動チェック（pre-commit hook）
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

pnpm run lint
pnpm run type-check
pnpm run test:unit
```

### 3. デバッグ手順

#### フロントエンド（Next.js）
```bash
# 開発サーバーでのデバッグ
pnpm run dev:frontend

# ブラウザ開発者ツール + React DevTools
# Chrome拡張: React Developer Tools

# Next.js デバッガー
NODE_OPTIONS='--inspect' pnpm run dev:frontend
```

#### バックエンド（Node.js）
```bash
# VS Code デバッガー設定
# .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Backend",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/backend/server.js",
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal"
    }
  ]
}

# コマンドラインデバッグ
node --inspect backend/server.js
```

## テストとデバッグ

### テスト戦略

```bash
# テストピラミッド
├── E2E テスト (5%)      # Playwright
├── 結合テスト (15%)     # Jest + Supertest  
├── 単体テスト (80%)     # Jest + Testing Library
```

### テスト実行

```bash
# 全テスト実行
pnpm test

# テストタイプ別実行
pnpm run test:unit        # 単体テスト
pnpm run test:integration # 結合テスト
pnpm run test:e2e         # E2Eテスト

# 特定ファイルのテスト
pnpm test src/components/Dashboard.test.tsx

# ウォッチモード
pnpm test --watch

# カバレッジ報告
pnpm test --coverage
```

### デバッグツール

#### 1. ログ設定
```javascript
// 開発用ログ設定
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'debug.log' })
  ]
});

// 使用例
logger.debug('デバッグ情報', { userId, action });
logger.info('処理完了', { duration });
logger.error('エラー発生', { error: error.message });
```

#### 2. API テストツール
```bash
# HTTPie でAPI テスト
http GET http://localhost:8000/api/health

# curl でAPI テスト  
curl -X POST http://localhost:8000/api/llm/query \
  -H "Content-Type: application/json" \
  -d '{"question": "テスト質問"}'

# Postman Collection
# postman/conea-api.json をインポート
```

#### 3. データベースデバッグ
```bash
# PostgreSQL接続
psql postgresql://conea:password@localhost:5432/conea_dev

# クエリ実行時間計測
\timing on
SELECT * FROM users WHERE created_at > NOW() - INTERVAL '7 days';

# スロークエリログ
tail -f /var/log/postgresql/postgresql.log | grep "duration:"
```

## トラブルシューティング

### よくある問題と解決方法

#### 1. Node.js バージョン問題
```bash
# エラー: Node.js version not supported
# 解決:
nvm list
nvm use 22.15.0
rm -rf node_modules package-lock.json
pnpm install
```

#### 2. TypeScript型エラー
```bash
# エラー: Type errors in build
# 解決:
pnpm run type-check
# .d.ts ファイルを確認・更新
# 型定義パッケージをインストール
pnpm add -D @types/node @types/react
```

#### 3. API接続エラー
```bash
# エラー: API connection refused
# 解決:
# 1. バックエンドサーバー起動確認
pnpm run dev:backend

# 2. ポート番号確認
lsof -i :8000

# 3. 環境変数確認
echo $API_URL
```

#### 4. Docker関連エラー
```bash
# エラー: Docker daemon not running
# 解決:
# macOS: Docker Desktop を起動
# Linux: 
sudo systemctl start docker

# ポート競合
docker-compose down
docker-compose up -d

# イメージキャッシュクリア
docker system prune -af
```

#### 5. Firebase認証エラー
```bash
# エラー: Firebase auth failed
# 解決:
firebase login
firebase use conea-dev
firebase projects:list

# 設定ファイル確認
cat firebase.json
echo $FIREBASE_PROJECT_ID
```

### パフォーマンス最適化

#### フロントエンド最適化
```bash
# Bundle分析
pnpm run analyze

# 画像最適化
pnpm add next-optimized-images

# コード分割確認
# Next.js Bundle Analyzer で確認
```

#### バックエンド最適化
```bash
# プロファイリング
node --prof backend/server.js
node --prof-process isolate-*.log > profile.txt

# メモリ使用量監視
node --inspect --expose-gc backend/server.js
```

### セキュリティチェック

```bash
# 依存関係脆弱性チェック
pnpm audit
pnpm audit --fix

# セキュリティヘッダーチェック
curl -I http://localhost:3000

#環境変数漏洩チェック
git log --all --full-history -- .env*
```

## 開発者リソース

### ドキュメント
- [API リファレンス](./API_REFERENCE.md)
- [アーキテクチャ概要](./ARCHITECTURE.md)
- [デプロイメントガイド](./DEPLOYMENT_GUIDE_v1.1.0.md)

### コミュニティ
- **Slack**: #conea-dev-team
- **GitHub Discussions**: プロジェクト相談
- **Weekly Standup**: 毎週火曜日 10:00

### 便利なスクリプト

#### 開発環境リセット
```bash
#!/bin/bash
# reset-dev-env.sh

echo "開発環境をリセットしています..."

# Docker環境停止・削除
docker-compose -f docker-compose.dev.yml down -v

# node_modules削除
rm -rf node_modules
rm -rf frontend-v2/node_modules

# 依存関係再インストール
pnpm install
cd frontend-v2 && pnpm install && cd ..

# データベース再構築
docker-compose -f docker-compose.dev.yml up -d postgres redis
sleep 10
pnpm run db:migrate
pnpm run db:seed:dev

echo "開発環境のリセットが完了しました"
```

#### コード品質チェック
```bash
#!/bin/bash
# quality-check.sh

echo "コード品質をチェックしています..."

# TypeScript型チェック
echo "📝 TypeScript型チェック"
pnpm run type-check

# ESLint
echo "🔍 ESLintチェック"
pnpm run lint

# Prettier
echo "🎨 コードフォーマットチェック"
pnpm run format:check

# 単体テスト
echo "🧪 単体テスト実行"
pnpm run test:unit

# セキュリティチェック
echo "🔒 セキュリティチェック"
pnpm audit

echo "✅ 全てのチェックが完了しました"
```

---

*最終更新: 2025-05-31 | Conea Platform v1.1.0*
*このガイドに関する質問は #conea-dev-team でお気軽にどうぞ！*