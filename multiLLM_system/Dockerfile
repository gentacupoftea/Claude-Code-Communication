# multiLLM_system/Dockerfile

FROM python:3.11-slim

WORKDIR /app

# requirements.txtを先にコピーして、キャッシュを有効活用
COPY ./requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションコードをコピー
COPY . .

# サーバーを起動
CMD ["uvicorn", "api.server:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
