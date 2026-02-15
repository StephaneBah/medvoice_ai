
import React from 'react';
import { LayoutDashboard, FilePlus, History, Settings, User } from 'lucide-react';
import { AppView, UserProfile } from '../types';

interface SidebarProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
  user: UserProfile;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, user }) => {
  const menuItems = [
    { id: AppView.DASHBOARD, icon: LayoutDashboard, label: 'Tableau de bord' },
    { id: AppView.NEW_REPORT, icon: FilePlus, label: 'Nouveau Rapport' },
    { id: AppView.HISTORY, icon: History, label: 'Historique' },
    { id: AppView.SETTINGS, icon: Settings, label: 'Paramètres' },
  ];

  return (
    <div className="w-full md:w-64 h-auto md:h-screen border-b md:border-b-0 md:border-r border-slate-800 bg-dark flex flex-col flex-shrink-0 transition-all duration-300">
      
      {/* Top Header: Logo (Visible on all) + User Avatar (Mobile Only) */}
      <div className="p-4 md:p-6 flex justify-between items-center md:block">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-cyan-500 rounded-lg flex items-center justify-center accent-glow shrink-0">
            <span className="text-white font-bold text-lg md:text-xl">M</span>
          </div>
          <h1 className="text-lg md:text-xl font-bold tracking-tight text-white">MedVoice AI</h1>
        </div>

        {/* Mobile User Profile (Avatar only) */}
        <div className="md:hidden flex items-center justify-center w-8 h-8 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
          <User size={16} />
        </div>
      </div>

      {/* Navigation: Horizontal scroll on mobile, Vertical list on desktop */}
      <nav className="
        w-full overflow-x-auto no-scrollbar 
        flex flex-row items-center space-x-2 p-2 
        md:flex-col md:items-stretch md:overflow-visible md:space-x-0 md:space-y-2 md:mt-6 md:px-4 md:flex-1
      ">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`
              flex items-center justify-center md:justify-start 
              space-x-0 md:space-x-3 
              p-3 md:px-4 md:py-3 
              rounded-xl transition-all 
              flex-shrink-0
              ${
                currentView === item.id
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
              }
            `}
          >
            <item.icon size={20} className={currentView === item.id ? 'stroke-[2.5px]' : ''} />
            {/* Label hidden on mobile for compactness, visible on desktop */}
            <span className="hidden md:block font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* User Profile Footer (Desktop Only) */}
      <div className="hidden md:block p-6 border-t border-slate-800/50 mt-auto">
        <div className="flex items-center space-x-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/5 shadow-inner hover:bg-white/10 transition-colors cursor-pointer group">
          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-white transition-colors">
            <User size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate group-hover:text-cyan-400 transition-colors">{user.name}</p>
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest truncate">{user.role}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
