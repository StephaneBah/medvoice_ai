"""
Audio Endpoints - Upload, retrieve, and delete audio files.
"""

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session as DBSession

from app.models.database import get_db, init_db
from app.models.session import Session
from app.schemas.audio import AudioUploadResponse
from app.schemas.session import SessionType
from app.services.audio_utils import save_upload_file, get_audio_path, get_audio_duration, delete_audio_file


router = APIRouter()

# Ensure database is initialized
init_db()


@router.post("/upload", response_model=AudioUploadResponse)
async def upload_audio(
    file: UploadFile = File(...),
    type: SessionType = Form(...),
    exam_type: str = Form(None),
    patient_name: str = Form(None),
    clinical_context: str = Form(None),
    db: DBSession = Depends(get_db),
):
    """
    Upload an audio file and create a new session.
    
    - **file**: Audio file (wav, mp3, m4a, etc.)
    - **type**: Session type ('conversation' or 'scribe')
    - **exam_type**: Type of exam (optional)
    - **patient_name**: Anonymized patient identifier (optional)
    - **clinical_context**: Additional context (optional)
    """
    # Create new session
    session = Session(
        type=type,
        status="pending",
        exam_type=exam_type,
        patient_name=patient_name,
        clinical_context=clinical_context,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    
    # Save audio file
    original_filename, save_path = await save_upload_file(file, session.id)
    
    # Get audio duration
    duration = get_audio_duration(save_path)
    
    # Update session with audio info
    session.audio_filename = original_filename
    session.audio_duration = duration
    db.commit()
    
    return AudioUploadResponse(
        session_id=session.id,
        audio_filename=original_filename,
        audio_duration=duration,
        message="Audio uploaded successfully"
    )


@router.get("/{session_id}")
async def get_audio(
    session_id: str,
    db: DBSession = Depends(get_db),
):
    """
    Retrieve an audio file by session ID.
    Returns the audio file as a stream.
    """
    # Verify session exists
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get audio path
    audio_path = get_audio_path(session_id)
    if not audio_path:
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    return FileResponse(
        path=str(audio_path),
        media_type="audio/wav",
        filename=session.audio_filename or f"{session_id}.wav"
    )


@router.delete("/{session_id}")
async def delete_audio(
    session_id: str,
    db: DBSession = Depends(get_db),
):
    """
    Delete an audio file and its associated session.
    """
    # Verify session exists
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Delete audio file
    delete_audio_file(session_id)
    
    # Delete session from database
    db.delete(session)
    db.commit()
    
    return {"message": "Audio and session deleted successfully"}
