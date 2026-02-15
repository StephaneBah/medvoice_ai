"""
Pydantic schemas for report generation.
"""

from typing import Optional
from pydantic import BaseModel


# --- Report Content Schemas (matching frontend types) ---

class MedicalReportContent(BaseModel):
    """SOAP-style medical report content (for conversation mode)."""
    clinicalIndication: str
    findings: str
    impression: str
    recommendations: str


class DocumentationContent(BaseModel):
    """Scribe documentation content (for scribe mode)."""
    title: str
    correctedText: str


# --- Request/Response Schemas ---

class ReportGenerateRequest(BaseModel):
    """Request to generate a report."""
    context: Optional[str] = None  # Additional context for generation


class ReportGenerateResponse(BaseModel):
    """Response with generated report."""
    session_id: str
    report_type: str  # "medical_report" or "documentation"
    content: dict  # MedicalReportContent or DocumentationContent


class ReportUpdateRequest(BaseModel):
    """Request to update report content."""
    content: dict  # MedicalReportContent or DocumentationContent
