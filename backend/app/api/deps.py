"""
Dependency injection for API endpoints.
"""

from fastapi import Depends
from sqlalchemy.orm import Session as DBSession

from app.models.database import get_db
from app.config import get_settings, Settings


def get_current_settings() -> Settings:
    """Dependency for getting settings."""
    return get_settings()
