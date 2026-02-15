"""
Pydantic schemas for Session (request/response models).
"""

from datetime import datetime
from typing import Optional, Literal, Any
from pydantic import BaseModel, Field


# Type literals matching frontend
SessionType = Literal["conversation", "scribe"]
SessionStatus = Literal["pending", "processing", "transcribed", "completed", "error"]


# --- Request Schemas ---

class SessionCreate(BaseModel):
    """Schema for creating a new session."""
    type: SessionType
    exam_type: Optional[str] = None
    patient_name: Optional[str] = None
    clinical_context: Optional[str] = None


class SessionUpdate(BaseModel):
    """Schema for updating session fields."""
    exam_type: Optional[str] = None
    patient_name: Optional[str] = None
    clinical_context: Optional[str] = None
    raw_transcription: Optional[str] = None
    punctuated_text: Optional[str] = None
    diarized_text: Optional[str] = None
    corrected_text: Optional[str] = None
    report_content: Optional[dict] = None


# --- Response Schemas ---

class SessionBase(BaseModel):
    """Base session fields for responses."""
    id: str
    created_at: datetime
    updated_at: datetime
    type: SessionType
    status: SessionStatus
    exam_type: Optional[str] = None
    patient_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class SessionSummary(SessionBase):
    """Summary view of a session (for lists)."""
    audio_duration: Optional[float] = None
    has_transcription: bool = False
    has_report: bool = False


class SessionDetail(SessionBase):
    """Full session details."""
    clinical_context: Optional[str] = None
    audio_filename: Optional[str] = None
    audio_duration: Optional[float] = None
    raw_transcription: Optional[str] = None
    punctuated_text: Optional[str] = None
    diarized_text: Optional[str] = None
    corrected_text: Optional[str] = None
    report_content: Optional[dict] = None
    transcription_duration: Optional[float] = None
    confidence_score: Optional[float] = None


class SessionList(BaseModel):
    """Paginated list of sessions."""
    items: list[SessionSummary]
    total: int
