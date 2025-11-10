"""Pydantic schemas for inbound/outbound API payloads."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from .enums import (
    AuditEventType,
    ParticipantRole,
    RecommendationStatus,
    SurveyType,
    TripStatus,
    VoteStatus,
)


class APIModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True, json_schema_extra={"example": None})


class TripBase(APIModel):
    name: str
    description: Optional[str] = None
    organizer_name: str
    organizer_phone: str
    organizer_email: Optional[str] = None
    budget_min: Optional[int] = None
    budget_max: Optional[int] = None
    target_start_date: Optional[datetime] = None
    target_end_date: Optional[datetime] = None
    timezone: Optional[str] = None
    tags: List[str] = Field(default_factory=list)


class TripCreate(TripBase):
    prompt_bundle_version: str = "v1"


class TripUpdate(APIModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TripStatus] = None
    budget_min: Optional[int] = None
    budget_max: Optional[int] = None
    target_start_date: Optional[datetime] = None
    target_end_date: Optional[datetime] = None
    timezone: Optional[str] = None
    tags: Optional[List[str]] = None


class TripRead(TripBase):
    id: UUID
    status: TripStatus
    prompt_bundle_version: str
    created_at: datetime
    updated_at: datetime


class ParticipantBase(APIModel):
    name: str
    phone: str
    email: Optional[str] = None
    role: ParticipantRole = ParticipantRole.traveler
    timezone: Optional[str] = None


class ParticipantCreate(ParticipantBase):
    pass


class ParticipantRead(ParticipantBase):
    id: UUID
    trip_id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime


class AvailabilityWindowCreate(APIModel):
    start: datetime
    end: datetime


class AvailabilityWindowRead(AvailabilityWindowCreate):
    id: UUID
    participant_id: UUID
    created_at: datetime
    updated_at: datetime


class SurveyQuestion(APIModel):
    id: str
    text: str
    type: str = Field(default="text")
    options: Optional[List[str]] = None


class SurveyCreate(APIModel):
    name: str
    survey_type: SurveyType
    questions: List[SurveyQuestion]
    prompt_variant: str = Field(default="baseline")


class SurveyRead(SurveyCreate):
    id: UUID
    trip_id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime


class SurveyResponseCreate(APIModel):
    participant_id: UUID
    answers: Dict[str, Any]
    channel: str = "sms"
    prompt_variant: str = Field(default="baseline")


class SurveyResponseRead(SurveyResponseCreate):
    id: UUID
    survey_id: UUID
    created_at: datetime
    updated_at: datetime


class RecommendationCreate(APIModel):
    prompt_variant: str = Field(default="baseline")
    candidate_count: int = Field(default=5, ge=1, le=10)


class RecommendationRead(APIModel):
    id: UUID
    trip_id: UUID
    title: str
    description: str
    prompt_version: str
    model_name: str
    prompt_variant: str
    status: RecommendationStatus
    score: Optional[float]
    cost_usd: Optional[float]
    evaluation: Dict[str, float]
    extra: Dict[str, Any]
    created_at: datetime
    updated_at: datetime


class VoteSubmissionItem(APIModel):
    recommendation_id: UUID
    rank: int


class VoteSubmission(APIModel):
    participant_id: UUID
    rankings: List[VoteSubmissionItem]


class VoteRead(APIModel):
    id: UUID
    vote_round_id: UUID
    participant_id: UUID
    rankings: List[str]
    created_at: datetime
    updated_at: datetime


class VoteRoundRead(APIModel):
    id: UUID
    trip_id: UUID
    status: VoteStatus
    method: str
    results: Dict[str, Any]
    created_at: datetime
    updated_at: datetime


class VoteResults(APIModel):
    vote_round: VoteRoundRead
    recommendations: List[RecommendationRead]


class AuditLogRead(APIModel):
    id: UUID
    trip_id: Optional[UUID]
    event_type: AuditEventType
    actor: Optional[str]
    detail: Dict[str, str]
    created_at: datetime
    updated_at: datetime


class SMSWebhookPayload(APIModel):
    from_number: str = Field(alias="From")
    to_number: str = Field(alias="To")
    body: str = Field(alias="Body")
    message_sid: str = Field(alias="MessageSid")
    account_sid: str = Field(alias="AccountSid")


