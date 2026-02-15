# 🏥 Transcription & Rapports Médicaux AI

Application professionnelle de démonstration combinant transcription automatique de la parole (ASR) et génération de rapports structurés par LLM, dans un contexte médical et académique.

## 🎯 Trois Fonctionnalités Principales

### 1️⃣ **Transcription Simple**

Transcription audio rapide pour enregistrements courts ou dictée en temps réel.

**Cas d'usage:**

- 📝 Prise de notes vocales
- 🎤 Mémos rapides  
- 📞 Transcription d'appels courts

**Caractéristiques:**

- ✅ Micro en temps réel (streaming)
- ✅ Upload de fichiers audio
- ✅ Modèle Whisper optimisé français médical

---

### 2️⃣ **Audio Long → Rapport Automatique**

Pour enregistrements longs (conférences, entretiens, oraux de mémoire). Génère un rapport structuré.

**Cas d'usage:**

- 🎓 Oraux de mémoire
- 🎙️ Conférences/séminaires
- 📚 Entretiens de recherche

**Caractéristiques:**

- ✅ Transcription complète d'audio long
- ✅ Génération de rapport par LLM (résumé, thèmes, actions)
- ✅ Personnalisation via contexte

---

### 3️⃣ **Rapport Clinique (Format SOAP)**

Transforme une conversation médecin-patient en rapport clinique structuré professionnel.

**Cas d'usage:**

- 🩺 Consultations médicales (temps réel ou enregistrées)
- 🏥 Documentation post-consultation
- 🔬 Recherche en NLP clinique

**Format de rapport généré:**

```text
MOTIF DE CONSULTATION
  Raison principale de la visite

ANAMNÈSE (SUBJECTIF)
  - Symptômes rapportés (début, durée, intensité)
  - Antécédents médicaux pertinents
  - Médicaments actuels (DCI + posologie)
  - Allergies connues
  - Contexte social/familial si pertinent

EXAMEN CLINIQUE (OBJECTIF)
  - Signes vitaux mentionnés
  - Observations physiques
  - Résultats d'examens complémentaires

ÉVALUATION (ASSESSMENT)
  - Diagnostic(s) probable(s)
  - Diagnostic(s) différentiel(s)
  - Gravité/urgence estimée

PLAN DE TRAITEMENT
  - Prescriptions (médicaments, posologies, durée)
  - Examens complémentaires à réaliser
  - Orientations/référence vers spécialiste
  - Conseils hygiéno-diététiques

SUIVI ET RECOMMANDATIONS
  - Prochaine consultation
  - Signes d'alerte à surveiller
  - Éducation thérapeutique
```

**Caractéristiques:**

- ✅ Format SOAP (Subjective, Objective, Assessment, Plan)
- ✅ Extraction d'entités médicales (symptômes, médicaments, dosages)
- ✅ Conservation des données chiffrées exactes
- ✅ Inspiré de la recherche en clinical NLP
- ⚠️ **Démo recherche uniquement** — Ne remplace pas un dossier médical officiel

---

## 🔧 Architecture Technique

### Modèles utilisés

- **ASR (Speech-to-Text):** `StephaneBah/whisper-small-rad-fr2.0` (révision `81a88f4`)
  - Whisper fine-tuné pour le français médical/radiologique
  - Pipeline Transformers avec chunking (30s) + stride
  
- **LLM (Résumé/Rapport):** `google/flan-t5-xl` (~2.7B paramètres)
  - Modèle seq2seq avec quantization 4-bit (bitsandbytes)
  - Prompts spécialisés selon le type de rapport

### Performance

- **GPU NVIDIA recommandé** (CUDA) pour temps réel acceptable
  - ASR: float16 sur GPU, float32 sur CPU
  - LLM: 4-bit quantization si possible, sinon 8-bit, sinon CPU
- **Fonctionne sur CPU** mais plus lent (non recommandé pour temps réel)

---

## 📦 Installation

### Prérequis

- Python 3.10+
- GPU NVIDIA avec CUDA (recommandé)
- Compte Hugging Face avec token API

### Étapes

#### 1) Créer l'environnement virtuel

```bash
cd "App Demo"
python -m venv .venv
```

**Activer l'environnement:**

```powershell
# Windows PowerShell
.venv\Scripts\Activate.ps1
```

```bash
# Linux/macOS
source .venv/bin/activate
```

#### 2) Installer les dépendances

```bash
pip install -r requirements.txt
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121 
```

> **Note Windows:** `bitsandbytes` n'est pas toujours disponible. L'app basculera automatiquement en mode 8-bit ou CPU.

#### 3) Configurer le token Hugging Face

Créez un fichier `.env` à la racine:

```env
HF_TOKEN=hf_XXXXXXXXXXXXXXXXXXXXXXXX
```

Ou définissez la variable d'environnement:

```powershell
# PowerShell
$env:HF_TOKEN="hf_XXXXXXXXXXXXXXXXXXXXXXXX"
```

```bash
# Linux/macOS
export HF_TOKEN=hf_XXXXXXXXXXXXXXXXXXXXXXXX
```

#### 4) Lancer l'application

```bash
python app.py
```

