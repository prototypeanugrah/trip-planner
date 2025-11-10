"""Trip management endpoints."""

from __future__ import annotations

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlmodel import delete, select
from sqlmodel.ext.asyncio.session import AsyncSession

from ...enums import AuditEventType, TripStatus
from ...models import (
    AuditLog,
    AvailabilityWindow,
    DestinationRecommendation,
    Participant,
    Survey,
    SurveyResponse,
    Trip,
    Vote,
    VoteItem,
    VoteRound,
)
from ...schemas import TripCreate, TripRead, TripUpdate
from ..dependencies import get_db_session


router = APIRouter()


@router.post("", response_model=TripRead, status_code=status.HTTP_201_CREATED)
async def create_trip(
    payload: TripCreate,
    session: AsyncSession = Depends(get_db_session),
) -> Trip:
    from ...enums import ParticipantRole, SurveyType
    from ...models import Participant, Survey

    trip = Trip(**payload.model_dump())
    session.add(trip)

    # Auto-create organizer as participant
    organizer_participant = Participant(
        trip_id=trip.id,
        name=trip.organizer_name,
        phone=trip.organizer_phone,
        email=trip.organizer_email,
        role=ParticipantRole.organizer,
    )
    session.add(organizer_participant)
    await session.flush()  # Flush to get participant ID

    # Create default preferences survey
    preferences_survey = Survey(
        trip_id=trip.id,
        name="Travel Preferences",
        survey_type=SurveyType.preferences,
        questions=[
            {"id": "location", "text": "What is your current location?", "type": "text"},
            {"id": "budget", "text": "What is your budget range?", "type": "choice", "options": ["low", "medium", "high"]},
            {"id": "preferences", "text": "Select your travel preferences", "type": "multi_choice", "options": [
                "beaches", "city_sightseeing", "outdoor_adventures", "festivals_events",
                "food_exploration", "nightlife", "shopping", "spa_wellness"
            ]},
        ],
        is_active=True,
    )
    session.add(preferences_survey)
    await session.flush()  # Flush to get survey ID

    # Create empty survey response for organizer
    from ...models import SurveyResponse
    organizer_survey_response = SurveyResponse(
        survey_id=preferences_survey.id,
        participant_id=organizer_participant.id,
        answers={},
        channel="web",
    )
    session.add(organizer_survey_response)

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
    result = await session.exec(select(Trip).order_by(Trip.created_at.desc()))
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


@router.delete("/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trip(
    trip_id: UUID,
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    trip = await session.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    vote_round_ids_result = await session.exec(
        select(VoteRound.id).where(VoteRound.trip_id == trip_id)
    )
    vote_round_ids = vote_round_ids_result.all()
    if vote_round_ids:
        vote_ids_result = await session.exec(
            select(Vote.id).where(Vote.vote_round_id.in_(vote_round_ids))
        )
        vote_ids = vote_ids_result.all()
        if vote_ids:
            await session.exec(delete(VoteItem).where(VoteItem.vote_id.in_(vote_ids)))
            await session.exec(delete(Vote).where(Vote.id.in_(vote_ids)))
        await session.exec(delete(VoteRound).where(VoteRound.id.in_(vote_round_ids)))

    survey_ids_result = await session.exec(
        select(Survey.id).where(Survey.trip_id == trip_id)
    )
    survey_ids = survey_ids_result.all()
    if survey_ids:
        await session.exec(
            delete(SurveyResponse).where(SurveyResponse.survey_id.in_(survey_ids))
        )
        await session.exec(delete(Survey).where(Survey.id.in_(survey_ids)))

    participant_ids_result = await session.exec(
        select(Participant.id).where(Participant.trip_id == trip_id)
    )
    participant_ids = participant_ids_result.all()
    if participant_ids:
        await session.exec(
            delete(AvailabilityWindow).where(
                AvailabilityWindow.participant_id.in_(participant_ids)
            )
        )
        await session.exec(delete(Participant).where(Participant.id.in_(participant_ids)))

    await session.exec(
        delete(DestinationRecommendation).where(
            DestinationRecommendation.trip_id == trip_id
        )
    )
    await session.exec(delete(AuditLog).where(AuditLog.trip_id == trip_id))

    await session.delete(trip)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
