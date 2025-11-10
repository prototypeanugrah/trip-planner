"""Database session management using SQLModel."""

from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlalchemy.orm import sessionmaker

from .config import get_settings


_engine: AsyncEngine | None = None


def get_engine() -> AsyncEngine:
    """Lazily create and return the async database engine."""

    global _engine
    if _engine is None:
        settings = get_settings()
        _engine = create_async_engine(
            str(settings.database_url),
            future=True,
            echo=settings.environment == "development",
        )
    return _engine


async def init_db() -> None:
    """Create database tables based on the SQLModel metadata."""

    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that provides an async session."""

    engine = get_engine()
    async_session = sessionmaker(
        engine,
        expire_on_commit=False,
        class_=AsyncSession,
    )
    async with async_session() as session:
        yield session


