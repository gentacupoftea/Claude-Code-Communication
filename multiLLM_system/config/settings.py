# multiLLM_system/config/settings.py

from pydantic import BaseSettings, validator
from typing import Optional, List
import os


class Settings(BaseSettings):
    """
    環境変数から設定を読み込むためのクラス。
    大文字小文字を区別せず、環境変数を自動的にマッピングします。
    
    本番環境では必要なAPIキーの検証が行われ、不足している場合は
    起動時にエラーでプロセスが終了します。
    """
    # Slack API settings
    SLACK_BOT_TOKEN: Optional[str] = None
    SLACK_APP_TOKEN: Optional[str] = None

    # LLM Provider API keys
    ANTHROPIC_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    COHERE_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    
    # Timeout settings
    LLM_TIMEOUT: int = 120
    
    # GCP Project ID (if applicable)
    GOOGLE_CLOUD_PROJECT_ID: Optional[str] = None
    
    # Local LLM settings for Ollama
    OLLAMA_API_URL: str = "http://host.docker.internal:11434"
    LOCAL_LLM_MODEL: str = "command-r-plus"
    
    # Health check configuration
    HEALTHCHECK_TIMEOUT: int = 5  # seconds
    
    # General settings
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"
    
    # 有効なワーカータイプ（環境変数で指定可能）
    ENABLED_WORKERS: str = "anthropic,openai,local_llm"  # カンマ区切りの文字列
    
    # 必須検証を無効にするフラグ（開発・テスト用）
    SKIP_API_KEY_VALIDATION: bool = False

    class Config:
        env_file = '.env'
        env_file_encoding = 'utf-8'
        case_sensitive = False

    @validator("ENABLED_WORKERS", pre=True)
    def validate_enabled_workers(cls, v):
        """有効なワーカータイプの検証"""
        if isinstance(v, str):
            workers = [w.strip() for w in v.split(",")]
            valid_workers = {"anthropic", "openai", "local_llm", "claude"}
            invalid_workers = set(workers) - valid_workers
            if invalid_workers:
                raise ValueError(f"無効なワーカータイプが指定されています: {invalid_workers}")
            return workers
        return v

    @validator("ANTHROPIC_API_KEY")
    def validate_anthropic_key(cls, v, values):
        """Anthropic APIキーの検証"""
        if values.get("SKIP_API_KEY_VALIDATION", False):
            return v
            
        enabled_workers = values.get("ENABLED_WORKERS", [])
        if isinstance(enabled_workers, str):
            enabled_workers = [w.strip() for w in enabled_workers.split(",")]
        
        # anthropic または claude ワーカーが有効な場合はAPIキーが必須
        if ("anthropic" in enabled_workers or "claude" in enabled_workers):
            if not v or len(v.strip()) == 0:
                raise ValueError(
                    "Anthropic Claude ワーカーが有効ですが、ANTHROPIC_API_KEY が設定されていません。"
                    "環境変数 ANTHROPIC_API_KEY を設定するか、ENABLED_WORKERS から 'anthropic' と 'claude' を除外してください。"
                )
            if not v.startswith("sk-ant-"):
                raise ValueError(
                    "ANTHROPIC_API_KEY の形式が正しくありません。'sk-ant-' で始まる必要があります。"
                )
        return v

    @validator("OPENAI_API_KEY")
    def validate_openai_key(cls, v, values):
        """OpenAI APIキーの検証"""
        if values.get("SKIP_API_KEY_VALIDATION", False):
            return v
            
        enabled_workers = values.get("ENABLED_WORKERS", [])
        if isinstance(enabled_workers, str):
            enabled_workers = [w.strip() for w in enabled_workers.split(",")]
        
        # openai ワーカーが有効な場合はAPIキーが必須
        if "openai" in enabled_workers:
            if not v or len(v.strip()) == 0:
                raise ValueError(
                    "OpenAI ワーカーが有効ですが、OPENAI_API_KEY が設定されていません。"
                    "環境変数 OPENAI_API_KEY を設定するか、ENABLED_WORKERS から 'openai' を除外してください。"
                )
            if not v.startswith("sk-"):
                raise ValueError(
                    "OPENAI_API_KEY の形式が正しくありません。'sk-' で始まる必要があります。"
                )
        return v

    @validator("OLLAMA_API_URL")
    def validate_ollama_url(cls, v, values):
        """Ollama API URLの検証"""
        if values.get("SKIP_API_KEY_VALIDATION", False):
            return v
            
        enabled_workers = values.get("ENABLED_WORKERS", [])
        if isinstance(enabled_workers, str):
            enabled_workers = [w.strip() for w in enabled_workers.split(",")]
        
        # local_llm ワーカーが有効な場合はOllama URLの形式をチェック
        if "local_llm" in enabled_workers:
            if not v:
                raise ValueError(
                    "Local LLM ワーカーが有効ですが、OLLAMA_API_URL が設定されていません。"
                )
            if not (v.startswith("http://") or v.startswith("https://")):
                raise ValueError(
                    "OLLAMA_API_URL は有効なHTTP URLである必要があります。"
                )
        return v

    @validator("LOG_LEVEL")
    def validate_log_level(cls, v):
        """ログレベルの検証"""
        valid_levels = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        if v.upper() not in valid_levels:
            raise ValueError(f"LOG_LEVEL は {valid_levels} のいずれかである必要があります。")
        return v.upper()

    def get_enabled_workers(self) -> List[str]:
        """有効なワーカータイプのリストを取得"""
        if isinstance(self.ENABLED_WORKERS, str):
            return [w.strip() for w in self.ENABLED_WORKERS.split(",")]
        return self.ENABLED_WORKERS or []

    def is_worker_enabled(self, worker_type: str) -> bool:
        """指定されたワーカータイプが有効かどうかをチェック"""
        return worker_type in self.get_enabled_workers()

    def get_api_key_for_worker(self, worker_type: str) -> Optional[str]:
        """ワーカータイプに対応するAPIキーを取得"""
        key_mapping = {
            "anthropic": self.ANTHROPIC_API_KEY,
            "claude": self.ANTHROPIC_API_KEY,  # Claudeはanthropicと同じキー
            "openai": self.OPENAI_API_KEY,
            "cohere": self.COHERE_API_KEY,
            "gemini": self.GEMINI_API_KEY,
        }
        return key_mapping.get(worker_type)

    def validate_runtime_requirements(self) -> None:
        """
        実行時要件の検証
        アプリケーション起動時に呼び出される
        """
        errors = []
        enabled_workers = self.get_enabled_workers()
        
        for worker in enabled_workers:
            if worker in ["anthropic", "claude"] and not self.ANTHROPIC_API_KEY:
                errors.append(f"{worker} ワーカーが有効ですが、ANTHROPIC_API_KEY が設定されていません")
            elif worker == "openai" and not self.OPENAI_API_KEY:
                errors.append(f"{worker} ワーカーが有効ですが、OPENAI_API_KEY が設定されていません")
        
        if errors:
            error_message = "設定エラー:\n" + "\n".join(f"- {error}" for error in errors)
            error_message += "\n\n解決方法:\n"
            error_message += "1. 必要なAPIキーを環境変数で設定する\n"
            error_message += "2. または ENABLED_WORKERS から不要なワーカーを除外する\n"
            error_message += "3. または開発・テスト用に SKIP_API_KEY_VALIDATION=true を設定する"
            raise ValueError(error_message)


settings = Settings()

# アプリケーション起動時に実行時要件を検証
if not settings.SKIP_API_KEY_VALIDATION:
    try:
        settings.validate_runtime_requirements()
    except ValueError as e:
        print(f"🚨 設定エラー: {e}")
        if not settings.DEBUG:
            # 本番環境では即座に終了
            exit(1)
        else:
            # 開発環境では警告のみ
            print("⚠️ 開発モードのため続行しますが、一部機能が利用できない可能性があります。")