"""Endpoints for managing participants."""

from __future__ import annotations

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ...models import AvailabilityWindow, Participant, Trip
from ...schemas import (
    AvailabilityWindowCreate,
    AvailabilityWindowRead,
    ParticipantCreate,
    ParticipantRead,
)
from ..dependencies import get_db_session


router = APIRouter()


@router.post("/{trip_id}/participants", response_model=ParticipantRead, status_code=status.HTTP_201_CREATED)
async def add_participant(
    trip_id: UUID,
    payload: ParticipantCreate,
    session: AsyncSession = Depends(get_db_session),
) -> Participant:
    from ...enums import SurveyType
    from ...models import Survey, SurveyResponse

    trip = await session.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    participant = Participant(trip_id=trip.id, **payload.model_dump())
    session.add(participant)
    await session.flush()  # Flush to get participant ID

    # Find the preferences survey for this trip
    result = await session.exec(
        select(Survey)
        .where(Survey.trip_id == trip_id)
        .where(Survey.survey_type == SurveyType.preferences)
        .where(Survey.is_active == True)
    )
    preferences_survey = result.one_or_none()

    # If preferences survey exists, create a placeholder response
    # The actual answers will be submitted via a separate endpoint
    if preferences_survey:
        survey_response = SurveyResponse(
            survey_id=preferences_survey.id,
            participant_id=participant.id,
            answers={},
            channel="web",
        )
        session.add(survey_response)

    await session.commit()
    await session.refresh(participant)
    return participant


@router.get("/{trip_id}/participants", response_model=List[ParticipantRead])
async def list_participants(trip_id: UUID, session: AsyncSession = Depends(get_db_session)) -> List[Participant]:
    result = await session.exec(select(Participant).where(Participant.trip_id == trip_id))
    return result.all()


@router.post(
    "/{trip_id}/participants/{participant_id}/availability",
    response_model=AvailabilityWindowRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_availability_window(
    trip_id: UUID,
    participant_id: UUID,
    payload: AvailabilityWindowCreate,
    session: AsyncSession = Depends(get_db_session),
) -> AvailabilityWindow:
    participant = await session.get(Participant, participant_id)
    if not participant or participant.trip_id != trip_id:
        raise HTTPException(status_code=404, detail="Participant not found for this trip")
    window = AvailabilityWindow(participant_id=participant.id, **payload.model_dump())
    session.add(window)
    await session.commit()
    await session.refresh(window)
    return window
