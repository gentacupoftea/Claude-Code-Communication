FROM python:3.9-slim

WORKDIR /app

# 必要なパッケージのインストール
RUN apt-get update && apt-get install -y \
    redis-tools \
    bc \
    curl \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Pythonの依存関係をインストール
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 追加の依存関係をインストール
RUN pip install --no-cache-dir \
    matplotlib \
    numpy \
    psutil \
    redis \
    prometheus-client

# アプリケーションコードをコピー
COPY . .

# 作業ディレクトリを検証スクリプトのディレクトリに変更
WORKDIR /app/scripts/cache-verification

# 検証スクリプトに実行権限を付与
RUN chmod +x *.sh *.py

# デフォルトコマンド
CMD ["./automated_verification.sh"]