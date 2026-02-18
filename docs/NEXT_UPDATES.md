# 🚀 Prochaines Améliorations — Performance & UX

Ce document décrit les optimisations planifiées pour réduire le temps de traitement des audios de **50-70%** et améliorer drastiquement l'expérience utilisateur.

---

## 📊 Problème actuel

### Mode Upload (fichier audio)
```
Timeline actuelle :
┌─────────────────────────────────────────────────────────────────┐
│ Upload (1-3s) → ASR séquentiel (5-15s) → LLM (6-10s)           │
│ Total : 12-28s                                                   │
│ UX : Écran vide "Traitement en cours..." pendant 12-28s         │
└─────────────────────────────────────────────────────────────────┘
```

### Mode Direct (enregistrement)
```
Timeline actuelle :
┌─────────────────────────────────────────────────────────────────┐
│ Record 60s → Upload (2s) → ASR (5s) → LLM (8s)                 │
│ Total : 75s                                                      │
│ UX : L'utilisateur attend 15s après l'enregistrement            │
└─────────────────────────────────────────────────────────────────┘
```

**Verdict** : Trop lent comparé à la rédaction manuelle d'un médecin (~5× le temps manuel).

---

## 🎯 Objectif

Rendre l'application **2× plus rapide qu'un médecin** :
- **Temps réel réduit** : de 12-28s → 6-12s
- **Temps perçu** : de 28s d'écran vide → expérience fluide avec feedback continu
- **Satisfaction utilisateur** : passage de frustrant à "magique"

---

## 🔧 Axe 1 : Chunking parallèle de l'ASR (mode Upload)

### Principe

Au lieu de transcrire un fichier audio d'un seul bloc, le **découper en segments de 30s** et les transcrire **en parallèle** sur plusieurs threads.

### Implémentation

#### Backend : `backend/app/services/asr_service.py`

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor
import numpy as np

def split_audio_chunks(audio_path: str, chunk_duration: float = 30.0):
    """
    Split audio file into overlapping chunks for parallel processing.
    
    Args:
        audio_path: Path to audio file
        chunk_duration: Duration of each chunk in seconds (default 30s)
    
    Returns:
        List of audio chunks with metadata (array, sampling_rate, index, timestamps)
    """
    from app.services.audio_utils import load_audio_array
    
    audio_array, sr = load_audio_array(audio_path)
    
    # Calculate chunk size in samples
    chunk_samples = int(chunk_duration * sr)
    overlap_samples = int(5 * sr)  # 5s overlap to avoid word cuts
    
    chunks = []
    offset = 0
    chunk_idx = 0
    
    while offset < len(audio_array):
        end = min(offset + chunk_samples, len(audio_array))
        chunk_data = audio_array[offset:end]
        
        chunks.append({
            "array": chunk_data,
            "sampling_rate": sr,
            "index": chunk_idx,
            "start_time": offset / sr,
            "end_time": end / sr
        })
        
        offset += chunk_samples - overlap_samples
        chunk_idx += 1
    
    return chunks


async def transcribe_chunks_parallel(audio_path: str, max_workers: int = 4) -> str:
    """
    Transcribe audio file by splitting into chunks and processing in parallel.
    
    Performance:
        - Audio 2min : 8s séquentiel → 2-3s parallèle (4× plus rapide)
        - Audio 5min : 20s séquentiel → 5-6s parallèle (4× plus rapide)
    
    Args:
        audio_path: Path to audio file
        max_workers: Number of parallel threads (default 4)
    
    Returns:
        Full transcription text
    """
    chunks = split_audio_chunks(audio_path, chunk_duration=30.0)
    
    if len(chunks) <= 1:
        # File too short, use regular transcription
        return transcribe(audio_path)
    
    asr = load_asr()
    
    # Transcribe chunks in parallel
    def transcribe_chunk(chunk):
        result = asr({
            "array": chunk["array"],
            "sampling_rate": chunk["sampling_rate"]
        })
        text = result.get("text", "") if isinstance(result, dict) else str(result)
        return (chunk["index"], sanitize_transcript(text))
    
    # Use ThreadPoolExecutor for CPU-bound Whisper inference
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        results = await asyncio.gather(
            *[asyncio.get_event_loop().run_in_executor(executor, transcribe_chunk, c) for c in chunks]
        )
    
    # Sort by chunk index and merge
    sorted_results = sorted(results, key=lambda x: x[0])
    merged_text = " ".join([text for _, text in sorted_results if text.strip()])
    
    return merged_text
