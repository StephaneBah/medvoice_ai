"""
MedVoice AI - FastAPI Backend
=============================
Main application entry point with lifespan management for model loading.
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.api.v1.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Lifespan context manager for startup/shutdown events.
    Models are loaded lazily on first request, not here.
    """
    settings = get_settings()
    print(f"🚀 MedVoice AI Backend starting...")
    print(f"   ASR Model: {settings.ASR_MODEL_ID}")
    print(f"   LLM Model: {settings.LLM_MODEL_ID}")
    print(f"   Database: {settings.DATABASE_URL}")
    print(f"   Upload Dir: {settings.UPLOAD_DIR}")
    
    yield
    
    print("🛑 MedVoice AI Backend shutting down...")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()
    
    app = FastAPI(
        title="MedVoice AI",
        description="API pour transcription médicale et génération de rapports",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )
    
    # CORS Middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Include API router
    app.include_router(api_router, prefix=settings.API_V1_PREFIX)
    
    # Health check endpoint
    @app.get("/health", tags=["Health"])
    async def health_check():
        return {"status": "ok", "service": "medvoice-ai"}
    
    return app


# Application instance
app = create_app()
