"""Twilio messaging integration layer."""

from __future__ import annotations

import logging
from typing import Dict, Optional
from uuid import UUID

from fastapi import HTTPException
from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType

try:
    from twilio.http.http_client import TwilioHttpClient  # type: ignore
    from twilio.request_validator import RequestValidator  # type: ignore
    from twilio.rest import Client  # type: ignore
except ModuleNotFoundError:  # pragma: no cover - optional dependency for tests
    Client = None  # type: ignore
    RequestValidator = None  # type: ignore
    TwilioHttpClient = None  # type: ignore

from ..config import get_settings

logger = logging.getLogger(__name__)


class MessagingService:
    """Wrapper around Twilio SMS delivery and Email."""

    def __init__(self) -> None:
        settings = get_settings()
        self.account_sid = settings.twilio_account_sid
        self.auth_token = settings.twilio_auth_token
        self.messaging_service_sid = settings.twilio_messaging_service_sid
        self.from_number = settings.twilio_from_number

        if self.account_sid and self.auth_token and Client:
            try:
                self.client = Client(
                    self.account_sid,
                    self.auth_token,
                    # http_client=TwilioHttpClient(),
                )
            except Exception as e:
                logger.error(f"Failed to initialize Twilio client: {e}")
                self.client = None
        else:  # pragma: no cover - dev fallback
            self.client = None

        self.validator = (
            RequestValidator(self.auth_token)
            if self.auth_token and RequestValidator
            else None
        )

        # Email Configuration
        mail_from = settings.mail_from
        if (
            settings.mail_server == "smtp.gmail.com"
            and settings.mail_username
            and settings.mail_from == "noreply@packvote.com"
        ):
            logger.warning(
                "Using Gmail SMTP with default 'noreply' sender. "
                "Overriding MAIL_FROM to MAIL_USERNAME to ensure delivery."
            )
            mail_from = settings.mail_username

        self.email_conf = ConnectionConfig(
            MAIL_USERNAME=settings.mail_username,
            MAIL_PASSWORD=settings.mail_password,
            MAIL_FROM=mail_from,
            MAIL_PORT=settings.mail_port,
            MAIL_SERVER=settings.mail_server,
            MAIL_STARTTLS=settings.mail_starttls,
            MAIL_SSL_TLS=settings.mail_ssl_tls,
            USE_CREDENTIALS=settings.use_credentials,
            VALIDATE_CERTS=settings.validate_certs,
        )
        self.fastmail = FastMail(self.email_conf)

    def send_survey_sms(self, to_phone: str, body: str) -> str:
        """Send survey SMS; fallback to logging when Twilio is unavailable."""

        if not self.client:
            # Development fallback
            print("\n" + "=" * 60)
            print(f"📱 [DEV SMS PREVIEW] To: {to_phone}")
            print(f"💬 Body: {body}")

            settings = get_settings()
            print("⚠️ Twilio Config Missing or Client Failed:")
            print(f"   Account SID present: {bool(settings.twilio_account_sid)}")
            print(f"   Auth Token present: {bool(settings.twilio_auth_token)}")
            print(f"   Twilio Library: {bool(Client)}")

            print("=" * 60 + "\n")
            logger.info(f"[DEV SMS] -> {to_phone}: {body}")
            return "development-message-sid"

        try:
            message = self.client.messages.create(
                to=to_phone,
                messaging_service_sid=self.messaging_service_sid,
                from_=self.from_number,
                body=body,
            )
            return message.sid
        except Exception as e:
            logger.error(f"Failed to send SMS: {e}")
            # Fallback to dev print on error
            print("\n" + "=" * 60)
            print(f"❌ [SMS SEND FAILED] Error: {e}")
            print(f"📱 To: {to_phone}")
            print(f"💬 Body: {body}")
            print("=" * 60 + "\n")
            return "failed-message-sid"

    def validate_request(
        self, url: str, params: Dict[str, str], signature: Optional[str]
    ) -> None:
        if not self.validator or not signature:
            # Development fallback; skip validation when credentials missing
            return

        if not self.validator.validate(url, params, signature):
            raise HTTPException(status_code=401, detail="Invalid Twilio signature")

    async def send_invite_email(
        self, to_email: str, trip_id: UUID, trip_name: str
    ) -> None:
        """Send an invitation email to join a trip."""
        settings = get_settings()
        invite_link = f"{settings.frontend_base_url}/join/{trip_id}"

        html = f"""
        <p>You have been invited to join the trip <strong>{trip_name}</strong>!</p>
        <p>Click the link below to join and add your preferences:</p>
        <p><a href="{invite_link}">{invite_link}</a></p>
        """

        message = MessageSchema(
            subject=f"Invitation to join {trip_name}",
            recipients=[to_email],
            body=html,
            subtype=MessageType.html,
        )

        try:
            print(
                f"📧 [DEBUG] Attempting to send email to {to_email} from {self.email_conf.MAIL_FROM} via {self.email_conf.MAIL_SERVER}"
            )
            await self.fastmail.send_message(message)
        except Exception as e:
            print(f"❌ [DEBUG] Failed to send email: {e}")
            logger.warning(
                f"Failed to send email to {to_email} from {self.email_conf.MAIL_FROM}: {e}"
            )
            # Fallback to dev logging with prominent formatting
            print("\n" + "=" * 60)
            print(f"📧 [DEV EMAIL PREVIEW] To: {to_email}")
            print(f"🔗 Link: {invite_link}")
            print("=" * 60 + "\n")

    def send_invite_sms(self, to_phone: str, trip_id: UUID, trip_name: str) -> str:
        """Send an invitation SMS to join a trip."""
        settings = get_settings()
        invite_link = f"{settings.frontend_base_url}/join/{trip_id}"
        body = f"You've been invited to join '{trip_name}'! Click here to join: {invite_link}"

        return self.send_survey_sms(to_phone, body)
