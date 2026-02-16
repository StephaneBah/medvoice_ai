/**
 * MedVoice AI — API Service
 * Centralized HTTP client for all backend API calls.
 */

import type {
  SessionType,
  SessionStatus,
  SessionSummary,
  SessionDetail,
  SessionList,
  AudioUploadResponse,
  TranscriptionResponse,
  ProcessingResponse,
  ReportGenerateResponse,
} from '../types';

const API_BASE = '/api/v1';

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `API error ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ─── Sessions ──────────────────────────────────────────────────────────────────

export async function getSessions(params?: {
  skip?: number;
  limit?: number;
  type?: SessionType;
  status?: SessionStatus;
}): Promise<SessionList> {
  const query = new URLSearchParams();
  if (params?.skip != null) query.set('skip', String(params.skip));
  if (params?.limit != null) query.set('limit', String(params.limit));
  if (params?.type) query.set('type', params.type);
  if (params?.status) query.set('status', params.status);

  const qs = query.toString();
  return request<SessionList>(`/sessions${qs ? `?${qs}` : ''}`);
}

export async function getSession(sessionId: string): Promise<SessionDetail> {
  return request<SessionDetail>(`/sessions/${sessionId}`);
}

export async function deleteSession(sessionId: string): Promise<void> {
  await request<unknown>(`/sessions/${sessionId}`, { method: 'DELETE' });
}

// ─── Audio Upload ──────────────────────────────────────────────────────────────

export async function uploadAudio(
  file: Blob,
  type: SessionType,
  options?: {
    examType?: string;
    patientName?: string;
    clinicalContext?: string;
  },
): Promise<AudioUploadResponse> {
  const formData = new FormData();
  formData.append('file', file, 'recording.webm');
  formData.append('type', type);
  if (options?.examType) formData.append('exam_type', options.examType);
  if (options?.patientName) formData.append('patient_name', options.patientName);
  if (options?.clinicalContext) formData.append('clinical_context', options.clinicalContext);

  const res = await fetch(`${API_BASE}/audio/upload`, {
    method: 'POST',
    body: formData,
    // Do NOT set Content-Type — browser will set multipart boundary automatically
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Upload failed (${res.status})`);
  }

  return res.json() as Promise<AudioUploadResponse>;
}

// ─── Transcription ─────────────────────────────────────────────────────────────

export async function transcribe(sessionId: string): Promise<TranscriptionResponse> {
  return request<TranscriptionResponse>(`/transcribe/${sessionId}`, { method: 'POST' });
}

// ─── Processing (CoT Pipeline) ────────────────────────────────────────────────

export async function runFullPipeline(sessionId: string): Promise<ProcessingResponse> {
  return request<ProcessingResponse>(`/process/${sessionId}/full-pipeline`, { method: 'POST' });
}

export async function punctuate(sessionId: string): Promise<ProcessingResponse> {
  return request<ProcessingResponse>(`/process/${sessionId}/punctuate`, { method: 'POST' });
}

export async function diarize(sessionId: string): Promise<ProcessingResponse> {
  return request<ProcessingResponse>(`/process/${sessionId}/diarize`, { method: 'POST' });
}

export async function correct(sessionId: string): Promise<ProcessingResponse> {
  return request<ProcessingResponse>(`/process/${sessionId}/correct`, { method: 'POST' });
}

// ─── Report Generation ────────────────────────────────────────────────────────

export async function generateReport(
  sessionId: string,
  context?: string,
): Promise<ReportGenerateResponse> {
  return request<ReportGenerateResponse>(`/report/${sessionId}/generate`, {
    method: 'POST',
    body: JSON.stringify(context ? { context } : {}),
  });
}

export async function getReport(sessionId: string): Promise<ReportGenerateResponse> {
  return request<ReportGenerateResponse>(`/report/${sessionId}`);
}

export async function updateReport(sessionId: string, content: Record<string, unknown>): Promise<void> {
  await request<unknown>(`/report/${sessionId}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

// ─── Health ────────────────────────────────────────────────────────────────────

export async function healthCheck(): Promise<{ status: string; service: string }> {
  const res = await fetch('/health');
  return res.json();
}

// ─── Config ────────────────────────────────────────────────────────────────────

export interface BackendConfig {
  asr_model_id: string;
  llm_model_id: string;
}

export async function getConfig(): Promise<BackendConfig> {
  return request<BackendConfig>('/config');
}
