# Conea Production Deployment Guide

本ドキュメントでは、Coneaシステムの本番環境へのデプロイ方法について説明します。Coneaは、Blue-Greenデプロイメント戦略を使用して、ゼロダウンタイムのデプロイを実現しています。

## 目次

1. [アーキテクチャ概要](#アーキテクチャ概要)
2. [デプロイ前の準備](#デプロイ前の準備)
3. [手動デプロイ手順](#手動デプロイ手順)
4. [自動デプロイ（GitHubアクション）](#自動デプロイgithubアクション)
5. [ロールバック手順](#ロールバック手順)
6. [モニタリングとトラブルシューティング](#モニタリングとトラブルシューティング)

## アーキテクチャ概要

Conea本番環境は以下のコンポーネントから構成されています：

- **フロントエンド**: React/TypeScriptベースのSPA（Single Page Application）
- **バックエンド**: Node.js/Python ハイブリッドアプリケーション
- **データベース**: MongoDB（認証有効）
- **キャッシュ**: Redis
- **リバースプロキシ**: Nginx
- **Blue-Greenデプロイメント環境**: 2つの同一環境（blue/green）

### Blue-Greenデプロイメント

Blue-Greenデプロイメントは、リスクを最小限に抑えながらアプリケーションをアップデートする方法です：

1. 現在のアクティブ環境（blue）が本番トラフィックを処理
2. 新バージョンを非アクティブ環境（green）にデプロイ
3. テストと検証を実施
4. Nginxの設定を変更して、トラフィックを新環境（green）に切り替え
5. 次回のデプロイでは、逆の環境セットを使用

この方法により、デプロイ中のダウンタイムをゼロにし、問題が発生した場合の迅速なロールバックが可能になります。

## デプロイ前の準備

### 環境変数の設定

本番環境の`.env`ファイルには以下の変数が必要です：

```
# MongoDB認証情報
MONGO_ROOT_USERNAME=<ユーザー名>
MONGO_ROOT_PASSWORD=<パスワード>

# Redis認証情報
REDIS_PASSWORD=<パスワード>

# JWT認証用シークレット
JWT_SECRET=<長くランダムな文字列>

# Shopify API認証情報
SHOPIFY_SHOP_NAME=<shop-name>
SHOPIFY_ACCESS_TOKEN=<access-token>
SHOPIFY_API_VERSION=2025-04

# その他の設定
LOG_LEVEL=info
NODE_ENV=production
```

### ディレクトリ構造

本番サーバーには以下のディレクトリ構造を設定します：

```
/opt/conea/
├── blue/                 # Blue環境
│   ├── docker-compose.yml
│   └── .env
├── green/                # Green環境
│   ├── docker-compose.yml
│   └── .env
├── nginx/                # Nginx設定
│   ├── conf.d/
│   │   └── production.conf
│   ├── certs/
│   │   ├── conea.example.com.crt
│   │   └── conea.example.com.key
│   └── logs/
├── data/                 # 永続データ（ボリュームマウント用）
│   ├── mongo/
│   └── redis/
└── current_env.txt       # 現在アクティブな環境を示すファイル
```

## 手動デプロイ手順

1. **SSH接続**:
   ```bash
   ssh admin@conea-production-server
   ```

2. **環境変数の設定**:
   ```bash
   cd /opt/conea
   CURRENT_ENV=$(cat current_env.txt 2>/dev/null || echo "blue")
   if [ "$CURRENT_ENV" = "blue" ]; then
     NEXT_ENV="green"
   else
     NEXT_ENV="blue"
   fi
   ```

3. **新バージョンのデプロイ**:
   ```bash
   cd $NEXT_ENV
   
   # 設定の更新
   git pull
   
   # 最新イメージの取得
   docker-compose pull
   
   # コンテナの再起動
   docker-compose down
   docker-compose up -d
   ```

4. **ヘルスチェック**:
   ```bash
   # 30秒待機してサービスの初期化
   sleep 30
   
   # バックエンドとフロントエンドの健全性を確認
   curl -f http://localhost:8080/health
   curl -f http://localhost:3000/health.txt
   ```

5. **トラフィックの切り替え**:
   ```bash
   cd /opt/conea/nginx
   
   # Nginx設定を更新して新環境へトラフィックをルーティング
   sed -i "s/proxy_pass http:\/\/$CURRENT_ENV/proxy_pass http:\/\/$NEXT_ENV/g" conf.d/production.conf
   
   # Nginxに設定をリロードさせる
   docker exec nginx-proxy nginx -s reload
   
   # 現在のアクティブ環境を更新
   echo $NEXT_ENV > /opt/conea/current_env.txt
   ```

## 自動デプロイ（GitHubアクション）

Coneaは、GitHubアクションを使用して自動デプロイを行います。これは、`main`ブランチへのマージ時または手動トリガーで実行されます。

### 自動デプロイプロセス

1. セキュリティスキャン
2. アプリケーションのビルドとテスト
3. Dockerイメージのビルドとプッシュ
4. Blue-Greenデプロイメントの実行
5. ヘルスチェックと検証
6. トラフィックの切り替え

### 手動デプロイのトリガー

GitHubインターフェースから手動デプロイを開始するには：

1. リポジトリのActionsタブに移動
2. "Deploy to Production"ワークフローを選択
3. "Run workflow"ボタンをクリック
4. デプロイバージョンを入力（オプション）
5. "Run workflow"を再度クリックして確認

## ロールバック手順

デプロイに問題が発生した場合、以下の手順でロールバックします：

1. **以前の環境に切り替え**:
   ```bash
   cd /opt/conea
   CURRENT_ENV=$(cat current_env.txt)
   if [ "$CURRENT_ENV" = "blue" ]; then
     ROLLBACK_ENV="green"
   else
     ROLLBACK_ENV="blue"
   fi
   
   # Nginx設定を更新して以前の環境にトラフィックをルーティング
   cd /opt/conea/nginx
   sed -i "s/proxy_pass http:\/\/$CURRENT_ENV/proxy_pass http:\/\/$ROLLBACK_ENV/g" conf.d/production.conf
   
   # Nginxに設定をリロード
   docker exec nginx-proxy nginx -s reload
   
   # 現在のアクティブ環境を更新
   echo $ROLLBACK_ENV > /opt/conea/current_env.txt
   ```

2. **問題の調査**:
   ```bash
   # 失敗した環境のログを確認
   cd /opt/conea/$CURRENT_ENV
   docker-compose logs
   ```

## モニタリングとトラブルシューティング

### ログへのアクセス

```bash
# フロントエンドログ
docker logs conea_frontend_1

# バックエンドログ
docker logs conea_backend_1

# MongoDBログ
docker logs conea_mongo_1

# Redisログ
docker logs conea_redis_1

# Nginxログ
cd /opt/conea/nginx/logs
tail -f access.log error.log
```

### 一般的な問題と解決策

**問題**: ヘルスチェックの失敗
**解決策**: バックエンドとフロントエンドのログを確認し、具体的なエラーメッセージを特定

**問題**: データベース接続エラー
**解決策**: MongoDB認証情報を確認し、MongoDB コンテナが起動していることを確認

**問題**: キャッシュエラー
**解決策**: Redis認証情報を確認し、Redis コンテナが起動していることを確認

---

このデプロイガイドについて質問がある場合は、Conea開発チームにお問い合わせください。
EOF < /dev/null