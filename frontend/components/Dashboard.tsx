
import React from 'react';
import { Activity, Clock, FileText, CheckCircle2, Mic } from 'lucide-react';
import { UserProfile, MedicalReport } from '../types';

interface DashboardProps {
  user: UserProfile;
  reports: MedicalReport[];
}

const Dashboard: React.FC<DashboardProps> = ({ user, reports }) => {
  const stats = [
    { label: 'Rapports totaux', value: (124 + reports.length).toString(), icon: FileText, color: 'text-blue-400' },
    { label: 'Aujourd\'hui', value: (12 + reports.length).toString(), icon: Activity, color: 'text-cyan-400' },
    { label: 'En attente', value: '3', icon: Clock, color: 'text-amber-400' },
    { label: 'Validés', value: (109 + reports.length).toString(), icon: CheckCircle2, color: 'text-emerald-400' },
  ];

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header>
        <h2 className="text-3xl font-bold text-white">Bonjour, <span className="text-cyan-400">{user.name}</span></h2>
        <p className="text-slate-400 mt-1">Voici un résumé de vos activités aujourd'hui.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="glass p-6 rounded-2xl border border-white/10 flex items-center space-x-4">
            <div className={`p-3 rounded-xl bg-white/5 ${stat.color}`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-400 font-medium">{stat.label}</p>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass p-6 rounded-3xl border border-white/10 flex flex-col">
          <h3 className="text-lg font-semibold text-white mb-4 px-2">Activité récente</h3>
          <div className="space-y-3 flex-1 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
            {reports.length === 0 && (
               <div className="text-center py-10 text-slate-600 italic text-sm">
                 Aucun rapport récent. Commencez par en créer un !
               </div>
            )}
            {reports.map((report) => (
              <div key={report.id} className="flex items-center justify-between p-4 rounded-2xl hover:bg-white/5 transition-all group border border-white/5 hover:border-white/10 shadow-sm">
                <div className="flex items-center space-x-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${report.source === 'consultation' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-purple-500/10 text-purple-400'}`}>
                    {report.source === 'consultation' ? <FileText size={20} /> : <Mic size={20} />}
                  </div>
                  <div>
                    <p className="font-bold text-white group-hover:text-cyan-400 transition-colors">
                      {report.source === 'consultation' ? `Rapport #${report.id}` : `Dictée #${report.id}`}
                    </p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                      {report.examType} • {report.date}
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-tighter">Validé</span>
              </div>
            ))}
            
            {/* Mock data for visual consistency */}
            {[1024, 1025].map((id) => (
              <div key={id} className="flex items-center justify-between p-4 rounded-2xl hover:bg-white/5 transition-all group border border-white/5 hover:border-white/10">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                    <FileText size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-white">Patient #{id}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Radio Pulmonaire • Il y a 2h</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-tighter">Généré</span>
              </div>
            ))}
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
                <p className="text-white font-bold tracking-tight">Whisper-rad-FR2</p>
                <p className="text-slate-500 text-xs mt-1">Prêt pour la dictée médicale</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
