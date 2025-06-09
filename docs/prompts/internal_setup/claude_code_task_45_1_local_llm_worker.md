# Claude Code 実行プロンプト: Task 45.1 - LocalLLMWorker の新規作成

## 概要 (Overview)

こんにちは、Claude Code！

プロジェクト「Cup of Tea AI Empire」の最初のタスクとして、既存の`multiLLM_system`にローカルLLMを統合するためのコンポーネントを実装します。

このタスク(`45.1`)の目的は、Ollama APIと通信する新しいワーカー `LocalLLMWorker` を作成し、設定とワーカーファクトリに統合することです。これにより、システムがクラウドAIだけでなく、ローカルで動作するLLMも利用できるようになります。

## 背景 (Background)

`multiLLM_system`は、複数のAIモデルを切り替えて利用するためのオーケストレーションシステムです。現在は主にクラウドベースのAPIを呼び出すワーカーで構成されています。ここに、ローカル環境でOllama経由で実行されるモデル（例: `Command R+`）を組み込むための、新しいモジュールが必要になりました。

`LocalLLMWorker`は、他のワーカー（例: `AnthropicWorker`）と同様に、ワーカーファactryから呼び出せるように設計する必要があります。

## ターゲットファイルと実装内容 (Target Files and Implementation Details)

以下のファイル構造に従って、3つのファイルを新規作成または変更してください。

### 1. **新規作成**: `multiLLM_system/workers/local_llm_worker.py`

このファイルに、Ollama APIと通信する新しいワーカーを定義します。

```python
# multiLLM_system/workers/local_llm_worker.py

import requests
from typing import Dict, Any, List

from .base_worker import BaseWorker
from ..config.settings import settings

class LocalLLMWorker(BaseWorker):
    """
    A worker that interacts with a local LLM served via the Ollama API.
    """

    def __init__(self, model_id: str = settings.LOCAL_LLM_MODEL):
        """
        Initializes the LocalLLMWorker.

        Args:
            model_id: The identifier of the local model to be used (e.g., 'command-r-plus').
        """
        self.model_id = model_id
        self.api_url = f"{settings.OLLAMA_API_URL}/api/generate"

    def process_task(self, prompt: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Sends a prompt to the local LLM and returns the response.

        Args:
            prompt: The input prompt for the LLM.
            params: Additional parameters for the Ollama API call.

        Returns:
            A dictionary containing the response from the LLM.
        
        Raises:
            requests.exceptions.RequestException: If the API call fails.
        """
        payload = {
            "model": self.model_id,
            "prompt": prompt,
            "stream": False  # For now, we'll use non-streaming responses
        }
        if params:
            payload.update(params)

        try:
            response = requests.post(self.api_url, json=payload, timeout=settings.LLM_TIMEOUT)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            # In a real-world scenario, you'd want more robust logging and error handling
            print(f"Error calling Ollama API: {e}")
            raise

    def get_supported_models(self) -> List[str]:
        """
        Returns a list of models this worker supports.
        For now, it's just the one configured model.
        """
        return [self.model_id]

```

### 2. **変更**: `multiLLM_system/orchestrator/worker_factory.py`

既存のワーカーファクトリに、新しい`LocalLLMWorker`を登録します。

```python
# multiLLM_system/orchestrator/worker_factory.py

# ... existing code ...
from ..workers.anthropic_worker import AnthropicWorker # Assuming this exists
from ..workers.openai_worker import OpenAIWorker # Assuming this exists
from ..workers.local_llm_worker import LocalLLMWorker # Add this import

class WorkerFactory:
    @staticmethod
    def create_worker(worker_type: str, model_id: str = None):
        # ... existing code ...
        elif worker_type == "openai":
            return OpenAIWorker(model_id=model_id)
        # Add the following block
        elif worker_type == "local_llm":
            return LocalLLMWorker(model_id=model_id)
        # ... existing code ...

# ... existing code ...
```

### 3. **変更**: `multiLLM_system/config/settings.py`

Ollama APIのエンドポイントとデフォルトモデルの情報を、設定ファイルに追加します。`pydantic`の`BaseSettings`を想定しています。

```python
# multiLLM_system/config/settings.py

# ... existing code ...

class Settings(BaseSettings):
    # ... existing settings ...
    ANTHROPIC_API_KEY: str = "your_anthropic_api_key"
    OPENAI_API_KEY: str = "your_openai_api_key"
    LLM_TIMEOUT: int = 120

    # Add these new settings for the local LLM
    OLLAMA_API_URL: str = "http://localhost:11434"
    LOCAL_LLM_MODEL: str = "command-r-plus"

    class Config:
        env_file = ".env"

settings = Settings()

# ... existing code ...
```

## 最終確認

- 上記のファイルパスと内容が正確であることを確認してください。
- 他のファイルは変更しないでください。
- 開発憲法に従い、適切な型ヒントを使用し、コードの品質を担保してください。

この実装により、`multiLLM_system`の柔軟性が大幅に向上します。よろしくお願いします！ 