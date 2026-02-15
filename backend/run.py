"""
MedVoice AI Backend - Entry Script
Run with: python run.py
"""

import sys
import os

# Add app to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

import uvicorn

from app.config import get_settings
from app.models.database import init_db


def main():
    """Start the FastAPI server."""
    settings = get_settings()
    
    # Initialize database
    print("📦 Initializing database...")
    init_db()
    
    # Run server
    print(f"🚀 Starting MedVoice AI Backend...")
    print(f"   Docs: http://localhost:8000/docs")
    print(f"   Health: http://localhost:8000/health")
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level="info" if settings.DEBUG else "warning"
    )


if __name__ == "__main__":
    main()
