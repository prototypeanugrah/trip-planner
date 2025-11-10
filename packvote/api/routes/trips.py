"""Trip management endpoints."""

from __future__ import annotations

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlmodel import col
from sqlmodel.ext.asyncio.session import AsyncSession

from ...enums import AuditEventType, TripStatus
from ...models import AuditLog, Trip
from ...schemas import TripCreate, TripRead, TripUpdate
from ..dependencies import get_db_session


router = APIRouter()


@router.post("", response_model=TripRead, status_code=status.HTTP_201_CREATED)
async def create_trip(
    payload: TripCreate,
    session: AsyncSession = Depends(get_db_session),
) -> Trip:
    trip = Trip(**payload.model_dump())
    session.add(trip)
    session.add(
        AuditLog(
            trip_id=trip.id,
            event_type=AuditEventType.trip_created,
            actor=trip.organizer_name,
            detail={"trip_name": trip.name},
        )
    )
    await session.commit()
    await session.refresh(trip)
    return trip


@router.get("", response_model=List[TripRead])
async def list_trips(session: AsyncSession = Depends(get_db_session)) -> List[Trip]:
    result = await session.exec(select(Trip).order_by(col(Trip.created_at).desc()))
    return result.all()


@router.get("/{trip_id}", response_model=TripRead)
async def get_trip(trip_id: UUID, session: AsyncSession = Depends(get_db_session)) -> Trip:
    trip = await session.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip


@router.patch("/{trip_id}", response_model=TripRead)
async def update_trip(
    trip_id: UUID,
    payload: TripUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> Trip:
    trip = await session.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(trip, key, value)

    if update_data.get("status") == TripStatus.finalized:
        session.add(
            AuditLog(
                trip_id=trip.id,
            event_type=AuditEventType.vote_results_finalized,
                actor=trip.organizer_name,
                detail={"status": TripStatus.finalized.value},
            )
        )

    await session.commit()
    await session.refresh(trip)
    return trip


