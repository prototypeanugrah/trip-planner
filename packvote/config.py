"""Application settings and configuration utilities."""

from functools import lru_cache
from typing import List, Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Pydantic settings for the Pack Vote service."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", env_prefix="PACKVOTE_")

    app_name: str = "Pack Vote"
    environment: str = Field(default="development", pattern=r"^(development|staging|production)$")
    database_url: str = Field(default="sqlite+aiosqlite:///./packvote.db")
    twilio_account_sid: Optional[str] = None
    twilio_auth_token: Optional[str] = None
    twilio_messaging_service_sid: Optional[str] = None
    openai_api_key: Optional[str] = Field(default=None, alias="OPENAI_API_KEY")
    anthropic_api_key: Optional[str] = None
    deepseek_api_key: Optional[str] = None
    allowed_origins: List[str] = Field(default_factory=lambda: ["*"])
    redis_url: str = "redis://localhost:6379/0"
    prompt_store_path: str = "./prompts"
    metrics_namespace: str = "packvote"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached settings instance."""

    return Settings()


