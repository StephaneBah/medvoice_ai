"""
Configuration endpoint — exposes current model IDs (read-only).
"""

from fastapi import APIRouter
from pydantic import BaseModel

from app.config import get_settings


router = APIRouter()


class ConfigResponse(BaseModel):
    """Public configuration values returned to the frontend."""
    asr_model_id: str
    llm_model_id: str


@router.get("", response_model=ConfigResponse)
async def get_config():
    """Return current backend model configuration."""
    settings = get_settings()
    return ConfigResponse(
        asr_model_id=settings.ASR_MODEL_ID,
        llm_model_id=settings.LLM_MODEL_ID,
    )
