# Cahier de Charge - Système de Génération Automatique de Rapports Médicaux

**Projet** : MedVoice AI - Plateforme de transcription et génération de rapports médicaux adaptée aux accents africains

---

## 1. CONTEXTE ET OBJECTIFS

### 1.1 Contexte
Développement d'une application démonstrative intégrant le modèle ASR whisper-small-rad-FR2 dans un pipeline complet de génération de rapports médicaux pour radiologues béninois.

### 1.2 Cas d'Utilisation

Le système propose **deux modes de fonctionnement distincts** :

#### Cas 1 : Rapport de Consultation (Format SOAP)
- **Entrée** : Enregistrement d'une conversation Médecin/Patient (dialogue)
- **Pipeline** : ASR → Diarisation (identification locuteurs) → Génération rapport SOAP
- **Sortie** : Rapport médical structuré (Subjectif/Objectif/Assessment/Plan)
- **Usage** : Consultations, entretiens cliniques

#### Cas 2 : Documentation Médicale (Scribe)
- **Entrée** : Dictée vocale du médecin (monologue)
- **Pipeline** : ASR → Ponctuation → Correction médicale
- **Sortie** : Transcription corrigée et formatée
- **Usage** : Comptes rendus radiologiques, notes cliniques, observations

### 1.3 Objectifs
- **Objectif principal** : Démontrer l'applicabilité clinique du modèle ASR adapté aux deux cas d'usage
- **Objectif secondaire** : Valider les deux pipelines (SOAP et Scribe)
- **Objectif tertiaire** : Créer une interface professionnelle utilisable en soutenance

### 1.4 Contraintes
- Temps développement : 3-4 semaines maximum
- Budget : 0€ (stack gratuite uniquement)
- Déploiement : Doit fonctionner offline ET online pour soutenance
- Performance : Interface fluide (< 3s latence perçue)

---

## 2. ARCHITECTURE TECHNIQUE

### 2.1 Stack Technologique

#### Frontend
```
Framework    : React.js 18+ avec TypeScript
UI Library   : Tailwind CSS + shadcn/ui components
Animations   : Framer Motion + Canvas API (visualisations audio)
Audio        : Web Audio API + RecordRTC
State Mgmt   : Zustand (léger, performant)
HTTP Client  : Axios avec retry logic
```

#### Backend
```
Framework    : FastAPI 0.109+
ASGI Server  : Uvicorn avec workers multiples
ASR Engine   : whisper-small-rad-FR2 (modèle local)
LLM          : Mistral Large via API (gratuit tier disponible)
Database     : PostgreSQL 15 (dev) / SQLite (fallback demo)
ORM          : SQLAlchemy 2.0
File Storage : Local filesystem (audio files)
Async Tasks  : asyncio (pas de Celery, trop lourd)
```

#### Déploiement
```
Containerisation : Docker + Docker Compose
CI/CD            : GitHub Actions (tests automatiques)
Cloud Hosting    : Railway.app (free tier 500h/mois)
Fallback Local   : Script launch_demo.sh (offline mode)
Monitoring       : Logs structurés (loguru)
```

### 2.2 Architecture Modulaire

