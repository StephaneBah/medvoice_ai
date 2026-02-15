"""
ASR Service - Automatic Speech Recognition for medical audio transcription.
Uses configurable ASR model (fine-tuned for French medical speech).
Model can be changed via ASR_MODEL_ID in configuration.
"""

import os
from typing import Optional, Tuple, Any, Union

import torch
from transformers import (
    pipeline,
    WhisperProcessor,
    WhisperForConditionalGeneration,
    GenerationConfig,
)

from app.config import get_settings

# Type hint for numpy (optional import)
try:
    import numpy as np
except ImportError:
    np = None  # type: ignore


# Lazy singleton for ASR pipeline
_asr_pipeline = None


def device_and_dtype() -> Tuple[str, torch.dtype]:
    """Determine compute device and dtype."""
    if torch.cuda.is_available():
        return ("cuda", torch.float16)
    return ("cpu", torch.float32)


def load_asr():
    """
    Load and return the ASR pipeline (lazy singleton).
    Ported from app.py lines 85-136.
    """
    global _asr_pipeline
    if _asr_pipeline is not None:
        return _asr_pipeline

    settings = get_settings()
    device, dtype = device_and_dtype()
    
    print(f"🔊 Loading ASR model: {settings.ASR_MODEL_ID}")
    print(f"   Device: {device}, Dtype: {dtype}")

    # Load model with revision
    if settings.ASR_MODEL_REVISION:
        model = WhisperForConditionalGeneration.from_pretrained(
            settings.ASR_MODEL_ID,
            revision=settings.ASR_MODEL_REVISION,
            torch_dtype=dtype,
        )
    else:
        model = WhisperForConditionalGeneration.from_pretrained(
            settings.ASR_MODEL_ID,
            torch_dtype=dtype,
        )

    # Load generation config from base model
    try:
        model.generation_config = GenerationConfig.from_pretrained("openai/whisper-small")
    except Exception:
        pass  # Fallback if fails

    # Clear forced_decoder_ids to avoid conflicts
    model.generation_config.forced_decoder_ids = None

    # Load processor from base model
    processor = WhisperProcessor.from_pretrained("openai/whisper-small")

    if device == "cuda":
        model = model.to("cuda")
        model.eval()

    # Create pipeline
    _asr_pipeline = pipeline(
        "automatic-speech-recognition",
        model=model,
        tokenizer=processor.tokenizer,
        feature_extractor=processor.feature_extractor,
        device=0 if device == "cuda" else -1,
        return_timestamps=True,
        chunk_length_s=30,
        stride_length_s=(5, 2),
        batch_size=8,
        generate_kwargs={"task": "transcribe", "language": settings.ASR_LANGUAGE}
    )
    
    print("✅ ASR model loaded successfully")
    return _asr_pipeline


def sanitize_transcript(text: str) -> str:
    """
    Remove artifacts and normalize the transcript.
    Ported from app.py lines 181-192.
    """
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


def transcribe(audio_input: Union[str, dict, Any]) -> str:
    """
    Transcribe audio file or numpy array.
    Ported from app.py lines 195-208.
    
    Args:
        audio_input: Either a file path (str) or dict with 'raw' and 'sampling_rate'
    
    Returns:
        Transcribed and sanitized text
    """
    asr = load_asr()
    
    # Handle different input types
    if isinstance(audio_input, str):
        # File path
        result = asr(audio_input)
    elif isinstance(audio_input, dict) and "raw" in audio_input:
        # Numpy array with sampling rate
        result = asr(audio_input)
    else:
        # Assume it's already in correct format
        result = asr(audio_input)
    
    if isinstance(result, dict) and "text" in result:
        text_value = result.get("text", "")
        return sanitize_transcript(str(text_value).strip())
    
    return sanitize_transcript(str(result))


def transcribe_file(file_path: str) -> Tuple[str, float]:
    """
    Transcribe an audio file and return text with processing time.
    
    Args:
        file_path: Path to audio file
    
    Returns:
        Tuple of (transcribed_text, processing_time_seconds)
    """
    import time
    
    start = time.time()
    text = transcribe(file_path)
    duration = time.time() - start
    
    return text, duration
