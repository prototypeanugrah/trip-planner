"""Twilio messaging integration layer."""

from __future__ import annotations

from typing import Dict, Optional

from fastapi import HTTPException

try:
    from twilio.http.http_client import TwilioHttpClient  # type: ignore
    from twilio.request_validator import RequestValidator  # type: ignore
    from twilio.rest import Client  # type: ignore
except ModuleNotFoundError:  # pragma: no cover - optional dependency for tests
    Client = None  # type: ignore
    RequestValidator = None  # type: ignore
    TwilioHttpClient = None  # type: ignore

from ..config import get_settings


class MessagingService:
    """Wrapper around Twilio SMS delivery."""

    def __init__(self) -> None:
        settings = get_settings()
        self.account_sid = settings.twilio_account_sid
        self.auth_token = settings.twilio_auth_token
        self.messaging_service_sid = settings.twilio_messaging_service_sid
        if self.account_sid and self.auth_token and Client:
            self.client = Client(self.account_sid, self.auth_token, http_client=TwilioHttpClient())
        else:  # pragma: no cover - dev fallback
            self.client = None

        self.validator = RequestValidator(self.auth_token) if self.auth_token and RequestValidator else None

    def send_survey_sms(self, to_phone: str, body: str) -> str:
        """Send survey SMS; fallback to logging when Twilio is unavailable."""

        if not self.client:
            # Development fallback
            print(f"[DEV SMS] -> {to_phone}: {body}")  # noqa: T201
            return "development-message-sid"

        message = self.client.messages.create(
            to=to_phone,
            messaging_service_sid=self.messaging_service_sid,
            body=body,
        )
        return message.sid

    def validate_request(self, url: str, params: Dict[str, str], signature: Optional[str]) -> None:
        if not self.validator or not signature:
            # Development fallback; skip validation when credentials missing
            return

        if not self.validator.validate(url, params, signature):
            raise HTTPException(status_code=401, detail="Invalid Twilio signature")


