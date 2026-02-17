"""
LLM Service - Large Language Model API for text processing.
Provides CoT processing (punctuation, diarization, correction) and report generation.
Model can be changed via LLM_MODEL_ID in configuration.
"""

import os
import json
import time
from typing import Optional, Dict, Any, Type, TypeVar

from mistralai import Mistral
from pydantic import BaseModel

from app.config import get_settings
from app.schemas.report import MedicalReportContent, DocumentationContent


# Lazy singleton for Mistral client
_mistral_client: Optional[Mistral] = None


def load_mistral() -> Mistral:
    """
    Load and return the Mistral client (lazy singleton).
    Ported from app.py lines 70-78.
    """
    global _mistral_client
    if _mistral_client is not None:
        return _mistral_client
    
    settings = get_settings()
    api_key = settings.MISTRAL_API_KEY
    if not api_key:
        raise RuntimeError("MISTRAL_API_KEY manquant dans les variables d'environnement.")
    
    _mistral_client = Mistral(api_key=api_key)
    print("✅ Mistral client initialized")
    return _mistral_client


def _call_mistral(
    prompt: str,
    max_tokens: int = 1024,
    temperature: float = 0.3,
    _retries: int = 3,
) -> str:
    """Helper to call Mistral API with retry on transient network errors."""
    client = load_mistral()
    settings = get_settings()
    
    last_err: Exception | None = None
    for attempt in range(_retries):
        try:
            res = client.chat.complete(
                model=settings.LLM_MODEL_ID,
                messages=[{"role": "user", "content": prompt}],
                temperature=temperature,
                max_tokens=max_tokens,
                top_p=0.9,
                stream=False,
                response_format={"type": "text"},
            )
            if getattr(res, "choices", None):
                return res.choices[0].message.content.strip()
            return ""
        except (OSError, ConnectionError) as e:
            last_err = e
            wait = 2 ** attempt  # 1s, 2s, 4s
            print(f"⚠️ Mistral API network error (attempt {attempt+1}/{_retries}): {e}. Retrying in {wait}s...")
            time.sleep(wait)
    raise RuntimeError(f"Mistral API unreachable after {_retries} retries: {last_err}")


T = TypeVar("T", bound=BaseModel)


def _call_mistral_structured(
    prompt: str,
    response_model: Type[T],
    max_tokens: int = 1024,
    temperature: float = 0.2,
    _retries: int = 3,
) -> Optional[T]:
    """Call Mistral and validate JSON output with a Pydantic model (with retry)."""
    client = load_mistral()
    settings = get_settings()

    # First try JSON object mode + local Pydantic validation (stable across SDK versions)
    last_err: Exception | None = None
    for attempt in range(_retries):
        try:
            res = client.chat.complete(
                model=settings.LLM_MODEL_ID,
                messages=[{"role": "user", "content": prompt}],
                temperature=temperature,
                max_tokens=max_tokens,
                top_p=0.9,
                stream=False,
                response_format={"type": "json_object"},
            )
            if getattr(res, "choices", None):
                content = res.choices[0].message.content
                if content:
                    return response_model.model_validate_json(content)
            break  # API responded but no valid content — don't retry
        except (OSError, ConnectionError) as e:
            last_err = e
            wait = 2 ** attempt
            print(f"⚠️ Mistral structured call network error (attempt {attempt+1}/{_retries}): {e}. Retrying in {wait}s...")
            time.sleep(wait)
        except Exception:
            break  # non-network error — fall through to text fallback

    # Fallback to text response + manual extraction
    try:
        raw = _call_mistral(prompt, max_tokens=max_tokens, temperature=temperature)
        parsed = _extract_json_object(raw)
        if parsed is not None:
            return response_model.model_validate(parsed)
    except Exception:
        pass

    return None


