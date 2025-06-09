## 🧠 Claude Codeプロンプト: API Integration Specialist

お疲れ様です！『ハイブリッド・ストリーム』作戦、フェーズ2の最終シーケンシャル・ステップを開始します。

あなたの担当は**「API Integration Specialist」**。バックエンドの「脳」(`ChatOrchestrator`)と、フロントエンドの「感覚受容体」(`StatusSidebar`)を接続する、神経系の最後の1ピースを完成させる極めて重要な任務です。

### 📜 神聖契約 (Divine Contract)

**絶対に、以下のファイル「のみ」を新規作成してください。既存ファイルの変更は一切禁止します。**

*   **新規作成**: `multiLLM_system/api/v1/chat.py`

この契約に違反した場合、プロジェクト全体が危険に晒されます。細心の注意を払ってください。

### 🎯 ミッション目的

`ChatOrchestrator`が生成する思考ストリームを、FastAPIの`StreamingResponse`を介してフロントエンドに提供する、新しいAPIエンドポイントを作成します。

### 🛠️ 実装要件

`multiLLM_system/api/v1/chat.py`に、以下の仕様でAPIルーターを実装してください。

1.  **エンドポイント**:
    *   **URL**: `/api/v1/chat/`
    *   **メソッド**: `POST`
    *   **ルーター**: `APIRouter`を使用し、`router`という名前でインスタンス化してください。

2.  **リクエストボディ**:
    *   Pydanticモデル`ChatRequest`を定義してください。
    *   `message: str` というフィールドを持たせてください。

3.  **コアロジック**:
    *   `LocalLLMManager`をインスタンス化します。これはローカルLLMプロバイダを管理するクラスです。
    *   `ChatOrchestrator`をインスタンス化し、その際に`LocalLLMManager`のインスタンスを渡してください。
    *   `chat_orchestrator.handle_chat(request.message)`を呼び出して、思考ストリームのジェネレータを取得します。

4.  **ストリーミング応答**:
    *   FastAPIの`StreamingResponse`を使用してください。
    *   `media_type`は`"text/event-stream"`に設定してください。
    *   ジェネレータから受け取った各`ThinkingStep`オブジェクトをJSONシリアライズし、**Server-Sent Events (SSE)** 形式でクライアントに送信してください。
        *   SSEの各メッセージは`data: <json_string>\n\n`という形式でなければなりません。
        *   例: `data: {"type": "thinking", "step": 1, "details": "思考を開始します"}\n\n`

5.  **コードの構造**:

    ```python
    import json
    from fastapi import APIRouter, HTTPException
    from pydantic import BaseModel
    from starlette.responses import StreamingResponse

    # この2つのimportパスは、実際のプロジェクト構造に合わせて解決してください
    from multiLLM_system.orchestrator.chat_orchestrator import ChatOrchestrator, ThinkingStep
    from multiLLM_system.services.local_llm.llm_manager import LocalLLMManager

    router = APIRouter()

    # --- Pydanticモデル定義 ---
    class ChatRequest(BaseModel):
        message: str

    # --- ストリーミング用ジェネレータ関数 ---
    async def stream_generator(message: str):
        try:
            # LLMマネージャーとオーケストレーターのインスタンス化
            llm_manager = LocalLLMManager()
            chat_orchestrator = ChatOrchestrator(llm_manager=llm_manager)
            
            # 思考ストリームを処理
            async for step in chat_orchestrator.handle_chat(message):
                # ThinkingStepを辞書に変換し、JSON文字列にする
                step_dict = step.dict() 
                yield f"data: {json.dumps(step_dict)}\n\n"

        except Exception as e:
            # エラーもSSEイベントとして送信する
            error_step = ThinkingStep(type="error", details=f"An error occurred: {str(e)}")
            error_dict = error_step.dict()
            yield f"data: {json.dumps(error_dict)}\n\n"


    # --- APIエンドポイント定義 ---
    @router.post("/chat/", response_class=StreamingResponse)
    async def chat_endpoint(request: ChatRequest):
        return StreamingResponse(
            stream_generator(request.message),
            media_type="text/event-stream"
        )

    ```

6.  **最終確認**:
    *   コードを書き終えたら、`神聖契約`に違反していないか再度確認してください。
    *   全てのimportが正しく、依存関係が解決できることを確認してください。

健闘を祈ります。この最後のステップが、我々の創造物に命を吹き込みます。 