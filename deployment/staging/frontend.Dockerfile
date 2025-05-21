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
ENV REACT_APP_VERSION=${REACT_APP_VERSION:-staging}
ENV NODE_ENV=production

# アプリケーションをビルド
RUN npm run build

# 実行ステージ
FROM nginx:1.21-alpine

# ビルド済みのアプリケーションをnginxのHTMLディレクトリにコピー
COPY --from=build /app/build /usr/share/nginx/html

# Nginx設定ファイルをコピー
COPY ./deployment/staging/nginx.conf /etc/nginx/conf.d/default.conf

# コンテナ起動時にReactルーターをサポートするための設定を追加
RUN echo 'location / { \
            root /usr/share/nginx/html; \
            index index.html index.htm; \
            try_files $uri $uri/ /index.html; \
        }' > /etc/nginx/conf.d/default.conf

# ヘルスチェック用のファイルを追加
RUN echo "OK" > /usr/share/nginx/html/health.txt

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]