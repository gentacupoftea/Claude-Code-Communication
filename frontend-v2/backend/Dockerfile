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
CMD ["node", "server.js"]