```
medvoice-ai/
├── frontend/                    # Application React
│   ├── src/
│   │   ├── components/
│   │   │   ├── AudioRecorder/   # Composant enregistrement + viz
│   │   │   ├── TranscriptEditor/ # Édition transcription
│   │   │   ├── ReportViewer/    # Affichage rapport généré
│   │   │   └── Dashboard/       # Historique consultations
│   │   ├── hooks/               # Custom hooks
│   │   ├── services/            # API calls
│   │   ├── store/               # Zustand stores
│   │   └── utils/               # Helpers
│   └── public/
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── v1/
│   │   │   │   ├── endpoints/
│   │   │   │   │   ├── audio.py       # Upload/récupération audios
│   │   │   │   │   ├── transcription.py # ASR endpoints
│   │   │   │   │   ├── report.py      # Génération rapports
│   │   │   │   │   └── history.py     # Historique
│   │   │   └── deps.py            # Dependencies injection
│   │   ├── core/
│   │   │   ├── config.py          # Configuration env
│   │   │   ├── security.py        # (Basique pour demo)
│   │   │   └── logging.py         # Setup logs
│   │   ├── services/
│   │   │   ├── asr_service.py     # Whisper FR2 inference
│   │   │   ├── llm_service.py     # Mistral API calls
│   │   │   ├── punctuation.py     # Chain-of-Thought ponctuation
│   │   │   ├── diarization.py     # Chain-of-Thought diarisation
│   │   │   └── correction.py      # Chain-of-Thought correction
│   │   ├── models/                # SQLAlchemy models
│   │   ├── schemas/               # Pydantic schemas
│   │   └── db/                    # Database setup
│   └── tests/
│
├── docker/
│   ├── Dockerfile.frontend
│   ├── Dockerfile.backend
│   └── docker-compose.yml
│
├── scripts/
│   ├── launch_demo.sh             # Lancement offline
│   ├── setup_env.sh               # Setup environnement
│   └── load_test_data.sh          # Charger audios test
│
└── docs/
    ├── API.md                     # Documentation API
    └── DEPLOYMENT.md              # Guide déploiement
```

---

## 3. SPÉCIFICATIONS FONCTIONNELLES

### 3.1 Module 1 : Enregistrement Audio

#### Fonctionnalités
```
✓ Enregistrement via microphone navigateur
✓ Visualisation forme d'onde temps réel (Canvas API)
  - Animation circulaire type "film AI" avec couleurs dynamiques
  - Particules animées suivant intensité audio
  - Compteur durée enregistrement
✓ Boutons Start/Pause/Stop/Reset
✓ Upload fichier audio (.wav, .mp3, .m4a) si mic indisponible
✓ Preview audio avant envoi (player HTML5)
✓ Détection qualité audio (niveau bruit, saturation)
✓ Limite durée : 5 minutes max par enregistrement
```

#### Workflow UX
```
1. User clique "Nouveau rapport"
2. Modal s'ouvre : choix enregistrer OU upload fichier
3. Si enregistrement :
   - Demande permission micro
   - Affiche visualisation circulaire animée
   - User parle, visualisation réagit en temps réel
   - Stop → Preview audio
4. Si upload :
   - Drag & drop ou file picker
   - Validation format/taille
5. Remplissage métadonnées optionnelles :
   - Type examen (radio pulmonaire, mammo, etc.)
   - Contexte clinique (court texte libre)
6. Bouton "Transcrire" → envoi backend
```

#### Contraintes Techniques
- Format sortie : WAV 16kHz mono (conversion auto si autre format)
- Taille max fichier : -MB
- Durée max : - minutes
- Compression : Opus si upload 4G/mobile (décompression backend)

---

### 3.2 Module 2 : Transcription ASR

#### Pipeline Backend
```python
# Pseudo-code pipeline ASR
async def transcribe_audio(audio_file, metadata):
    # 1. Prétraitement audio
    audio = await preprocess_audio(audio_file)  # Resample 16kHz
    
    # 2. Inférence Whisper FR2
    raw_transcription = await asr_service.transcribe(
        audio=audio,
        model="whisper-small-rad-FR2",
        language="fr",
        task="transcribe"
    )
    
    # 3. Post-processing initial
    cleaned_text = normalize_text(raw_transcription)
    
    return {
        "raw": raw_transcription,
        "cleaned": cleaned_text,
        "confidence": calculate_confidence(raw_transcription),
        "duration": audio.duration,
        "metadata": metadata
    }
```

