"""
API v1 Router - Aggregates all endpoint routers.
"""

from fastapi import APIRouter

from app.api.v1.endpoints import audio, transcribe, process, report, sessions

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(audio.router, prefix="/audio", tags=["Audio"])
api_router.include_router(transcribe.router, prefix="/transcribe", tags=["Transcription"])
api_router.include_router(process.router, prefix="/process", tags=["Processing"])
api_router.include_router(report.router, prefix="/report", tags=["Report"])
api_router.include_router(sessions.router, prefix="/sessions", tags=["Sessions"])
