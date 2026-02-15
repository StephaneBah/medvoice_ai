"""
Transcription Endpoints - ASR processing.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session as DBSession

from app.models.database import get_db
from app.models.session import Session
from app.schemas.audio import TranscriptionResponse, TranscriptionStatus
from app.services.asr_service import transcribe_file
from app.services.audio_utils import get_audio_path


router = APIRouter()


@router.post("/{session_id}", response_model=TranscriptionResponse)
async def transcribe_audio(
    session_id: str,
    db: DBSession = Depends(get_db),
):
    """
    Run ASR transcription on the session's audio file.
    Returns the raw transcription text.
    """
    # Get session
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get audio path
    audio_path = get_audio_path(session_id)
    if not audio_path:
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    # Update status
    session.status = "processing"
    db.commit()
    
    try:
        # Run transcription
        text, duration = transcribe_file(str(audio_path))
        
        # Update session
        session.raw_transcription = text
        session.transcription_duration = duration
        session.status = "transcribed"
        db.commit()
        
        return TranscriptionResponse(
            session_id=session_id,
            raw_transcription=text,
            duration_seconds=duration,
            confidence_score=session.confidence_score
        )
    
    except Exception as e:
        session.status = "error"
        db.commit()
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


@router.get("/{session_id}/status", response_model=TranscriptionStatus)
async def get_transcription_status(
    session_id: str,
    db: DBSession = Depends(get_db),
):
    """
    Get the current transcription status for a session.
    """
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Map status to progress percentage
    progress_map = {
        "pending": 0,
        "processing": 50,
        "transcribed": 100,
        "completed": 100,
        "error": 0
    }
    
    return TranscriptionStatus(
        session_id=session_id,
        status=session.status,
        progress=progress_map.get(session.status, 0),
        message=f"Status: {session.status}"
    )
