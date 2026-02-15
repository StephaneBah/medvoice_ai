
export enum AppView {
  DASHBOARD = 'dashboard',
  NEW_REPORT = 'new_report',
  HISTORY = 'history',
  SETTINGS = 'settings'
}

export type DocumentSource = 'consultation' | 'documentation';

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

export interface DocumentationSection {
  label: string;
  content: string;
}

export interface DocumentationContent {
  title: string;
  sections: DocumentationSection[];
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