def _clean_llm_response(text: str) -> str:
    """
    Remove common conversational artifacts from LLM response.
    """
    if not text:
        return ""
    
    # 1. Remove surrounding quotes
    if (text.startswith('"') and text.endswith('"')) or (text.startswith("'") and text.endswith("'")):
        text = text[1:-1].strip()
        
    # 2. Remove Prefix/Suffix sections
    import re
    # Remove "Here is..." or "Voici..." prefixes
    text = re.sub(r'^(Here is|Here are|Voici|La correction|The corrected|Corrected text|Résultat|Output).*?:\s*', '', text, flags=re.IGNORECASE | re.DOTALL)
    
    # Remove "### Explanation", "Explication:", "Note:" suffixes
    text = re.sub(r'\n\s*(###|Note|Explication).*', '', text, flags=re.IGNORECASE | re.DOTALL)
    
    return text.strip()


def _extract_json_object(text: str) -> Optional[Dict[str, Any]]:
    """Extract first JSON object candidate from text and parse it."""
    if not text or not text.strip():
        return None

    cleaned = text.strip()
    # Remove markdown code fences anywhere in the string
    import re
    cleaned = re.sub(r'```(?:json)?', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'```', '', cleaned, flags=re.IGNORECASE)
    cleaned = cleaned.strip()

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None

    candidate = cleaned[start:end + 1]
    try:
        parsed = json.loads(candidate)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        # Try to fix common JSON errors (newline in strings)
        try:
            candidate_fixed = candidate.replace('\n', '\\n')
            parsed = json.loads(candidate_fixed)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass
    return None


def _flatten_to_text(value: Any) -> str:
    """Convert any nested dict/list to readable plain text."""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        return "\n".join(f"- {_flatten_to_text(item)}" for item in value)
    if isinstance(value, dict):
        parts = []
        for key, val in value.items():
            inner = _flatten_to_text(val)
            if "\n" in inner:
                parts.append(f"{key} :\n{inner}")
            else:
                parts.append(f"{key} : {inner}")
        return "\n".join(parts)
    return str(value).strip()


def _normalize_soap_payload(payload: Optional[Dict[str, Any]], fallback_text: str = "") -> Dict[str, str]:
    """Ensure SOAP payload always has the 4 expected string fields (always flat text)."""
    base = {
        "clinicalIndication": "",
        "findings": "",
        "impression": "",
        "recommendations": "",
    }

    if not isinstance(payload, dict):
        base["findings"] = fallback_text or ""
        return base

    # If model nested SOAP keys inside findings, unwrap first.
    if isinstance(payload.get("findings"), dict):
        nested = payload["findings"]
        if any(k in nested for k in ["clinicalIndication", "findings", "impression", "recommendations"]):
            return _normalize_soap_payload(nested, fallback_text=fallback_text)

    normalized = {
        "clinicalIndication": _flatten_to_text(payload.get("clinicalIndication") or ""),
        "findings": _flatten_to_text(payload.get("findings") or ""),
        "impression": _flatten_to_text(payload.get("impression") or ""),
        "recommendations": _flatten_to_text(payload.get("recommendations") or ""),
    }

    if not normalized["findings"] and fallback_text:
        normalized["findings"] = fallback_text

    return normalized


# ============================================================================
# Chain-of-Thought Processing Functions
# ============================================================================

