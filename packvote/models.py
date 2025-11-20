"""SQLModel models representing Pack Vote domain entities."""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from sqlalchemy import Column
from sqlalchemy.dialects.sqlite import JSON
from sqlmodel import Field, Relationship, SQLModel

from .enums import (
    AuditEventType,
    ParticipantRole,
    RecommendationStatus,
    SurveyType,
    TripStatus,
    VoteStatus,
)


def _utcnow() -> datetime:
    """Return timezone-aware current time for DB timestamps."""

    return datetime.now(timezone.utc)


class TimestampMixin(SQLModel):
    created_at: datetime = Field(default_factory=_utcnow, nullable=False)
    updated_at: datetime = Field(
        default_factory=_utcnow,
        nullable=False,
        sa_column_kwargs={"onupdate": _utcnow},
    )


class Trip(TimestampMixin, SQLModel, table=True):
    __tablename__ = "trips"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    name: str = Field(max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    organizer_name: str = Field(max_length=120)
    organizer_phone: Optional[str] = Field(default=None, max_length=32)
    organizer_email: Optional[str] = Field(default=None, max_length=255)
    status: TripStatus = Field(default=TripStatus.draft)
    prompt_bundle_version: str = Field(default="v1")
    budget_min: Optional[int] = None
    budget_max: Optional[int] = None
    target_start_date: Optional[datetime] = None
    target_end_date: Optional[datetime] = None
    timezone: Optional[str] = Field(default=None, max_length=64)
    tags: List[str] = Field(default_factory=list, sa_column=Column(JSON))

    participants: List["Participant"] = Relationship(back_populates="trip")
    surveys: List["Survey"] = Relationship(back_populates="trip")
    recommendations: List["DestinationRecommendation"] = Relationship(
        back_populates="trip"
    )
    vote_rounds: List["VoteRound"] = Relationship(back_populates="trip")
    audit_events: List["AuditLog"] = Relationship(back_populates="trip")
    itinerary: Optional["Itinerary"] = Relationship(back_populates="trip")


class Participant(TimestampMixin, SQLModel, table=True):
    __tablename__ = "participants"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    trip_id: UUID = Field(foreign_key="trips.id", index=True)
    name: str = Field(max_length=120)
    phone: Optional[str] = Field(default=None, max_length=32)
    email: Optional[str] = Field(default=None, max_length=255)
    role: ParticipantRole = Field(default=ParticipantRole.traveler)
    timezone: Optional[str] = Field(default=None, max_length=64)
    is_active: bool = Field(default=True)

    trip: "Trip" = Relationship(back_populates="participants")
    availabilities: List["AvailabilityWindow"] = Relationship(
        back_populates="participant"
    )
    responses: List["SurveyResponse"] = Relationship(back_populates="participant")
    votes: List["Vote"] = Relationship(back_populates="participant")


class AvailabilityWindow(TimestampMixin, SQLModel, table=True):
    __tablename__ = "availability_windows"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    participant_id: UUID = Field(foreign_key="participants.id", index=True)
    start: datetime
    end: datetime

    participant: "Participant" = Relationship(back_populates="availabilities")


class Survey(TimestampMixin, SQLModel, table=True):
    __tablename__ = "surveys"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    trip_id: UUID = Field(foreign_key="trips.id", index=True)
    name: str = Field(max_length=200)
    survey_type: SurveyType = Field(default=SurveyType.custom)
    questions: List[Dict[str, Any]] = Field(
        default_factory=list, sa_column=Column(JSON)
    )
    is_active: bool = Field(default=True)
    prompt_variant: str = Field(default="baseline")

    trip: "Trip" = Relationship(back_populates="surveys")
    responses: List["SurveyResponse"] = Relationship(back_populates="survey")


class SurveyResponse(TimestampMixin, SQLModel, table=True):
    __tablename__ = "survey_responses"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    survey_id: UUID = Field(foreign_key="surveys.id", index=True)
    participant_id: UUID = Field(foreign_key="participants.id", index=True)
    answers: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    channel: str = Field(default="sms", max_length=32)
    prompt_variant: str = Field(default="baseline")

    survey: "Survey" = Relationship(back_populates="responses")
    participant: "Participant" = Relationship(back_populates="responses")


class DestinationRecommendation(TimestampMixin, SQLModel, table=True):
    __tablename__ = "destination_recommendations"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    trip_id: UUID = Field(foreign_key="trips.id", index=True)
    title: str = Field(max_length=200)
    description: str = Field(max_length=4000)
    prompt_version: str = Field(max_length=50)
    model_name: str = Field(max_length=100)
    prompt_variant: str = Field(default="baseline", max_length=50)
    status: RecommendationStatus = Field(default=RecommendationStatus.completed)
    score: Optional[float] = None
    cost_usd: Optional[float] = None
    evaluation: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    extra: Dict[str, Any] = Field(
        default_factory=dict, sa_column=Column("metadata", JSON)
    )

    trip: "Trip" = Relationship(back_populates="recommendations")
    vote_items: List["VoteItem"] = Relationship(back_populates="recommendation")


class VoteRound(TimestampMixin, SQLModel, table=True):
    __tablename__ = "vote_rounds"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    trip_id: UUID = Field(foreign_key="trips.id", index=True)
    status: VoteStatus = Field(default=VoteStatus.open)
    method: str = Field(default="instant_runoff", max_length=50)
    candidates: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    results: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))

    trip: "Trip" = Relationship(back_populates="vote_rounds")
    votes: List["Vote"] = Relationship(back_populates="vote_round")


