# Claude Code 実行プロンプト: Task 45.6 - multiLLM APIエンドポイントの改修

## 概要 (Overview)

こんにちは、Claude Code！

このタスクでは、`multiLLM_system`のメインAPIエンドポイントを改修し、新しく追加される`LocalLLMWorker`を外部から呼び出せるようにします。リクエストボディに`worker_type`を追加し、それに応じて適切なワーカーが選択されるようにロジックを修正します。

## 背景 (Background)

現在、APIエンドポイントは特定のクラウドAIワーカーを決め打ちで呼び出しているか、あるいはワーカーを選択する仕組みがありません。`WorkerFactory`が拡張され、`"local_llm"`タイプを扱えるようになったため、API側もこの変更に対応する必要があります。

FastAPIのPydanticモデルを拡張し、リクエストでワーカータイプを受け取れるようにするのが最もクリーンな方法です。

## ターゲットファイルと実装内容 (Target Files and Implementation Details)

### 1. **変更**: `multiLLM_system/api/main.py` (または同等のエンドポイント定義ファイル)

FastAPIのエンドポイントを定義している主要なファイルを変更します。ファイル名は`main.py`, `endpoints.py`, `routes.py`などが考えられます。ここでは仮に`main.py`とします。

**変更前の想定コード:**
```python
# multiLLM_system/api/main.py (想定)
from fastapi import FastAPI
from pydantic import BaseModel
from ..orchestrator.worker_factory import WorkerFactory

app = FastAPI()

class GenerationRequest(BaseModel):
    prompt: str
    model_id: str = None 
    # worker_type がない状態

@app.post("/generate")
async def generate(request: GenerationRequest):
    # 'openai' など、特定のワーカーに固定されている
    worker = WorkerFactory.create_worker("openai", model_id=request.model_id)
    response = worker.process_task(request.prompt)
    return response
```

**変更後のコード:**
```python
# multiLLM_system/api/main.py (変更後)
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from ..orchestrator.worker_factory import WorkerFactory

app = FastAPI()

class GenerationRequest(BaseModel):
    prompt: str
    # worker_type を追加し、デフォルト値を設定
    worker_type: str = Field(default="openai", description="The type of worker to use (e.g., 'openai', 'anthropic', 'local_llm')")
    model_id: Optional[str] = None

@app.post("/generate")
async def generate(request: GenerationRequest):
    """
    Generates a response by dynamically selecting a worker based on the request.
    """
    try:
        worker = WorkerFactory.create_worker(
            worker_type=request.worker_type, 
            model_id=request.model_id
        )
    except ValueError as e:
        # WorkerFactoryが不明なworker_typeに対してValueErrorを発生させることを想定
        raise HTTPException(status_code=400, detail=str(e))

    try:
        response = worker.process_task(request.prompt)
        return response
    except Exception as e:
        # ワーカー実行中の一般的なエラーを捕捉
        raise HTTPException(status_code=500, detail=f"Error processing task: {e}")

```

## 変更のポイント

1.  **`GenerationRequest`モデルの拡張:**
    -   `worker_type`フィールドを追加します。`pydantic.Field`を使ってデフォルト値（例: `"openai"`）と説明を加えてください。
    -   `model_id`を`Optional`にして、必須ではないことを明示します（ワーカーがデフォルトモデルを持つ場合）。

2.  **`generate`エンドポイントのロジック修正:**
    -   `WorkerFactory.create_worker`を呼び出す際に、リクエストから受け取った`request.worker_type`を渡すように変更します。
    -   `WorkerFactory`が不正な`worker_type`を受け取った場合に`ValueError`を投げることを想定し、`try...except`ブロックで捕捉して400 Bad Requestエラーを返すようにします。
    -   ワーカーの処理中に発生したエラーも捕捉し、500 Internal Server Errorを返すように堅牢化します。

## 最終確認

- `GenerationRequest`が正しく拡張されているか確認してください。
- `WorkerFactory`の呼び出しが動的に変更されているか確認してください。
- エラーハンドリングが追加されているか確認してください。

この改修により、APIの利用者はリクエストを送るだけで、クラウドAIとローカルLLMを自由に切り替えて利用できるようになります。よろしくお願いします！ 