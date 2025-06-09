# MultiLLM System

複数のLLMを統合管理し、Slackを通じて対話的なサポートを提供するシステム

## MultiLLM System ローカル実行ガイド

### 起動方法
`multiLLM_system`ディレクトリで `docker-compose up --build` を実行します。

### 詳細セットアップ（初回のみ）

1. **前提条件**
   - Docker と Docker Compose がインストールされていること
   - Python 3.11以上（ローカルテスト用）

2. **環境変数の設定**
   ```bash
   cp .env.example .env
   # .envファイルを編集してAPIキーを設定
   ```

3. **Dockerコンテナの起動**
   ```bash
   docker-compose up --build
   ```
   
   これにより以下が起動します：
   - MultiLLM APIサーバー（http://localhost:8000）
   - Ollamaサーバー（http://localhost:11434）

4. **動作確認**
   ```bash
   # APIの確認
   curl http://localhost:8000/workers/types
   
   # ローカルLLMのモデル一覧
   curl http://localhost:8000/local_llm/models
   ```

## アーキテクチャ

- **Orchestrator**: タスクの振り分けと管理
- **Worker LLMs**: 特化したタスク処理
- **Memory Sync**: OpenMemoryとの連携
- **Slack Integration**: ユーザーインターフェース

## デプロイ手順

### 1. 環境変数の設定

```bash
export SLACK_BOT_TOKEN="xoxb-..."
export SLACK_SIGNING_SECRET="..."
export SLACK_BOT_ID="U..."
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
export GOOGLE_AI_API_KEY="..."
export OPENMEMORY_URL="http://localhost:8765"
```

### 2. デプロイ実行

```bash
# Stagingへのデプロイ
./deploy.sh staging

# Productionへのデプロイ
./deploy.sh production
```

### 3. サービス停止

```bash
./stop.sh
```

## 設定カスタマイズ

`config/config_validator.py`で設定をカスタマイズできます：

- レート制限
- リトライ戦略
- メモリ同期間隔
- Worker設定

## セキュリティ機能

- URL検証とホワイトリスト
- リソース制限
- レート制限
- 環境変数検証
- エクスポネンシャルバックオフ

## モニタリング

- ヘルスチェックエンドポイント
- メトリクス収集
- エラーログ

## Phase 2 予定

- GitHub Webhook統合
- MCP拡張機能
- React UI
- 高度な分析機能