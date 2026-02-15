
import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, Square, Loader2, Save, X, 
  ClipboardList, Upload, FileAudio, User, Stethoscope, BookOpen, 
  Play, Pause, RotateCcw, Volume2, PlayCircle, ChevronRight, CheckCircle2,
  FileText, AlignLeft, Edit3
} from 'lucide-react';
import AudioVisualizer from './AudioVisualizer';
import { generateMedicalReport } from '../services/geminiService';
import { RecordingState, MedicalReportContent, DocumentationContent, DocumentSource, InputMethod, MedicalReport } from '../types';

interface NewReportProps {
  onSave: (report: MedicalReport) => void;
}

const PRESET_EXAMS = [
  "Radio Pulmonaire",
  "Mammographie",
  "Scanner Abdominal",
  "IRM Cérébrale",
  "Échographie Pelvienne",
  "Radio Osseuse"
];

const ChevronDown = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
);

const NewReport: React.FC<NewReportProps> = ({ onSave }) => {
  const [state, setState] = useState<RecordingState>('idle');
  const [inputMethod, setInputMethod] = useState<InputMethod>('microphone');
  const [docSource, setDocSource] = useState<DocumentSource>('consultation');
  
  const [examType, setExamType] = useState('Radio Pulmonaire');
  const [isCustomExam, setIsCustomExam] = useState(false);
  const [patientName, setPatientName] = useState('');
  
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // These hold the editable version of the content
  const [report, setReport] = useState<MedicalReportContent | null>(null);
  const [documentation, setDocumentation] = useState<DocumentationContent | null>(null);
  
  const [timer, setTimer] = useState(0);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state === 'recording') {
      timerRef.current = window.setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleStartRecording = () => {
    setState('recording');
    setAudioUrl(null);
    setTimer(0);
  };

  const processTranscription = async (text?: string) => {
    setState('processing');
    const finalExam = examType;
    
    // Simulate audio processing time
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const mockTranscription = text || `Transcription brute pour l'examen ${finalExam}. Patient: ${patientName || 'Anonyme'}. Les structures anatomiques observées sont conformes aux attentes cliniques standard. Aucun signe de pathologie évolutive détecté lors de cet examen.`;
    
    try {
      const generated = await generateMedicalReport(mockTranscription, finalExam, docSource);
      if (docSource === 'consultation') {
        setReport(generated);
        setDocumentation(null);
      } else {
        setDocumentation(generated);
        setReport(null);
      }
      setState('completed');
    } catch (error) {
      console.error(error);
      setState('idle');
      alert("Erreur lors de la génération. Veuillez réessayer.");
    }
  };

  const handleSave = () => {
    const newSavedReport: MedicalReport = {
      id: Math.floor(1000 + Math.random() * 9000).toString(),
      date: "À l'instant",
      patientName: patientName || 'Anonyme',
      examType: examType,
      source: docSource,
      transcription: "Transcription enregistrée...",
      status: 'validated',
      finalReportContent: report || undefined,
      finalDocumentationContent: documentation || undefined,
    };
    onSave(newSavedReport);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      setState('idle'); 
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setState('idle');
    setReport(null);
    setDocumentation(null);
    setTimer(0);
    setAudioUrl(null);
    setIsPlaying(false);
  };

  const handleEditReport = (key: keyof MedicalReportContent, val: string) => {
    if (report) setReport({ ...report, [key]: val });
  };

  const handleEditDocumentation = (index: number, val: string) => {
    if (documentation) {
      const newSections = [...documentation.sections];
      newSections[index].content = val;
      setDocumentation({ ...documentation, sections: newSections });
    }
  };

  return (
    <div className="p-4 md:p-5 max-w-7xl mx-auto flex flex-col custom-scrollbar">
      <header className="mb-4 md:mb-5 flex justify-between items-end">
        <div>
          <div className="flex items-center space-x-2 text-cyan-500 mb-1">
            <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Live Transcription Engine</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-white tracking-tighter">Espace de Travail</h2>
        </div>
        
        <div className="flex space-x-3">
          {state === 'completed' && (
            <button 
              onClick={handleSave}
              className="px-8 py-3 rounded-2xl bg-cyan-500 text-white font-black text-xs uppercase tracking-widest flex items-center space-x-3 accent-glow hover:bg-cyan-400 hover:scale-105 active:scale-95 transition-all"
            >
              <Save size={18} />
              <span>Valider & Archiver</span>
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5 flex-1 items-start lg:items-stretch">
        <div className="lg:col-span-5 space-y-3 md:space-y-4 flex flex-col">
          <div className="glass p-3 md:p-4 rounded-3xl border border-white/10">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">Usage du document</label>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => { setDocSource('consultation'); handleReset(); }}
                className={`flex items-center justify-center space-x-2 p-3 rounded-2xl border transition-all ${docSource === 'consultation' ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-white/5 border-transparent text-slate-500 hover:bg-white/10'}`}
              >
                <Stethoscope size={18} />
                <span className="text-xs font-bold uppercase">Consultation</span>
              </button>
              <button 
                onClick={() => { setDocSource('documentation'); handleReset(); }}
                className={`flex items-center justify-center space-x-2 p-3 rounded-2xl border transition-all ${docSource === 'documentation' ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' : 'bg-white/5 border-transparent text-slate-500 hover:bg-white/10'}`}
              >
                <BookOpen size={18} />
                <span className="text-xs font-bold uppercase">Documentation</span>
              </button>
            </div>
          </div>

          <div className="glass p-4 md:p-5 rounded-[32px] border border-white/10 flex flex-col items-center justify-between min-h-[310px] md:min-h-[340px] relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
            
            <div className="w-full flex justify-between items-start z-20">
              <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 shadow-inner">
                <button 
                  onClick={() => { setInputMethod('microphone'); handleReset(); }}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all ${inputMethod === 'microphone' ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Direct
                </button>
                <button 
                  onClick={() => { setInputMethod('upload'); handleReset(); }}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all ${inputMethod === 'upload' ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Upload
                </button>
              </div>
              <div className="text-right">
                <p className="text-2xl md:text-3xl font-mono text-white leading-none tracking-tighter tabular-nums">{formatTime(timer)}</p>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1">Chronomètre</p>
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center w-full py-3 md:py-4 space-y-3 md:space-y-4 z-10">
              {inputMethod === 'microphone' ? (
                <>
                  <AudioVisualizer isRecording={state === 'recording'} isProcessing={state === 'processing'} />
                  
                  <div className="flex flex-col items-center justify-center min-h-[96px] md:min-h-[110px]">
                    {state === 'idle' ? (
                      <button 
                        onClick={handleStartRecording}
                        className="group relative w-16 h-16 md:w-20 md:h-20 rounded-full bg-cyan-500 flex items-center justify-center text-white accent-glow hover:scale-110 active:scale-95 transition-all shadow-xl"
                      >
                        <Mic size={28} className="group-hover:animate-pulse md:w-8 md:h-8" />
                        <span className="absolute -bottom-8 whitespace-nowrap text-[9px] font-black text-cyan-500 tracking-[0.16em] uppercase">Dicter le rapport</span>
                      </button>
                    ) : state === 'recording' ? (
                      <button 
                        onClick={() => processTranscription()}
                        className="group relative w-16 h-16 md:w-20 md:h-20 rounded-full bg-red-500 flex items-center justify-center text-white shadow-2xl shadow-red-500/50 hover:scale-105 transition-all"
                      >
                        <Square size={24} fill="currentColor" className="md:w-7 md:h-7" />
                        <span className="absolute -bottom-8 whitespace-nowrap text-[9px] font-black text-red-500 tracking-[0.16em] uppercase">Terminer</span>
                      </button>
                    ) : state === 'processing' ? (
                      <div className="flex flex-col items-center space-y-5">
                        <div className="w-20 h-20 rounded-full border-[6px] border-cyan-500/10 border-t-cyan-500 animate-spin flex items-center justify-center shadow-inner" />
                        <span className="text-[10px] font-black text-cyan-500 tracking-[0.3em] animate-pulse uppercase">Structuration IA...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center space-y-4">
                        <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
                          <CheckCircle2 size={40} />
                        </div>
                        <span className="text-[10px] font-black text-emerald-400 tracking-widest uppercase">Prêt pour validation</span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 w-full">
                  {!audioUrl ? (
                    <>
                      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="audio/*" className="hidden" />
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-36 h-36 md:w-44 md:h-44 rounded-[36px] bg-white/5 border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-slate-500 hover:border-cyan-500 hover:text-cyan-500 transition-all group shadow-inner"
                      >
                        <Upload size={46} className="mb-3 group-hover:-translate-y-2 transition-transform duration-500 md:w-14 md:h-14" />
                        <span className="text-[10px] font-black tracking-[0.2em] uppercase">Importer Dictée</span>
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center space-y-6">
                      <div className={`w-36 h-36 md:w-40 md:h-40 rounded-[36px] ${state === 'completed' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-cyan-500/10 border-cyan-500/20'} border flex flex-col items-center justify-center ${state === 'completed' ? 'text-emerald-400' : 'text-cyan-400'} transition-all duration-700 shadow-xl`}>
                        {state === 'completed' ? <CheckCircle2 size={50} className="mb-2" /> : <FileAudio size={50} className="mb-2 animate-bounce" />}
                        <span className="text-[10px] font-black tracking-widest uppercase">{state === 'completed' ? 'Document Structuré' : 'Fichier Chargé'}</span>
                      </div>
                      {state === 'processing' && (
                        <div className="flex items-center space-x-3 text-cyan-500">
                          <Loader2 className="animate-spin" size={16} />
                          <span className="text-[10px] font-black tracking-[0.3em] uppercase">Intelligence en cours...</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {audioUrl && (
              <div className="w-full bg-white/5 rounded-3xl p-3 flex items-center space-x-3 border border-white/10 animate-in fade-in slide-in-from-bottom-2 z-20">
                <audio 
                  ref={audioRef} 
                  src={audioUrl} 
                  onEnded={() => setIsPlaying(false)} 
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  className="hidden" 
                />
                <button 
                  onClick={togglePlayback}
                  className="w-10 h-10 rounded-2xl bg-cyan-500 flex items-center justify-center text-white shadow-xl hover:scale-105 active:scale-95 transition-all flex-shrink-0"
                >
                  {isPlaying ? <Pause size={20} fill="white" /> : <Play size={20} fill="white" className="ml-1" />}
                </button>
                <div className="flex-1 h-1.5 bg-white/10 rounded-full relative overflow-hidden">
                  <div className={`h-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)] ${isPlaying ? 'w-full transition-all duration-[30s] ease-linear' : 'w-0'}`} />
                </div>
                <div className="flex items-center space-x-3 flex-shrink-0">
                  <button onClick={handleReset} className="text-slate-500 hover:text-red-400 transition-colors p-2 rounded-xl hover:bg-white/5" title="Reset">
                    <RotateCcw size={18} />
                  </button>
                </div>
                
                {state === 'idle' && (
                  <button 
                    onClick={() => processTranscription()}
                    className="flex-shrink-0 bg-cyan-500 text-white px-4 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center space-x-2 accent-glow hover:bg-cyan-400 transition-all ml-1"
                  >
                    <PlayCircle size={16} />
                    <span>TRAITER</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="glass p-4 md:p-5 rounded-3xl border border-white/10 space-y-4 shadow-sm">
            <div className="grid grid-cols-1 gap-4">
              <div className="relative">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Désignation de l'examen</label>
                {!isCustomExam ? (
                  <div className="relative group">
                    <select 
                      value={examType}
                      onChange={(e) => {
                        if (e.target.value === "CUSTOM") setIsCustomExam(true);
                        else setExamType(e.target.value);
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white font-semibold outline-none focus:border-cyan-500/50 transition-all appearance-none cursor-pointer group-hover:bg-white/10"
                    >
                      {PRESET_EXAMS.map(ex => <option key={ex} value={ex} className="bg-dark">{ex}</option>)}
                      <option value="CUSTOM" className="bg-dark text-cyan-400 font-bold tracking-tighter uppercase">+ Saisie personnalisée</option>
                    </select>
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 group-hover:text-cyan-500 transition-colors">
                      <ChevronDown size={18} />
                    </div>
                  </div>
                ) : (
                  <div className="flex space-x-2 animate-in slide-in-from-right-2">
                    <input 
                      autoFocus
                      type="text"
                      placeholder="Type d'examen..."
                      value={examType === "CUSTOM" ? "" : examType}
                      onChange={(e) => setExamType(e.target.value)}
                      className="flex-1 bg-white/5 border border-cyan-500/40 rounded-2xl px-4 py-3 text-white font-semibold outline-none focus:bg-white/10"
                    />
                    <button onClick={() => setIsCustomExam(false)} className="px-4 rounded-2xl bg-white/5 text-slate-500 hover:text-white border border-white/5 hover:border-white/10">
                      <X size={18} />
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Identifiant / Patient</label>
                <div className="relative group">
                  <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-hover:text-cyan-500 transition-colors" size={20} />
                  <input 
                    type="text"
                    placeholder="Nom ou Matricule..."
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-white font-semibold outline-none focus:border-cyan-500/50 group-hover:bg-white/10 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 flex flex-col min-h-[420px] lg:min-h-0 lg:h-full self-stretch">
          {state === 'completed' && (report || documentation) ? (
            <div className="glass flex-1 rounded-[36px] md:rounded-[44px] border border-white/10 p-6 md:p-8 space-y-6 md:space-y-8 animate-in fade-in zoom-in-95 duration-700 flex flex-col shadow-2xl relative overflow-hidden">
              <div className="absolute top-6 right-6 md:top-8 md:right-8 text-[10px] font-black text-cyan-500 border border-cyan-500/20 px-4 py-2 rounded-full uppercase tracking-widest bg-cyan-500/5 backdrop-blur-sm">
                Mode Édition & Validation
              </div>

              <div className="flex items-center space-x-4 md:space-x-6 border-b border-white/5 pb-5 md:pb-6 pr-0 md:pr-28">
                <div className={`w-16 h-16 rounded-[24px] flex items-center justify-center shadow-xl ${docSource === 'consultation' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-purple-500/10 text-purple-400'}`}>
                  {docSource === 'consultation' ? <ClipboardList size={36} /> : <AlignLeft size={36} />}
                </div>
                <div>
                  <h3 className="text-3xl font-black text-white tracking-tight">
                    {docSource === 'consultation' ? 'Rapport Structuré' : 'Dictée Médicale'}
                  </h3>
                  <p className="text-xs text-slate-500 uppercase font-black tracking-[0.2em] mt-1">
                    {examType} • {new Date().toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 md:pr-4 min-h-0">
                {docSource === 'consultation' && report ? (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 md:gap-8">
                    <div className="space-y-6">
                      <section className="group">
                        <div className="flex items-center justify-between mb-3">
                           <div className="flex items-center space-x-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,1)]" />
                              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Contexte Clinique</h4>
                           </div>
                           <Edit3 size={12} className="text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <textarea 
                          value={report.clinicalIndication}
                          onChange={(e) => handleEditReport('clinicalIndication', e.target.value)}
                          className="w-full text-slate-300 text-sm leading-7 bg-white/5 p-5 rounded-[28px] border border-white/5 shadow-inner outline-none focus:border-cyan-500/30 min-h-[170px] resize-y"
                        />
                      </section>
                      <section className="group">
                        <div className="flex items-center justify-between mb-3">
                           <div className="flex items-center space-x-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,1)]" />
                              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Observations</h4>
                           </div>
                           <Edit3 size={12} className="text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <textarea 
                          value={report.findings}
                          onChange={(e) => handleEditReport('findings', e.target.value)}
                          className="w-full text-slate-300 text-sm leading-7 bg-white/5 p-5 rounded-[28px] border border-white/5 outline-none focus:border-cyan-500/30 min-h-[260px] resize-y"
                        />
                      </section>
                    </div>

                    <div className="space-y-6">
                      <section className="group">
                        <div className="flex items-center justify-between mb-3">
                           <div className="flex items-center space-x-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,1)]" />
                              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Conclusion</h4>
                           </div>
                           <Edit3 size={12} className="text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <textarea 
                          value={report.impression}
                          onChange={(e) => handleEditReport('impression', e.target.value)}
                          className="w-full text-white text-sm font-bold leading-7 bg-cyan-500/10 p-6 rounded-[30px] border border-cyan-500/30 shadow-[inset_0_0_20px_rgba(6,182,212,0.1)] outline-none focus:border-cyan-400 min-h-[180px] resize-y"
                        />
                      </section>
                      <section className="group">
                        <div className="flex items-center justify-between mb-3">
                           <div className="flex items-center space-x-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,1)]" />
                              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Recommandations</h4>
                           </div>
                           <Edit3 size={12} className="text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <textarea 
                          value={report.recommendations}
                          onChange={(e) => handleEditReport('recommendations', e.target.value)}
                          className="w-full text-slate-300 text-sm italic leading-7 bg-white/5 p-5 rounded-[28px] border border-white/5 outline-none focus:border-cyan-500/30 min-h-[170px] resize-y"
                        />
                      </section>
                    </div>
                  </div>
                ) : documentation ? (
                  <div className="space-y-8">
                    <div className="mb-8 border-b border-white/5 pb-6 relative group">
                       <h5 className="text-cyan-400 font-black tracking-tighter text-2xl md:text-3xl leading-tight mb-3 pr-8">{documentation.title}</h5>
                       <p className="text-[10px] text-slate-600 uppercase font-black tracking-[0.3em]">IA Structuration Engine v2.1</p>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 md:gap-8">
                      {documentation.sections.map((sec, idx) => (
                        <section key={idx} className={`space-y-4 group ${idx === 2 ? 'xl:col-span-2' : ''}`}>
                          <div className="flex items-center justify-between">
                             <div className="flex items-center space-x-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,1)]" />
                                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{sec.label}</h4>
                             </div>
                             <Edit3 size={12} className="text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <textarea 
                            value={sec.content}
                            onChange={(e) => handleEditDocumentation(idx, e.target.value)}
                            onInput={(e) => {
                              const target = e.target as HTMLTextAreaElement;
                              target.style.height = 'auto';
                              target.style.height = `${target.scrollHeight + 4}px`;
                            }}
                            style={{ height: 'auto', minHeight: '120px' }}
                            className={`w-full text-sm leading-7 p-6 rounded-[30px] border outline-none transition-all shadow-inner resize-none ${idx % 2 === 1 ? 'bg-cyan-500/5 border-cyan-500/20 text-white font-semibold focus:border-cyan-400' : 'bg-white/5 border-white/5 text-slate-300 focus:border-cyan-500/30'}`}
                          />
                        </section>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="pt-5 md:pt-6 border-t border-white/5 flex justify-between items-center z-10">
                 <button 
                  onClick={handleReset} 
                  className="flex items-center space-x-3 px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-slate-500 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all group active:scale-95"
                >
                    <RotateCcw size={20} className="group-hover:text-red-400 transition-colors" />
                    <span className="text-[11px] font-black uppercase tracking-[0.2em]">Annuler & Recommencer</span>
                 </button>
                <div className="flex flex-col items-end">
                  <p className="text-[10px] text-slate-600 font-mono italic tracking-tighter">
                    VERIFICATION MEDICALE REQUISE AVANT ARCHIVAGE
                  </p>
                  <p className="text-[9px] text-slate-700 font-bold uppercase mt-0.5">MedVoice Security Core</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 glass rounded-[36px] md:rounded-[56px] border border-white/5 border-dashed flex flex-col items-center justify-center p-6 md:p-12 group transition-all duration-700 hover:bg-white/5 overflow-hidden">
              <div className="text-center relative">
                <div className="w-32 h-32 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-10 group-hover:scale-110 transition-transform duration-700 relative">
                  <div className="absolute inset-0 bg-cyan-500/10 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <FileText size={56} className="text-slate-800 opacity-20 relative z-10" />
                </div>
                <h3 className="text-3xl font-black text-slate-400 mb-4 tracking-tighter">Terminal de Dictée</h3>
                <p className="text-slate-600 max-w-sm mx-auto leading-relaxed text-sm font-medium">
                  Initialisez l'enregistrement ou téléversez vos fichiers audio pour accéder à la structuration par intelligence artificielle.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewReport;
