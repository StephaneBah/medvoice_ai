
import React, { useState, useEffect } from 'react';
import { Settings, Cpu, Brain, Check, ShieldCheck, ChevronDown, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { UserProfile } from '../types';
import { getConfig, type BackendConfig } from '../services/apiService';

interface SettingsViewProps {
  user: UserProfile;
  onUserChange: (user: UserProfile) => void;
}

const ASR_MODELS = [
  { id: 'StephaneBah/whisper-small-rad-FR2', name: 'Whisper-Small-Rad FR2', description: 'Optimisé pour les accents africains et terminologie radiologique.' },
  { id: 'StephaneBah/Med-Whisper-AfroRad-FR', name: 'Med-Whisper-AfroRad-FR', description: 'Modèle spécialisé pour la radiologie africaine francophone.' },
  { id: 'openai/whisper-large-v3', name: 'Whisper Large v3', description: 'Modèle général haute précision, multilingue.' }
];

const LLM_MODELS = [
  { id: 'mistral-large-latest', name: 'Mistral Large', description: 'Structuration de haut niveau et correction sémantique contextuelle.' },
  { id: 'mistral-small-latest', name: 'Mistral Small', description: 'Modèle léger et rapide pour les tâches courantes.' },
];

const SettingsView: React.FC<SettingsViewProps> = ({ user, onUserChange }) => {
  const [config, setConfig] = useState<BackendConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showASRDropdown, setShowASRDropdown] = useState(false);
  const [showLLMDropdown, setShowLLMDropdown] = useState(false);

  const fetchConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const cfg = await getConfig();
      setConfig(cfg);
    } catch (err: any) {
      setError(err.message ?? 'Impossible de charger la configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConfig(); }, []);

  // Determine active models — fall back to raw model ID when not in list
  const activeASR = config ? (ASR_MODELS.find(m => m.id === config.asr_model_id) ?? { id: config.asr_model_id, name: config.asr_model_id, description: 'Modèle configuré côté serveur.' }) : null;
  const activeLLM = config ? (LLM_MODELS.find(m => m.id === config.llm_model_id) ?? { id: config.llm_model_id, name: config.llm_model_id, description: 'Modèle configuré côté serveur.' }) : null;

  return (
    <div className="p-4 md:p-12 max-w-4xl mx-auto flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="mb-12 text-center">
        <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-3">Paramètres</h2>
        <p className="text-slate-500 text-lg">Configuration des modèles ASR & LLM du backend.</p>
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
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                <Cpu size={20} />
              </div>
              <h3 className="text-xl font-bold text-white">Configuration des Modèles</h3>
            </div>
            <button onClick={fetchConfig} className="p-2 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white transition-all" title="Rafraîchir">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-8 text-slate-500 space-x-3">
              <Loader2 size={20} className="animate-spin" />
              <span>Chargement de la configuration…</span>
            </div>
          )}

          {error && (
            <div className="flex items-center space-x-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
              <AlertCircle size={18} />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {config && !loading && (
            <div className="space-y-6">
              {/* ASR Model Display */}
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
                        <h4 className="font-bold text-white">{activeASR?.name}</h4>
                        <p className="text-xs text-slate-500">{activeASR?.description}</p>
                      </div>
                    </div>
                    <ChevronDown size={20} className={`text-cyan-400 transition-transform ${showASRDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showASRDropdown && (
                    <div className="absolute top-full mt-2 w-full bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                      {ASR_MODELS.map((model) => {
                        const isActive = model.id === config.asr_model_id;
                        return (
                          <div
                            key={model.id}
                            className={`w-full p-4 flex items-center justify-between ${isActive ? 'bg-cyan-500/10' : 'opacity-50'}`}
                          >
                            <div className="text-left">
                              <h4 className="font-bold text-white text-sm">{model.name}</h4>
                              <p className="text-xs text-slate-500 mt-0.5">{model.description}</p>
                            </div>
                            {isActive && (
                              <div className="w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center text-white flex-shrink-0 ml-3">
                                <Check size={12} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <div className="px-4 py-3 border-t border-white/5 text-[10px] text-slate-600 uppercase tracking-widest">
                        Configuré via variable d'environnement ASR_MODEL_ID
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* LLM Model Display */}
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
                        <h4 className="font-bold text-white">{activeLLM?.name}</h4>
                        <p className="text-xs text-slate-500">{activeLLM?.description}</p>
                      </div>
                    </div>
                    <ChevronDown size={20} className={`text-purple-400 transition-transform ${showLLMDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showLLMDropdown && (
                    <div className="absolute top-full mt-2 w-full bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                      {LLM_MODELS.map((model) => {
                        const isActive = model.id === config.llm_model_id;
                        return (
                          <div
                            key={model.id}
                            className={`w-full p-4 flex items-center justify-between ${isActive ? 'bg-purple-500/10' : 'opacity-50'}`}
                          >
                            <div className="text-left">
                              <h4 className="font-bold text-white text-sm">{model.name}</h4>
                              <p className="text-xs text-slate-500 mt-0.5">{model.description}</p>
                            </div>
                            {isActive && (
                              <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center text-white flex-shrink-0 ml-3">
                                <Check size={12} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <div className="px-4 py-3 border-t border-white/5 text-[10px] text-slate-600 uppercase tracking-widest">
                        Configuré via variable d'environnement LLM_MODEL_ID
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        <footer className="text-center pt-8">
           <p className="text-[10px] text-slate-700 font-mono tracking-widest uppercase italic">Système déployé sur infrastructure sécurisée (HDS) • MedVoice v2.1</p>
        </footer>
      </div>
    </div>
  );
};

export default SettingsView;