def punctuate(text: str, exam_type: str = "") -> str:
    """
    CoT Step 1: Add punctuation to raw transcription.
    Based on PUNCTUATION_PROMPT from Cahier_Charge.md.
    """
    if not text or not text.strip():
        return text

    # Check if this is a simple transcription request
    if exam_type and "simple" in exam_type.lower():
        prompt = f'''Tu es un expert en ponctuation de texte.

Tâche : Ajoute la ponctuation appropriée au texte suivant. Le texte manque de ponctuation mais doit être structuré avec points, virgules, deux-points et majuscules appropriées.

Règles :
- Respecte le texte exact (ne change AUCUN terme)
- Ajoute uniquement : . , : ; ! ? et majuscules
- Structure en phrases cohérentes
- Retourne uniquement le texte ponctué, sans explication.

Texte brut :
{text.strip()}

Texte ponctué :'''
        raw_result = _call_mistral(prompt, max_tokens=len(text) * 2, temperature=0.1)
        return _clean_llm_response(raw_result)
    
    prompt = f"""Tu es un expert en ponctuation de textes médicaux français.

Tâche : Ajoute la ponctuation appropriée au texte suivant, qui est une transcription vocale médicale. Le texte manque de ponctuation mais doit être structuré avec points, virgules, deux-points et majuscules appropriées.

Règles :
- Respecte le vocabulaire médical exact (ne change AUCUN terme)
- Ajoute uniquement : . , : ; ! ? et majuscules
- Préserve tous les nombres et unités
- Structure en phrases cohérentes

Texte brut :
{text.strip()}

Texte ponctué :"""

    return _clean_llm_response(
        _call_mistral(prompt, max_tokens=len(text) * 2, temperature=0.2)
    )


def diarize(text: str) -> str:
    """
    CoT Step 2: Identify and separate speakers (doctor/patient dialogue).
    Based on DIARIZATION_PROMPT from Cahier_Charge.md.
    """
    if not text or not text.strip():
        return text
    
    prompt = f"""Tu es un expert en analyse de dialogues médicaux.

Tâche : Détecte s'il y a plusieurs locuteurs dans ce texte et sépare leurs interventions. Si un seul locuteur, retourne le texte tel quel.

Contexte : Transcription consultation médicale (médecin et/ou patient)

Texte :
{text.strip()}

Formate le résultat ainsi (si dialogue détecté) :
[Médecin] : ...
[Patient] : ...

Si un seul locuteur, retourne simplement le texte ponctué.

Résultat :"""

    return _call_mistral(prompt, max_tokens=len(text) * 2, temperature=0.3)


def correct(text: str, exam_type: str = "") -> str:
    """
    CoT Step 3: Correct ASR errors while preserving medical meaning.
    Based on CORRECTION_PROMPT from Cahier_Charge.md.
    """
    if not text or not text.strip():
        return text

    # Check if this is a simple transcription request
    if exam_type and "simple" in exam_type.lower():
        prompt = f'''Tu es un assistant de transcription expert.

Tâche : Corrige uniquement la ponctuation et l'orthographe de ce texte.
Règles :
- NE PAS reformuler le contenu
- NE PAS ajouter de jargon médical
- NE PAS changer le sens
- Retourne uniquement le texte corrigé, SANS guillemets d'ouverture ou de fermeture, SANS texte introductif "Voici le texte corrigé :".

Texte :
{text.strip()}

Texte corrigé :'''
        # Lower temperature for strict transcription
        raw_result = _call_mistral(prompt, max_tokens=len(text) * 2, temperature=0.1)
        return _clean_llm_response(raw_result)
    
    prompt = f"""Tu es un radiologue expert francophone.

Tâche : Corrige les erreurs potentielles dans cette transcription automatique médicale.

Texte :
{text.strip()}

Erreurs à vérifier :
- Confusion phonétique (ex: "plairal" → "pleural")
- Nombres et unités (ex: "2cm" → "2 cm")
- Acronymes (ex: "TDM", "IRM")

IMPORTANT :
- Retourne UNIQUEMENT le texte corrigé.
- Commence ta réponse immédiatement avec le texte corrigé. Ne pas ajouter de phrases d'introduction ou de conclusion comme "Voici le texte corrigé".
- PAS de guillemets.
- PRÉSERVE le sens médical original.

Texte corrigé :"""

    return _clean_llm_response(
        _call_mistral(prompt, max_tokens=len(text) * 2, temperature=0.15)
    )


# ============================================================================
# Fused CoT Processing (optimized single-call pipeline)
# ============================================================================

