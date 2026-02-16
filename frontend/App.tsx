
import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import NewReport from './components/NewReport';
import HistoryView from './components/HistoryView';
import SettingsView from './components/SettingsView';
import { AppView, UserProfile, MedicalReport } from './types';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [user, setUser] = useState<UserProfile>({
    name: '-',
    role: 'Médecin'
  });

  const handleSaveReport = (_newReport: MedicalReport) => {
    // Report is already persisted in the backend via the pipeline.
    // Navigate back to dashboard which will fetch fresh data.
    setCurrentView(AppView.DASHBOARD);
  };

  const renderView = () => {
    switch (currentView) {
      case AppView.DASHBOARD:
        return <Dashboard user={user} />;
      case AppView.NEW_REPORT:
        return <NewReport onSave={handleSaveReport} />;
      case AppView.HISTORY:
        return <HistoryView />;
      case AppView.SETTINGS:
        return <SettingsView user={user} onUserChange={setUser} />;
      default:
        return <Dashboard user={user} />;
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
