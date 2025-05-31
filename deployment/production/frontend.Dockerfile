# ビルドステージ
FROM node:18-alpine as build

WORKDIR /app

# 依存関係をコピーしてインストール
COPY package.json package-lock.json ./
RUN npm ci

# ソースコードをコピー
COPY . .

# 環境変数の設定
ARG REACT_APP_API_URL
ARG REACT_APP_WS_URL
ARG REACT_APP_VERSION
ENV REACT_APP_API_URL=${REACT_APP_API_URL}
ENV REACT_APP_WS_URL=${REACT_APP_WS_URL}
ENV REACT_APP_VERSION=${REACT_APP_VERSION:-production}
ENV NODE_ENV=production

# アプリケーションをビルド
RUN npm run build

# 実行ステージ
FROM nginx:1.21-alpine

# セキュリティ強化: 非rootユーザーを作成
RUN addgroup -g 1001 -S nginx-custom && \
    adduser -u 1001 -S -G nginx-custom nginx-custom

# ビルド済みのアプリケーションをnginxのHTMLディレクトリにコピー
COPY --from=build /app/build /usr/share/nginx/html

# セキュリティ設定を含むNginx設定ファイルをコピー
COPY ./deployment/production/nginx.conf /etc/nginx/conf.d/default.conf

# コンテナ起動時にReactルーターをサポートするための設定を追加
RUN echo 'location / { \
            root /usr/share/nginx/html; \
            index index.html index.htm; \
            try_files $uri $uri/ /index.html; \
            add_header X-Content-Type-Options nosniff; \
            add_header X-XSS-Protection "1; mode=block"; \
        }' > /etc/nginx/conf.d/default.conf

# セキュリティヘッダーを追加
RUN echo 'add_header Content-Security-Policy "default-src \'self\'; img-src \'self\' data: https:; style-src \'self\' \'unsafe-inline\'; script-src \'self\' \'unsafe-inline\' \'unsafe-eval\'; connect-src \'self\' https:; font-src \'self\' data:;";' >> /etc/nginx/conf.d/security.conf

# ヘルスチェック用のファイルを追加
RUN echo "OK" > /usr/share/nginx/html/health.txt

# ディレクトリとファイルの所有権を変更
RUN chown -R nginx-custom:nginx-custom /usr/share/nginx /var/cache/nginx /var/log/nginx /etc/nginx/conf.d

# 権限を設定
RUN chmod -R 755 /usr/share/nginx/html

# 実行ユーザーを変更
USER nginx-custom

EXPOSE 80

# カスタム起動コマンド（非root権限でのNginx実行）
CMD ["nginx", "-g", "daemon off;"]