def process_transcription(text: str, session_type: str = "conversation", exam_type: str = "") -> str:
    """
    Fused CoT pipeline: punctuate + (diarize if conversation) + correct in ONE LLM call.
    Replaces 2-3 sequential calls with a single call for the full-pipeline endpoint.
    
    - session_type == "conversation" : punctuate + diarize + correct
    - session_type == "scribe"       : punctuate + correct (NO diarization)
    
    Individual punctuate(), diarize(), correct() functions are kept for backward compatibility.
    """
    if not text or not text.strip():
        return text

    is_simple = exam_type and "simple" in exam_type.lower()
    is_conversation = session_type == "conversation"

    if is_conversation:
        # ── Conversation mode: punctuate + diarize + correct ──
        if is_simple:
            prompt = f"""Tu es un expert en traitement de transcriptions de dialogues.

Tâche : Traite cette transcription brute en effectuant les 3 opérations suivantes EN UNE SEULE PASSE :

1. PONCTUATION : Ajoute la ponctuation appropriée (. , : ; ! ? et majuscules)
2. DIARISATION : Identifie les locuteurs et sépare leurs interventions avec les marqueurs [Médecin] et [Patient]
3. CORRECTION : Corrige les erreurs d'orthographe et de transcription

Règles :
- NE PAS reformuler le contenu
- NE PAS changer le sens
- Retourne UNIQUEMENT le texte traité, sans explication ni introduction

Transcription brute :
{text.strip()}

Texte traité :"""
        else:
            prompt = f"""Tu es un radiologue expert francophone spécialisé dans l'analyse de dialogues médicaux.

Tâche : Traite cette transcription automatique brute d'une consultation médicale en effectuant les 3 opérations suivantes EN UNE SEULE PASSE :

1. PONCTUATION : Ajoute la ponctuation appropriée (. , : ; ! ? et majuscules)
2. DIARISATION : Identifie et sépare les interventions du médecin et du patient avec [Médecin] et [Patient]
3. CORRECTION MÉDICALE : Corrige les erreurs ASR (confusions phonétiques comme "plairal" → "pleural", nombres et unités comme "2cm" → "2 cm", acronymes comme "TDM", "IRM")

Règles :
- Préserve le vocabulaire médical exact
- Préserve le sens médical original
- Ne rien inventer
- Retourne UNIQUEMENT le texte traité, sans explication ni phrase d'introduction

Transcription brute :
{text.strip()}

Texte traité :"""
    else:
        # ── Documentation/Scribe mode: punctuate + correct (NO diarization) ──
        if is_simple:
            prompt = f"""Tu es un expert en traitement de transcriptions.

Tâche : Traite cette transcription brute en effectuant les 2 opérations suivantes EN UNE SEULE PASSE :

1. PONCTUATION : Ajoute la ponctuation appropriée (. , : ; ! ? et majuscules)
2. CORRECTION : Corrige les erreurs d'orthographe et de transcription

Règles :
- NE PAS reformuler le contenu
- NE PAS ajouter de sections ou de formatage
- NE PAS faire de diarisation (c'est une dictée mono-locuteur)
- Retourne UNIQUEMENT le texte traité, sans explication ni introduction

Transcription brute :
{text.strip()}

Texte traité :"""
        else:
            prompt = f"""Tu es un radiologue expert francophone spécialisé en transcription médicale.

Tâche : Traite cette transcription automatique brute d'une dictée médicale en effectuant les 2 opérations suivantes EN UNE SEULE PASSE :

1. PONCTUATION : Ajoute la ponctuation appropriée (. , : ; ! ? et majuscules)
2. CORRECTION MÉDICALE : Corrige les erreurs ASR (confusions phonétiques, termes médicaux, nombres et unités, acronymes)

Règles :
- NE PAS reformuler le contenu
- NE PAS ajouter de sections ou de formatage
- NE PAS faire de diarisation (c'est une dictée mono-locuteur)
- Préserve le sens médical original
- Ne rien inventer
- Retourne UNIQUEMENT le texte traité, sans explication ni phrase d'introduction

Transcription brute :
{text.strip()}

Texte traité :"""

    return _clean_llm_response(
        _call_mistral(prompt, max_tokens=len(text) * 3, temperature=0.2)
    )


