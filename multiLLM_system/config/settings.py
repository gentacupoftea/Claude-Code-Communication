# multiLLM_system/config/settings.py

from pydantic import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    """
    環境変数から設定を読み込むためのクラス。
    大文字小文字を区別せず、環境変数を自動的にマッピングします。
    """
    # Slack API settings
    SLACK_BOT_TOKEN: Optional[str] = None
    SLACK_APP_TOKEN: Optional[str] = None

    # LLM Provider API keys
    ANTHROPIC_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    COHERE_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    
    # GCP Project ID (if applicable)
    GOOGLE_CLOUD_PROJECT_ID: Optional[str] = None
    
    # Local LLM settings for Ollama
    OLLAMA_API_URL: str = "http://host.docker.internal:11434"
    LOCAL_LLM_MODEL: str = "command-r-plus"
    
    # Health check configuration
    HEALTHCHECK_TIMEOUT: int = 5  # seconds

    class Config:
        env_file = '.env'
        env_file_encoding = 'utf-8'
        case_sensitive = False

settings = Settings()