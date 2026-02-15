"""
Audio Utilities - File handling and audio preprocessing.
"""

import os
import uuid
from pathlib import Path
from typing import Optional, Tuple

from app.config import get_settings


def get_upload_path(filename: str, session_id: str) -> Path:
    """
    Generate a unique path for uploaded audio file.
    
    Args:
        filename: Original filename
        session_id: Session UUID
    
    Returns:
        Path object for the file
    """
    settings = get_settings()
    
    # Get extension from original filename
    ext = Path(filename).suffix.lower() or ".wav"
    
    # Create unique filename with session ID
    unique_filename = f"{session_id}{ext}"
    
    return settings.UPLOAD_DIR / unique_filename


async def save_upload_file(file, session_id: str) -> Tuple[str, Path]:
    """
    Save an uploaded file to disk.
    
    Args:
        file: UploadFile from FastAPI
        session_id: Session UUID
    
    Returns:
        Tuple of (original_filename, saved_path)
    """
    original_filename = file.filename or "audio.wav"
    save_path = get_upload_path(original_filename, session_id)
    
    # Ensure directory exists
    save_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Write file
    content = await file.read()
    with open(save_path, "wb") as f:
        f.write(content)
    
    return original_filename, save_path


def delete_audio_file(session_id: str) -> bool:
    """
    Delete audio file for a session.
    
    Args:
        session_id: Session UUID
    
    Returns:
        True if deleted, False if not found
    """
    settings = get_settings()
    
    # Try common extensions
    for ext in [".wav", ".mp3", ".m4a", ".ogg", ".webm"]:
        path = settings.UPLOAD_DIR / f"{session_id}{ext}"
        if path.exists():
            path.unlink()
            return True
    
    return False


def get_audio_path(session_id: str) -> Optional[Path]:
    """
    Find the audio file path for a session.
    
    Args:
        session_id: Session UUID
    
    Returns:
        Path if found, None otherwise
    """
    settings = get_settings()
    
    for ext in [".wav", ".mp3", ".m4a", ".ogg", ".webm"]:
        path = settings.UPLOAD_DIR / f"{session_id}{ext}"
        if path.exists():
            return path
    
    return None


def get_audio_duration(file_path: Path) -> Optional[float]:
    """
    Get audio duration in seconds.
    Requires pydub or similar library.
    
    Args:
        file_path: Path to audio file
    
    Returns:
        Duration in seconds, or None if can't determine
    """
    try:
        from pydub import AudioSegment
        audio = AudioSegment.from_file(str(file_path))
        return len(audio) / 1000.0  # Convert ms to seconds
    except ImportError:
        # pydub not installed, try wave for .wav files
        try:
            import wave
            if file_path.suffix.lower() == ".wav":
                with wave.open(str(file_path), 'rb') as f:
                    frames = f.getnframes()
                    rate = f.getframerate()
                    return frames / float(rate)
        except Exception:
            pass
    except Exception:
        pass
    
    return None
