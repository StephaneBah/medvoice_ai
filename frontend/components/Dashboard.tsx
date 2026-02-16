
import React, { useEffect, useState } from 'react';
import { Activity, Clock, FileText, CheckCircle2, Mic, AlertCircle, Loader2 } from 'lucide-react';
import { UserProfile, SessionSummary, SESSION_TYPE_TO_SOURCE } from '../types';
import { getSessions } from '../services/apiService';

interface DashboardProps {
  user: UserProfile;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSessions({ limit: 100 });
      setSessions(data.items);
      setTotal(data.total);
    } catch (err: any) {
      setError(err?.message || 'Impossible de charger les sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSessions(); }, []);

  // Compute real stats
  const completedCount = sessions.filter(s => s.status === 'completed').length;
  const pendingCount = sessions.filter(s => s.status === 'pending' || s.status === 'processing' || s.status === 'transcribed').length;
  const errorCount = sessions.filter(s => s.status === 'error').length;

  const stats = [
    { label: 'Sessions totales', value: total.toString(), icon: FileText, color: 'text-blue-400' },
    { label: 'Complétées', value: completedCount.toString(), icon: CheckCircle2, color: 'text-emerald-400' },
    { label: 'En cours', value: pendingCount.toString(), icon: Clock, color: 'text-amber-400' },
    { label: 'Erreurs', value: errorCount.toString(), icon: AlertCircle, color: 'text-red-400' },
  ];

  const statusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-tighter">Complété</span>;
      case 'error':
        return <span className="px-3 py-1 rounded-lg bg-red-500/10 text-red-400 text-[10px] font-black uppercase tracking-tighter">Erreur</span>;
      case 'transcribed':
        return <span className="px-3 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 text-[10px] font-black uppercase tracking-tighter">Transcrit</span>;
      case 'processing':
        return <span className="px-3 py-1 rounded-lg bg-amber-500/10 text-amber-400 text-[10px] font-black uppercase tracking-tighter">En cours</span>;
      default:
        return <span className="px-3 py-1 rounded-lg bg-slate-500/10 text-slate-400 text-[10px] font-black uppercase tracking-tighter">En attente</span>;
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin}min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `Il y a ${diffH}h`;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header>
        <h2 className="text-3xl font-bold text-white">Bonjour, <span className="text-cyan-400">{user.name}</span></h2>
        <p className="text-slate-400 mt-1">Voici un résumé de vos activités.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="glass p-6 rounded-2xl border border-white/10 flex items-center space-x-4">
            <div className={`p-3 rounded-xl bg-white/5 ${stat.color}`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-400 font-medium">{stat.label}</p>
              <p className="text-2xl font-bold text-white">{loading ? '…' : stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass p-6 rounded-3xl border border-white/10 flex flex-col">
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="text-lg font-semibold text-white">Activité récente</h3>
            {!loading && (
              <button onClick={fetchSessions} className="text-[10px] font-black text-cyan-500 uppercase tracking-widest hover:text-cyan-400 transition-colors">
                ↻ Rafraîchir
              </button>
            )}
          </div>
          <div className="space-y-3 flex-1 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
            {loading && (
              <div className="flex items-center justify-center py-10 text-cyan-500">
                <Loader2 className="animate-spin mr-3" size={20} />
                <span className="text-sm font-medium">Chargement…</span>
              </div>
            )}
            {error && (
              <div className="text-center py-10 space-y-2">
                <p className="text-red-400 text-sm font-bold">{error}</p>
                <button onClick={fetchSessions} className="text-[10px] font-black text-cyan-400 uppercase tracking-widest hover:text-cyan-300">↻ Réessayer</button>
              </div>
            )}
            {!loading && !error && sessions.length === 0 && (
              <div className="text-center py-10 text-slate-600 italic text-sm">
                Aucune session. Commencez par en créer une !
              </div>
            )}
            {!loading && !error && sessions.slice(0, 10).map((session) => {
              const source = SESSION_TYPE_TO_SOURCE[session.type];
              return (
                <div key={session.id} className="flex items-center justify-between p-4 rounded-2xl hover:bg-white/5 transition-all group border border-white/5 hover:border-white/10 shadow-sm">
                  <div className="flex items-center space-x-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${source === 'consultation' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-purple-500/10 text-purple-400'}`}>
                      {source === 'consultation' ? <FileText size={20} /> : <Mic size={20} />}
                    </div>
                    <div>
                      <p className="font-bold text-white group-hover:text-cyan-400 transition-colors">
                        {session.patient_name || (source === 'consultation' ? 'Consultation' : 'Documentation')}
                      </p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                        {session.exam_type || 'Examen'} • {formatDate(session.created_at)}
                      </p>
                    </div>
                  </div>
                  {statusBadge(session.status)}
                </div>
              );
            })}
          </div>
        </div>

        <div className="glass p-6 rounded-3xl border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">Moteur de Transcription</h3>
          <div className="flex items-center justify-center h-64">
             <div className="text-center group">
                <div className="relative mb-4">
                  <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-xl group-hover:bg-cyan-500/40 transition-all duration-500"></div>
                  <Activity className="relative mx-auto text-cyan-500 animate-pulse" size={48} />
                </div>
                <p className="text-white font-bold tracking-tight">MedVoice ASR</p>
                <p className="text-slate-500 text-xs mt-1">Prêt pour la dictée médicale</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
