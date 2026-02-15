"""
Application Demo — Transcription Audio & Rapport Clinique
=========================================================
Projet de mémoire de licence · Speech-to-Text médical français

Features:
  1. Transcription simple (temps réel micro ou fichier court)
  2. Audio long → Rapport automatique (LLM)
  3. Consultation médicale → Rapport clinique structuré (médecin-patient)
"""

import os
import time
from typing import TYPE_CHECKING, Any, Optional, Tuple, Union

import gradio as gr
import torch
from transformers import (  # type: ignore
    pipeline,
    # AutoModelForSeq2SeqLM,
    # AutoTokenizer,
    # AutoFeatureExtractor,
    # WhisperForConditionalGeneration,
    WhisperProcessor,
    GenerationConfig,
)
# Removed adapters import (unused; causing ModuleNotFoundError)
from mistralai import Mistral

from dotenv import load_dotenv

load_dotenv()

try:
    import numpy as np
except ImportError:
    np = None  # type: ignore

import warnings

# Filtrer les avertissements bruyants de transformers
warnings.filterwarnings("ignore", message=".*The input name `inputs` is deprecated.*")
warnings.filterwarnings("ignore", message=".*The attention mask is not set.*")


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║                              CONFIGURATION                                    ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

ASR_MODEL_ID = "StephaneBah/Med-Whisper-AfroRad-FR" #"StephaneBah/whisper-small-rad-FR2"
ASR_MODEL_REVISION = "8b973261fd7f275577f0c7e56703d30a7102e59d"  # Révision utilisée dans le notebook
ASR_LANGUAGE = "fr"

SUMMARIZER_MODEL_ID = os.environ.get("SUMMARIZER_MODEL_ID", "mistral-large-latest")
MISTRAL_MODEL_ID = os.environ.get("MISTRAL_MODEL_ID", "mistral-large")


def device_and_dtype():
    if torch.cuda.is_available():
        return ("cuda", torch.float16)
    return ("cpu", torch.float32)


# Lazy singletons
_asr_pipeline = None
_sum_model = None
_sum_tokenizer = None
_mistral_client = None

def load_mistral():
    global _mistral_client
    if _mistral_client is not None:
        return _mistral_client, "mistral-large-latest"
    api_key = os.environ.get("MISTRAL_API_KEY")
    if not api_key:
        raise RuntimeError("MISTRAL_API_KEY manquant dans les variables d'environnement.")
    _mistral_client = Mistral(api_key=api_key)
    return _mistral_client, "mistral-large-latest"


def get_hf_token() -> Optional[str]:
    return os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACEHUB_API_TOKEN")


def load_asr():
    global _asr_pipeline
    if _asr_pipeline is not None:
        return _asr_pipeline

    device, dtype = device_and_dtype()
    
    from transformers import WhisperForConditionalGeneration  # type: ignore
    
    if ASR_MODEL_REVISION:
        model = WhisperForConditionalGeneration.from_pretrained(
            ASR_MODEL_ID,
            revision=ASR_MODEL_REVISION,
            torch_dtype=dtype,
        )
    else:
        model = WhisperForConditionalGeneration.from_pretrained(
            ASR_MODEL_ID,
            torch_dtype=dtype,
        )

    # FIX: Charger explicitement la configuration de génération depuis le modèle de base
    # Cela restaure les token_ids nécessaires pour les timestamps (no_timestamps_token_id, etc.)
    try:
        model.generation_config = GenerationConfig.from_pretrained("openai/whisper-small")
    except Exception:
        pass  # Fallback si échec (rare)

    
    # Clear forced_decoder_ids from saved config to avoid conflicts
    model.generation_config.forced_decoder_ids = None
    
    processor = WhisperProcessor.from_pretrained("openai/whisper-small")  # type: ignore[call-arg]
    
    if device == "cuda":
        model = model.to("cuda")
        model.eval()
    
    # Pipeline minimal - on laisse tout gérer automatiquement
    _asr_pipeline = pipeline(
        "automatic-speech-recognition",
        model=model,
        tokenizer=processor.tokenizer,  # type: ignore[attr-defined]
        feature_extractor=processor.feature_extractor,  # type: ignore[attr-defined]
        device=0 if device == "cuda" else -1,
        return_timestamps=True,  # Force le mode long-form pour éviter les coupures
        chunk_length_s=30,
        stride_length_s=(4, 2),
        batch_size=8,  # Traitement par lot pour fluidifier
        generate_kwargs={"task": "transcribe", 
                         "language": ASR_LANGUAGE,
                         "num_beams": 1, # Greedy decoding (plus rapide, moins de warning)
                        }
    )
    return _asr_pipeline