#### Fonctionnalités Frontend
```
✓ Affichage transcription en temps réel (streaming si possible)
✓ Indicateur progression : 
  - Barre progression + animation "AI processing"
  - Effet particules/ondes colorées pendant traitement
✓ Highlight termes médicaux détectés (couleur distinctive)
✓ Affichage score confiance global (WER estimé)
✓ Segments à faible confiance surlignés en jaune
```

#### Temps Réponse Cible
- Audio 30s : < 5s transcription
- Audio 2min : < 15s transcription
- Timeout : 60s max (erreur si dépassé)

---

### 3.3 Module 3 : Chain-of-Thought Processing

#### 3.3.1 Ponctuation (Chain-of-Thought 1)

**Objectif** : Ajouter ponctuation naturelle au texte brut ASR

```python
# Prompt Mistral pour ponctuation
PUNCTUATION_PROMPT = """
Tu es un expert en ponctuation de textes médicaux français.

Tâche : Ajoute la ponctuation appropriée au texte suivant, qui est une 
transcription vocale d'une conclusion radiologique. Le texte manque de 
ponctuation mais doit être structuré avec points, virgules, deux-points 
et majuscules appropriées.

Règles :
- Respecte le vocabulaire médical exact (ne change AUCUN terme)
- Ajoute uniquement : . , : ; ! ? et majuscules
- Préserve tous les nombres et unités
- Structure en phrases cohérentes

Texte brut :
{raw_text}

Réfléchis étape par étape :
1. Identifie les fins de phrases logiques
2. Repère les énumérations nécessitant virgules
3. Détecte les introductions nécessitant deux-points
4. Applique la ponctuation

Texte ponctué :
"""
```

**Sortie attendue** :
```
Input  : "examen radiologique du thorax face réalisé le 12 janvier 2025 
          montre une opacité nodulaire du lobe supérieur droit de 2 cm 
          pas d'épanchement pleural cœur de taille normale"

Output : "Examen radiologique du thorax de face, réalisé le 12 janvier 2025. 
          Montre une opacité nodulaire du lobe supérieur droit de 2 cm. 
          Pas d'épanchement pleural. Cœur de taille normale."
```

#### 3.3.2 Diarisation (Chain-of-Thought 2)

**Objectif** : Identifier et séparer locuteurs si dialogue (optionnel Phase 1)

```python
DIARIZATION_PROMPT = """
Tu es un expert en analyse de dialogues médicaux.

Tâche : Détecte s'il y a plusieurs locuteurs dans ce texte et sépare leurs 
interventions. Si un seul locuteur, indique-le.

Contexte : Transcription consultation médicale (radiologue +/- patient)

Texte :
{punctuated_text}

Analyse étape par étape :
1. Y a-t-il des indices de changement de locuteur ? (questions/réponses, 
   changement de registre, etc.)
2. Identifie les segments de chaque locuteur potentiel
3. Labellise : [Médecin] / [Patient] / [Locuteur unique]

Résultat :
"""
```

**Sortie attendue** :
```
Input  : "Bonjour madame asseyez vous s'il vous plaît. Bonjour docteur. 
          Alors on va faire une radio de votre genou droit d'accord. 
          Oui docteur j'ai très mal depuis hier."

Output : 
[Médecin] : Bonjour madame, asseyez-vous s'il vous plaît. Alors, on va 
            faire une radio de votre genou droit, d'accord ?
[Patient] : Bonjour docteur. Oui docteur, j'ai très mal depuis hier.
```

**Note** : Pour version 1, on peut skip diarisation si trop complexe et se concentrer sur monologues radiologues.

#### 3.3.3 Correction (Chain-of-Thought 3)

**Objectif** : Corriger erreurs ASR en préservant sens médical

