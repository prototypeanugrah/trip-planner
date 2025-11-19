"""Endpoints for managing participants."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import or_
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ...enums import ParticipantRole
from ...models import AvailabilityWindow, Participant, Trip
from ...schemas import (
    AvailabilityWindowCreate,
    AvailabilityWindowRead,
    ParticipantCreate,
    ParticipantInvite,
    ParticipantJoin,
    ParticipantRead,
    ParticipantUpdate,
)
from ...services.messaging import MessagingService
from ..dependencies import get_db_session, get_messaging_service

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
        .where(Survey.is_active)
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


@router.post("/{trip_id}/invite", status_code=status.HTTP_200_OK)
async def invite_participant(
    trip_id: UUID,
    payload: ParticipantInvite,
    session: AsyncSession = Depends(get_db_session),
    messaging: MessagingService = Depends(get_messaging_service),
) -> Dict[str, str]:
    trip = await session.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    print(f"🚀 [DEBUG] Invite Request: {payload}")

    if not payload.email and not payload.phone:
        raise HTTPException(
            status_code=400, detail="Either email or phone must be provided"
        )

    # Check if participant already exists
    query = select(Participant).where(Participant.trip_id == trip_id)
    conditions = []
    if payload.email:
        conditions.append(Participant.email == payload.email)
    if payload.phone:
        conditions.append(Participant.phone == payload.phone)

    if conditions:
        query = query.where(or_(*conditions))
        result = await session.exec(query)
        existing = result.first()
        if existing:
            participant = existing
        else:
            # Create new participant
            participant = Participant(
                trip_id=trip_id,
                name="Invited User",
                email=payload.email,
                phone=payload.phone,
                role=ParticipantRole.traveler,
                is_active=True,
            )
            session.add(participant)
            await session.commit()
            await session.refresh(participant)
    else:
        # Should not happen due to check above
        raise HTTPException(
            status_code=400, detail="Either email or phone must be provided"
        )

    # Send Invite
    if payload.email:
        await messaging.send_invite_email(payload.email, trip_id, trip.name)

    if payload.phone:
        messaging.send_invite_sms(payload.phone, trip_id, trip.name)

    return {"message": "Invitation sent"}


@router.post("/{trip_id}/join", response_model=ParticipantRead)
async def join_trip(
    trip_id: UUID,
    payload: ParticipantJoin,
    session: AsyncSession = Depends(get_db_session),
) -> Participant:
    trip = await session.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Check if participant exists by email or phone
    query = select(Participant).where(Participant.trip_id == trip_id)
    conditions = []
    if payload.email:
        conditions.append(Participant.email == payload.email)
    if payload.phone:
        conditions.append(Participant.phone == payload.phone)

    participant = None
    if conditions:
        query = query.where(or_(*conditions))
        result = await session.exec(query)
        participant = result.first()

    if participant:
        # Update existing
        participant.name = payload.name
        if payload.phone:
            participant.phone = payload.phone
        if payload.email:
            participant.email = payload.email
        # Keep existing role
        session.add(participant)
    else:
        # Create new
        participant = Participant(
            trip_id=trip_id,
            name=payload.name,
            phone=payload.phone,
            email=payload.email,
            role=ParticipantRole.traveler,
        )
        session.add(participant)

    await session.flush()  # To get ID

    # Handle preferences (Survey Response)
    from ...enums import SurveyType
    from ...models import Survey, SurveyResponse

    # Find preferences survey
    result = await session.exec(
        select(Survey)
        .where(Survey.trip_id == trip_id)
        .where(Survey.survey_type == SurveyType.preferences)
        .where(Survey.is_active)
    )
    preferences_survey = result.one_or_none()

    if preferences_survey:
        # Check if response exists
        result = await session.exec(
            select(SurveyResponse)
            .where(SurveyResponse.survey_id == preferences_survey.id)
            .where(SurveyResponse.participant_id == participant.id)
        )
        existing_response = result.one_or_none()

        answers = {
            "preferences": payload.preferences,
            "budget": payload.budget,
            "location": payload.location,
        }

        if existing_response:
            existing_response.answers = answers
            session.add(existing_response)
        else:
            survey_response = SurveyResponse(
                survey_id=preferences_survey.id,
                participant_id=participant.id,
                answers=answers,
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
    transfer_organizer_to: Optional[UUID] = Query(None),
    x_user_email: Optional[str] = Header(None),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    trip = await session.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    participant = await session.get(Participant, participant_id)
    if not participant or participant.trip_id != trip_id:
        raise HTTPException(status_code=404, detail="Participant not found")

    # Authorization Check
    if x_user_email:
        is_self = participant.email == x_user_email
        is_organizer = trip.organizer_email == x_user_email

        if not (is_self or is_organizer):
            raise HTTPException(
                status_code=403, detail="Not authorized to remove this participant"
            )

    # Organizer Leaving Logic
    if participant.role == ParticipantRole.organizer:
        # Check for other participants
        query = (
            select(Participant)
            .where(Participant.trip_id == trip_id)
            .where(Participant.id != participant_id)
        )
        result = await session.exec(query)
        others = result.all()

        if others:
            if not transfer_organizer_to:
                raise HTTPException(
                    status_code=400,
                    detail="Organizer must assign a new organizer before leaving. Provide 'transfer_organizer_to' query parameter.",
                )

            # Verify new organizer
            new_organizer = await session.get(Participant, transfer_organizer_to)
            if not new_organizer or new_organizer.trip_id != trip_id:
                raise HTTPException(
                    status_code=400, detail="New organizer not found in this trip"
                )

            # Transfer Role
            new_organizer.role = ParticipantRole.organizer
            trip.organizer_name = new_organizer.name
            trip.organizer_email = new_organizer.email
            trip.organizer_phone = new_organizer.phone

            session.add(new_organizer)
            session.add(trip)
        else:
            # No one else in the trip.
            raise HTTPException(
                status_code=400,
                detail="You are the only participant. Please delete the trip instead of leaving.",
            )

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
