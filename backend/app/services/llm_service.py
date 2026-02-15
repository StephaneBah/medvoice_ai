"""
LLM Service - Large Language Model API for text processing.
Provides CoT processing (punctuation, diarization, correction) and report generation.
Model can be changed via LLM_MODEL_ID in configuration.
"""

import os
from typing import Optional, Dict, Any

from mistralai import Mistral

from app.config import get_settings


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
) -> str:
    """Helper to call Mistral API."""
    client = load_mistral()
    settings = get_settings()
    
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


# ============================================================================
# Chain-of-Thought Processing Functions
# ============================================================================

def punctuate(text: str) -> str:
    """
    CoT Step 1: Add punctuation to raw transcription.
    Based on PUNCTUATION_PROMPT from Cahier_Charge.md.
    """
    if not text or not text.strip():
        return text
    
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

    return _call_mistral(prompt, max_tokens=len(text) * 2, temperature=0.2)


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


def correct(text: str) -> str:
    """
    CoT Step 3: Correct ASR errors while preserving medical meaning.
    Based on CORRECTION_PROMPT from Cahier_Charge.md.
    """
    if not text or not text.strip():
        return text
    
    prompt = f"""Tu es un radiologue expert francophone.

Tâche : Corrige les erreurs potentielles dans cette transcription automatique médicale, en tenant compte du jargon médical et des confusions phonétiques courantes.

Texte :
{text.strip()}

Erreurs courantes ASR à vérifier :
- Confusion phonétique : "plairal" → "pleural", "nodulère" → "nodulaire"
- Nombres mal transcrits : "2cm" → "2 cm"
- Acronymes : "TDM" vs "T D M", "IRM" vs "I R M"

Règles :
- Corrige uniquement les erreurs évidentes
- PRÉSERVE le sens médical original
- Ne rien inventer

Texte corrigé :"""

    return _call_mistral(prompt, max_tokens=len(text) * 2, temperature=0.15)


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
    
    prompt = f"""Tu es un radiologue expert rédigeant un compte rendu médical formel.

{context_line}{exam_line}
Transcription de la consultation :
\"\"\"{transcript.strip()}\"\"\"

Génère un rapport médical structuré en JSON avec exactement ces 4 champs :
- clinicalIndication: Contexte clinique et motif de l'examen
- findings: Observations détaillées de l'examen
- impression: Conclusion diagnostique
- recommendations: Recommandations et suivi

Réponds UNIQUEMENT avec le JSON, sans texte avant/après.
"""

    response = _call_mistral(prompt, max_tokens=1024, temperature=0.2)
    
    # Parse JSON response
    try:
        import json
        # Try to extract JSON from response
        if "{" in response:
            json_str = response[response.index("{"):response.rindex("}") + 1]
            return json.loads(json_str)
    except Exception:
        pass
    
    # Fallback: return raw text in findings
    return {
        "clinicalIndication": context or "Non spécifié",
        "findings": response,
        "impression": "",
        "recommendations": ""
    }


def generate_scribe_document(
    transcript: str,
    exam_type: str = "",
) -> Dict[str, str]:
    """
    Generate a corrected documentation from dictation.
    For 'scribe' mode.
    Returns dict matching DocumentationContent schema.
    """
    if not transcript or not transcript.strip():
        return {"title": "", "correctedText": ""}
    
    exam_line = f"Type de document : {exam_type}\n" if exam_type else ""
    
    prompt = f"""Tu es un assistant médical expert en transcription.

{exam_line}
Transcription brute de la dictée :
\"\"\"{transcript.strip()}\"\"\"

Tâche : Nettoie et structure cette transcription médicale :
1. Corrige la ponctuation et les fautes
2. Corrige les termes médicaux mal orthographiés
3. Structure le texte en paragraphes cohérents
4. Suggère un titre approprié

Réponds en JSON avec exactement ces 2 champs :
- title: Titre suggestif du document
- correctedText: Transcription corrigée et structurée (en Markdown)

Réponds UNIQUEMENT avec le JSON, sans texte avant/après.
"""

    response = _call_mistral(prompt, max_tokens=1500, temperature=0.2)
    
    # Parse JSON response
    try:
        import json
        if "{" in response:
            json_str = response[response.index("{"):response.rindex("}") + 1]
            return json.loads(json_str)
    except Exception:
        pass
    
    # Fallback
    return {
        "title": exam_type or "Document médical",
        "correctedText": transcript
    }


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