def load_summarizer():
    global _sum_model
    if _sum_model is not None:
        return _sum_model
    api_key = os.environ.get("MISTRAL_API_KEY", "")
    _sum_model = Mistral(api_key=api_key)
    return _sum_model




# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║                                 UTILITIES                                     ║
# ╚══════════════════════════════════════════════════════════════════════════════╝


def format_timestamp(seconds: float) -> str:
    seconds = max(0.0, float(seconds))
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    if h > 0:
        return f"{h:02d}:{m:02d}:{s:02d}"
    return f"{m:02d}:{s:02d}"


def numpy_audio_from_gradio(audio) -> Tuple[Optional[int], Union[Any, str]]:
    """Normalize Gradio audio input to (sample_rate, float32 numpy array or path)."""
    if audio is None:
        return 16000, np.zeros(0, dtype=np.float32) if np else []  # type: ignore
    if isinstance(audio, dict) and "sampling_rate" in audio:
        sr = int(audio.get("sampling_rate", 16000))
        data = np.array(audio.get("data", []), dtype=np.float32) if np else []  # type: ignore
        return sr, data
    if isinstance(audio, tuple) and len(audio) == 2:
        sr, data = audio
        return int(sr), np.array(data, dtype=np.float32) if np else []  # type: ignore
    if isinstance(audio, str) and os.path.exists(audio):
        return None, audio
    return 16000, np.array([], dtype=np.float32) if np else []  # type: ignore


def sanitize_transcript(text: str) -> str:
    if not text:
        return text
    banned = [
        "Sous-titres réalisés par la communauté d'Amara.org",
        "Sous-titres par la communauté d'Amara.org",
        "Musique de générique",
        "Générique",
    ]
    lines = [l for l in text.splitlines() if l.strip() and all(b not in l for b in banned)]
    filtered = "\n".join(lines).strip()
    return filtered if filtered else text.strip()


def asr_transcribe(audio_input) -> str:
    """Transcription via Whisper fine-tuned."""
    asr = load_asr()
    sr, norm_audio = numpy_audio_from_gradio(audio_input)

    # Préparer l'input selon le type
    if isinstance(norm_audio, str):
        # Fichier audio
        inputs = norm_audio
    else:
        # Numpy array
        inputs = {"raw": norm_audio, "sampling_rate": sr or 16000}
    
    # Transcription avec gestion explicite des timestamps
    result = asr(
        inputs,
        return_timestamps=True,
        generate_kwargs={
            "task": "transcribe",
            "language": ASR_LANGUAGE,
        }
    )
    
    if isinstance(result, dict) and "text" in result:
        text_value = result.get("text", "")
        return sanitize_transcript(str(text_value).strip())
    return sanitize_transcript(str(result))


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║                            LLM REPORT GENERATORS                              ║
# ╚══════════════════════════════════════════════════════════════════════════════╝


