# v0.2.0 インストール問題の回避策

## 問題

Shopify-MCP-Server v0.2.0はPyPI上で誤ってPython 3.12以上を要求しています。これはパッケージング時の設定ミスで、本来はPython 3.10以上で動作します。

## 回避策

### 方法1: Dockerを使用

```dockerfile
# Dockerfileを作成
FROM python:3.12-slim

WORKDIR /app

RUN pip install shopify-mcp-server==0.2.0

# 設定ファイルをコピーする場合
COPY config.json /root/.shopify-mcp-server/config.json

CMD ["python", "-m", "shopify_mcp_server"]
```

ビルドと実行:
```bash
docker build -t shopify-mcp .
docker run -it shopify-mcp
```

### 方法2: pyenvでPython 3.12をインストール

```bash
# pyenvをインストール（macOS）
brew install pyenv

# Python 3.12をインストール
pyenv install 3.12.7
pyenv local 3.12.7

# 仮想環境を作成
python -m venv shopify_env
source shopify_env/bin/activate

# パッケージをインストール
pip install shopify-mcp-server==0.2.0
```

### 方法3: condaを使用

```bash
# Python 3.12環境を作成
conda create -n shopify-env python=3.12
conda activate shopify-env

# パッケージをインストール
pip install shopify-mcp-server==0.2.0
```

## v0.2.1での修正予定

v0.2.1ではPython要件を3.10+に修正します。リリースまで4-6時間の予定です。

## 問い合わせ

インストールに関する問題がある場合は、GitHubの[Issues](https://github.com/gentacupoftea/shopify-mcp-server/issues)に報告してください。