```python
CORRECTION_PROMPT = """
Tu es un radiologue expert francophone d'Afrique de l'Ouest.

Tâche : Corrige les erreurs potentielles dans cette transcription automatique 
d'une conclusion radiologique, en tenant compte des spécificités de 
prononciation africaines et du jargon médical.

Texte ponctué :
{punctuated_text}

Erreurs courantes ASR à vérifier :
- Confusion phonétique : "plairal" → "pleural", "nodulère" → "nodulaire"
- Nombres mal transcrits : "2cm" → "2 cm", "120" → "un cent vingt"
- Acronymes : "TDM" vs "T D M", "IRM" vs "I R M"
- Noms propres africains : vérifier cohérence

Réfléchis étape par étape :
1. Identifie les mots/expressions médicaux suspects
2. Vérifie cohérence anatomique (ex: "lobe supérieur" existe-t-il ?)
3. Corrige uniquement les erreurs évidentes
4. PRÉSERVE le sens médical original

Texte corrigé :
"""
```

**Sortie attendue** :
```
Input  : "Examen radiologique du torax de face. Montre une opacité 
          nodulère du lob supérieur droit de deuxcm."

Output : "Examen radiologique du thorax de face. Montre une opacité 
          nodulaire du lobe supérieur droit de 2 cm."
```

#### 3.3.4 Édition Manuelle (Interface)

**Fonctionnalités** :
```
✓ Affichage étapes CoT :
  [Transcription brute] → [Ponctuation] → [Diarisation] → [Correction]
  
✓ Chaque étape éditable manuellement :
  - Clic sur texte → mode édition inline
  - Bouton "Annuler correction automatique" → retour étape précédente
  - Highlight différences entre étapes (diff view)

✓ Suggestions intelligentes :
  - Termes médicaux mal orthographiés soulignés
  - Suggestions alternatives au survol
  - Dictionnaire médical intégré (recherche rapide)

✓ Validation finale :
  - Bouton "Valider transcription" → passe à génération rapport
  - Affichage temps économisé vs saisie manuelle
```

---

### 3.4 Module 4 : Génération Rapport Structuré

#### Prompt Engineering Mistral

```python
REPORT_GENERATION_PROMPT = """
Tu es un radiologue expert rédigeant un compte rendu médical formel.

Contexte clinique :
{context}  # Ex: "Suspicion de pneumonie, patient 45 ans, toux depuis 5 jours"

Transcription validée :
{corrected_text}

Tâche : Génère un compte rendu radiologique structuré et professionnel en 
français, suivant le format standard hospitalier.

Structure obligatoire :
1. **INDICATION** : Motif de l'examen
2. **TECHNIQUE** : Type d'examen réalisé, incidences
3. **OBSERVATIONS** : Description détaillée des constatations
4. **CONCLUSION** : Synthèse diagnostique
5. **RECOMMANDATIONS** (si applicable) : Examens complémentaires suggérés

Consignes :
- Style formel et précis
- Vocabulaire médical approprié
- Phrases complètes et structurées
- Pas d'abréviations non standard
- Longueur : 150-300 mots selon complexité

Génère le rapport :
"""
```

#### Exemple Sortie Attendue

```markdown
**COMPTE RENDU RADIOLOGIQUE**

**INDICATION**
Suspicion de pneumonie. Patient de 45 ans présentant une toux persistante 
depuis 5 jours.

**TECHNIQUE**
Radiographie thoracique de face et profil, réalisée le 12 janvier 2025.

**OBSERVATIONS**
Le parenchyme pulmonaire présente une opacité alvéolaire du lobe inférieur 
gauche, de forme triangulaire, à base pleurale. Cette opacité est associée 
à un bronchogramme aérien visible. Pas d'épanchement pleural associé.

Le médiastin est de taille et de morphologie normales. La silhouette 
cardiaque n'est pas élargie. Les structures osseuses visualisées sont 
d'aspect normal.

**CONCLUSION**
Pneumopathie aiguë du lobe inférieur gauche, d'aspect compatible avec une 
pneumonie communautaire.

**RECOMMANDATIONS**
- Traitement antibiotique adapté
- Contrôle radiologique à 4-6 semaines pour vérifier la régression
- Scanner thoracique si absence d'amélioration clinique sous traitement
```