def generate_simple_report(
    transcript: str,
    notes: str = "",
    max_new_tokens: int = 640,
    temperature: float = 0.25,
) -> str:
    """Rapport générique pour audio long (ex. oral de mémoire)."""
    if not transcript or not transcript.strip():
        return "Aucune transcription fournie."

    client = load_summarizer()

    directives = (
        "Rédige un rapport structuré en français à partir de cette transcription longue. "
        "Sections attendues: Résumé global · Thèmes majeurs · Points chiffrés ou faits notables · "
        "Risques/alertes · Actions ou prochaines étapes · Citations courtes utiles. "
        "Style concis, fidèle au verbatim, aucune invention."
    )
    if notes and notes.strip():
        directives += f"\nConsignes: {notes.strip()}"

    prompt = f"Instruction: {directives}\n\nTranscription:\n{transcript.strip()}"

    try:
        res = client.chat.complete(
            model=SUMMARIZER_MODEL_ID,
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature,
            max_tokens=max_new_tokens,
            top_p=0.9,
            stream=False,
            response_format={"type": "text"},
        )
        return res.choices[0].message.content.strip() if getattr(res, "choices", None) else "Réponse LLM vide"
    except Exception as e:
        return f"❌ Erreur LLM: {e}"


def generate_clinical_report(
    transcript: str,
    notes: str = "",
    max_new_tokens: int = 768,
    temperature: float = 0.2,
) -> str:
    """
    Génère un rapport clinique structuré à partir d'une conversation médecin-patient.
    Inspiré des travaux:
      - «Real-time Speech Summarization for Medical Conversations» (Schloss & al.)
      - «Clinical Text Summarization with LLMs» (Van Veen & al.)
    Sections alignées sur le standard SOAP étendu:
      Subjectif · Objectif · Évaluation · Plan · Suivi
    """
    if not transcript or not transcript.strip():
        return "Aucune transcription fournie."

    client = load_summarizer()

    directives = """Tu es un assistant clinique expert. À partir de la transcription brute d'une conversation entre un médecin et un patient, génère un rapport clinique structuré en français.

SECTIONS OBLIGATOIRES (format texte brut, pas de markdown):

1. INFORMATIONS PATIENT
   - Identifiant/anonyme, âge approximatif, sexe si mentionné

2. MOTIF DE CONSULTATION
   - Raison principale de la visite (chief complaint)

3. HISTOIRE DE LA MALADIE ACTUELLE (HMA)
   - Chronologie des symptômes, facteurs déclenchants, évolution

4. ANTÉCÉDENTS
   - Médicaux, chirurgicaux, familiaux pertinents
   - Allergies (médicamenteuses et autres)
   - Traitements en cours (DCI + posologie si disponible)

5. EXAMEN CLINIQUE / CONSTATS
   - Signes vitaux si mentionnés
   - Observations objectives du médecin

6. ÉVALUATION / DIAGNOSTIC
   - Hypothèses diagnostiques (diagnostic différentiel)
   - Niveau de certitude si exprimé

7. PLAN THÉRAPEUTIQUE
   - Prescriptions (médicaments, examens, imagerie)
   - Conseils hygiéno-diététiques
   - Orientations / adressages

8. SUIVI
   - Prochaine consultation
   - Signes d'alerte à surveiller
   - Consignes pour le patient

RÈGLES:
- Conserver tous les chiffres, doses, fréquences mentionnés
- Ne rien inventer: si une information manque, écrire "Non mentionné"
- Rester factuel et professionnel
- Respecter la confidentialité (pas de noms réels)"""

    if notes and notes.strip():
        directives += f"\n\nCONSIGNES ADDITIONNELLES: {notes.strip()}"

    prompt = f"Instruction:\n{directives}\n\nTRANSCRIPTION DE LA CONSULTATION:\n\"\"\"\n{transcript.strip()}\n\"\"\"\n\nRAPPORT CLINIQUE:"

    try:
        res = client.chat.complete(
            model=SUMMARIZER_MODEL_ID,
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature,
            max_tokens=max_new_tokens,
            top_p=0.9,
            stream=False,
            response_format={"type": "text"},
        )
        return res.choices[0].message.content.strip() if getattr(res, "choices", None) else "Réponse LLM vide"
    except Exception as e:
        return f"❌ Erreur LLM: {e}"


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║                              CUSTOM CSS                                       ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

