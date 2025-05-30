# Conea Staging API Documentation

## Overview

Conea Staging バックエンドAPIは、MultiLLM統合サービスを提供し、AI機能へのアクセスを可能にします。

## Base URL

- Development: `http://localhost:8000`
- Production: `https://conea-backend-staging-<hash>-an.a.run.app`

## Authentication

すべてのMultiLLM APIエンドポイントは、環境変数で設定されたAPIキーを使用して認証されます。

## Endpoints

### 1. Health Check

```
GET /api/health
```

サーバーの稼働状況を確認します。

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-05-29T12:00:00.000Z",
  "version": "1.0.0",
  "environment": "production",
  "mode": "production",
  "services": {
    "api": "running",
    "multiLLM": "configured",
    "database": "file_based"
  }
}
```

### 2. Chat API

```
POST /api/chat
```

AIチャット機能を提供します。

**Request Body:**
```json
{
  "messages": [
    {"role": "user", "content": "こんにちは"}
  ],
  "model": "gpt-3.5-turbo",
  "temperature": 0.7,
  "max_tokens": 1000,
  "system_prompt": "You are a helpful assistant."
}
```

### 3. Meeting API

#### Upload Meeting
```
POST /api/v2/multillm/meeting/upload
```

音声・動画ファイルをアップロードして文字起こし・分析を行います。

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Fields:
  - `file`: 音声/動画ファイル (必須)
  - `language`: 言語コード (オプション, デフォルト: "ja")
  - `generateSummary`: 要約生成 (オプション, boolean)
  - `analyzeContent`: 内容分析 (オプション, boolean)

#### Get Meeting Status
```
GET /api/v2/multillm/meeting/:id/status
```

処理ステータスを確認します。

#### Get Meeting Result
```
GET /api/v2/multillm/meeting/:id/result
```

処理結果を取得します。

#### Export Meeting
```
POST /api/v2/multillm/meeting/:id/export
```

結果を指定フォーマットでエクスポートします。

**Request Body:**
```json
{
  "format": "pdf",
  "options": {
    "includeTimestamps": true,
    "includeSpeakers": true,
    "includeSummary": true
  }
}
```

### 4. Task Execution API

```
POST /api/v2/multillm/execute
```

汎用的なAIタスクを実行します。

**Request Body:**
```json
{
  "taskType": "text_generation",
  "input": "AIについて説明してください",
  "model": "gpt-4",
  "parameters": {
    "temperature": 0.7,
    "maxTokens": 500
  }
}
```

### 5. Workflow API

#### Execute Workflow
```
POST /api/v2/multillm/workflow/execute
```

事前定義されたワークフローを実行します。

#### List Workflows
```
GET /api/v2/multillm/workflows
```

利用可能なワークフロー一覧を取得します。

### 6. Workers Status

```
GET /api/v2/multillm/workers/status
```

ワーカーの状態を確認します。

### 7. CSV Analysis

```
POST /api/v2/multillm/analyze/csv
```

CSVファイルを分析します。

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Fields:
  - `file`: CSVファイル (必須)
  - `analysisOptions`: 分析オプション (オプション, JSON文字列)

### 8. Market Research

```
POST /api/v2/multillm/research/market
```

市場調査を実行します。

**Request Body:**
```json
{
  "topic": "AI市場の動向",
  "region": "日本",
  "timeframe": "2024-2025",
  "depth": "detailed"
}
```

### 9. Code Execution

```
POST /api/v2/multillm/execute/code
```

コードを安全な環境で実行します。

**Request Body:**
```json
{
  "language": "python",
  "code": "print('Hello, World!')",
  "input": "",
  "timeout": 10000
}
```

### 10. API Settings

```
GET /api/settings/apis
```

API設定を取得します。

```
POST /api/settings/apis
```

API設定を更新します。

### 11. Dashboard Management

```
GET /api/dashboards
```

ダッシュボード一覧を取得します。

```
POST /api/dashboards
```

ダッシュボードを保存します。

### 12. Learning Data

```
GET /api/learning-data
```

学習データ一覧を取得します。

```
POST /api/learning-data/upload
```

学習データをアップロードします。

## Error Responses

すべてのエンドポイントは以下の形式でエラーを返します：

```json
{
  "error": "エラータイプ",
  "message": "詳細なエラーメッセージ",
  "status": "error"
}
```

### Common Error Codes

- `400` - Bad Request: リクエストが不正です
- `401` - Unauthorized: 認証が必要です
- `403` - Forbidden: アクセスが禁止されています
- `404` - Not Found: リソースが見つかりません
- `500` - Internal Server Error: サーバーエラー
- `503` - Service Unavailable: サービス利用不可

## Rate Limiting

現在、レート制限は実装されていませんが、将来的に以下の制限が適用される可能性があります：

- 1分あたり60リクエスト
- 1時間あたり1000リクエスト

## CORS

以下のオリジンからのアクセスが許可されています：

- `http://localhost:3000`
- `http://localhost:3001`
- `https://staging-conea-ai.web.app`
- `https://staging.conea.ai`
- `https://conea.ai`

## WebSocket Support (Future)

将来的にリアルタイム通信のためのWebSocketサポートが追加される予定です。

## SDK Usage Examples

### JavaScript/TypeScript

```typescript
import { multiLLMAPI, meetingAPI } from '@/lib/api';

// タスク実行
const result = await multiLLMAPI.executeTask({
  taskType: 'text_generation',
  input: 'AIについて説明してください',
  model: 'gpt-4'
});

// ミーティングアップロード
const meeting = await meetingAPI.uploadMeeting(file, {
  language: 'ja',
  generateSummary: true
});
```

## Deployment

### Cloud Run

```bash
gcloud run deploy conea-backend-staging \
  --image gcr.io/conea-48fcf/conea-backend-staging \
  --region asia-northeast1 \
  --platform managed \
  --allow-unauthenticated
```

### Environment Variables

必要な環境変数：

- `NODE_ENV`: 実行環境 (development/production)
- `PORT`: サーバーポート (デフォルト: 8000)
- `MULTILLM_API_URL`: MultiLLM APIのURL
- `MULTILLM_API_KEY`: MultiLLM APIキー
- `FRONTEND_URL`: フロントエンドURL (CORS用)