L'interface sera disponible sur **<http://localhost:7860>**

---

## 🖥️ Interface Utilisateur

### Design professionnel

- 🎨 Interface moderne avec gradients et cartes
- 📱 Layout responsive
- 🎯 Navigation par onglets claire
- 📋 Boutons de copie pour tous les résultats
- ⚡ Indicateurs de statut en temps réel

### Workflow par feature

#### 📝 Feature 1 - Transcription Simple

1. Onglet "Transcription Simple"
2. Choisir "Enregistrement direct" (micro) ou "Fichier audio"
3. Parler ou uploader le fichier
4. Récupérer la transcription

#### 📊 Feature 2 - Audio Long → Rapport

1. Onglet "Audio Long → Rapport"
2. Uploader un fichier audio long
3. (Optionnel) Ajouter du contexte dans la zone de texte
4. Cliquer sur "Transcrire et générer le rapport"
5. Obtenir transcription brute + rapport structuré

#### 🩺 Feature 3 - Rapport Clinique

1. Onglet "Rapport Clinique"
2. Choisir la spécialité médicale dans le menu déroulant
3. Enregistrer en direct (micro) ou uploader une consultation
4. (Optionnel) Ajouter des notes cliniques
5. Cliquer sur "Générer le rapport clinique"
6. Obtenir rapport au format SOAP complet

---

## ⚙️ Configuration Avancée

### Variables d'environnement

```env
# Obligatoire pour accès aux modèles
HF_TOKEN=hf_xxx

# Optionnel: changer le modèle de résumé
SUMMARIZER_MODEL_ID=google/flan-t5-large  # Plus petit/rapide
# ou
SUMMARIZER_MODEL_ID=google/flan-t5-xxl    # Plus puissant
```

### Optimisation mémoire GPU

Dans `app.py`, vous pouvez ajuster:

```python
# ASR chunking (réduire si RAM limitée)
chunk_length_s=30  # → 20
stride_length_s=(5, 2)  # → (3, 1)

# Tokens générés (réduire pour moins de VRAM)
max_new_tokens=640  # Feature 2
max_new_tokens=768  # Feature 3
```

### Personnalisation des prompts

Modifier les fonctions dans `app.py`:

- `generate_report()` → Feature 2 (rapport général)
- `generate_clinical_report()` → Feature 3 (rapport SOAP)

Pour adapter le format de sortie, les sections, le ton, etc.

### Exposition réseau

Pour rendre l'app accessible sur le réseau local, c'est déjà configuré par défaut:

```python
demo.launch(
    server_name="0.0.0.0",  # Accessible sur LAN
    server_port=7860,
    share=False,  # Mettre True pour lien public Gradio
)
```

---

## 📚 Références Scientifiques

Cette application s'inspire de travaux de recherche en NLP clinique:

- **Clinical Text Summarization with LLMs** (2023-2024)
  - Format SOAP structuré
  - Extraction d'entités médicales
  - Fidélité au verbatim

- **Real-time Speech Summarization for Medical Conversations**
  - Streaming ASR médical
  - Latence acceptable pour usage clinique
  - Génération incrémentale de rapports

- **Temporal Relation Extraction in Clinical Notes**
  - Conservation des données temporelles
  - Extraction de posologies et dosages

---

## ⚠️ Avertissements et Limitations

### ⚡ Performance

- **Temps réel** : nécessite GPU pour latence acceptable (~2-3s)
- **Streaming** : mise à jour par batch (2-3s), pas token-par-token
- **Charge** : ASR + LLM simultanés = ~8-12 GB VRAM (T5-XL quantifié)

### 🔒 Usage médical

- ❌ **Pas un dispositif médical** — outil de recherche/démonstration uniquement
- ❌ Ne remplace pas un dossier patient officiel
- ❌ Validation humaine obligatoire pour tout usage clinique réel
- ✅ Respecte l'anonymisation (pas de noms dans les prompts)

### 🐛 Limitations connues

- **Streaming audio** : mise à jour par batch, pas en continu
- **Hallucinations LLM** : toujours vérifier les faits médicaux
- **Langue** : optimisé pour français uniquement
- **Formats audio** : MP3, WAV, M4A recommandés
- **Diarisation** : feature désactivée pour le moment (prévue v3.0)

---

## 🔬 Contexte du Projet

Ce projet s'inscrit dans le cadre d'un **mémoire de licence** explorant:

- L'application de l'ASR en contexte médical francophone
- La génération automatique de documentation clinique
- L'évaluation de LLM pour le résumé médical
- Les défis éthiques et techniques du NLP en santé

**Objectifs académiques:**

- Démontrer la faisabilité technique
- Identifier les limites et risques
- Proposer un cadre d'évaluation
- Contribuer à la recherche en IA médicale francophone

---

## 📞 Support & Contribution

Pour questions techniques ou contributions:

- 📖 Documentation Gradio: <https://gradio.app/docs>
- 🤗 Hugging Face Transformers: <https://huggingface.co/docs/transformers>
- 🔬 Papers: voir section Références

---

## 📄 Licence

Projet académique de démonstration — Mémoire de Licence 2026
