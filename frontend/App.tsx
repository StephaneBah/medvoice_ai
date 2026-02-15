
import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import NewReport from './components/NewReport';
import SettingsView from './components/SettingsView';
import { AppView, UserProfile, MedicalReport } from './types';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [user, setUser] = useState<UserProfile>({
    name: '-',
    role: 'Médecin'
  });
  
  // Lifted state to manage saved reports across the app
  const [reports, setReports] = useState<MedicalReport[]>([]);

  const handleSaveReport = (newReport: MedicalReport) => {
    setReports(prev => [newReport, ...prev]);
    setCurrentView(AppView.DASHBOARD);
  };

  const renderView = () => {
    switch (currentView) {
      case AppView.DASHBOARD:
        return <Dashboard user={user} reports={reports} />;
      case AppView.NEW_REPORT:
        return <NewReport onSave={handleSaveReport} />;
      case AppView.HISTORY:
        return (
          <div className="p-12 flex flex-col items-center justify-center h-full text-slate-500">
            <h2 className="text-2xl font-bold text-white mb-2">Historique complet</h2>
            <p>Accédez ici à l'intégralité de vos archives médicales.</p>
          </div>
        );
      case AppView.SETTINGS:
        return <SettingsView user={user} onUserChange={setUser} />;
      default:
        return <Dashboard user={user} reports={reports} />;
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-dark overflow-hidden selection:bg-cyan-500/30">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} user={user} />
      <main className="flex-1 overflow-y-auto overflow-x-hidden bg-[#0d121b] relative">
        <div className="absolute top-0 right-0 w-64 h-64 md:w-[500px] md:h-[500px] bg-cyan-500/5 rounded-full blur-[120px] -mr-64 -mt-64 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 md:w-[500px] md:h-[500px] bg-blue-500/5 rounded-full blur-[120px] -ml-64 -mb-64 pointer-events-none"></div>
        <div className="relative z-10 h-full">
          {renderView()}
        </div>
      </main>
    </div>
  );
};

export default App;
