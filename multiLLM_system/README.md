# MultiLLM System

複数のLLMを統合管理し、Slackを通じて対話的なサポートを提供するシステム

## ローカルLLM実行環境

このシステムはDockerを使って、ローカルLLM（Ollama）を含んだ開発環境を簡単に構築できます。

### 1. 前提条件
- Docker と Docker Compose がインストールされていること。
- Ollamaで利用したいモデルがローカルにダウンロードされていること。（初回起動時に自動でダウンロードされます）

### 2. セットアップ手順
1.  リポジトリのルートで、環境変数ファイルを作成します。
    ```bash
    cp multiLLM_system/.env.example multiLLM_system/.env
    ```
2.  必要に応じて、`.env`ファイル内の`ANTHROPIC_API_KEY`などを設定してください。

### 3. 起動方法
`multiLLM_system`ディレクトリに移動し、以下のコマンドを実行します。
```bash
cd multiLLM_system
docker-compose up --build
```
初回起動時はOllamaイメージのダウンロードなどで時間がかかることがあります。

### 4. テスト方法
環境が起動したら、別のターミナルを開き、以下のテストクライアントを実行します。
```bash
python multiLLM_system/local_llm_test_client.py
```
コンソールに「✅ Success!」とJSONレスポンスが表示されれば成功です。

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