#### Fonctionnalités Interface

```
✓ Affichage rapport formaté (markdown → HTML rich)
✓ Sections collapsibles (accordéon)
✓ Édition inline de chaque section
✓ Boutons actions :
  - "Régénérer rapport" (avec nouveau prompt)
  - "Modifier le contexte" → régénère avec nouveau contexte
  - "Exporter PDF"
  - "Copier dans presse-papier"
  - "Envoyer par email" (optionnel)
✓ Preview avant/après (split view)
✓ Temps génération affiché (ex: "Rapport généré en 8.3s")
```

---

### 3.5 Module 5 : Historique et Dashboard

#### Fonctionnalités

```
✓ Liste chronologique consultations :
  - Date/heure
  - Type examen
  - Patient (anonymisé : "Patient #1234")
  - Statut : Brouillon / Finalisé / Exporté
  - Durée audio
  - WER estimé

✓ Filtres et recherche :
  - Par date (range picker)
  - Par type examen (dropdown)
  - Par statut
  - Recherche full-text dans transcriptions

✓ Actions batch :
  - Sélection multiple
  - Export PDF groupé
  - Suppression

✓ Statistiques dashboard :
  - Nombre consultations ce mois
  - Temps total économisé (estimation)
  - Graphique évolution usage
  - WER moyen des transcriptions
```

#### Base de données Schema

```sql
-- Table principale consultations
CREATE TABLE consultations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Audio
    audio_filename VARCHAR(255),
    audio_duration FLOAT,  -- en secondes
    audio_format VARCHAR(10),  -- wav, mp3, etc.
    
    -- Métadonnées médicales
    exam_type VARCHAR(100),  -- "Radio thorax", "Mammographie", etc.
    clinical_context TEXT,
    patient_id VARCHAR(50),  -- Anonymisé
    
    -- Transcription
    raw_transcription TEXT,
    punctuated_text TEXT,
    diarized_text TEXT,
    corrected_text TEXT,
    
    -- Rapport final
    final_report TEXT,
    report_exported BOOLEAN DEFAULT FALSE,
    
    -- Métriques
    transcription_wer FLOAT,
    transcription_duration FLOAT,  -- temps traitement ASR
    report_generation_duration FLOAT,  -- temps génération rapport
    
    -- Statut
    status VARCHAR(20),  -- draft, finalized, exported
    
    INDEX idx_created_at (created_at),
    INDEX idx_exam_type (exam_type),
    INDEX idx_status (status)
);

-- Table logs (debug)
CREATE TABLE processing_logs (
    id SERIAL PRIMARY KEY,
    consultation_id UUID REFERENCES consultations(id),
    step VARCHAR(50),  -- "ASR", "punctuation", "correction", "report"
    timestamp TIMESTAMP DEFAULT NOW(),
    duration FLOAT,
    success BOOLEAN,
    error_message TEXT
);
```

---

## 4. SPÉCIFICATIONS INTERFACE UTILISATEUR

### 4.1 Design System

#### Palette Couleurs
```css
/* Thème principal : Médical + AI futuriste */
--primary: #0066FF;          /* Bleu électrique (IA) */
--primary-dark: #0052CC;
--primary-light: #3D8BFF;

--secondary: #00D9FF;        /* Cyan néon (accent) */
--accent: #FF6B35;           /* Orange corail (alertes) */

--success: #00C853;          /* Vert (validation) */
--warning: #FFB300;          /* Jaune (attention) */
--error: #D32F2F;            /* Rouge (erreur) */

--bg-primary: #0A0E27;       /* Fond sombre principal */
--bg-secondary: #151B3B;     /* Fond cartes */
--bg-tertiary: #1E2749;      /* Fond inputs */

--text-primary: #FFFFFF;
--text-secondary: #B0B8D4;
--text-muted: #6B7598;

/* Glassmorphism */
--glass-bg: rgba(21, 27, 59, 0.7);
--glass-border: rgba(255, 255, 255, 0.1);
```

