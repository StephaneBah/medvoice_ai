"""
Database setup and session management.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session as DBSession
from typing import Generator

from app.config import get_settings
from app.models.session import Base


_engine = None
_SessionLocal = None


def get_engine():
    """Get or create the database engine."""
    global _engine
    if _engine is None:
        settings = get_settings()
        _engine = create_engine(
            settings.DATABASE_URL,
            connect_args={"check_same_thread": False}  # SQLite specific
        )
    return _engine


def get_session_local():
    """Get or create the session factory."""
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=get_engine())
    return _SessionLocal


def init_db():
    """Initialize the database (create tables)."""
    engine = get_engine()
    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[DBSession, None, None]:
    """Dependency for getting a database session."""
    SessionLocal = get_session_local()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
