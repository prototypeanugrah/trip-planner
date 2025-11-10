"""Survey lifecycle endpoints."""

from __future__ import annotations

from typing import List
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ...enums import AuditEventType
from ...models import AuditLog, Participant, Survey, SurveyResponse, Trip
from ...schemas import (
    SurveyCreate,
    SurveyRead,
    SurveyResponseCreate,
    SurveyResponseRead,
)
from ...services.metrics import sms_sent_counter
from ..dependencies import get_db_session, get_messaging_service

router = APIRouter()


@router.post(
    "/{trip_id}/surveys",
    response_model=SurveyRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_survey(
    trip_id: UUID,
    payload: SurveyCreate,
    session: AsyncSession = Depends(get_db_session),
) -> Survey:
    trip = await session.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    survey = Survey(trip_id=trip.id, **payload.model_dump())
    session.add(survey)
    session.add(
        AuditLog(
            trip_id=trip.id,
            event_type=AuditEventType.survey_sent,
            actor=trip.organizer_name,
            detail={
                "survey_name": survey.name,
                "prompt_variant": survey.prompt_variant,
            },
        )
    )
    await session.commit()
    await session.refresh(survey)
    return survey


@router.get("/{trip_id}/surveys", response_model=List[SurveyRead])
async def list_surveys(
    trip_id: UUID, session: AsyncSession = Depends(get_db_session)
) -> List[Survey]:
    result = await session.exec(select(Survey).where(Survey.trip_id == trip_id))
    return result.all()


@router.post(
    "/{trip_id}/surveys/{survey_id}/responses",
    response_model=SurveyResponseRead,
    status_code=status.HTTP_201_CREATED,
)
async def submit_response(
    trip_id: UUID,
    survey_id: UUID,
    payload: SurveyResponseCreate,
    session: AsyncSession = Depends(get_db_session),
) -> SurveyResponse:
    survey = await session.get(Survey, survey_id)
    if not survey or survey.trip_id != trip_id:
        raise HTTPException(status_code=404, detail="Survey not found for this trip")
    participant = await session.get(Participant, payload.participant_id)
    if not participant or participant.trip_id != trip_id:
        raise HTTPException(status_code=400, detail="Participant not part of trip")
    response = SurveyResponse(survey_id=survey.id, **payload.model_dump())
    session.add(response)
    session.add(
        AuditLog(
            trip_id=survey.trip_id,
            event_type=AuditEventType.survey_response_received,
            actor=participant.name,
            detail={"survey_id": str(survey.id)},
        )
    )
    await session.commit()
    await session.refresh(response)
    return response


@router.get(
    "/{trip_id}/participants/{participant_id}/survey-response",
    response_model=SurveyResponseRead,
)
async def get_participant_survey_response(
    trip_id: UUID,
    participant_id: UUID,
    session: AsyncSession = Depends(get_db_session),
) -> SurveyResponse:
    """Get survey response for a participant's preferences survey."""
    from ...enums import SurveyType

    # Verify participant belongs to trip
    participant = await session.get(Participant, participant_id)
    if not participant or participant.trip_id != trip_id:
        raise HTTPException(
            status_code=404, detail="Participant not found for this trip"
        )

    # Find the preferences survey for this trip
    survey_result = await session.exec(
        select(Survey)
        .where(Survey.trip_id == trip_id)
        .where(Survey.survey_type == SurveyType.preferences)
        .where(Survey.is_active == True)
    )
    preferences_survey = survey_result.one_or_none()
    if not preferences_survey:
        raise HTTPException(status_code=404, detail="Preferences survey not found")

    # Find the survey response
    response_result = await session.exec(
        select(SurveyResponse)
        .where(SurveyResponse.survey_id == preferences_survey.id)
        .where(SurveyResponse.participant_id == participant_id)
    )
    survey_response = response_result.one_or_none()

    if not survey_response:
        raise HTTPException(status_code=404, detail="Survey response not found")

    return survey_response


@router.patch(
    "/{trip_id}/participants/{participant_id}/survey-response",
    response_model=SurveyResponseRead,
)
async def update_participant_survey_response(
    trip_id: UUID,
    participant_id: UUID,
    payload: dict,
    session: AsyncSession = Depends(get_db_session),
) -> SurveyResponse:
    """Update survey response answers for a participant's preferences survey."""
    from ...enums import SurveyType

    # Verify participant belongs to trip
    participant = await session.get(Participant, participant_id)
    if not participant or participant.trip_id != trip_id:
        raise HTTPException(
            status_code=404, detail="Participant not found for this trip"
        )

    # Find the preferences survey for this trip
    survey_result = await session.exec(
        select(Survey)
        .where(Survey.trip_id == trip_id)
        .where(Survey.survey_type == SurveyType.preferences)
        .where(Survey.is_active == True)
    )
    preferences_survey = survey_result.one_or_none()
    if not preferences_survey:
        raise HTTPException(status_code=404, detail="Preferences survey not found")

    # Find or create the survey response
    response_result = await session.exec(
        select(SurveyResponse)
        .where(SurveyResponse.survey_id == preferences_survey.id)
        .where(SurveyResponse.participant_id == participant_id)
    )
    survey_response = response_result.one_or_none()

    if not survey_response:
        # Create new response if it doesn't exist
        survey_response = SurveyResponse(
            survey_id=preferences_survey.id,
            participant_id=participant_id,
            answers=payload.get("answers", {}),
            channel="web",
        )
        session.add(survey_response)
    else:
        # Update existing response
        survey_response.answers = payload.get("answers", {})

    await session.commit()
    await session.refresh(survey_response)
    return survey_response


@router.post(
    "/{trip_id}/surveys/{survey_id}/send", status_code=status.HTTP_202_ACCEPTED
)
async def send_survey(
    trip_id: UUID,
    survey_id: UUID,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_db_session),
    messaging=Depends(get_messaging_service),
) -> dict:
    survey = await session.get(Survey, survey_id)
    if not survey or survey.trip_id != trip_id:
        raise HTTPException(status_code=404, detail="Survey not found for this trip")
    participants_result = await session.exec(
        select(Participant).where(Participant.trip_id == trip_id)
    )
    participants = participants_result.all()

    def _send_messages() -> None:  # pragma: no cover - background side-effect
        for participant in participants:
            question_prompts = ", ".join(q.get("text", "") for q in survey.questions)
            message_body = (
                f"Pack Vote survey: {survey.name}\nPlease reply: {question_prompts}"
            )
            try:
                messaging.send_survey_sms(participant.phone, message_body)
                sms_sent_counter.labels(str(trip_id), "success").inc()
            except Exception:  # pragma: no cover - best effort logging
                sms_sent_counter.labels(str(trip_id), "failed").inc()

    background_tasks.add_task(_send_messages)
    return {"status": "scheduled"}
