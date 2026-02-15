"""
Pydantic schemas for audio upload and transcription.
"""

from typing import Optional
from pydantic import BaseModel


# --- Audio Schemas ---

class AudioUploadResponse(BaseModel):
    """Response after audio upload."""
    session_id: str
    audio_filename: str
    audio_duration: Optional[float] = None
    message: str = "Audio uploaded successfully"


# --- Transcription Schemas ---

class TranscriptionRequest(BaseModel):
    """Request to start transcription."""
    language: str = "fr"


class TranscriptionResponse(BaseModel):
    """Response with transcription result."""
    session_id: str
    raw_transcription: str
    duration_seconds: float
    confidence_score: Optional[float] = None


class TranscriptionStatus(BaseModel):
    """Status of ongoing transcription."""
    session_id: str
    status: str  # pending, processing, completed, error
    progress: Optional[int] = None  # 0-100
    message: Optional[str] = None
