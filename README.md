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

## 🛍️ Shopify統合設定

### 環境変数設定

Shopify APIを使用するには以下の環境変数を設定してください：

```bash
# .envファイルに追加
SHOPIFY_API_KEY=your_shopify_api_key_here
SHOPIFY_API_SECRET=your_shopify_api_secret_here
SHOPIFY_STORE_DOMAIN=your_store_name  # .myshopify.comは含めない
SHOPIFY_ACCESS_TOKEN=your_shopify_access_token_here
SHOPIFY_API_VERSION=2024-01
SHOPIFY_SCOPES=read_products,read_orders,read_customers
```

### Shopifyアプリ設定手順

1. **Shopify Partnersでアプリを作成**
   - https://partners.shopify.com にアクセス
   - 新しいアプリを作成し、API_KEYとAPI_SECRETを取得

2. **ストア権限の設定**
   - 必要なスコープ（read_products, read_orders, read_customers）を設定
   - アクセストークンを生成

3. **接続テスト**
   ```bash
   curl http://localhost:8000/api/shopify/test-connection
   ```

### トラブルシューティング

- **"RedisStore is not a constructor" エラー**: Redis接続の問題。Redisサーバーが起動していることを確認
- **API接続エラー**: 環境変数の設定を確認。ストア名に`.myshopify.com`を含めないでください
- **権限エラー**: アプリのスコープ設定と実際の権限が一致していることを確認

### 注意事項

- Shopify設定がなくても他の機能は正常に動作します
- Shopifyエラーが発生した場合、503エラーでフォールバック応答を返します

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

## 🎯 プロジェクト進捗状況 (v1.1.0)

### ✅ 完了済み
- **Phase 1**: 基盤アーキテクチャ構築
- **Phase 2**: MultiLLM統合
- **Phase 3**: API統合 (Shopify, Google Analytics, Rakuten)
- **Phase 4**: AI/ML機能実装
- **Frontend v2**: Next.js 15.2.3 統合完了
- **統合バックエンド**: 単一エンドポイント化
- **認証システム**: JWT + Firebase Auth
- **監視システム**: Prometheus + Grafana

### 🚧 継続中
- **21件のオープンPR**: 機能拡張・バグ修正
- **パフォーマンス最適化**: API応答時間改善
- **セキュリティ強化**: 脆弱性対応
- **ドキュメント整備**: 開発者ガイド更新

### 📈 次期ロードマップ (v1.2.0)
- **リアルタイム分析**: WebSocket実装
- **モバイルアプリ**: React Native
- **エンタープライズ機能**: SSO, RBAC
- **国際化**: 多言語対応

## 🏗️ フロントエンド v2 (Next.js 15.2.3)

最新のNext.jsベースのフロントエンドアプリケーション。React 19とTypeScriptを活用。

### 開発環境のセットアップ

```bash
cd frontend-v2
npm install
npm run dev
```

開発サーバーが http://localhost:3000 で起動します。

### ビルドとデプロイ

```bash
cd frontend-v2
npm run build
npm run export  # 静的エクスポート
```

### Firebase Hostingへのデプロイ

```bash
cd frontend-v2
npm run build
firebase deploy --only hosting
```

---

*Powered by Conea AI Platform - v1.1.0 (2025)*