# Claude Code 実行プロンプト: Task 45.1 自己レビュー指摘事項の修正

## 概要 (Overview)

こんにちは、Claude Code！

`Task 45.1`で実装したコードの自己レビューが完了し、いくつかの重要な修正点と改善点が特定されました。このプロンプトの目的は、それらの指摘事項をすべて修正し、コードベースの品質と堅牢性を向上させることです。

以下の指示に従って、各ファイルを慎重に修正してください。

## 変更対象ファイルと修正内容 (Target Files and Modifications)

### 1. `multiLLM_system/orchestrator/worker_factory.py`

このファイルには、ワーカーのID生成とインスタンス化に関する重大な問題があります。

#### 修正点:

- **ワーカーID生成の修正:** `id()` の使用をやめ、`uuid` を使って一意なIDを生成します。
- **ワーカーインスタンス化の修正:** `ClaudeWorker` と `OpenAIWorker` のインスタンス化時に、レビューで指摘された通り `config` オブジェクトを渡すように修正します。(レビューの修正案に合わせて`name`と`config`を渡す形にします)
- **型ヒントの改善:** `get_supported_worker_types` メソッドの戻り値の型ヒントを `list` から `List[str]` に修正します。

```python
# multiLLM_system/orchestrator/worker_factory.py (修正後)

# ... 既存のimport ...
import uuid
from typing import Dict, List
# ... 他import ...

# ... WorkerFactoryクラス定義 ...
# ... create_workerメソッド ...
        # (修正箇所)
        elif worker_type == "claude":
            # 修正案: uuidを使用し、configを渡す
            return ClaudeWorker(name=f"claude_worker_{uuid.uuid4().hex[:8]}", config=config)
        elif worker_type == "openai":
            # 修正案: uuidを使用し、configを渡す
            return OpenAIWorker(name=f"openai_worker_{uuid.uuid4().hex[:8]}", config=config)
        elif worker_type == "local_llm":
            # LocalLLMWorkerも同様の規約に合わせる
            return LocalLLMWorker(name=f"local_llm_worker_{uuid.uuid4().hex[:8]}", config=config)
        else:
            raise ValueError(f"Unsupported worker type: {worker_type}")

    @staticmethod
    def get_supported_worker_types() -> List[str]: # 型ヒントを修正
        return ["claude", "openai", "local_llm"]

# ... 以降のコード ...
```

### 2. `multiLLM_system/config/settings.py`

設定値のプレースホルダーは、環境変数が設定されていない場合にエラーとならないため、潜在的なバグの原因となります。

#### 修正点:

- APIキーのデフォルト値を削除し、環境変数から必須で読み込まれるようにします。

```python
# multiLLM_system/config/settings.py (修正後)

# ... 既存のimport ...

class Settings(BaseSettings):
    # ... 既存の設定 ...

    # 修正案: デフォルト値を削除
    ANTHROPIC_API_KEY: str
    OPENAI_API_KEY: str
    
    LLM_TIMEOUT: int = 120

    OLLAMA_API_URL: str = "http://localhost:11434"
    LOCAL_LLM_MODEL: str = "command-r-plus"

    class Config:
        env_file = ".env"

# ... 以降のコード ...
```

### 3. `multiLLM_system/workers/local_llm_worker.py`

エラーハンドリングと型定義を強化します。

#### 修正点:

- レビューで提案された `emergency_response` メソッドの具体的なロジックを実装します。
- `Dict[str, Any]` を、より具体的な `TypedDict` に置き換えて型安全性を向上させます。
- `health_check`メソッド内のAPI呼び出しにエラーハンドリングを追加します。

```python
# multiLLM_system/workers/local_llm_worker.py (修正後)

# ... 既存のimport ...
import asyncio
from typing import Dict, Any, List, TypedDict

from loguru import logger
# ... 他のimport ...

# 型定義を追加
class OllamaResponse(TypedDict):
    response: str
    done: bool
    context: List[int]
    total_duration: int
    load_duration: int
    prompt_eval_count: int
    eval_count: int

class LocalLLMWorker(BaseWorker):
    # ... __init__ ...
    
    # process_task の戻り値の型ヒントを修正
    async def process_task(self, prompt: str, params: Dict[str, Any] = None) -> OllamaResponse:
        # ... 既存のロジック ...

    async def _get_available_models(self) -> List[str]:
        try:
            response = requests.get(f"{settings.OLLAMA_API_URL}/api/tags", timeout=5)
            response.raise_for_status()
            data = response.json()
            return [model['name'] for model in data.get('models', [])]
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to fetch models from Ollama: {e}")
            return []

    # health_check にエラーハンドリングを追加
    async def health_check(self):
        # ... 既存のロジックに _get_available_models の呼び出しを追加 ...
        available_models = await self._get_available_models()
        if not available_models:
             self.healthy = False
             await self.emergency_response("api_down", {})
             return
        
        if self.model_id not in available_models:
            self.healthy = False
            await self.emergency_response("model_unavailable", {"available": available_models})
            return
            
        self.healthy = True
        logger.info(f"LocalLLMWorker health check passed. Model {self.model_id} is available.")

    # emergency_response のロジックを実装
    async def emergency_response(self, emergency_type: str, data: Dict):
        """Worker固有の緊急対応"""
        logger.warning(f"LocalLLMWorker handling emergency: {emergency_type}")

        if emergency_type == "model_unavailable":
            logger.error(f"Model {self.model_id} is unavailable")
            # フォールバックモデルへの切り替え
            available = data.get("available", [])
            fallback_models = ["llama2", "mistral", "default"]
            for model in fallback_models:
                if model in available:
                    self.model_id = model
                    logger.info(f"Switched to fallback model: {model}")
                    self.healthy = True # 切り替え成功
                    break

        elif emergency_type == "api_down":
            logger.error("Ollama API is down. Scheduling reconnect attempt.")
            # 再接続の試行をスケジュール
            await asyncio.sleep(5)
            await self.health_check()
```

## 最終確認

- 上記のすべての修正が、それぞれのファイルに正しく適用されていることを確認してください。
- 特に `worker_factory.py` のインスタンス化の不整合は、システムの動作に直接影響する重大な問題なので、慎重に修正してください。

これらの修正を適用することで、私たちのコードは格段に安定し、保守しやすくなります。よろしくお願いします！ 