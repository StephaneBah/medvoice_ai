
export enum AppView {
  DASHBOARD = 'dashboard',
  NEW_REPORT = 'new_report',
  HISTORY = 'history',
  SETTINGS = 'settings'
}

// ─── Backend-aligned types ─────────────────────────────────────────────────────

/** Backend session type: 'conversation' (consultation) or 'scribe' (documentation) */
export type SessionType = 'conversation' | 'scribe';
export type SessionStatus = 'pending' | 'processing' | 'transcribed' | 'completed' | 'error';

/** UI label → backend value mapping */
export type DocumentSource = 'consultation' | 'documentation';

export const SOURCE_TO_SESSION_TYPE: Record<DocumentSource, SessionType> = {
  consultation: 'conversation',
  documentation: 'scribe',
};

export const SESSION_TYPE_TO_SOURCE: Record<SessionType, DocumentSource> = {
  conversation: 'consultation',
  scribe: 'documentation',
};

// ─── Backend response interfaces ───────────────────────────────────────────────

export interface SessionSummary {
  id: string;
  created_at: string;
  updated_at: string;
  type: SessionType;
  status: SessionStatus;
  exam_type: string | null;
  patient_name: string | null;
  audio_duration: number | null;
  has_transcription: boolean;
  has_report: boolean;
}

export interface SessionDetail extends SessionSummary {
  clinical_context: string | null;
  audio_filename: string | null;
  raw_transcription: string | null;
  punctuated_text: string | null;
  diarized_text: string | null;
  corrected_text: string | null;
  report_content: Record<string, unknown> | string | null;
  transcription_duration: number | null;
  confidence_score: number | null;
}

export interface SessionList {
  items: SessionSummary[];
  total: number;
}

export interface AudioUploadResponse {
  session_id: string;
  audio_filename: string;
  audio_duration: number | null;
  message: string;
}

export interface TranscriptionResponse {
  session_id: string;
  raw_transcription: string;
  duration_seconds: number;
  confidence_score: number | null;
}

export interface ProcessingResponse {
  session_id: string;
  step: string;
  result: string;
  message: string;
}

export interface ReportGenerateResponse {
  session_id: string;
  report_type: 'medical_report' | 'documentation';
  content: Record<string, unknown>;
}

// ─── Report content structures ─────────────────────────────────────────────────

export interface UserProfile {
  name: string;
  role: string;
}

export interface MedicalReportContent {
  clinicalIndication: string;
  findings: string;
  impression: string;
  recommendations: string;
}

export interface DocumentationContent {
  transcription: string;
}

export interface MedicalReport {
  id: string;
  date: string;
  patientName?: string;
  examType: string;
  source: DocumentSource;
  transcription: string;
  status: 'draft' | 'validated';
  // Final content can be edited by the user
  finalReportContent?: MedicalReportContent;
  finalDocumentationContent?: DocumentationContent;
}

export type RecordingState = 'idle' | 'recording' | 'processing' | 'completed';
export type InputMethod = 'microphone' | 'upload';
