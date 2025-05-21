# ビルドステージ - Node.js (TypeScript)
FROM node:18-alpine as node-build

WORKDIR /app

# 依存関係をコピーしてインストール
COPY package.json package-lock.json ./
RUN npm ci

# TypeScriptのソースコードをコピー
COPY *.ts ./
COPY tsconfig.json ./

# TypeScriptのコンパイル
RUN npm run build

# ビルドステージ - Python
FROM python:3.9-slim as python-build

WORKDIR /app

# 依存関係をコピーしてインストール
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 実行ステージ
FROM python:3.9-slim

WORKDIR /app

# セキュリティ強化: 非rootユーザーを作成
RUN groupadd -g 1001 conea && \
    useradd -u 1001 -g conea -s /bin/bash -m conea

# 必要なパッケージをインストール
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# ビルド済みのNode.jsアプリケーションをコピー
COPY --from=node-build /app/dist /app/dist
COPY --from=node-build /app/node_modules /app/node_modules

# Pythonの依存関係をコピー
COPY --from=python-build /usr/local/lib/python3.9/site-packages /usr/local/lib/python3.9/site-packages

# Pythonのソースコードをコピー
COPY shopify_mcp_server.py run_server.py ./
COPY src/ ./src/

# ログディレクトリを作成
RUN mkdir -p /app/logs

# ヘルスチェックファイルを追加
RUN echo '#!/usr/bin/env python3\nprint("OK")' > /app/health.py && \
    chmod +x /app/health.py

# 所有権と権限を設定
RUN chown -R conea:conea /app
RUN chmod -R 755 /app

# 実行ユーザーを変更
USER conea

# アプリケーションが使用するポートを公開
EXPOSE 8080

# ヘルスチェック設定
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# 環境変数の設定
ENV PYTHONUNBUFFERED=1
ENV NODE_ENV=production
ENV PORT=8080

# アプリケーションの起動
CMD ["python", "run_server.py"]