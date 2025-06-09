# multiLLM_system/config/settings.py

import os
from pydantic import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    """
    Application settings with environment variable support
    """
    # Existing settings - required from environment
    ANTHROPIC_API_KEY: str
    OPENAI_API_KEY: str
    LLM_TIMEOUT: int = 120
    
    # Google settings (if exists)
    GOOGLE_CLOUD_PROJECT_ID: Optional[str] = None
    
    # Local LLM settings for Ollama
    OLLAMA_API_URL: str = os.getenv("OLLAMA_API_URL", "http://localhost:11434")
    LOCAL_LLM_MODEL: str = os.getenv("LOCAL_LLM_MODEL", "command-r-plus")
    
    # Health check configuration
    HEALTHCHECK_TIMEOUT: int = 5  # seconds
    
    # General settings
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

# Create global settings instance
settings = Settings()