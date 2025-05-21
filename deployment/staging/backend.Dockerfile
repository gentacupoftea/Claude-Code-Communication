# ビルドステージ
FROM node:18-alpine as build

WORKDIR /app

# 依存関係をコピーしてインストール
COPY package.json package-lock.json ./
RUN npm ci

# ソースコードをコピー
COPY . .

# TypeScriptのコンパイル
RUN npm run build

# 実行ステージ
FROM node:18-alpine

WORKDIR /app

# パッケージ設定とビルド済みファイルをコピー
COPY --from=build /app/package*.json ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules

# 環境変数の設定
ENV NODE_ENV=production
ENV PORT=8080

# アプリケーションが使用するポートを公開
EXPOSE 8080

# アプリケーションの起動
CMD ["node", "dist/index.js"]