# multiLLM API エンドポイント - Worker Type サポート

## 概要

multiLLM APIが拡張され、リクエストで`worker_type`を指定することで、特定のAIワーカー（クラウドAIまたはローカルLLM）を直接選択できるようになりました。

## サポートされているワーカータイプ

- `openai` - OpenAI GPT models
- `anthropic` / `claude` - Claude AI by Anthropic
- `local_llm` - Local LLM models (Ollama, Deepseek, etc.)

### ローカルLLMプロバイダ

`local_llm`ワーカータイプでは、以下のプロバイダがサポートされています：

- **Ollama**: ローカルでLLMを実行するためのツール
  - デフォルトURL: `http://localhost:11434`
  - 対応モデル: llama2, codellama, command-r-plus, etc.
  
- **Deepseek**: DeepseekのAPI（OpenAI互換）
  - デフォルトURL: `https://api.deepseek.com/v1`
  - APIキーが必要
  - 対応モデル: deepseek-chat, deepseek-coder, etc.

## APIエンドポイント

### 1. ローカルLLMプロバイダ管理

#### 1.1 プロバイダ一覧取得

```bash
GET /local-llm/providers
```

**レスポンス例:**
```json
{
  "success": true,
  "providers": [
    {
      "name": "ollama-local",
      "type": "ollama",
      "api_base": "http://localhost:11434",
      "status": "healthy"
    },
    {
      "name": "deepseek-api", 
      "type": "deepseek",
      "api_base": "https://api.deepseek.com/v1",
      "status": "healthy"
    }
  ]
}
```

#### 1.2 プロバイダ追加

```bash
POST /local-llm/providers
```

**リクエストボディ:**
```json
{
  "name": "my-ollama",
  "provider_type": "ollama",
  "api_base": "http://localhost:11434",
  "timeout": 300
}
```

**レスポンス例:**
```json
{
  "success": true,
  "message": "Provider added successfully",
  "provider": {
    "name": "my-ollama",
    "type": "ollama",
    "status": "healthy"
  }
}
```

#### 1.3 プロバイダヘルスチェック

```bash
GET /local-llm/providers/health
```

**レスポンス例:**
```json
{
  "success": true,
  "health_status": {
    "ollama-local": true,
    "deepseek-api": false
  }
}
```

### 2. ワーカータイプ一覧の取得

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

### エラーレスポンス例

#### 400 Bad Request (無効なワーカータイプ)
```json
{
  "detail": "Unsupported worker type: 'invalid_worker'. Supported types are: ['openai', 'anthropic', 'claude', 'local_llm']"
}
```

#### 503 Service Unavailable (Ollamaサーバー接続不可)
```json
{
  "status": "error",
  "message": "Ollama server is unreachable.",
  "url": "http://localhost:11434",
  "error_details": "Max retries exceeded with url: / (Caused by NewConnectionError('<urllib3.connection.HTTPConnection object at 0x...>: Failed to establish a new connection: [Errno 61] Connection refused'))"
}
```

#### 429 Too Many Requests (レート制限)
```json
{
  "detail": "Rate limit exceeded: 30 per 1 minute"
}
```

### フォールバック時のレスポンス例

未知の `worker_type` (`custom_gpt`など) を指定した場合、システムは安全にデフォルトのオーケストレーターにフォールバックし、その情報をレスポンスに含めます。

```json
{
  "success": true,
  "response": "こちらが生成されたテキストです...",
  "conversation_id": "conv_123",
  "task_analysis": {
    "type": "general_query",
    "complexity": "medium",
    "suggested_workers": ["claude", "openai"]
  },
  "fallback_info": {
    "used": true,
    "requested_worker": "custom_gpt",
    "actual_worker": "orchestrator"
  }
}
```

### ワーカー実行エラー

ワーカーの実行中にエラーが発生した場合、500エラーが返されます：

```json
{
  "detail": "Error processing task: Connection timeout to worker service"
}
```

## レート制限

APIエンドポイントには以下のレート制限が適用されています：

- `/generate`: 30リクエスト/分
- `/chat`: 制限なし（今後実装予定）
- `/chat/stream`: 制限なし（今後実装予定）
- `/workers/types`: 制限なし

レート制限を超えた場合、`429 Too Many Requests`エラーが返されます。

## 注意事項

1. **model_id**: 現在、`model_id`パラメータは`/generate`エンドポイントでのみサポートされています。
2. **フォールバック**: `/chat`と`/chat/stream`エンドポイントでは、不明なworker_typeが指定された場合、自動的に既存のOrchestratorロジックにフォールバックします。
3. **ローカルLLM**: `local_llm`を使用する場合、Ollamaなどのローカルサーバーが実行されている必要があります。
4. **レスポンス構造**: `/chat`エンドポイントは常に`task_analysis`フィールドを含みます。直接ワーカー呼び出しの場合は`null`になります。
5. **セキュリティ**: すべてのエンドポイントはIPアドレスベースのレート制限を使用しています。