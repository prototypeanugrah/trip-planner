"""Aggregate API router for Pack Vote."""

from fastapi import APIRouter

from . import health, participants, recommendations, surveys, trips, votes, webhooks


api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(trips.router, prefix="/trips", tags=["trips"])
api_router.include_router(participants.router, prefix="/trips", tags=["participants"])
api_router.include_router(surveys.router, prefix="/trips", tags=["surveys"])
api_router.include_router(recommendations.router, prefix="/trips", tags=["recommendations"])
api_router.include_router(votes.router, prefix="/trips", tags=["votes"])
api_router.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])


