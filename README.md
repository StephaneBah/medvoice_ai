# MedVoice AI

Application de démonstration combinant transcription automatique de la parole (ASR) et génération de rapports médicaux structurés par LLM, développée dans le cadre d'un mémoire de licence à l'IFRI/UAC.

## Architecture

```
┌─────────────────────┐       API REST        ┌─────────────────────────┐
│   Frontend (React)  │ ◄──── /api/v1 ──────► │   Backend (FastAPI)     │
│   Vite + TypeScript │       proxy:3000→8000  │   Python + SQLAlchemy   │
│   Tailwind CSS      │                        │   SQLite                │
└─────────────────────┘                        └──────────┬──────────────┘
                                                          │
                                          ┌───────────────┼───────────────┐
                                          ▼                               ▼
                                   ┌─────────────┐                ┌─────────────┐
                                   │  Whisper ASR │                │ Mistral LLM │
                                   │  (local)     │                │ (API cloud) │
                                   │  Audio→Texte │                │ Texte→Texte │
                                   └─────────────┘                └─────────────┘
```

**Séparation stricte :** Whisper ne voit jamais de texte, Mistral ne voit jamais d'audio.

### Modèles

| Composant | Modèle | Rôle |
|-----------|--------|------|
| ASR | `StephaneBah/Med-Whisper-AfroRad-FR` | Whisper fine-tuné pour le français médical/radiologique (local, GPU/CPU) |
| LLM | `mistral-large-latest` (Mistral API) | Traitement CoT du texte + génération de rapports (API cloud) |

### Stack technique

| Couche | Technologies |
|--------|-------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons |
| Backend | FastAPI, Uvicorn, Pydantic, SQLAlchemy, SQLite |
| ASR | PyTorch, Transformers (pipeline Whisper), float16/GPU ou float32/CPU |
| LLM | Mistral AI API (cloud) |

---

## Fonctionnalités

### 1. Consultation (mode `conversation`)

Transforme un enregistrement de dialogue médecin-patient en rapport clinique structuré.

**Pipeline :**
```
Audio → Whisper ASR → CoT (ponctuation + diarisation + correction) → Rapport SOAP
         1 appel local          1 appel LLM                          1 appel LLM
```

**Format de sortie (SOAP) :**
- **Indication clinique** — Contexte et motif de l'examen
- **Observations** — Constatations détaillées
- **Impression** — Conclusion diagnostique
- **Recommandations** — Plan de suivi

### 2. Documentation (mode `scribe`)

Transcrit et nettoie une dictée médicale mono-locuteur. Pas de diarisation.

**Pipeline :**
```
Audio → Whisper ASR → CoT (ponctuation + correction) → Texte nettoyé
         1 appel local        1 appel LLM                (pas d'appel LLM supplémentaire)
```

### Entrée audio

- Enregistrement micro en temps réel (MediaRecorder WebM)
- Upload de fichier audio (MP3, WAV, M4A, WebM)

---

## Installation

### Prérequis

