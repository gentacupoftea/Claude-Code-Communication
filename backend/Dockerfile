<<<<<<< HEAD
# Node.js ベースイメージ
FROM node:18-alpine

# 作業ディレクトリを設定
WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 本番依存関係のみインストール
RUN npm ci --only=production

# アプリケーションコードをコピー
COPY . .

# ポート8000を公開
EXPOSE 8000

# ヘルスチェック設定
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => { process.exit(1); });"

# アプリケーションを起動
=======
# Node.js LTSイメージを使用
FROM node:18-alpine

# 作業ディレクトリの設定
WORKDIR /app

# パッケージファイルのコピー
COPY package*.json ./

# 依存関係のインストール
RUN npm ci --only=production

# アプリケーションファイルのコピー
COPY . .

# ポートの公開
EXPOSE 8000

# ヘルスチェックの追加
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8000/api/shopify/test-connection', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# アプリケーションの起動
>>>>>>> origin/main
CMD ["node", "server.js"]