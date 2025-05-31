# Conea ステージング環境デプロイ

このディレクトリには、Coneaアプリケーションをステージング環境にデプロイするために必要なファイルとスクリプトが含まれています。

## 前提条件

- Docker と Docker Compose がインストールされていること
- Git がインストールされていること
- Node.js v18 以上がインストールされていること（開発環境用）
- openssl がインストールされていること（自己署名証明書の生成用）

## ディレクトリ構造

```
deployment/staging/
├── .env.example          # 環境変数のサンプルファイル
├── README.md             # このファイル
├── backend.Dockerfile    # バックエンドのDockerfile
├── config.js             # ステージング環境の設定ファイル
├── deploy.sh             # デプロイスクリプト
├── docker-compose.yml    # Docker Composeの設定ファイル
├── frontend.Dockerfile   # フロントエンドのDockerfile
└── nginx/                # Nginx設定ファイル
    └── conf.d/           # Nginxの設定ディレクトリ
        └── conea.conf    # Conea用のNginx設定
```

## デプロイ手順

### 1. 環境変数の設定

`.env.example` ファイルをコピーして `.env` ファイルを作成し、必要に応じて値を変更します。

```bash
cp .env.example .env
```

### 2. デプロイの実行

デプロイスクリプトを実行します。

```bash
chmod +x deploy.sh
./deploy.sh
```

スクリプトは以下の処理を行います：

1. 必要なディレクトリの作成
2. 自己署名SSL証明書の生成（初回のみ）
3. Dockerイメージのビルド
4. コンテナの起動
5. ヘルスチェックの実行

### 3. 動作確認

ステージング環境にアクセスして動作を確認します。

```
https://staging.conea.example.com
```

ローカル環境でテストする場合は、以下のURLでアクセスできます：

```
http://localhost:3000     # フロントエンド
http://localhost:8080/api # バックエンドAPI
```

## 環境のカスタマイズ

### ドメイン名の変更

ステージング環境のドメイン名を変更する場合は、以下のファイルを編集してください：

1. `nginx/conf.d/conea.conf` - サーバー名とSSL証明書のパスを変更
2. `.env` - `CORS_ORIGIN` の値を変更
3. `config.js` - `baseUrl`, `apiUrl`, `wsUrl` の値を変更

### SSL証明書

本番環境では、自己署名証明書の代わりに適切な証明書（Let's Encrypt など）を使用してください。証明書ファイルは `nginx/certs` ディレクトリに配置し、`nginx/conf.d/conea.conf` ファイルで参照するパスを更新します。

## トラブルシューティング

### コンテナログの確認

```bash
docker-compose logs -f
```

特定のサービスのログだけを確認する場合：

```bash
docker-compose logs -f frontend
docker-compose logs -f backend
docker-compose logs -f nginx
```

### コンテナの再起動

```bash
docker-compose restart frontend
docker-compose restart backend
```

### 完全な再デプロイ

すべてのコンテナとイメージを削除して再デプロイする場合：

```bash
docker-compose down --rmi all
./deploy.sh
```

### データベースのバックアップと復元

```bash
# バックアップ
docker-compose exec mongo mongodump --out=/data/db/backup

# 復元
docker-compose exec mongo mongorestore /data/db/backup
```

## 注意事項

- ステージング環境は開発中の機能のテスト用です。本番環境とは異なる設定が適用されている場合があります。
- ステージング環境のデータは定期的にリセットされる可能性があります。
- セキュリティ上の理由から、ステージング環境にも強固なパスワードを使用してください。