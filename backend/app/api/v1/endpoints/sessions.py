"""
Sessions Endpoints - CRUD operations for sessions.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import desc

from app.models.database import get_db
from app.models.session import Session
from app.schemas.session import (
    SessionSummary,
    SessionDetail,
    SessionList,
    SessionUpdate
)
from app.services.audio_utils import delete_audio_file


router = APIRouter()


@router.get("", response_model=SessionList)
async def list_sessions(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    type: Optional[str] = Query(None, description="Filter by type (conversation/scribe)"),
    status: Optional[str] = Query(None, description="Filter by status"),
    db: DBSession = Depends(get_db),
):
    """
    List all sessions with optional filtering and pagination.
    """
    query = db.query(Session)
    
    if type:
        query = query.filter(Session.type == type)
    if status:
        query = query.filter(Session.status == status)
    
    total = query.count()
    sessions = query.order_by(desc(Session.created_at)).offset(skip).limit(limit).all()
    
    items = [
        SessionSummary(
            id=s.id,
            created_at=s.created_at,
            updated_at=s.updated_at,
            type=s.type,
            status=s.status,
            exam_type=s.exam_type,
            patient_name=s.patient_name,
            audio_duration=s.audio_duration,
            has_transcription=bool(s.raw_transcription),
            has_report=bool(s.report_content)
        )
        for s in sessions
    ]
    
    return SessionList(items=items, total=total)


@router.get("/{session_id}", response_model=SessionDetail)
async def get_session(
    session_id: str,
    db: DBSession = Depends(get_db),
):
    """
    Get full details of a session.
    """
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return SessionDetail(
        id=session.id,
        created_at=session.created_at,
        updated_at=session.updated_at,
        type=session.type,
        status=session.status,
        exam_type=session.exam_type,
        patient_name=session.patient_name,
        clinical_context=session.clinical_context,
        audio_filename=session.audio_filename,
        audio_duration=session.audio_duration,
        raw_transcription=session.raw_transcription,
        punctuated_text=session.punctuated_text,
        diarized_text=session.diarized_text,
        corrected_text=session.corrected_text,
        report_content=session.report_content,
        transcription_duration=session.transcription_duration,
        confidence_score=session.confidence_score
    )


@router.put("/{session_id}", response_model=SessionDetail)
async def update_session(
    session_id: str,
    request: SessionUpdate,
    db: DBSession = Depends(get_db),
):
    """
    Update session fields.
    """
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Update only provided fields
    update_data = request.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(session, field, value)
    
    db.commit()
    db.refresh(session)
    
    return get_session(session_id, db)


@router.delete("/{session_id}")
async def delete_session(
    session_id: str,
    db: DBSession = Depends(get_db),
):
    """
    Delete a session and its associated audio file.
    """
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Delete audio file
    delete_audio_file(session_id)
    
    # Delete session
    db.delete(session)
    db.commit()
    
    return {"message": "Session deleted successfully", "session_id": session_id}
