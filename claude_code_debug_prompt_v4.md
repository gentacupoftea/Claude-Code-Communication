# 【最終版】プロジェクト起動完全修正指示書 (v4)

## ☰ 厳守すべき開発憲法 (最重要) ☰

**この指示書は、プロジェクトの `docs/prompts/project_guidelines/comprehensive_development_guidelines.md` に基づく開発憲法を最優先事項とします。以下のルールを絶対に遵守してください。**

- **品質保証の3つの柱**:
    1.  **開発者責務**: 常に最高品質のコードを目指す。
    2.  **CI自動検証**: 全てのテストがパスすることを前提とする。
    3.  **AI開発支援**: 保守性、可読性、パフォーマンスを最大化する。
- **絶対的禁止事項**:
    - `any`型の使用は**一切禁止**。
    - `@ts-ignore`による型エラーの無視は**一切禁止**。
- **承認義務**:
    - 大規模リファクタリングやプロジェクト構造の変更は行わない。

---

## 🎯 最終目標

現在発生しているバックエンドの`AttributeError`、データベース接続エラー、およびFastAPIの警告を恒久的に解決し、アプリケーションが`http://localhost:8000`で完全に正常起動することを目標とします。

## 🔍根本原因の分析

1.  **ロガーエラー (`AttributeError`)**: `StructuredLogger`クラスに汎用的なログメソッド (`.info`, `.error`等) が実装されていなかった。
2.  **DB接続エラー (`password authentication failed`)**: アプリケーションが`.env`ファイルの設定を正しく読み込めていなかった。
3.  **FastAPI警告 (`DeprecationWarning`)**: 非推奨の`on_event`が使用されていた。

## 🛠️ 修正手順

### フェーズ1: 根本的なロガー機能の修正

**課題**: `AttributeError: 'StructuredLogger' object has no attribute 'info'` エラーによりサーバーがクラッシュする。

**指示**: `multiLLM_system/config/logging_config.py`にある`StructuredLogger`クラスに、汎用的なログメソッドを追加します。これにより、アプリケーション全体で一貫したロギングが可能になります。

```python:multiLLM_system/config/logging_config.py
// ... 既存のコード ...
class StructuredLogger:
    """
    構造化ログ出力のためのヘルパークラス
    """

    def __init__(self, name: str):
        self.logger = logging.getLogger(name)

    # ===== ここから追加 =====
    def debug(self, msg, *args, **kwargs):
        self.logger.debug(msg, *args, **kwargs)

    def info(self, msg, *args, **kwargs):
        self.logger.info(msg, *args, **kwargs)

    def warning(self, msg, *args, **kwargs):
        self.logger.warning(msg, *args, **kwargs)

    def error(self, msg, *args, **kwargs):
        self.logger.error(msg, *args, **kwargs)

    def critical(self, msg, *args, **kwargs):
        self.logger.critical(msg, *args, **kwargs)
    # ===== ここまで追加 =====

    def log_api_request(
// ... 既存のコード ...
```

### フェーズ2: DB接続と設定読み込みの恒久対策

**課題**: 依然として `password authentication failed for user "postgres"` が発生する。これは、正しい`.env`ファイルが読み込めていない証拠です。

**指示1: `multiLLM_system/config/settings.py`の修正**
Pydanticが`.env`ファイルを確実に読み込むように、`SettingsConfigDict`を使い設定を強制します。パスを絶対的に解決することで、どこから実行しても同じ設定を読み込むようにします。

```python:multiLLM_system/config/settings.py
from pydantic_settings import BaseSettings, SettingsConfigDict
import os

class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str
    LOG_LEVEL: str = "INFO"
    # ... 他の既存の設定値 ...

    # ↓↓↓ このmodel_configで.envファイルの読み込みを強制する ↓↓↓
    model_config = SettingsConfigDict(
        # プロジェクトルートにある.envを絶対パスで指定
        env_file=os.path.join(os.path.dirname(__file__), '..', '..', '.env'),
        env_file_encoding='utf-8',
        extra='ignore'
    )

settings = Settings()
```

**指示2: `.env`ファイルの確認**
プロジェクトのルートディレクトリに以下の内容の`.env`ファイルがあることを**再確認**してください。なければ作成します。

```env
# Database Configuration
DATABASE_URL="postgresql://conea:conea123@localhost:5432/conea"
POSTGRES_USER="conea"
POSTGRES_PASSWORD="conea123"
POSTGRES_DB="conea"

# Redis Configuration
REDIS_URL="redis://localhost:6380"

# Application Settings
LOG_LEVEL="DEBUG"
DEBUG=true
```

### フェーズ3: 非推奨機能のモダン化

**課題**: FastAPIの`on_event`は非推奨であり、将来的に削除されるため警告が表示される。

**指示**: `multiLLM_system/api/server.py` を開き、`@app.on_event("startup")` と `@app.on_event("shutdown")` を、最新の`lifespan`コンテキストマネージャー方式に書き換えます。

```python:multiLLM_system/api/server.py
# 必要なものをインポート
import contextlib
from fastapi import FastAPI, Request, HTTPException
from multiLLM_system.orchestrator.orchestrator import Orchestrator
from multiLLM_system.config.logging_config import get_logger, StructuredLogger
# ... 他のインポート ...

# ...

# グローバル変数の定義
logger: StructuredLogger = get_logger(__name__)
orchestrator: Orchestrator

def initialize_orchestrator():
    global orchestrator
    orchestrator = Orchestrator()

def shutdown_orchestrator():
    global orchestrator
    if orchestrator:
        orchestrator.shutdown()

# lifespanコンテキストマネージャーを定義
@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    # スタートアップ処理
    logger.info("🚀 MultiLLM API Server is starting up...")
    try:
        initialize_orchestrator()
        logger.info("✅ MultiLLM Orchestrator and components initialized successfully.")
    except Exception as e:
        logger.critical(f"❌ Failed to initialize orchestrator during startup: {e}", exc_info=True)
        raise

    yield

    # シャットダウン処理
    logger.info("🛑 MultiLLM API Server is shutting down...")
    try:
        shutdown_orchestrator()
        logger.info("✅ Shutdown complete.")
    except Exception as e:
        logger.error(f"Error during orchestrator shutdown: {e}", exc_info=True)


# FastAPIインスタンスにlifespanを登録
app = FastAPI(
    title="MultiLLM System API",
    description="Orchestrates multiple LLM interactions and tasks.",
    version="1.0.0",
    lifespan=lifespan
)

# ... (既存のルート定義など) ...

# 以前の @app.on_event("startup") と @app.on_event("shutdown") の
# デコレーターと、それらに関連する関数 (例: startup_event, shutdown_event) は
# 全て削除してください。

# ... サーバー起動のコード ...
if __name__ == "__main__":
    import uvicorn
    # ...
    # ポートを8000に変更
    logger.info(f"🚀 Starting server on port 8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

## ✅ 最終確認手順

全ての修正後、以下のコマンドでサーバーを起動し、エラーが出ないことを確認してください。

1.  **仮想環境を有効化:**
    ```bash
    source venv/bin/activate
    ```
2.  **サーバーを起動:**
    ```bash
    python -m multiLLM_system.api.server
    ```

### 期待される結果

- `AttributeError`が完全に解消される。
- `PostgreSQL connection failed`エラーが出ず、DBに接続できる。
- `DeprecationWarning`が表示されなくなる。
- サーバーが`http://0.0.0.0:8000`で正常に起動し、リクエストを待機状態になる。 