"""Reusable FastAPI dependencies."""

from __future__ import annotations

from functools import lru_cache

from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from ..db import get_session
from ..services.ai_gateway import ModelGateway
from ..services.messaging import MessagingService
from ..services.recommendations import RecommendationService


async def get_db_session() -> AsyncSession:
    async for session in get_session():
        yield session


@lru_cache(maxsize=1)
def _gateway() -> ModelGateway:
    return ModelGateway()


def get_model_gateway() -> ModelGateway:
    return _gateway()


@lru_cache(maxsize=1)
def _messaging_service() -> MessagingService:
    return MessagingService()


def get_messaging_service() -> MessagingService:
    return _messaging_service()


def get_recommendation_service(
    gateway: ModelGateway = Depends(get_model_gateway),
) -> RecommendationService:
    return RecommendationService(gateway)