CUSTOM_CSS = """
/* ─────────────────────────────── Global ─────────────────────────────── */
.gradio-container {
    max-width: 1400px !important;
    margin: auto;
    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
}

/* ─────────────────────────────── Header ─────────────────────────────── */
.app-header {
    background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%);
    color: white;
    padding: 2rem 2.5rem;
    border-radius: 16px;
    margin-bottom: 1.5rem;
    box-shadow: 0 4px 20px rgba(30, 58, 95, 0.3);
}
.app-header h1 {
    margin: 0 0 0.5rem 0;
    font-size: 1.9rem;
    font-weight: 700;
    letter-spacing: -0.02em;
}
.app-header p {
    margin: 0;
    opacity: 0.9;
    font-size: 1rem;
}
.header-badges {
    margin-top: 1rem;
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
}
.badge {
    background: rgba(255,255,255,0.15);
    padding: 0.3rem 0.7rem;
    border-radius: 20px;
    font-size: 0.8rem;
    backdrop-filter: blur(4px);
}

/* ─────────────────────────────── Tabs ─────────────────────────────── */
.tabs > .tab-nav {
    background: #f8fafc;
    border-radius: 12px;
    padding: 0.5rem;
    gap: 0.5rem;
}
.tabs > .tab-nav > button {
    border-radius: 8px !important;
    font-weight: 600;
    padding: 0.75rem 1.5rem !important;
    transition: all 0.2s ease;
}
.tabs > .tab-nav > button.selected {
    background: #1e3a5f !important;
    color: white !important;
    box-shadow: 0 2px 8px rgba(30, 58, 95, 0.25);
}

/* ─────────────────────────────── Cards ─────────────────────────────── */
.feature-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 1rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}
.feature-card h3 {
    margin: 0 0 0.5rem 0;
    color: #1e3a5f;
    font-size: 1.1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}
.feature-card p {
    margin: 0;
    color: #64748b;
    font-size: 0.9rem;
}

/* ─────────────────────────────── Buttons ─────────────────────────────── */
.primary-btn {
    background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%) !important;
    color: white !important;
    font-weight: 600 !important;
    padding: 0.75rem 2rem !important;
    border-radius: 10px !important;
    border: none !important;
    box-shadow: 0 2px 8px rgba(30, 58, 95, 0.25) !important;
    transition: all 0.2s ease !important;
}
.primary-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(30, 58, 95, 0.35) !important;
}

.medical-btn {
    background: linear-gradient(135deg, #166534 0%, #15803d 100%) !important;
    color: white !important;
    font-weight: 600 !important;
    padding: 0.75rem 2rem !important;
    border-radius: 10px !important;
    border: none !important;
    box-shadow: 0 2px 8px rgba(22, 101, 52, 0.25) !important;
}

/* ─────────────────────────────── Textboxes ─────────────────────────────── */
textarea {
    border-radius: 10px !important;
    border: 1.5px solid #e2e8f0 !important;
    font-family: 'JetBrains Mono', 'Fira Code', monospace !important;
    font-size: 0.9rem !important;
}
textarea:focus {
    border-color: #1e3a5f !important;
    box-shadow: 0 0 0 3px rgba(30, 58, 95, 0.1) !important;
}

/* ─────────────────────────────── Status ─────────────────────────────── */
.status-indicator {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: #f1f5f9;
    border-radius: 8px;
    font-size: 0.85rem;
    color: #475569;
}
.status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #22c55e;
    animation: pulse 2s infinite;
}
@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

/* ─────────────────────────────── Footer ─────────────────────────────── */
.app-footer {
    text-align: center;
    padding: 1.5rem;
    color: #94a3b8;
    font-size: 0.85rem;
    border-top: 1px solid #e2e8f0;
    margin-top: 2rem;
}
"""

# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║                              GRADIO UI                                        ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