#### Typographie
```css
/* Font stack */
font-family: 'Inter', 'SF Pro Display', system-ui, sans-serif;

/* Scales */
--text-xs: 0.75rem;      /* 12px */
--text-sm: 0.875rem;     /* 14px */
--text-base: 1rem;       /* 16px */
--text-lg: 1.125rem;     /* 18px */
--text-xl: 1.25rem;      /* 20px */
--text-2xl: 1.5rem;      /* 24px */
--text-3xl: 2rem;        /* 32px */

/* Poids */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### 4.2 Composants Clés

#### 4.2.1 AudioVisualizer (Composant Star ⭐)

**Description** : Visualisation circulaire animée type "film AI" pendant enregistrement

```jsx
// Spécifications techniques
<AudioVisualizer
  audioStream={mediaStream}
  isRecording={true}
  variant="circular"  // circular, waveform, particles
/>

// Comportement :
- Centre : Cercle pulsant avec intensité audio
- Anneaux : 3 cercles concentriques animés
- Particules : 50-100 points lumineux orbitant
- Couleurs : Gradient bleu → cyan → violet (animation fluide)
- FPS : 60fps (requestAnimationFrame)
- Responsive : Adapté mobile/desktop

// Canvas API + Web Audio API
- Analyse fréquences temps réel (FFT)
- Mapping amplitude → taille/couleur particules
- Smooth transitions (easing functions)
```

**Effet visuel cible** : Pense à l'interface JARVIS (Iron Man) ou l'orbe Siri iOS

#### 4.2.2 ProcessingAnimation

**Description** : Animation pendant traitement ASR/LLM

```jsx
<ProcessingAnimation
  step="transcription"  // transcription, punctuation, correction, report
  progress={45}  // 0-100
  message="Analyse acoustique en cours..."
/>

// Éléments visuels :
- Barre progression avec gradient animé
- Texte étape actuelle (fade in/out)
- Particules flottantes en arrière-plan
- Icônes étapes (checkmark quand complété)
- Estimation temps restant

// États :
- idle → processing → success / error
- Transitions fluides (Framer Motion)
```

#### 4.2.3 TranscriptEditor

**Description** : Éditeur texte riche avec highlights

```jsx
<TranscriptEditor
  text={transcription}
  highlightMedicalTerms={true}
  showConfidenceScores={true}
  onEdit={(newText) => handleEdit(newText)}
/>

// Features :
- Syntax highlighting termes médicaux (couleur distinctive)
- Tooltip au survol : définition terme + confiance ASR
- Segments faible confiance : background jaune pâle
- Diff view : voir corrections suggérées (mode accept/reject)
- Boutons actions : Undo/Redo, Dictionnaire, Rechercher
```

#### 4.2.4 ReportPreview

**Description** : Affichage rapport généré style document médical

```jsx
<ReportPreview
  report={generatedReport}
  format="markdown"  // markdown, html, pdf-preview
  editable={true}
/>

// Rendu :
- En-tête : Logo hôpital (fictif) + date
- Sections collapsibles (accordéon)
- Typographie médicale professionnelle
- Boutons export : PDF, DOCX, Copy, Print
- Watermark "DEMO" en fond (pour soutenance)
```

### 4.3 Layouts & Navigation

#### Navigation Principale (Sidebar)

```
┌─────────────────────────────────────┐
│  🏥 MedVoice AI                    │
├─────────────────────────────────────┤
│  🎤 Nouveau rapport                 │  ← Action principale
│  📋 Historique                      │
│  📊 Statistiques                    │
│  ⚙️  Paramètres                     │
├─────────────────────────────────────┤
│  👤 Dr. [Nom]                       │  ← User profile
│  🔴 Modèle : Whisper FR2           │  ← Indicateur modèle actif
└─────────────────────────────────────┘
```

#### Flow Principal (Wizard Steps)

```
Step 1 : Enregistrement
   ↓
