"""
Authentication configuration settings
"""
import os
from typing import Optional
from pydantic_settings import BaseSettings
from pydantic import Field


class AuthSettings(BaseSettings):
    """Authentication and security settings"""
    
    # JWT Configuration
    jwt_secret_key: str = Field(..., env="JWT_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", env="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(default=15, env="ACCESS_TOKEN_EXPIRE_MINUTES")
    refresh_token_expire_minutes: int = Field(default=60*24*7, env="REFRESH_TOKEN_EXPIRE_MINUTES")  # 7 days
    
    # Database Configuration
    database_url: str = Field(..., env="DATABASE_URL")
    
    # Security Settings
    bcrypt_rounds: int = Field(default=12, env="BCRYPT_ROUNDS")
    
    # API Token Settings
    api_token_expire_days: int = Field(default=365, env="API_TOKEN_EXPIRE_DAYS")
    
    # Organization Settings
    default_org_name: str = Field(default="Default Organization", env="DEFAULT_ORG_NAME")
    
    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
        "extra": "ignore"
    }


def get_auth_settings() -> AuthSettings:
    """Get authentication settings instance"""
    return AuthSettings()