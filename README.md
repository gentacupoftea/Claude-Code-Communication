# Conea MultiLLM System

高度な質問に対応できるECドメイン特化のMultiLLMシステム

## 🚀 クイックスタート

### 1. 環境構築

```bash
# リポジトリのクローン
git clone <repository-url>
cd conea-integration

# 環境変数の設定
cp .env.example .env
# .envファイルを編集してAPIキーを設定
```

### 2. デプロイ

#### 開発環境
```bash
./deploy.sh dev
```

#### 本番環境
```bash
./deploy.sh prod
```

### 3. APIの使用

```bash
# 基本的なクエリ
curl -X POST https://localhost/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "過去3年間の季節性を考慮して、来月の売上を予測してください",
    "context": {
      "storeName": "テストストア",
      "period": "2024年1-10月",
      "metrics": {"monthly_sales": [100, 120, 110, 130]}
    }
  }'

# バッチクエリ
curl -X POST https://localhost/api/batch-query \
  -H "Content-Type: application/json" \
  -d '{
    "queries": [
      {
        "id": "1",
        "question": "在庫最適化の提案をお願いします",
        "context": {"current_stock": 1000}
      },
      {
        "id": "2", 
        "question": "顧客セグメント分析を実施してください",
        "context": {"total_customers": 50000}
      }
    ]
  }'
```

## 📊 システムアーキテクチャ

### コンポーネント

- **API Server** (port 3000): Express.js ベースのRESTful API
- **Nginx** (port 80/443): リバースプロキシ、SSL終端、レート制限
- **PostgreSQL** (port 5432): メタデータとログの永続化
- **Redis** (port 6379): キャッシュとセッション管理
- **Prometheus** (port 9090): メトリクス収集
- **Grafana** (port 3001): ダッシュボードと可視化

### LLMプロバイダー

- **Claude**: データ分析、説明、複雑な文脈理解
- **GPT-4**: 予測、数値計算、最適化問題
- **Gemini**: 創造的提案、戦略立案、アイデア生成

## 🛠️ 開発環境

### 前提条件

- Node.js 18+
- Docker & Docker Compose
- 各LLMプロバイダーのAPIキー

### ローカル開発

```bash
# 依存関係のインストール
npm install

# 開発サーバー起動
npm run dev

# TypeScriptコンパイル
npm run build

# テスト実行
npm test

# ベンチマークテスト
npm run test:benchmark:baseline
```

### 最適化とベンチマーク

```bash
# 改善サイクル実行（5回）
./improvement-cycle.sh

# 個別の最適化
npm run optimize:prompts
npm run optimize:routing

# 結果比較
npm run compare:results baseline.json improved.json

# 失敗分析
npm run analyze:failures results.json
```

## 📈 モニタリング

### ダッシュボード

- **Grafana**: http://localhost:3001 (admin/admin123)
  - システムメトリクス
  - API応答時間
  - エラー率
  - LLMプロバイダー別統計

- **Prometheus**: http://localhost:9090
  - 生メトリクス
  - アラート設定

### ヘルスチェック

```bash
# システム全体
curl https://localhost/health

# API状態
curl https://localhost/api/status

# サービス状態確認
./deploy.sh status
```

## 🔧 設定

### 環境変数

| 変数名 | 説明 | 必須 |
|--------|------|------|
| ANTHROPIC_API_KEY | Claude API キー | ✅ |
| OPENAI_API_KEY | OpenAI API キー | ✅ |
| GOOGLE_CLOUD_PROJECT_ID | Google Cloud プロジェクトID | ✅ |
| NODE_ENV | 実行環境 (development/production) | ✅ |
| JWT_SECRET | JWT署名用秘密鍵 | ✅ |
| DATABASE_PASSWORD | PostgreSQL パスワード | ✅ |

### APIエンドポイント

| エンドポイント | メソッド | 説明 |
|----------------|----------|------|
| `/health` | GET | ヘルスチェック |
| `/api/status` | GET | システム状態 |
| `/api/query` | POST | 単一質問 |
| `/api/batch-query` | POST | バッチ質問 |
| `/metrics` | GET | Prometheusメトリクス |

## 🚀 デプロイメント

### Docker Compose

```bash
# すべてのサービスを起動
docker-compose up -d

# 特定のサービスのみ
docker-compose up -d conea-multillm nginx

# ログ確認
docker-compose logs -f

# サービス停止
docker-compose down
```

### CI/CD

GitHub Actionsによる自動デプロイ:

1. **テスト** - コード品質チェック、ユニットテスト
2. **ビルド** - Dockerイメージ作成、レジストリプッシュ
3. **ベンチマーク** - 性能テスト実行
4. **デプロイ** - ステージング/本番環境へのデプロイ

## 📝 ログとトラブルシューティング

### ログ確認

```bash
# アプリケーションログ
docker-compose logs conea-multillm

# Nginxログ
docker-compose logs nginx

# データベースログ
docker-compose logs postgres

# 全サービスのログ
./deploy.sh logs
```

### よくある問題

1. **APIキーエラー**
   - `.env`ファイルの設定を確認
   - APIキーの有効性を確認

2. **SSL証明書エラー**
   - `ssl/`ディレクトリに有効な証明書を配置
   - 開発環境では自己署名証明書を使用

3. **メモリ不足**
   - Dockerのメモリ制限を確認
   - 不要なコンテナを停止

## 📚 ドキュメント

- [システム最適化レポート](MULTILLLM_OPTIMIZATION_REPORT.md)
- [APIリファレンス](docs/api-reference.md)
- [デプロイガイド](docs/deployment-guide.md)

## 🤝 コントリビューション

1. Forkプロジェクト
2. 機能ブランチ作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. Pull Requestを作成

## 📄 ライセンス

MIT License - 詳細は [LICENSE](LICENSE) ファイルを参照

## 🙋‍♂️ サポート

- Issues: GitHub Issues
- ドキュメント: [Wiki](../../wiki)
- メール: support@conea.ai

---

*Powered by Conea AI Platform - 2024*
## Frontend (Next.js)

新しいNext.jsベースのフロントエンドアプリケーション。

### 開発環境のセットアップ

\\n
開発サーバーが http://localhost:3001 で起動します。

### ビルドとデプロイ

\\n
### Firebase Hostingへのデプロイ

\\

## Frontend (Next.js)

新しいNext.jsベースのフロントエンドアプリケーション。

### 開発環境のセットアップ

```bash
cd frontend-next
npm install
npm run dev
```

開発サーバーが http://localhost:3001 で起動します。

### ビルドとデプロイ

```bash
cd frontend-next
npm run build
```

### Firebase Hostingへのデプロイ

```bash
cd frontend-next
npm run build
firebase deploy --only hosting
```
EOF < /dev/null