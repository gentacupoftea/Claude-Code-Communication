# Persona Analysis Service

ペルソナ分析サービス - Conea AI Platform

## 概要

このサービスは、動画、文書、購買データなどの複数のデータソースから顧客のペルソナを詳細に分析するマイクロサービスです。

## 主な機能

- 🎥 動画分析（音声・表情・行動パターン）
- 📝 テキスト分析（感情・センチメント）
- 🧠 性格特性分析（Big Five モデル）
- 📊 購買行動分析
- 📑 PDF レポート生成

## 技術スタック

- **Backend**: Node.js + TypeScript + Express
- **AI/ML**: OpenAI GPT-4, Anthropic Claude, Google Cloud AI
- **Queue**: Bull + Redis
- **Report**: Puppeteer
- **Storage**: Local filesystem / Cloud Storage

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

```bash
cp .env.example .env
# .env ファイルを編集して必要な API キーを設定
```

### 3. Redis の起動

```bash
docker run -d -p 6379:6379 redis:7-alpine
```

### 4. サービスの起動

```bash
# 開発モード
npm run dev

# 本番モード
npm run build
npm start
```

## API エンドポイント

### ヘルスチェック
```
GET /health
GET /health/ready
```

### ペルソナ分析
```
POST   /api/persona-analysis/analyze       - 新規分析の作成
GET    /api/persona-analysis/analyses      - 分析リストの取得
GET    /api/persona-analysis/analyses/:id  - 特定の分析の取得
GET    /api/persona-analysis/analyses/:id/status - 分析ステータスの取得
GET    /api/persona-analysis/analyses/:id/report - レポートのダウンロード
DELETE /api/persona-analysis/analyses/:id  - 分析の削除
```

## テスト

```bash
# ユニットテスト
npm test

# API テスト
./test-analysis.sh
```

## Docker での実行

```bash
docker build -t persona-analysis-service .
docker run -p 8002:8002 --env-file .env persona-analysis-service
```

## 設定項目

| 環境変数 | 説明 | デフォルト値 |
|---------|------|------------|
| PORT | サービスポート | 8002 |
| REDIS_URL | Redis 接続 URL | redis://localhost:6379/0 |
| OPENAI_API_KEY | OpenAI API キー | - |
| ANTHROPIC_API_KEY | Anthropic API キー | - |
| GOOGLE_APPLICATION_CREDENTIALS | GCP 認証ファイルパス | - |

## ライセンス

MIT