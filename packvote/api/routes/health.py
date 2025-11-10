"""Health check endpoints."""

from datetime import datetime, timezone

from fastapi import APIRouter

from ...config import get_settings


router = APIRouter()


@router.get("/healthz")
async def healthcheck() -> dict:
    settings = get_settings()
    return {
        "status": "ok",
        "app": settings.app_name,
        "environment": settings.environment,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