- Python 3.10+
- Node.js 18+
- GPU NVIDIA + CUDA (recommandé pour l'ASR)
- Clé API Mistral
- Token Hugging Face (pour le modèle ASR)

### 1. Environnement Python

```bash
cd "App Demo"
python -m venv .venv

# Windows PowerShell
.venv\Scripts\Activate.ps1

# Linux/macOS
source .venv/bin/activate

# Dépendances backend
pip install -r backend/requirements.txt

# PyTorch avec CUDA (recommandé)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
```

### 2. Dépendances frontend

```bash
cd frontend
npm install
```

### 3. Configuration

Créer un fichier `.env` à la racine :

```env
MISTRAL_API_KEY=votre_clé_mistral
HF_TOKEN=hf_XXXXXXXXXXXXXXXXXXXXXXXX
```

### 4. Lancement

**Terminal 1 — Backend (port 8000) :**
```bash
cd backend
python run.py
```

**Terminal 2 — Frontend (port 3000) :**
```bash
cd frontend
npm run dev
```

L'application est accessible sur **http://localhost:3000**.

Le frontend proxy automatiquement les appels `/api/*` vers le backend sur le port 8000.

---

## Structure du projet

```
App Demo/
├── backend/
│   ├── run.py                          # Point d'entrée serveur
│   ├── requirements.txt
│   └── app/
│       ├── main.py                     # App FastAPI + CORS + routes
│       ├── config.py                   # Settings (env vars, modèles)
│       ├── api/v1/endpoints/
│       │   ├── audio.py                # Upload audio
│       │   ├── transcribe.py           # ASR Whisper
│       │   ├── process.py              # Pipeline CoT (full-pipeline)
│       │   ├── report.py               # Génération de rapport
│       │   └── sessions.py             # CRUD sessions
│       ├── models/
│       │   ├── database.py             # SQLAlchemy + SQLite
│       │   └── session.py              # Modèle Session
│       ├── schemas/                    # Schémas Pydantic
│       └── services/
│           ├── asr_service.py          # Whisper pipeline (local)
│           ├── llm_service.py          # Mistral API (CoT + rapports)
│           └── audio_utils.py          # Conversion audio (pydub)
├── frontend/
│   ├── index.html / index.tsx          # Point d'entrée
│   ├── App.tsx                         # Router principal
│   ├── types.ts                        # Types TypeScript
│   ├── vite.config.ts                  # Config Vite + proxy
│   ├── components/
│   │   ├── NewReport.tsx               # Créer un rapport (record/upload → pipeline)
│   │   ├── Dashboard.tsx               # Tableau de bord
│   │   ├── Sidebar.tsx                 # Navigation latérale
│   │   ├── SettingsView.tsx            # Paramètres
│   │   └── AudioVisualizer.tsx         # Visualisation audio
│   └── services/
│       └── apiService.ts              # Client HTTP centralisé
├── app.py                              # Version legacy Gradio (référence)
└── .env                                # Variables d'environnement
```

---

## API REST

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/v1/audio/upload` | Upload audio + création de session |
| POST | `/api/v1/transcribe/{id}` | Transcription ASR (Whisper) |
| POST | `/api/v1/process/{id}/full-pipeline` | Pipeline CoT complet (1 appel LLM) |
| POST | `/api/v1/process/{id}/punctuate` | Ponctuation seule |
| POST | `/api/v1/process/{id}/diarize` | Diarisation seule |
| POST | `/api/v1/process/{id}/correct` | Correction seule |
| POST | `/api/v1/report/{id}/generate` | Génération du rapport final |
| GET | `/api/v1/sessions` | Liste des sessions |
| GET | `/api/v1/sessions/{id}` | Détail d'une session |
| DELETE | `/api/v1/sessions/{id}` | Supprimer une session |
| GET | `/health` | Health check |

Documentation Swagger automatique : **http://localhost:8000/docs**

---

## Configuration avancée

### Variables d'environnement

```env
# Obligatoires
MISTRAL_API_KEY=...          # Clé API Mistral
HF_TOKEN=hf_...              # Token Hugging Face

# Optionnels (valeurs par défaut)
ASR_MODEL_ID=StephaneBah/Med-Whisper-AfroRad-FR
LLM_MODEL_ID=mistral-large-latest
DATABASE_URL=sqlite:///./medvoice.db
MAX_AUDIO_SIZE_MB=50
MAX_AUDIO_DURATION_MINUTES=30
DEBUG=false
```

### Performance ASR

- **GPU NVIDIA (CUDA)** : float16, ~2-3s pour un audio de 30s
- **CPU** : float32, plus lent (~10-15s pour 30s d'audio)
- Le modèle Whisper est chargé en lazy singleton (premier appel uniquement)

---

## Avertissements

- **Pas un dispositif médical** — outil de recherche/démonstration uniquement
- Ne remplace pas un dossier patient officiel
- Validation humaine obligatoire pour tout usage clinique réel
- Les LLM peuvent halluciner — toujours vérifier les faits médicaux
- Optimisé pour le français uniquement

---

## Contexte du Projet

Ce projet s'inscrit dans le cadre d'un **mémoire de licence** à l'IFRI/UAC explorant :

- L'application de l'ASR en contexte médical francophone
- La génération automatique de documentation clinique par LLM
- Le traitement Chain-of-Thought (CoT) pour améliorer la qualité des transcriptions
- Les défis éthiques et techniques du NLP en santé

---

## Références

- Hugging Face Transformers : <https://huggingface.co/docs/transformers>
- FastAPI : <https://fastapi.tiangolo.com>
- Mistral AI : <https://docs.mistral.ai>
- React : <https://react.dev>

---

## Licence

Projet académique de démonstration — Mémoire de Licence 2026