class Vote(TimestampMixin, SQLModel, table=True):
    __tablename__ = "votes"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    vote_round_id: UUID = Field(foreign_key="vote_rounds.id", index=True)
    participant_id: UUID = Field(foreign_key="participants.id", index=True)
    rankings: List[str] = Field(default_factory=list, sa_column=Column(JSON))

    vote_round: "VoteRound" = Relationship(back_populates="votes")
    participant: "Participant" = Relationship(back_populates="votes")
    items: List["VoteItem"] = Relationship(back_populates="vote")


class VoteItem(TimestampMixin, SQLModel, table=True):
    __tablename__ = "vote_items"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    vote_id: UUID = Field(foreign_key="votes.id", index=True)
    recommendation_id: UUID = Field(
        foreign_key="destination_recommendations.id", index=True
    )
    rank: int = Field(ge=1)

    vote: "Vote" = Relationship(back_populates="items")
    recommendation: "DestinationRecommendation" = Relationship(
        back_populates="vote_items"
    )


class AuditLog(TimestampMixin, SQLModel, table=True):
    __tablename__ = "audit_logs"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    trip_id: Optional[UUID] = Field(default=None, foreign_key="trips.id", index=True)
    event_type: AuditEventType = Field()
    actor: Optional[str] = Field(default=None, max_length=120)
    detail: Dict[str, str] = Field(default_factory=dict, sa_column=Column(JSON))

    trip: Optional[Trip] = Relationship(back_populates="audit_events")


class Itinerary(TimestampMixin, SQLModel, table=True):
    __tablename__ = "itineraries"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    trip_id: UUID = Field(foreign_key="trips.id", index=True)
    content: List[Dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON))
    model_name: str = Field(max_length=100)
    prompt_variant: str = Field(default="baseline", max_length=50)

    trip: "Trip" = Relationship(back_populates="itinerary")


class TravelLogistics(TimestampMixin, SQLModel, table=True):
    """Stores all travel logistics for a trip/participant combination."""
    __tablename__ = "travel_logistics"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    trip_id: UUID = Field(foreign_key="trips.id", index=True)
    participant_id: UUID = Field(foreign_key="participants.id", index=True)
    model_name: Optional[str] = Field(default=None, max_length=100)
    prompt_variant: str = Field(default="baseline", max_length=50)

    trip: "Trip" = Relationship()
    participant: "Participant" = Relationship()
    flight_recommendations: List["FlightRecommendation"] = Relationship(
        back_populates="logistics"
    )
    hotel_recommendations: List["HotelRecommendation"] = Relationship(
        back_populates="logistics"
    )


class FlightRecommendation(TimestampMixin, SQLModel, table=True):
    """Individual flight recommendation with airline, pricing, and timing details."""
    __tablename__ = "flight_recommendations"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    logistics_id: UUID = Field(foreign_key="travel_logistics.id", index=True)

    direction: str = Field(..., max_length=20)  # "outbound" or "return"
    rank: int = Field(..., ge=1, le=3)  # 1 = best, 2-3 = alternatives

    airline: str = Field(..., max_length=200)
    airline_logo_url: Optional[str] = Field(default=None, max_length=500)
    flight_number: str = Field(..., max_length=20)

    departure_airport: str = Field(..., max_length=10)  # IATA code
    arrival_airport: str = Field(..., max_length=10)  # IATA code
    departure_time: datetime = Field(...)
    arrival_time: datetime = Field(...)

    price_usd: float = Field(..., ge=0)
    duration_minutes: int = Field(..., ge=0)
    num_stops: int = Field(..., ge=0)

    extra: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))

    logistics: "TravelLogistics" = Relationship(back_populates="flight_recommendations")


class HotelRecommendation(TimestampMixin, SQLModel, table=True):
    """Individual hotel recommendation with pricing and amenity details."""
    __tablename__ = "hotel_recommendations"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    logistics_id: UUID = Field(foreign_key="travel_logistics.id", index=True)

    rank: int = Field(..., ge=1, le=3)  # 1 = best, 2-3 = alternatives

    name: str = Field(..., max_length=200)
    star_rating: int = Field(..., ge=1, le=5)

    check_in_date: datetime = Field(...)
    check_out_date: datetime = Field(...)
    num_nights: int = Field(..., ge=1)

    price_per_night_usd: float = Field(..., ge=0)
    total_price_usd: float = Field(..., ge=0)

    address: str = Field(..., max_length=500)
    amenities: List[str] = Field(default_factory=list, sa_column=Column(JSON))

    extra: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))

    logistics: "TravelLogistics" = Relationship(back_populates="hotel_recommendations")
