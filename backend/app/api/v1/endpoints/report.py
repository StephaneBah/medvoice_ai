"""
Report Endpoints - Generate and manage reports.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession

from app.models.database import get_db
from app.models.session import Session
from app.schemas.report import (
    ReportGenerateRequest,
    ReportGenerateResponse,
    ReportUpdateRequest
)
from app.services.llm_service import generate_soap_report, generate_scribe_document


router = APIRouter()


@router.post("/{session_id}/generate", response_model=ReportGenerateResponse)
async def generate_report(
    session_id: str,
    request: ReportGenerateRequest = None,
    db: DBSession = Depends(get_db),
):
    """
    Generate a report based on session type.
    - 'conversation': Generate SOAP medical report
    - 'scribe': Generate cleaned documentation
    """
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Use best available transcription
    transcript = (
        session.corrected_text or 
        session.diarized_text or 
        session.punctuated_text or 
        session.raw_transcription
    )
    
    if not transcript:
        raise HTTPException(status_code=400, detail="No transcription available.")
    
    context = ""
    if request and request.context:
        context = request.context
    elif session.clinical_context:
        context = session.clinical_context
    
    try:
        if session.type == "conversation":
            # Generate SOAP report
            content = generate_soap_report(
                transcript=transcript,
                context=context,
                exam_type=session.exam_type or ""
            )
            report_type = "medical_report"
        else:
            # Generate scribe documentation
            content = generate_scribe_document(
                transcript=transcript,
                exam_type=session.exam_type or ""
            )
            report_type = "documentation"
        
        # Save to session
        session.report_content = content
        session.status = "completed"
        db.commit()
        
        return ReportGenerateResponse(
            session_id=session_id,
            report_type=report_type,
            content=content
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")


@router.get("/{session_id}")
async def get_report(
    session_id: str,
    db: DBSession = Depends(get_db),
):
    """
    Get the generated report for a session.
    """
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if not session.report_content:
        raise HTTPException(status_code=404, detail="No report generated yet")
    
    report_type = "medical_report" if session.type == "conversation" else "documentation"
    
    return ReportGenerateResponse(
        session_id=session_id,
        report_type=report_type,
        content=session.report_content
    )


@router.put("/{session_id}")
async def update_report(
    session_id: str,
    request: ReportUpdateRequest,
    db: DBSession = Depends(get_db),
):
    """
    Update the report content (after manual editing).
    """
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session.report_content = request.content
    db.commit()
    
    return {"message": "Report updated successfully", "session_id": session_id}
