# Claude Code 実行プロンプト: Task 45.7 - ローカルLLM環境設定とヘルスチェック

## 概要 (Overview)

こんにちは、Claude Code！

このタスクでは、`multiLLM_system`のローカルLLM開発環境を整備し、システムの安定性を高めるための2つの重要な機能を追加します。
1.  開発者が簡単に環境設定を行えるように、`.env.example`ファイルを作成します。
2.  Ollamaサーバーの接続状態を外部から確認できる、ヘルスチェック用のAPIエンドポイントを実装します。

## ターゲットファイルと実装内容 (Target Files and Implementation Details)

### 1. **新規作成**: `multiLLM_system/.env.example`

`multiLLM_system`ディレクトリのルートに、環境変数のテンプレートファイルを作成します。これにより、他の開発者がどの変数を設定すればよいか一目でわかります。

```ini
# .env.example

# -------------------------
# LLM Provider API Keys
# -------------------------
# Required for cloud-based workers
ANTHROPIC_API_KEY="your_anthropic_api_key_here"
OPENAI_API_KEY="your_openai_api_key_here"

# -------------------------
# Local LLM (Ollama) Settings
# -------------------------
# URL for the Ollama API server
OLLAMA_API_URL="http://localhost:11434"

# Default model to use with the LocalLLMWorker
LOCAL_LLM_MODEL="command-r-plus"

# -------------------------
# General Worker Settings
# -------------------------
# Timeout in seconds for LLM API calls
LLM_TIMEOUT=120
```

### 2. **変更**: `multiLLM_system/api/main.py` (または同等のエンドポイント定義ファイル)

FastAPIアプリケーションに、新しいヘルスチェックエンドポイントを追加します。

```python
# multiLLM_system/api/main.py (追記)

# ... 既存のimport ...
import requests
from ..config.settings import settings

# ... 既存のFastAPI app定義とエンドポイント ...


@app.get("/health/ollama", tags=["Health Checks"])
async def health_check_ollama():
    """
    Checks the health and connectivity of the configured Ollama server.
    """
    try:
        # A simple GET request to the Ollama base URL should be enough
        # to verify that the server is running and reachable.
        response = requests.get(settings.OLLAMA_API_URL, timeout=5) # 5 second timeout
        response.raise_for_status()
        
        # If the request is successful, the service is considered healthy.
        return {
            "status": "ok",
            "message": "Ollama server is reachable.",
            "url": settings.OLLAMA_API_URL
        }
    except requests.exceptions.RequestException as e:
        # If the request fails for any reason (timeout, connection error, etc.)
        raise HTTPException(
            status_code=503, # Service Unavailable
            detail={
                "status": "error",
                "message": "Ollama server is unreachable.",
                "url": settings.OLLAMA_API_URL,
                "error_details": str(e)
            }
        )

```

## 変更のポイント

1.  **`.env.example`の作成:**
    -   他の設定（`ANTHROPIC_API_KEY`など）も含まれていることを想定し、セクション分けしてコメントを追加することで、可読性を高めてください。
2.  **ヘルスチェックエンドポイントの実装:**
    -   `GET`メソッドで `/health/ollama` というパスに作成します。
    -   FastAPIの`tags`機能を使って、Swagger UIなどで見やすく分類してください。
    -   `requests`ライブラリを使って、設定ファイルから読み込んだ`OLLAMA_API_URL`にGETリクエストを送信します。
    -   成功した場合（ステータスコード200番台）は、`{"status": "ok"}` を含むJSONを返します。
    -   失敗した場合は、`RequestException`を捕捉し、ステータスコード`503 Service Unavailable`とともにエラー詳細をJSONで返します。

## 最終確認

- `.env.example`が正しいディレクトリに、正しい内容で作成されているか確認してください。
- 新しいAPIエンドポイントが既存のコードに追加されているか確認してください。
- 成功時と失敗時の両方で、ヘルスチェックが意図通りに動作するロジックになっているか確認してください。

この実装により、プロジェクトのセットアップが容易になり、問題発生時の切り分けも迅速に行えるようになります。よろしくお願いします！ 