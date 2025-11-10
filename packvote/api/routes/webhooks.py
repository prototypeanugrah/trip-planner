"""Inbound webhook endpoints (e.g., Twilio)."""

from __future__ import annotations

from typing import Dict

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ...models import Participant, Survey, SurveyResponse
from ...schemas import SMSWebhookPayload
from ..dependencies import get_db_session, get_messaging_service


router = APIRouter()


@router.post("/twilio/sms")
async def twilio_sms_webhook(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    messaging=Depends(get_messaging_service),
) -> Dict[str, str]:
    form = dict(await request.form())
    signature = request.headers.get("X-Twilio-Signature")
    messaging.validate_request(str(request.url), form, signature)

    payload = SMSWebhookPayload.model_validate(form)
    participant_result = await session.exec(select(Participant).where(Participant.phone == payload.from_number))
    participant = participant_result.one_or_none()
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not recognized")

    survey_result = await session.exec(
        select(Survey)
        .where(Survey.trip_id == participant.trip_id)
        .order_by(Survey.created_at.desc())
    )
    survey = survey_result.first()
    if not survey:
        raise HTTPException(status_code=404, detail="No active survey")

    response = SurveyResponse(
        survey_id=survey.id,
        participant_id=participant.id,
        answers={"sms": payload.body},
        channel="sms",
        prompt_variant=survey.prompt_variant,
    )
    session.add(response)
    await session.commit()
    return {"status": "received"}
