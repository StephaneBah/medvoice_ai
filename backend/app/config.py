"""
Configuration settings for MedVoice AI Backend.
Loaded from environment variables with sensible defaults.
"""

import os
from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # API Keys
    MISTRAL_API_KEY: str = ""
    HF_TOKEN: Optional[str] = None
    
    # ASR Model
    ASR_MODEL_ID: str = "StephaneBah/Med-Whisper-AfroRad-FR" #"StephaneBah/whisper-small-rad-FR2"
    ASR_MODEL_REVISION: str = "8b973261fd7f275577f0c7e56703d30a7102e59d" #"731ddf9943a99c95d329b96581c80912af9e8d96"
    ASR_LANGUAGE: str = "fr"
    
    # LLM
    LLM_MODEL_ID: str = "mistral-large-latest"
    
    # Database
    DATABASE_URL: str = "sqlite:///./medvoice.db"
    
    # File Storage
    UPLOAD_DIR: Path = Path("./uploads")
    MAX_AUDIO_SIZE_MB: int = 50
    MAX_AUDIO_DURATION_MINUTES: int = 30
    
    # Server
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"
    
    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


# Singleton instance
_settings: Optional[Settings] = None


def get_settings() -> Settings:
    """Get settings singleton."""
    global _settings
    if _settings is None:
        _settings = Settings()
        # Ensure upload directory exists
        _settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    return _settings
