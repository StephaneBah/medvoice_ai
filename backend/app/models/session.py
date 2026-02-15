"""
Database Session Model - Represents a transcription/report session.
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Column, String, Float, DateTime, Text, JSON, Enum as SQLEnum
from sqlalchemy.dialects.sqlite import JSON as SQLiteJSON
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class Session(Base):
    """
    A session represents one audio processing workflow.
    Type can be 'conversation' (dialogue -> SOAP report) or 'scribe' (dictation -> corrected text).
    """
    __tablename__ = "sessions"
    
    # Primary key
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Type and status
    type = Column(String(20), nullable=False)  # "conversation" or "scribe"
    status = Column(String(20), default="pending", nullable=False)  # pending, processing, completed, error
    
    # Metadata
    exam_type = Column(String(100), nullable=True)
    patient_name = Column(String(100), nullable=True)  # Anonymized
    clinical_context = Column(Text, nullable=True)
    
    # Audio
    audio_filename = Column(String(255), nullable=True)
    audio_duration = Column(Float, nullable=True)  # in seconds
    
    # Transcription stages
    raw_transcription = Column(Text, nullable=True)
    punctuated_text = Column(Text, nullable=True)
    diarized_text = Column(Text, nullable=True)
    corrected_text = Column(Text, nullable=True)
    
    # Final output (JSON)
    report_content = Column(JSON, nullable=True)  # MedicalReportContent or DocumentationContent
    
    # Metrics
    transcription_duration = Column(Float, nullable=True)  # Processing time in seconds
    confidence_score = Column(Float, nullable=True)
    
    def __repr__(self):
        return f"<Session(id={self.id}, type={self.type}, status={self.status})>"