# ============================================================================
# Report Generation Functions
# ============================================================================

def generate_soap_report(
    transcript: str,
    context: str = "",
    exam_type: str = "",
) -> Dict[str, str]:
    """
    Generate a structured SOAP report from a conversation transcript.
    For 'conversation' mode.
    Returns dict matching MedicalReportContent schema.
    """
    if not transcript or not transcript.strip():
        return {
            "clinicalIndication": "",
            "findings": "",
            "impression": "",
            "recommendations": ""
        }
    
    context_line = f"Contexte clinique : {context}\n" if context else ""
    exam_line = f"Type d'examen : {exam_type}\n" if exam_type else ""

    prompt = f"""Tu es un assistant médical expert chargé de rédiger un compte rendu structuré à partir d'une conversation médecin-patient.

{context_line}{exam_line}
Transcription de la consultation :
\"\"\"{transcript.strip()}\"\"\"

CONSIGNES STRICTES :
1. ANALYSE la conversation ci-dessus et EXTRAIS les faits médicaux pertinents.
2. NE COPIE PAS la transcription mot pour mot. Rédige des phrases synthétiques et structurées en langage médical.
3. Génère un JSON avec exactement ces 4 champs :

- "clinicalIndication" : Le motif de consultation et le contexte clinique (ex: "Douleur abdominale aiguë épigastrique évoluant depuis 24h").
- "findings" : UNE SEULE CHAÎNE DE TEXTE (string) contenant les observations médicales. JAMAIS un objet JSON imbriqué ni un tableau. Rédige un texte continu structuré par paragraphes :
  Anamnèse : ... (début, circonstances, caractéristiques, facteurs, signes associés, antécédents)
  Examen clinique : ... (si mentionné)
  Résultats paracliniques : ... (si mentionnés)
  PAS de copie verbatim du dialogue. PAS de sous-objets JSON.
- "impression" : UNE SEULE CHAÎNE DE TEXTE (string). La conclusion ou hypothèse diagnostique. Si le médecin n'a pas formulé de conclusion explicite, propose une brève hypothèse en ajoutant "(suggestion IA)" à la fin.
- "recommendations" : UNE SEULE CHAÎNE DE TEXTE (string). Si plusieurs recommandations, sépare-les par des points. JAMAIS un tableau JSON []. Si le médecin n'a pas donné de recommandations explicites, propose 1-2 recommandations brèves en ajoutant "(suggestion IA)" à la fin de chaque.

EXEMPLE de sortie attendue (ne pas recopier, adapter au contenu réel) :
{{
  "clinicalIndication": "Douleur abdominale aiguë épigastrique",
  "findings": "Patient de sexe masculin consultant pour douleur abdominale aiguë d'apparition brusque au réveil, sans facteur déclenchant identifié. Douleur de type crampe, cotée 5-6/10, d'emblée maximale, continue. Pas de facteur aggravant ni soulageant identifié. Pas de soulagement par paracétamol. Transit : arrêt des matières et des gaz depuis 24h, sans diarrhée ni constipation préalable. Pas de pyrosis, pas de rectorragie, pas de méléna, pas de faux besoins.",
  "impression": "Tableau évocateur d'un syndrome occlusif débutant à explorer (suggestion IA)",
  "recommendations": "Réaliser un ASP et/ou un scanner abdominal en urgence (suggestion IA). Bilan biologique avec NFS, CRP, ionogramme (suggestion IA)"
}}

Réponds UNIQUEMENT avec le JSON valide, sans texte avant/après.
NE PAS utiliser de markdown ni de blocs de code.
"""

    structured = _call_mistral_structured(
        prompt,
        MedicalReportContent,
        max_tokens=2048,
        temperature=0.2,
    )
    if structured is not None:
        return _normalize_soap_payload(structured.model_dump(), fallback_text=transcript)

    response = _call_mistral(prompt, max_tokens=2048, temperature=0.2)
    parsed = _extract_json_object(response)
    if parsed is not None:
        return _normalize_soap_payload(parsed, fallback_text=transcript)
    
    # Fallback: return raw text in findings
    return _normalize_soap_payload(
        {
            "clinicalIndication": context or "Non spécifié",
            "findings": response,
            "impression": "",
            "recommendations": "",
        },
        fallback_text=transcript,
    )