with gr.Blocks(
    title="MedTranscribe · Transcription & Rapport Clinique",
    theme=gr.themes.Soft(  # type: ignore[attr-defined]
        primary_hue="slate",
        secondary_hue="blue",
        neutral_hue="slate",
        font=["Inter", "system-ui", "sans-serif"],
    ),
    css=CUSTOM_CSS,
) as demo:

    # ─────────────────────────── Header ───────────────────────────
    gr.HTML(
        """
        <div class="app-header">
            <h1>🩺 MedTranscribe</h1>
            <p>Plateforme de transcription audio et génération de rapports cliniques automatisés</p>
            <div class="header-badges">
                <span class="badge">🎙️ Whisper Fine-tuned FR</span>
                <span class="badge">🤖 Mistral Large</span>
                <span class="badge">📋 Rapports SOAP</span>
                <span class="badge">🔬 Projet Mémoire</span>
            </div>
        </div>
        """
    )

    with gr.Tabs(elem_classes="tabs"):

        # ══════════════════════════════════════════════════════════════
        # TAB 1: Transcription Simple
        # ══════════════════════════════════════════════════════════════
        with gr.Tab("📝 Transcription Simple", id="tab-simple"):
            gr.HTML(
                """
                <div class="feature-card">
                    <h3>🎯 Transcription rapide</h3>
                    <p>Convertissez un audio court en texte instantanément. Idéal pour des notes vocales, 
                    mémos ou tests rapides. Supporte le micro en temps réel ou l'upload de fichiers.</p>
                </div>
                """
            )

            with gr.Row():
                with gr.Column(scale=1):
                    with gr.Tabs():
                        with gr.TabItem("🎤 Micro temps réel"):
                            mic = gr.Audio(
                                sources=["microphone"],
                                type="numpy",
                                streaming=True,
                                label="Enregistrement en direct",
                            )
                            live_status = gr.HTML(
                                '<div class="status-indicator"><span class="status-dot"></span>En attente…</div>'
                            )

                        with gr.TabItem("📁 Fichier audio"):
                            file_audio = gr.Audio(
                                sources=["upload"],
                                type="filepath",
                                label="Glissez un fichier audio ici",
                            )
                            btn_transcribe = gr.Button(
                                "▶️ Transcrire",
                                variant="primary",
                                elem_classes="primary-btn",
                            )

                with gr.Column(scale=1):
                    transcript_box = gr.Textbox(
                         label="📄 Transcription",
                         lines=18,
                         placeholder="La transcription apparaîtra ici…",
                         show_copy_button=True
                     )

            live_state = gr.State({"acc_text": "", "last_update": 0.0})

        # ══════════════════════════════════════════════════════════════
        # TAB 2: Audio Long → Rapport
        # ══════════════════════════════════════════════════════════════
        with gr.Tab("📊 Audio Long → Rapport", id="tab-report"):
            gr.HTML(
                """
                <div class="feature-card">
                    <h3>📑 Rapport automatique</h3>
                    <p>Pour des enregistrements plus longs (entretiens, soutenances, réunions). 
                    L'audio est transcrit puis analysé par un LLM pour extraire un rapport structuré 
                    avec thèmes, points clés et actions.</p>
                </div>
                """
            )

            with gr.Row():
                with gr.Column(scale=1):
                    long_audio = gr.Audio(
                        sources=["upload"],
                        type="filepath",
                        label="📂 Audio long (upload)",
                    )
                    notes_box = gr.Textbox(
                        label="📌 Contexte / Consignes (optionnel)",
                        lines=3,
                        placeholder="Ex: focus sur les risques, extraire les décisions prises…",
                    )
                    btn_report = gr.Button(
                        "🚀 Transcrire & Générer le rapport",
                        variant="primary",
                        elem_classes="primary-btn",
                    )

                with gr.Column(scale=1):
                    with gr.Accordion("📝 Transcription brute", open=False):
                        long_transcript_box = gr.Textbox(
                            label="Transcription",
                            lines=10,
                            show_copy_button=True,
                        )
                    report_box = gr.Textbox(
                        label="📋 Rapport généré",
                        lines=18,
                        placeholder="Le rapport structuré apparaîtra ici…",
                        show_copy_button=True,
                    )

        # ══════════════════════════════════════════════════════════════
        # TAB 3: Consultation Médicale → Rapport Clinique
        # ══════════════════════════════════════════════════════════════
        with gr.Tab("🏥 Consultation Médicale", id="tab-clinical"):
            gr.HTML(
                """
                <div class="feature-card" style="border-left: 4px solid #166534;">
                    <h3>🩺 Rapport clinique automatisé</h3>
                    <p>Transformez un enregistrement de consultation médecin-patient en rapport clinique 
                    structuré selon le format SOAP étendu. Inspiré des travaux de recherche sur la 
                    summarisation médicale en temps réel.</p>
                </div>
                """
            )

            with gr.Row():
                with gr.Column(scale=1):
                    gr.HTML(
                        """
                        <div style="background: #f0fdf4; border-radius: 10px; padding: 1rem; margin-bottom: 1rem;">
                            <strong style="color: #166534;">💡 Conseils d'utilisation</strong>
                            <ul style="margin: 0.5rem 0 0 1rem; color: #166534; font-size: 0.9rem;">
                                <li>Enregistrez la consultation avec consentement du patient</li>
                                <li>Un audio de 5-30 minutes fonctionne bien</li>
                                <li>Le rapport suit le format SOAP médical</li>
                            </ul>
                        </div>
                        """
                    )

                    with gr.Tabs():
                        with gr.TabItem("🎤 Enregistrer (temps réel)"):
                            clinical_mic = gr.Audio(
                                sources=["microphone"],
                                type="numpy",
                                streaming=True,
                                label="Consultation en direct",
                            )
                            clinical_live_status = gr.HTML(
                                '<div class="status-indicator"><span class="status-dot"></span>Prêt à enregistrer</div>'
                            )
                            clinical_live_transcript = gr.Textbox(
                                label="Transcription en cours",
                                lines=8,
                                interactive=False,
                            )
                            btn_clinical_live = gr.Button(
                                "📋 Générer le rapport clinique",
                                variant="primary",
                                elem_classes="medical-btn",
                            )

                        with gr.TabItem("📁 Importer un audio"):
                            clinical_audio = gr.Audio(
                                sources=["upload"],
                                type="filepath",
                                label="Audio de consultation",
                            )
                            clinical_notes = gr.Textbox(
                                label="📌 Contexte clinique (optionnel)",
                                lines=2,
                                placeholder="Ex: patient diabétique, suivi post-opératoire…",
                            )
                            btn_clinical = gr.Button(
                                "🩺 Transcrire & Générer le rapport clinique",
                                variant="primary",
                                elem_classes="medical-btn",
                            )

                with gr.Column(scale=1):
                    clinical_report_box = gr.Textbox(
                        label="📋 Rapport Clinique Structuré",
                        lines=24,
                        placeholder="Le rapport clinique SOAP apparaîtra ici…\n\n"
                        "Sections: Informations Patient · Motif · HMA · Antécédents · "
                        "Examen · Évaluation · Plan · Suivi",
                        show_copy_button=True,
                    )

            # State for clinical live transcription
            clinical_live_state = gr.State({"acc_text": "", "last_update": 0.0})

    # ─────────────────────────── Footer ───────────────────────────
    gr.HTML(
        """
        <div class="app-footer">
            <p>🎓 Projet de Mémoire de Licence · Speech-to-Text Médical Français</p>
            <p>Modèles: Whisper fine-tuned (ASR) · Mistral Large (LLM)</p>
        </div>
        """
    )

    # ╔══════════════════════════════════════════════════════════════════════════╗
    # ║                              EVENT HANDLERS                               ║
    # ╚══════════════════════════════════════════════════════════════════════════╝

    def on_file_transcribe(audio_np):
        if audio_np is None:
            return "⚠️ Aucun audio fourni."
        try:
            return asr_transcribe(audio_np)
        except Exception as e:
            return f"❌ Erreur: {e}"

    def on_live_stream(chunk, state: dict):
        now = time.time()
        last = float(state.get("last_update", 0.0))
        acc_text = state.get("acc_text", "")

        if now - last < 2.0:
            status = f'<div class="status-indicator"><span class="status-dot" style="background:#f59e0b;"></span>Flux en cours… {format_timestamp(now % 3600)}</div>'
            return acc_text, state, status

        try:
            partial = asr_transcribe(chunk)
            if partial and (not acc_text or partial not in acc_text):
                acc_text = (acc_text + " \n" + partial).strip() if acc_text else partial
            state = {"acc_text": acc_text, "last_update": now}
            status = f'<div class="status-indicator"><span class="status-dot"></span>Mise à jour: {format_timestamp(now % 3600)}</div>'
            return acc_text, state, status
        except Exception as e:
            return acc_text, state, f'<div class="status-indicator" style="background:#fee2e2;color:#dc2626;">❌ {e}</div>'

    def on_long_report(audio_path, notes):
        if audio_path is None:
            return "⚠️ Aucun audio fourni.", ""
        try:
            transcript = asr_transcribe(audio_path)
            report = generate_simple_report(transcript, notes)
            return transcript, report
        except Exception as e:
            return f"❌ Erreur: {e}", ""

    def on_clinical_report(audio_path, notes):
        if audio_path is None:
            return "⚠️ Aucun audio fourni."
        try:
            transcript = asr_transcribe(audio_path)
            report = generate_clinical_report(transcript, notes)
            return report
        except Exception as e:
            return f"❌ Erreur: {e}"

    def on_clinical_live_stream(chunk, state: dict):
        now = time.time()
        last = float(state.get("last_update", 0.0))
        acc_text = state.get("acc_text", "")

        if now - last < 2.5:
            status = f'<div class="status-indicator"><span class="status-dot" style="background:#166534;"></span>Enregistrement… {format_timestamp(now % 3600)}</div>'
            return acc_text, state, status

        try:
            partial = asr_transcribe(chunk)
            if partial and (not acc_text or partial not in acc_text):
                acc_text = (acc_text + " " + partial).strip() if acc_text else partial
            state = {"acc_text": acc_text, "last_update": now}
            status = f'<div class="status-indicator"><span class="status-dot" style="background:#166534;"></span>Transcrit: {format_timestamp(now % 3600)}</div>'
            return acc_text, state, status
        except Exception as e:
            return acc_text, state, f'<div class="status-indicator" style="background:#fee2e2;color:#dc2626;">❌ {e}</div>'

    def on_clinical_live_generate(transcript):
        if not transcript or not transcript.strip():
            return "⚠️ Aucune transcription disponible. Enregistrez d'abord une consultation."
        try:
            return generate_clinical_report(transcript)
        except Exception as e:
            return f"❌ Erreur: {e}"

    # ─────────────────────────── Wire Events ───────────────────────────

    # Tab 1: Simple transcription
    btn_transcribe.click(on_file_transcribe, inputs=[file_audio], outputs=[transcript_box])
    mic.stream(
        on_live_stream,
        inputs=[mic, live_state],
        outputs=[transcript_box, live_state, live_status],
    )

    # Tab 2: Long audio report
    btn_report.click(
        on_long_report,
        inputs=[long_audio, notes_box],
        outputs=[long_transcript_box, report_box],
    )

    # Tab 3: Clinical report
    btn_clinical.click(
        on_clinical_report,
        inputs=[clinical_audio, clinical_notes],
        outputs=[clinical_report_box],
    )
    clinical_mic.stream(
        on_clinical_live_stream,
        inputs=[clinical_mic, clinical_live_state],
        outputs=[clinical_live_transcript, clinical_live_state, clinical_live_status],
    )
    btn_clinical_live.click(
        on_clinical_live_generate,
        inputs=[clinical_live_transcript],
        outputs=[clinical_report_box],
    )


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║                                  MAIN                                         ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

if __name__ == "__main__":
    demo.launch(
        server_name="0.0.0.0",
        share=False,
        show_error=True,
    )
