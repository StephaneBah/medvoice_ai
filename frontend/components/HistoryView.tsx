
import React, { useEffect, useState } from 'react';
import {
  FileText, Mic, Trash2, Eye, Loader2, ChevronDown,
  CheckCircle2, AlertCircle, Clock, Filter
} from 'lucide-react';
import { SessionSummary, SessionType, SessionStatus, SESSION_TYPE_TO_SOURCE } from '../types';
import { getSessions, deleteSession, getSession } from '../services/apiService';

const HistoryView: React.FC = () => {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterType, setFilterType] = useState<SessionType | ''>('');
  const [filterStatus, setFilterStatus] = useState<SessionStatus | ''>('');

  // Detail panel
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = { limit: 100 };
      if (filterType) params.type = filterType;
      if (filterStatus) params.status = filterStatus;
      const data = await getSessions(params);
      setSessions(data.items);
      setTotal(data.total);
    } catch (err: any) {
      setError(err?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [filterType, filterStatus]);

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette session définitivement ?')) return;
    try {
      await deleteSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
      setTotal(prev => prev - 1);
      if (selectedId === id) { setSelectedId(null); setDetail(null); }
    } catch (err: any) {
      alert(err?.message || 'Echec de la suppression');
    }
  };

  const cleanText = (text: string): string => {
    if (!text) return '';
    // Remove common LLM prefixes (non-greedy match until colon)
    let cleaned = text.replace(/^(Here is|Here are|Voici|La correction|The corrected|Corrected text|Résultat|Output).*?:\s*/is, '');
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '');
    
    // Remove common LLM suffixes/explanations
    cleaned = cleaned.replace(/\n\s*(###|Note|Explication).*/is, '');
    
    return cleaned.trim();
  };

  const createEmptyMedicalReport = (): Record<string, unknown> => ({
    clinicalIndication: '',
    findings: '',
    impression: '',
    recommendations: '',
  });

  const toObject = (value: unknown): Record<string, unknown> | null => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return null;
  };

  const extractJsonObject = (value: unknown): Record<string, unknown> | null => {
    if (typeof value !== 'string') return null;
    const cleaned = cleanText(value);
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      const parsed = JSON.parse(cleaned.slice(start, end + 1));
      return toObject(parsed);
    } catch {
      return null;
    }
  };

  const asText = (value: unknown): string => (typeof value === 'string' ? cleanText(value) : '');

  const normalizeMedicalReport = (
    content: unknown,
    fallbackText: string,
  ): Record<string, unknown> => {
    const empty = createEmptyMedicalReport();
    const objectContent = toObject(content) || extractJsonObject(content);

    if (!objectContent) {
      return { ...empty, findings: fallbackText };
    }

    const normalized = {
      clinicalIndication: asText(objectContent.clinicalIndication),
      findings: asText(objectContent.findings),
      impression: asText(objectContent.impression),
      recommendations: asText(objectContent.recommendations),
    };

    const nested = extractJsonObject(normalized.findings);
    if (nested) {
      return normalizeMedicalReport(nested, fallbackText);
    }

    if (normalized.clinicalIndication || normalized.findings || normalized.impression || normalized.recommendations) {
      return {
        ...empty,
        ...normalized,
        findings: normalized.findings || fallbackText,
      };
    }

    const wrapped =
      objectContent.report_content ??
      objectContent.content ??
      objectContent.report ??
      (typeof objectContent.transcription === 'string' ? { findings: objectContent.transcription } : null);

    if (wrapped) return normalizeMedicalReport(wrapped, fallbackText);

    return { ...empty, findings: fallbackText };
  };

  const handleViewDetail = async (id: string) => {
    if (selectedId === id) { setSelectedId(null); setDetail(null); return; }
    setSelectedId(id);
    setDetailLoading(true);
    try {
      const d = await getSession(id);
      if (d.corrected_text) d.corrected_text = cleanText(d.corrected_text);
      const fallbackText = cleanText(d.corrected_text || d.diarized_text || d.punctuated_text || d.raw_transcription || '');

      if (d.type === 'conversation') {
        d.report_content = normalizeMedicalReport(d.report_content, fallbackText);
      } else if (typeof d.report_content === 'string') {
        const parsed = extractJsonObject(d.report_content);
        d.report_content = parsed || { transcription: cleanText(d.report_content) };
      }

      setDetail(d);
    } catch (err: any) {
      setDetail(null);
      alert(err?.message || 'Impossible de charger les détails');
    } finally {
      setDetailLoading(false);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      completed:  { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Complété' },
      error:      { bg: 'bg-red-500/10',     text: 'text-red-400',     label: 'Erreur' },
      transcribed:{ bg: 'bg-cyan-500/10',    text: 'text-cyan-400',    label: 'Transcrit' },
      processing: { bg: 'bg-amber-500/10',   text: 'text-amber-400',   label: 'En cours' },
      pending:    { bg: 'bg-slate-500/10',   text: 'text-slate-400',   label: 'En attente' },
    };
    const s = map[status] || map.pending;
    return <span className={`px-3 py-1 rounded-lg ${s.bg} ${s.text} text-[10px] font-black uppercase tracking-tighter`}>{s.label}</span>;
  };

  return (
    <div className="p-4 md:p-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Historique</h2>
          <p className="text-slate-400 mt-1 text-sm">{total} session{total !== 1 ? 's' : ''} au total</p>
        </div>
        <button
          onClick={fetchAll}
          className="text-[10px] font-black text-cyan-500 uppercase tracking-widest hover:text-cyan-400 transition-colors"
        >
          ↻ Rafraîchir
        </button>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as SessionType | '')}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-bold outline-none focus:border-cyan-500/50 appearance-none pr-8 cursor-pointer"
          >
            <option value="" className="bg-[#0d121b]">Tous les types</option>
            <option value="conversation" className="bg-[#0d121b]">Consultation</option>
            <option value="scribe" className="bg-[#0d121b]">Documentation</option>
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" />
        </div>
        <div className="relative">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as SessionStatus | '')}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-bold outline-none focus:border-cyan-500/50 appearance-none pr-8 cursor-pointer"
          >
            <option value="" className="bg-[#0d121b]">Tous les statuts</option>
            <option value="pending" className="bg-[#0d121b]">En attente</option>
            <option value="processing" className="bg-[#0d121b]">En cours</option>
            <option value="transcribed" className="bg-[#0d121b]">Transcrit</option>
            <option value="completed" className="bg-[#0d121b]">Complété</option>
            <option value="error" className="bg-[#0d121b]">Erreur</option>
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-cyan-500">
          <Loader2 className="animate-spin mr-3" size={24} />
          <span className="font-medium">Chargement…</span>
        </div>
      ) : error ? (
        <div className="text-center py-20 space-y-3">
          <AlertCircle className="mx-auto text-red-400" size={36} />
          <p className="text-red-400 font-bold">{error}</p>
          <button onClick={fetchAll} className="text-xs font-black text-cyan-400 uppercase tracking-widest hover:text-cyan-300">↻ Réessayer</button>
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-20 text-slate-600 italic text-sm">
          Aucune session trouvée.
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => {
            const source = SESSION_TYPE_TO_SOURCE[session.type];
            const isOpen = selectedId === session.id;
            return (
              <div key={session.id} className="glass rounded-2xl border border-white/10 overflow-hidden transition-all">
                {/* Row */}
                <div className="flex items-center justify-between p-4 hover:bg-white/5 transition-all">
                  <div className="flex items-center space-x-4 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center ${source === 'consultation' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-purple-500/10 text-purple-400'}`}>
                      {source === 'consultation' ? <FileText size={20} /> : <Mic size={20} />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-white truncate">
                        {session.patient_name || (source === 'consultation' ? 'Consultation' : 'Documentation')}
                      </p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5 truncate">
                        {session.exam_type || 'Examen'} • {formatDate(session.created_at)}
                        {session.audio_duration ? ` • ${Math.round(session.audio_duration)}s` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 flex-shrink-0 ml-4">
                    {statusBadge(session.status)}
                    <button
                      onClick={() => handleViewDetail(session.id)}
                      className="p-2 rounded-xl hover:bg-white/10 text-slate-500 hover:text-cyan-400 transition-all"
                      title="Voir détails"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(session.id)}
                      className="p-2 rounded-xl hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-all"
                      title="Supprimer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Detail panel */}
                {isOpen && (
                  <div className="border-t border-white/5 p-5 bg-white/[0.02] animate-in fade-in slide-in-from-top-2 duration-300">
                    {detailLoading ? (
                      <div className="flex items-center space-x-3 text-cyan-500 py-4">
                        <Loader2 className="animate-spin" size={16} />
                        <span className="text-sm">Chargement des détails…</span>
                      </div>
                    ) : detail ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {detail.raw_transcription && (
                            <div>
                              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Transcription brute</h4>
                              <p className="text-sm text-slate-300 bg-white/5 rounded-2xl p-4 border border-white/5 max-h-40 overflow-y-auto custom-scrollbar leading-relaxed">
                                {detail.raw_transcription}
                              </p>
                            </div>
                          )}
                          {detail.corrected_text && (
                            <div>
                              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Texte corrigé</h4>
                              <p className="text-sm text-slate-300 bg-white/5 rounded-2xl p-4 border border-white/5 max-h-40 overflow-y-auto custom-scrollbar leading-relaxed">
                                {cleanText(detail.corrected_text)}
                              </p>
                            </div>
                          )}
                        </div>
                        {detail.report_content && (
                          <div className="space-y-4">
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Rapport généré</h4>
                            {detail.type === 'conversation' ? (
                              <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-4">
                                {detail.report_content.clinicalIndication && (
                                  <div>
                                    <h5 className="text-[10px] text-cyan-400 font-bold uppercase mb-1">Indication Clinique</h5>
                                    <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{detail.report_content.clinicalIndication}</p>
                                  </div>
                                )}
                                {detail.report_content.findings && (
                                  <div>
                                    <h5 className="text-[10px] text-cyan-400 font-bold uppercase mb-1">Observations</h5>
                                    <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{detail.report_content.findings}</p>
                                  </div>
                                )}
                                {detail.report_content.impression && (
                                  <div>
                                    <h5 className="text-[10px] text-cyan-400 font-bold uppercase mb-1">Impression</h5>
                                    <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{detail.report_content.impression}</p>
                                  </div>
                                )}
                                {detail.report_content.recommendations && (
                                  <div>
                                    <h5 className="text-[10px] text-cyan-400 font-bold uppercase mb-1">Recommandations</h5>
                                    <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{detail.report_content.recommendations}</p>
                                  </div>
                                )}
                              </div>
                            ) : detail.report_content.transcription ? (
                              <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-4">
                                <div>
                                  <h5 className="text-[10px] text-cyan-400 font-bold uppercase mb-1">Transcription</h5>
                                  <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{detail.report_content.transcription}</p>
                                </div>
                              </div>
                            ) : detail.report_content.sections && Array.isArray(detail.report_content.sections) ? (
                                /* Documentation renderer */
                                <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-4">
                                  {detail.report_content.title && (
                                    <h3 className="text-sm font-bold text-white mb-2 underline decoration-cyan-500/50 underline-offset-4">{detail.report_content.title}</h3>
                                  )}
                                  {detail.report_content.sections.map((sec: any, idx: number) => (
                                    <div key={idx}>
                                      <h5 className="text-[10px] text-purple-400 font-bold uppercase mb-1">{sec.label}</h5>
                                      <p className="text-sm text-slate-300 whitespace-pre-wrap">{sec.content}</p>
                                    </div>
                                  ))}
                                </div>
                            ) : (
                              /* Fallback to JSON */
                              <pre className="text-xs text-slate-300 bg-white/5 rounded-2xl p-4 border border-white/5 max-h-60 overflow-y-auto custom-scrollbar whitespace-pre-wrap">
                                {typeof detail.report_content === 'string' ? detail.report_content : JSON.stringify(detail.report_content, null, 2)}
                              </pre>
                            )}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-4 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                          {detail.transcription_duration != null && <span>Durée transcription : {detail.transcription_duration.toFixed(1)}s</span>}
                          {detail.confidence_score != null && <span>Confiance : {(detail.confidence_score * 100).toFixed(0)}%</span>}
                          <span>Mis à jour : {formatDate(detail.updated_at)}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HistoryView;
