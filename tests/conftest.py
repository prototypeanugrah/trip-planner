from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
import pytest_asyncio
from asgi_lifespan import LifespanManager
from fastapi import FastAPI

from packvote.config import get_settings


@pytest.fixture(scope="session")
def event_loop() -> asyncio.AbstractEventLoop:
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture()
async def app(tmp_path: Path) -> AsyncIterator[FastAPI]:
    db_path = tmp_path / "test.db"
    os.environ["PACKVOTE_DATABASE_URL"] = f"sqlite+aiosqlite:///{db_path}"
    os.environ.setdefault("PACKVOTE_OPENAI_API_KEY", "")
    os.environ.setdefault("OPENAI_API_KEY", "")
    get_settings.cache_clear()  # type: ignore[attr-defined]
    from packvote import db as db_module
    db_module._engine = None  # type: ignore[attr-defined]
    from packvote.app import create_app

    test_app = create_app()
    async with LifespanManager(test_app):
        yield test_app
    os.environ.pop("PACKVOTE_DATABASE_URL", None)
    get_settings.cache_clear()  # type: ignore[attr-defined]


