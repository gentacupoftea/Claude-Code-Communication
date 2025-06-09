# multiLLM API エンドポイント - Worker Type サポート

## 概要

multiLLM APIが拡張され、リクエストで`worker_type`を指定することで、特定のAIワーカー（クラウドAIまたはローカルLLM）を直接選択できるようになりました。

## サポートされているワーカータイプ

- `openai` - OpenAI GPT models
- `anthropic` / `claude` - Claude AI by Anthropic
- `local_llm` - Local LLM models (Ollama, etc.)

## APIエンドポイント

### 1. ワーカータイプ一覧の取得

```bash
GET /workers/types
```

**レスポンス例:**
```json
{
  "success": true,
  "worker_types": ["anthropic", "claude", "openai", "local_llm"],
  "description": {
    "anthropic": "Claude AI by Anthropic",
    "claude": "Claude AI by Anthropic (alias)",
    "openai": "OpenAI GPT models",
    "local_llm": "Local LLM models (Ollama, etc.)"
  }
}
```

### 2. シンプルな生成エンドポイント

```bash
POST /generate
```

**リクエストボディ:**
```json
{
  "prompt": "こんにちは、今日の天気はどうですか？",
  "worker_type": "local_llm",
  "model_id": "llama2" // オプション
}
```

**レスポンス例:**
```json
{
  "success": true,
  "response": "こんにちは！私はAIアシスタントなので、リアルタイムの天気情報にはアクセスできません。",
  "worker_type": "local_llm",
  "model_id": "llama2"
}
```

### 3. チャットエンドポイント（worker_type対応）

```bash
POST /chat
```

**リクエストボディ:**
```json
{
  "message": "Pythonで簡単なWebサーバーを作成するコードを教えてください",
  "worker_type": "openai",
  "conversation_id": "conv_123",
  "user_id": "user_456"
}
```

**レスポンス例:**
```json
{
  "success": true,
  "response": "以下は、Pythonで簡単なHTTPサーバーを作成する例です:\n\n```python\nfrom http.server import HTTPServer, SimpleHTTPRequestHandler\n...",
  "conversation_id": "conv_123",
  "worker_type": "openai"
}
```

### 4. ストリーミングチャットエンドポイント（worker_type対応）

```bash
POST /chat/stream
```

**リクエストボディ:**
```json
{
  "message": "機械学習の基本概念について説明してください",
  "worker_type": "anthropic",
  "conversation_id": "conv_789"
}
```

**レスポンス:** Server-Sent Events (SSE)形式でストリーミング

## 使用例

### cURLを使った例

```bash
# ワーカータイプ一覧を取得
curl http://localhost:9000/workers/types

# ローカルLLMを使用して生成
curl -X POST http://localhost:9000/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Hello, how are you?",
    "worker_type": "local_llm"
  }'

# OpenAIを使用してチャット
curl -X POST http://localhost:9000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is machine learning?",
    "worker_type": "openai"
  }'
```

### Pythonを使った例

```python
import requests
import json

# APIエンドポイント
base_url = "http://localhost:9000"

# 1. サポートされているワーカータイプを取得
response = requests.get(f"{base_url}/workers/types")
print("Supported worker types:", response.json())

# 2. ローカルLLMを使用
response = requests.post(
    f"{base_url}/generate",
    json={
        "prompt": "Explain quantum computing in simple terms",
        "worker_type": "local_llm"
    }
)
print("Local LLM response:", response.json()["response"])

# 3. OpenAIを使用（フォールバック付き）
response = requests.post(
    f"{base_url}/chat",
    json={
        "message": "Write a Python function to calculate fibonacci numbers",
        "worker_type": "openai"
    }
)
print("OpenAI response:", response.json()["response"])
```

## エラーハンドリング

### 不明なworker_type

`worker_type`が不明な場合、`/generate`エンドポイントは400エラーを返します：

```json
{
  "detail": "Unsupported worker type: unknown_type"
}
```

`/chat`および`/chat/stream`エンドポイントは、不明なworker_typeの場合、自動的にOrchestratorにフォールバックします。

### ワーカー実行エラー

ワーカーの実行中にエラーが発生した場合、500エラーが返されます：

```json
{
  "detail": "Error processing task: [エラーメッセージ]"
}
```

## 注意事項

1. **model_id**: 現在、`model_id`パラメータは`/generate`エンドポイントでのみサポートされています。
2. **フォールバック**: `/chat`と`/chat/stream`エンドポイントでは、不明なworker_typeが指定された場合、自動的に既存のOrchestratorロジックにフォールバックします。
3. **ローカルLLM**: `local_llm`を使用する場合、Ollamaなどのローカルサーバーが実行されている必要があります。