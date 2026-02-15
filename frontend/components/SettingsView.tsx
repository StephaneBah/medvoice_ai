
import React, { useState } from 'react';
import { Settings, Cpu, Brain, Check, ShieldCheck, ChevronDown } from 'lucide-react';
import { UserProfile } from '../types';

interface SettingsViewProps {
  user: UserProfile;
  onUserChange: (user: UserProfile) => void;
}

const ASR_MODELS = [
  { id: 'whisper-rad-fr2', name: 'Whisper-Small-Rad FR2', description: 'Optimisé pour les accents africains et terminologie radiologique.' },
  { id: 'med-whisper-afrorad', name: 'Med-Whisper-AfroRad-FR', description: 'Modèle spécialisé pour la radiologie africaine francophone.' },
  { id: 'whisper-large', name: 'Whisper Large v3', description: 'Modèle général haute précision, multilingue.' }
];

const LLM_MODELS = [
  { id: 'mistral-large', name: 'Mistral Large', description: 'Structuration de haut niveau et correction sémantique contextuelle.' },
  { id: 'gemini-flash', name: 'Gemini 2.5 Flash', description: 'Intelligence rapide et précise pour la structuration médicale.' },
  { id: 'gpt-4', name: 'GPT-4 Turbo', description: 'Modèle avancé pour analyse et synthèse complexes.' }
];

const SettingsView: React.FC<SettingsViewProps> = ({ user, onUserChange }) => {
  const [selectedASR, setSelectedASR] = useState('whisper-rad-fr2');
  const [selectedLLM, setSelectedLLM] = useState('mistral-large');
  const [showASRDropdown, setShowASRDropdown] = useState(false);
  const [showLLMDropdown, setShowLLMDropdown] = useState(false);
  return (
    <div className="p-4 md:p-12 max-w-4xl mx-auto flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="mb-12 text-center">
        <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-3">Paramètres</h2>
        <p className="text-slate-500 text-lg">Configuration du modèle Whisper-rad-FR2 et Mistral API.</p>
      </header>

      <div className="space-y-8">
        {/* User Profile Section */}
        <section className="glass rounded-[32px] border border-white/10 p-8 space-y-6">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
              <ShieldCheck size={20} />
            </div>
            <h3 className="text-xl font-bold text-white">Identité de l'utilisateur</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Nom d'affichage</label>
              <input 
                type="text" 
                value={user.name}
                onChange={(e) => onUserChange({ ...user, name: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 text-white outline-none focus:border-cyan-500 transition-all shadow-inner"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Spécialité / Rôle</label>
              <input 
                type="text" 
                value={user.role}
                onChange={(e) => onUserChange({ ...user, role: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 text-white outline-none focus:border-cyan-500 transition-all shadow-inner"
              />
            </div>
          </div>
        </section>

        {/* Model Configuration Section */}
        <section className="glass rounded-[32px] border border-white/10 p-8 space-y-8">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Cpu size={20} />
            </div>
            <h3 className="text-xl font-bold text-white">Configuration des Modèles</h3>
          </div>

          <div className="space-y-6">
            {/* ASR Model Selector */}
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 block">Moteur ASR (Transcription)</label>
              <div className="relative">
                <button
                  onClick={() => setShowASRDropdown(!showASRDropdown)}
                  className="w-full p-5 rounded-2xl bg-cyan-500/10 border border-cyan-500/50 flex items-center justify-between group hover:bg-cyan-500/15 transition-all"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                      <Cpu size={24} />
                    </div>
                    <div className="text-left">
                      <h4 className="font-bold text-white">{ASR_MODELS.find(m => m.id === selectedASR)?.name}</h4>
                      <p className="text-xs text-slate-500">{ASR_MODELS.find(m => m.id === selectedASR)?.description}</p>
                    </div>
                  </div>
                  <ChevronDown size={20} className={`text-cyan-400 transition-transform ${showASRDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showASRDropdown && (
                  <div className="absolute top-full mt-2 w-full bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    {ASR_MODELS.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => {
                          setSelectedASR(model.id);
                          setShowASRDropdown(false);
                        }}
                        className={`w-full p-4 flex items-center justify-between hover:bg-white/5 transition-all ${selectedASR === model.id ? 'bg-cyan-500/10' : ''}`}
                      >
                        <div className="text-left">
                          <h4 className="font-bold text-white text-sm">{model.name}</h4>
                          <p className="text-xs text-slate-500 mt-0.5">{model.description}</p>
                        </div>
                        {selectedASR === model.id && (
                          <div className="w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center text-white flex-shrink-0 ml-3">
                            <Check size={12} />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* LLM Model Selector */}
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 block">Modèle LLM (Structuration)</label>
              <div className="relative">
                <button
                  onClick={() => setShowLLMDropdown(!showLLMDropdown)}
                  className="w-full p-5 rounded-2xl bg-purple-500/10 border border-purple-500/50 flex items-center justify-between group hover:bg-purple-500/15 transition-all"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
                      <Brain size={24} />
                    </div>
                    <div className="text-left">
                      <h4 className="font-bold text-white">{LLM_MODELS.find(m => m.id === selectedLLM)?.name}</h4>
                      <p className="text-xs text-slate-500">{LLM_MODELS.find(m => m.id === selectedLLM)?.description}</p>
                    </div>
                  </div>
                  <ChevronDown size={20} className={`text-purple-400 transition-transform ${showLLMDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showLLMDropdown && (
                  <div className="absolute top-full mt-2 w-full bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    {LLM_MODELS.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => {
                          setSelectedLLM(model.id);
                          setShowLLMDropdown(false);
                        }}
                        className={`w-full p-4 flex items-center justify-between hover:bg-white/5 transition-all ${selectedLLM === model.id ? 'bg-purple-500/10' : ''}`}
                      >
                        <div className="text-left">
                          <h4 className="font-bold text-white text-sm">{model.name}</h4>
                          <p className="text-xs text-slate-500 mt-0.5">{model.description}</p>
                        </div>
                        {selectedLLM === model.id && (
                          <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center text-white flex-shrink-0 ml-3">
                            <Check size={12} />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <footer className="text-center pt-8">
           <p className="text-[10px] text-slate-700 font-mono tracking-widest uppercase italic">Système déployé sur infrastructure sécurisée (HDS) • MedVoice v2.1</p>
        </footer>
      </div>
    </div>
  );
};

export default SettingsView;
