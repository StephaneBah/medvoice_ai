"""
Processing Endpoints - Chain-of-Thought text processing.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from pydantic import BaseModel

from app.models.database import get_db
from app.models.session import Session
from app.services.llm_service import punctuate, diarize, correct, process_transcription


router = APIRouter()


class ProcessingResponse(BaseModel):
    """Response for processing endpoints."""
    session_id: str
    step: str
    result: str
    message: str


@router.post("/{session_id}/punctuate", response_model=ProcessingResponse)
async def apply_punctuation(
    session_id: str,
    db: DBSession = Depends(get_db),
):
    """
    CoT Step 1: Apply punctuation to raw transcription.
    """
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if not session.raw_transcription:
        raise HTTPException(status_code=400, detail="No transcription available. Run transcription first.")
    
    try:
        # Pass exam_type to allow specific handling (e.g. neutral for "simple")
        result = punctuate(session.raw_transcription, exam_type=session.exam_type or "")
        session.punctuated_text = result
        db.commit()
        
        return ProcessingResponse(
            session_id=session_id,
            step="punctuate",
            result=result,
            message="Punctuation applied successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Punctuation failed: {str(e)}")


@router.post("/{session_id}/diarize", response_model=ProcessingResponse)
async def apply_diarization(
    session_id: str,
    db: DBSession = Depends(get_db),
):
    """
    CoT Step 2: Apply speaker diarization (for conversation mode).
    Uses punctuated text if available, otherwise raw transcription.
    """
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Use punctuated text if available, otherwise raw
    source_text = session.punctuated_text or session.raw_transcription
    if not source_text:
        raise HTTPException(status_code=400, detail="No transcription available.")
    
    try:
        result = diarize(source_text)
        session.diarized_text = result
        db.commit()
        
        return ProcessingResponse(
            session_id=session_id,
            step="diarize",
            result=result,
            message="Diarization applied successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Diarization failed: {str(e)}")


@router.post("/{session_id}/correct", response_model=ProcessingResponse)
async def apply_correction(
    session_id: str,
    db: DBSession = Depends(get_db),
):
    """
    CoT Step 3: Apply medical correction to transcription.
    Uses the best available text (diarized > punctuated > raw).
    """
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Use best available text
    source_text = session.diarized_text or session.punctuated_text or session.raw_transcription
    if not source_text:
        raise HTTPException(status_code=400, detail="No transcription available.")
    
    try:
        result = correct(source_text, exam_type=session.exam_type or "")
        session.corrected_text = result
        
        # For scribe mode, mark as completed after correction
        if session.type == "scribe":
            session.status = "completed"
        
        db.commit()
        
        return ProcessingResponse(
            session_id=session_id,
            step="correct",
            result=result,
            message="Correction applied successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Correction failed: {str(e)}")


@router.post("/{session_id}/full-pipeline", response_model=ProcessingResponse)
async def run_full_pipeline(
    session_id: str,
    db: DBSession = Depends(get_db),
):
    """
    Run the full CoT pipeline on a transcription.
    For 'conversation': punctuate -> diarize -> correct
    For 'scribe': punctuate -> correct
    """
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if not session.raw_transcription:
        raise HTTPException(status_code=400, detail="No transcription available.")
    
    try:
        # Fused CoT: punctuate + (diarize if conversation) + correct in ONE LLM call
        corrected = process_transcription(
            session.raw_transcription,
            session_type=session.type or "conversation",
            exam_type=session.exam_type or "",
        )
        session.corrected_text = corrected
        
        db.commit()
        
        return ProcessingResponse(
            session_id=session_id,
            step="full-pipeline",
            result=corrected,
            message=f"Full pipeline completed for {session.type} mode"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline failed: {str(e)}")
