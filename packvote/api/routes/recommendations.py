"""Destination recommendation endpoints."""

from __future__ import annotations

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ...enums import AuditEventType, VoteStatus
from ...models import AuditLog, DestinationRecommendation, Trip, VoteRound
from ...schemas import RecommendationCreate, RecommendationRead
from ..dependencies import get_db_session, get_recommendation_service


router = APIRouter()


@router.get("/{trip_id}/recommendations", response_model=List[RecommendationRead])
async def list_recommendations(trip_id: UUID, session: AsyncSession = Depends(get_db_session)) -> List[DestinationRecommendation]:
    result = await session.exec(select(DestinationRecommendation).where(DestinationRecommendation.trip_id == trip_id))
    return result.all()


@router.post(
    "/{trip_id}/recommendations",
    response_model=List[RecommendationRead],
    status_code=status.HTTP_201_CREATED,
)
async def generate_recommendations(
    trip_id: UUID,
    payload: RecommendationCreate,
    session: AsyncSession = Depends(get_db_session),
    service=Depends(get_recommendation_service),
) -> List[DestinationRecommendation]:
    trip_result = await session.exec(
        select(Trip)
        .where(Trip.id == trip_id)
        .options(selectinload(Trip.participants), selectinload(Trip.surveys))
    )
    trip = trip_result.one_or_none()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    recommendations = await service.generate_for_trip(session, trip, payload)
    session.add(
        AuditLog(
            trip_id=trip.id,
            event_type=AuditEventType.recommendations_requested,
            actor=trip.organizer_name,
            detail={"prompt_variant": payload.prompt_variant, "count": str(payload.candidate_count)},
        )
    )
    await session.commit()
    for rec in recommendations:
        await session.refresh(rec)
        
    # Check if we need to start a new voting round
    # If the latest round is closed, start a new one
    latest_round_result = await session.exec(
        select(VoteRound)
        .where(VoteRound.trip_id == trip_id)
        .order_by(VoteRound.created_at.desc())
    )
    latest_round = latest_round_result.first()
    
    if latest_round and latest_round.status == VoteStatus.closed:
        new_round = VoteRound(trip_id=trip_id, status=VoteStatus.open)
        session.add(new_round)
        await session.commit()
        
    return recommendations
