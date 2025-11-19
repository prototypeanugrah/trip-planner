"""Endpoints for managing participants."""

from __future__ import annotations

from typing import Any, List
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
    ParticipantUpdate,
)
from ..dependencies import get_db_session

router = APIRouter()


@router.post(
    "/{trip_id}/participants",
    response_model=ParticipantRead,
    status_code=status.HTTP_201_CREATED,
)
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
async def list_participants(
    trip_id: UUID, session: AsyncSession = Depends(get_db_session)
) -> Any:
    from sqlalchemy.orm import selectinload

    result = await session.exec(
        select(Participant)
        .where(Participant.trip_id == trip_id)
        .options(selectinload(Participant.responses))
    )
    participants = result.all()

    response_data = []
    for p in participants:
        survey_resp = next((r for r in p.responses if r.answers), None)

        p_dict = p.model_dump()
        p_dict["survey_response"] = survey_resp.answers if survey_resp else None
        response_data.append(p_dict)

    return response_data


@router.patch(
    "/{trip_id}/participants/{participant_id}", response_model=ParticipantRead
)
async def update_participant(
    trip_id: UUID,
    participant_id: UUID,
    payload: ParticipantUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    from sqlalchemy.orm import selectinload

    # Get participant with responses to match read schema
    result = await session.exec(
        select(Participant)
        .where(Participant.id == participant_id)
        .where(Participant.trip_id == trip_id)
        .options(selectinload(Participant.responses))
    )
    participant = result.one_or_none()

    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")

    participant_data = payload.model_dump(exclude_unset=True)
    for key, value in participant_data.items():
        setattr(participant, key, value)

    session.add(participant)
    await session.commit()
    await session.refresh(participant)

    survey_resp = next((r for r in participant.responses if r.answers), None)
    p_dict = participant.model_dump()
    p_dict["survey_response"] = survey_resp.answers if survey_resp else None

    return p_dict


@router.delete(
    "/{trip_id}/participants/{participant_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_participant(
    trip_id: UUID,
    participant_id: UUID,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    participant = await session.get(Participant, participant_id)
    if not participant or participant.trip_id != trip_id:
        raise HTTPException(status_code=404, detail="Participant not found")

    await session.delete(participant)
    await session.commit()


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
        raise HTTPException(
            status_code=404, detail="Participant not found for this trip"
        )
    window = AvailabilityWindow(participant_id=participant.id, **payload.model_dump())
    session.add(window)
    await session.commit()
    await session.refresh(window)
    return window
