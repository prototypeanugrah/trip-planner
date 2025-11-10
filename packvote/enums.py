"""Shared enumerations used across the Pack Vote domain."""

from enum import Enum


class TripStatus(str, Enum):
    draft = "draft"
    surveying = "surveying"
    recommending = "recommending"
    voting = "voting"
    finalized = "finalized"


class ParticipantRole(str, Enum):
    organizer = "organizer"
    traveler = "traveler"
    viewer = "viewer"


class SurveyType(str, Enum):
    availability = "availability"
    budget = "budget"
    preferences = "preferences"
    custom = "custom"


class RecommendationStatus(str, Enum):
    pending = "pending"
    completed = "completed"
    failed = "failed"


class VoteStatus(str, Enum):
    open = "open"
    closed = "closed"


class AuditEventType(str, Enum):
    trip_created = "trip_created"
    survey_sent = "survey_sent"
    survey_response_received = "survey_response_received"
    recommendations_requested = "recommendations_requested"
    recommendations_delivered = "recommendations_delivered"
    vote_submitted = "vote_submitted"
    vote_results_finalized = "vote_results_finalized"
    prompt_variant_won = "prompt_variant_won"