def generate_scribe_document(
    transcript: str,
    exam_type: str = "",
) -> Dict[str, Any]:
    """
        Generate a corrected documentation from dictation.
        For 'scribe' mode - returns ONLY cleaned transcription without extra formatting.
        Returns dict matching DocumentationContent schema:
            { transcription: str }
    """
    if not transcript or not transcript.strip():
        return {"transcription": ""}
    
    exam_line = f"Type de document : {exam_type}\n" if exam_type else ""
    
    prompt = f"""Tu es un assistant médical expert en transcription.

{exam_line}
Transcription brute de la dictée :
\"\"\"{transcript.strip()}\"\"\"

Tâche : Nettoie cette transcription médicale :
1. Ajoute la ponctuation appropriée (points, virgules, majuscules)
2. Corrige les erreurs d'orthographe des termes médicaux
3. Structure en paragraphes cohérents si nécessaire
4. Suggère un titre descriptif

IMPORTANT : 
- NE PAS utiliser de markdown (pas de **, pas de #, pas de listes à puces)
- NE PAS inventer de contenu
- NE PAS ajouter de sections artificielles
- Juste retourner le texte propre en texte brut

Réponds en JSON avec exactement ce champ :
- transcription: Le texte nettoyé (texte brut, sans markdown)

Exemple :
{
  "transcription": "Le patient présente... [texte propre en paragraphes]"
}

Réponds UNIQUEMENT avec le JSON, sans texte avant/après.
"""

    structured = _call_mistral_structured(
        prompt,
        DocumentationContent,
        max_tokens=1500,
        temperature=0.15,
    )
    if structured is not None:
        return structured.model_dump()

    response = _call_mistral(prompt, max_tokens=1500, temperature=0.15)
    parsed = _extract_json_object(response)
    if parsed is not None and "transcription" in parsed:
        return {
            "transcription": str(parsed.get("transcription") or "").strip()
        }

    return {"transcription": transcript}


# ============================================================================
# Legacy Functions (for compatibility with existing code)
# ============================================================================

def generate_clinical_report(
    transcript: str,
    notes: str = "",
    max_new_tokens: int = 768,
    temperature: float = 0.2,
) -> str:
    """
    Generate a clinical report (legacy format, returns string).
    Ported from app.py lines 254-332.
    """
    if not transcript or not transcript.strip():
        return "Aucune transcription fournie."

    directives = """Tu es un assistant clinique expert. À partir de la transcription brute d'une conversation entre un médecin et un patient, génère un rapport clinique structuré en français.

SECTIONS OBLIGATOIRES (format texte brut, pas de markdown):

1. INFORMATIONS PATIENT
2. MOTIF DE CONSULTATION
3. HISTOIRE DE LA MALADIE ACTUELLE (HMA)
4. ANTÉCÉDENTS
5. EXAMEN CLINIQUE / CONSTATS
6. ÉVALUATION / DIAGNOSTIC
7. PLAN THÉRAPEUTIQUE
8. SUIVI

RÈGLES:
- Conserver tous les chiffres, doses, fréquences mentionnés
- Ne rien inventer: si une information manque, écrire "Non mentionné"
- Rester factuel et professionnel"""

    if notes and notes.strip():
        directives += f"\n\nCONSIGNES ADDITIONNELLES: {notes.strip()}"

    prompt = f"Instruction:\n{directives}\n\nTRANSCRIPTION DE LA CONSULTATION:\n\"\"\"\n{transcript.strip()}\n\"\"\"\n\nRAPPORT CLINIQUE:"

    return _call_mistral(prompt, max_tokens=max_new_tokens, temperature=temperature)