```

#### Backend : `backend/app/api/v1/endpoints/transcribe.py`

Modifier l'endpoint pour utiliser le chunking parallèle sur les fichiers longs :

```python
from app.services import asr_service
import librosa

@router.post("/{session_id}", response_model=TranscriptionResponse)
async def transcribe_audio(session_id: str, db: DBSession = Depends(get_db)):
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session or not session.file_path:
        raise HTTPException(status_code=404, detail="Session or audio file not found")
    
    file_path = session.file_path
    
    try:
        # Check audio duration
        duration = librosa.get_duration(path=file_path)
        
        if duration > 60:
            # Long file (>1min) → parallel chunks (4× faster)
            raw_transcription = await asr_service.transcribe_chunks_parallel(file_path)
        else:
            # Short file (<1min) → regular transcription
            raw_transcription, duration = asr_service.transcribe_file(file_path)
        
        session.raw_transcription = raw_transcription
        session.status = "transcribed"
        db.commit()
        
        return TranscriptionResponse(
            session_id=session_id,
            raw_transcription=raw_transcription,
            duration=duration,
            message="Transcription completed"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
```

### Gain attendu

| Durée audio | Avant (séquentiel) | Après (parallèle) | Gain |
|-------------|-------------------|-------------------|------|
| 1 min | 3-5s | 3-5s | 0% (pas de chunking) |
| 2 min | 8-10s | **2-3s** | **70%** |
| 5 min | 20-25s | **5-6s** | **75%** |

---

## 🌊 Axe 2 : Streaming du rapport (amélioration UX majeure)

### Principe

Au lieu d'attendre que Mistral génère tout le rapport pour l'afficher d'un coup, **streamer les tokens en temps réel** via Server-Sent Events (SSE).

L'utilisateur voit le rapport **s'écrire mot par mot** comme si un médecin tapait en direct.

### Implémentation

#### Backend : `backend/app/api/v1/endpoints/stream.py`

Nouveau endpoint pour générer le rapport en streaming :

```python
"""
Streaming endpoint for real-time report generation.
Uses Server-Sent Events (SSE) to stream LLM tokens to frontend.
"""

import json
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
from mistralai import Mistral

from app.config import get_settings

router = APIRouter()


@router.post("/stream-report")
async def stream_report_generation(request: Request):
    """
    Generate medical report with real-time streaming.
    
    Request body:
        {
            "text": "transcription corrigée",
            "mode": "conversation" | "scribe",
            "exam_type": "Radio Pulmonaire",
            "context": "Patient de 45 ans..." (optionnel)
        }
    
    Response: Server-Sent Events stream
        data: {"token": "Mot"}
        data: {"token": " suivant"}
        ...
        data: {"done": true}
    
    Frontend example:
        const eventSource = new EventSource('/api/v1/stream-report');
        eventSource.onmessage = (e) => {
            const data = JSON.parse(e.data);
            if (data.token) appendToReport(data.token);
            if (data.done) eventSource.close();
        };
    """
    body = await request.json()
    text = body.get("text", "")
    mode = body.get("mode", "scribe")
    exam_type = body.get("exam_type", "")
    context = body.get("context", "")
    
    if not text.strip():
        raise HTTPException(status_code=400, detail="No text provided")
    
    async def generate():
        """Generator function for SSE streaming."""
        settings = get_settings()
        client = Mistral(api_key=settings.MISTRAL_API_KEY)
        
        # Build system prompt based on mode
        if mode == "conversation":
            system_prompt = """Tu es un assistant clinique expert. Génère un rapport SOAP structuré en français.

SECTIONS OBLIGATOIRES :
1. INFORMATIONS PATIENT
2. MOTIF DE CONSULTATION
3. HISTOIRE DE LA MALADIE ACTUELLE (HMA)
4. ANTÉCÉDENTS
5. EXAMEN CLINIQUE / CONSTATS
6. ÉVALUATION / DIAGNOSTIC
7. PLAN THÉRAPEUTIQUE
8. SUIVI

Règles :
- Conserver tous les chiffres, doses, fréquences
- Ne rien inventer : si info manque, écrire "Non mentionné"
- Rester factuel et professionnel"""
        else:
            system_prompt = f"""Tu es un radiologue expert. Génère un compte rendu structuré pour : {exam_type}.

Sections : INDICATION CLINIQUE, TECHNIQUE, OBSERVATIONS, SYNTHÈSE DIAGNOSTIQUE, RECOMMANDATIONS.

Ne rien inventer. Rester factuel."""
        
        user_prompt = f"Transcription :\n\n{text}"
        if context:
            user_prompt += f"\n\nContexte clinique :\n{context}"
        
        try:
            # Stream response token by token via Mistral API
            stream = client.chat.stream(
                model=settings.LLM_MODEL_ID,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.2,
                max_tokens=2048,
            )
            
            for chunk in stream:
                if chunk.data.choices and chunk.data.choices[0].delta.content:
                    token = chunk.data.choices[0].delta.content
                    yield f"data: {json.dumps({'token': token})}\n\n"
            
            # Signal completion
            yield f"data: {json.dumps({'done': True})}\n\n"
        
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")
```

#### Backend : `backend/app/api/v1/router.py`

Enregistrer la nouvelle route :

```python
from app.api.v1.endpoints import audio, transcribe, process, report, sessions, stream

# ...existing routes...
api_router.include_router(stream.router, tags=["stream"])
```

#### Frontend : `frontend/services/streamService.ts`

Service client pour consommer le stream SSE :

```typescript
/**
 * Stream report generation via Server-Sent Events.
 * Receives tokens in real-time as Mistral generates the report.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface StreamReportOptions {
  text: string;
  mode: 'conversation' | 'scribe';
  examType: string;
  context?: string;
}

export async function streamReport(
  options: StreamReportOptions,
  onToken: (token: string) => void,
  onDone: () => void,
  onError: (error: string) => void
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/stream-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: options.text,
        mode: options.mode,
        exam_type: options.examType,
        context: options.context || '',
      }),
    });

    if (!response.ok) {
      throw new Error(`Stream request failed: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body reader');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            if (data.token) {
              onToken(data.token);
            }
            
            if (data.done) {
              onDone();
              return;
            }
            
            if (data.error) {
              onError(data.error);
              return;
            }
          } catch (e) {
            console.warn('Failed to parse SSE data:', line);
          }
        }
      }
    }

    onDone();
  } catch (error: any) {
    onError(error.message || 'Stream error');
  }
}
```

#### Frontend : `frontend/components/NewReport.tsx`

Intégrer le streaming dans le workflow :

```typescript
import { streamReport } from '../services/streamService';

// Dans le composant NewReport :
const [streamedReport, setStreamedReport] = useState('');

const processTranscription = async () => {
  // ...upload + ASR existant...
  
  // Après ASR :
  setPipelineStep('processing');
  const processRes = await runFullPipeline(sid);
  
  // Au lieu de generateReport(), utiliser le streaming :
  setPipelineStep('generating');
  setStreamedReport(''); // Reset
  
  await streamReport(
    {
      text: processRes.result,
      mode: docSource === 'consultation' ? 'conversation' : 'scribe',
      examType: examType,
    },
    (token) => {
      // Append token en temps réel
      setStreamedReport(prev => prev + token);
    },
    () => {
      // Terminé
      setPipelineStep('done');
      setState('completed');
      
      // Parse le rapport streamé
      if (docSource === 'consultation') {
        // Parser le texte en SOAP structure si besoin
        setReport({ findings: streamedReport, ... });
      } else {
        setDocumentation({ transcription: streamedReport });
      }
    },
    (error) => {
      setPipelineError(error);
      setState('idle');
    }
  );
};

// Dans le rendu, afficher streamedReport pendant la génération :
{pipelineStep === 'generating' && streamedReport && (
  <div className="bg-white p-4 rounded border">
    <h3 className="font-semibold mb-2">Rapport en cours de génération...</h3>
    <p className="whitespace-pre-wrap">{streamedReport}</p>
  </div>
)}
```

### Gain attendu

| Métrique | Avant | Après streaming |
|----------|-------|----------------|
| **Temps réel** | 6-10s (LLM) | 6-10s (identique) |
| **Temps perçu** | 10s d'écran vide | **~2s** avant premiers mots |
| **Engagement** | ⚠️ Utilisateur fixe écran vide | ✅ Utilisateur voit le rapport s'écrire |
| **Satisfaction** | Frustrant | "Magique" |

**Gain psychologique : ~80%** — L'utilisateur ne perçoit plus d'attente.

---

## 📈 Résultat final (combinant les 2 axes)

### Avant optimisations

```
Mode Upload (audio 2min) :
┌─────────────────────────────────────────────────────────────────┐
│ Upload 2s → ASR 10s → LLM 8s = 20s                              │
│ UX : Écran vide pendant 20s                                      │
└─────────────────────────────────────────────────────────────────┘
```

### Après optimisations

```
Mode Upload (audio 2min) :
┌─────────────────────────────────────────────────────────────────┐
│ Upload 2s → ASR parallèle 3s → LLM streaming 6s = 11s           │
│ UX : Texte ASR visible à t+5s, rapport s'écrit à t+8s           │
│ Temps perçu : ~8s au lieu de 20s (-60%)                         │
└─────────────────────────────────────────────────────────────────┘
```

### Comparaison avec rédaction manuelle

| Scénario | Médecin manuel | App (avant) | App (après) | Verdict |
|----------|----------------|-------------|-------------|---------|
| Consultation 5min | ~3-5min | ~25s (5× plus lent) | **~12s** | ✅ **2× plus rapide** |
| Dictée 2min | ~8-10min | ~20s (25× plus rapide) | **~10s** | ✅ **50× plus rapide** |

**Objectif atteint** : L'application devient **significativement plus rapide** qu'un médecin, avec une UX fluide.

---

## 🛠️ Checklist d'implémentation

### Étape 1 : Chunking parallèle (ASR)
- [ ] Ajouter `split_audio_chunks()` dans `asr_service.py`
- [ ] Ajouter `transcribe_chunks_parallel()` dans `asr_service.py`
- [ ] Modifier `transcribe.py` endpoint pour détecter durée et utiliser chunking si >60s
- [ ] Ajouter `librosa` aux dépendances si pas déjà présent
- [ ] Tester avec audio 2min et 5min
- [ ] Mesurer gain de performance réel

### Étape 2 : Streaming du rapport (LLM)
- [ ] Créer `backend/app/api/v1/endpoints/stream.py`
- [ ] Implémenter endpoint `/stream-report` avec SSE
- [ ] Enregistrer route dans `router.py`
- [ ] Créer `frontend/services/streamService.ts`
- [ ] Intégrer `streamReport()` dans `NewReport.tsx`
- [ ] Gérer état `streamedReport` dans UI
- [ ] Afficher rapport en cours de génération
- [ ] Tester avec différents types de rapports

### Étape 3 : Tests & validation
- [ ] Tester mode Upload avec fichiers courts (<1min)
- [ ] Tester mode Upload avec fichiers longs (2-5min)
- [ ] Tester mode Direct (enregistrement)
- [ ] Vérifier qualité des rapports streamés
- [ ] Mesurer gains de performance réels
- [ ] Valider UX avec utilisateurs

---

## 📝 Notes techniques

### Dépendances supplémentaires

```bash
# Backend (si pas déjà installé)
pip install librosa  # Pour get_duration()
```

### Configuration Mistral

Le streaming nécessite que la clé API Mistral ait accès à `chat.stream()`. Vérifier avec :

```python
from mistralai import Mistral
client = Mistral(api_key="...")
stream = client.chat.stream(model="mistral-large-latest", messages=[...])
```

### Limites connues

1. **Chunking parallèle** :
   - Gain maximal avec 4 workers (CPU-bound Whisper)
   - Overlap de 5s entre chunks pour éviter coupures de mots
   - Pas de gain sur fichiers <1min

2. **Streaming SSE** :
   - Nécessite connexion HTTP/1.1 ou HTTP/2
   - Proxy nginx/apache doivent désactiver buffering (`X-Accel-Buffering: no`)
   - Timeout client à configurer (>60s si rapport long)

---

## 🎯 Prochaines étapes (Phase 2)

Après validation des 2 axes ci-dessus :

1. **WebSocket pour transcription temps réel** (mode Direct)
   - Transcrire pendant l'enregistrement
   - Gain : 10-15s + texte visible en live

2. **Cache LLM intelligent**
   - Mémoriser les traitements CoT pour transcriptions similaires
   - Gain : 30-50% sur sessions répétées

3. **Compression audio côté frontend**
   - Réduire taille upload de 50-70%
   - Gain : 1-2s sur upload réseau

---

**Date de création** : 17 février 2026  
**Version** : 1.0  
**Priorité** : 🔥 Haute (impact majeur sur UX)