Step 2 : Transcription (auto)
   ↓
Step 3 : Révision & Correction
   ↓
Step 4 : Génération Rapport
   ↓
Step 5 : Export & Finalisation
```

Chaque step = écran fullscreen avec :
- Progress bar en haut (5 étapes)
- Boutons "Précédent" / "Suivant"
- Sauvegarde auto brouillon toutes les 30s

---

## 5. SPÉCIFICATIONS TECHNIQUES BACKEND

### 5.1 API Endpoints

#### 5.1.1 Audio Management

```python
POST /api/v1/audio/upload
"""
Upload fichier audio pour transcription

Request:
- multipart/form-data
- file: audio file (max 50MB)
- exam_type: string (optional)
- clinical_context: string (optional)

Response:
{
  "consultation_id": "uuid",
  "audio_filename": "recording_123.wav",
  "duration": 45.3,
  "status": "uploaded"
}
"""

GET /api/v1/audio/{consultation_id}
"""
Récupérer fichier audio

Response: audio/wav stream
"""

DELETE /api/v1/audio/{consultation_id}
"""
Supprimer audio (et consultation associée)

Response: 204 No Content
"""
```

#### 5.1.2 Transcription

```python
POST /api/v1/transcribe/{consultation_id}
"""
Lancer transcription ASR

Request:
{
  "model": "whisper-small-rad-FR2",  # ou "baseline" pour test
  "temperature": 0.3,
  "language": "fr"
}

Response:
{
  "consultation_id": "uuid",
  "raw_transcription": "texte brut...",
  "confidence_score": 0.87,
  "wer_estimate": 0.436,
  "processing_time": 4.2,
  "status": "completed"
}
"""

GET /api/v1/transcribe/{consultation_id}/status
"""
Polling endpoint pour progression

Response:
{
  "status": "processing",  # processing, completed, failed
  "progress": 45,  # 0-100
  "estimated_time_remaining": 8.3
}
"""
```

#### 5.1.3 Chain-of-Thought Processing

```python
POST /api/v1/process/punctuation/{consultation_id}
"""
Étape 1 CoT : Ajouter ponctuation

Response:
{
  "punctuated_text": "...",
  "processing_time": 2.1
}
"""

POST /api/v1/process/diarization/{consultation_id}
"""
Étape 2 CoT : Diarisation (optionnel)

Response:
{
  "diarized_text": "...",
  "speakers_detected": 2,
  "segments": [
    {"speaker": "Médecin", "text": "...", "start": 0.0, "end": 12.3},
    {"speaker": "Patient", "text": "...", "start": 12.4, "end": 18.9}
  ]
}
"""

POST /api/v1/process/correction/{consultation_id}
"""
Étape 3 CoT : Correction erreurs ASR

Response:
{
  "corrected_text": "...",
  "corrections_made": [
    {"original": "torax", "corrected": "thorax", "position": 45},
    {"original": "nodulère", "corrected": "nodulaire", "position": 78}
  ],
  "processing_time": 3.5
}
"""
```

#### 5.1.4 Report Generation

```python
POST /api/v1/report/generate/{consultation_id}
"""
Générer rapport médical structuré

Request:
{
  "context": "Suspicion pneumonie, patient 45 ans",
  "style": "formal",  # formal, concise, detailed
  "include_recommendations": true
}

Response:
{
  "report": {
    "indication": "...",
    "technique": "...",
    "observations": "...",
    "conclusion": "...",
    "recommendations": "..."
  },
  "report_markdown": "# COMPTE RENDU...",
  "report_html": "<div>...",
  "processing_time": 8.7
}
"""

POST /api/v1/report/export/{consultation_id}
"""
Exporter rapport en PDF

Request:
{
  "format": "pdf",  # pdf, docx, txt
  "include_audio": false
}

Response