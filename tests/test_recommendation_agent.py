from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

import pytest

from packvote.models import SurveyResponse, Trip
from packvote.services.recommendation_agent import (
    RecommendationAgent,
    build_trip_window,
    summarize_preferences,
)
from packvote.services.ai_gateway import ModelRequest, ModelResponse


class _DummyGateway:
    """Minimal gateway stub that forces the agent to synthesize data."""

    default_order = ["dummy"]

    async def generate(self, request: ModelRequest) -> ModelResponse:  # pragma: no cover - simple stub
        return ModelResponse(
            content="no-json",
            model_name="dummy-model",
            prompt_variant=request.prompt_variant,
            usage={},
            cost_usd=0.0,
        )

    def format_recommendation_payload(self, responses, max_items=None):  # pragma: no cover - simple stub
        return []


def _make_trip() -> Trip:
    return Trip(
        name="Secret Trip",
        description="",
        organizer_name="Alex Example",
        organizer_phone="+15551234567",
        prompt_bundle_version="v-test",
    )


def test_build_trip_window_ignores_personal_details():
    trip = _make_trip()
    trip.target_start_date = trip.created_at
    trip.target_end_date = trip.created_at + timedelta(days=3)

    window = build_trip_window(trip)

    assert "name" not in window
    assert window["duration_days"] == 3
    assert window["start_date"] is not None
    assert window["end_date"] is not None


def test_summarize_preferences_only_counts_tags():
    responses = [
        SurveyResponse(
            survey_id=uuid4(),
            participant_id=uuid4(),
            answers={"preferences": ["beaches", "nightlife"], "location": "Austin"},
        ),
        SurveyResponse(
            survey_id=uuid4(),
            participant_id=uuid4(),
            answers={"preferences": ["beaches"], "phone": "+123"},
        ),
        SurveyResponse(
            survey_id=uuid4(),
            participant_id=uuid4(),
            answers={"budget": "high"},  # no preferences
        ),
    ]

    summary = summarize_preferences(responses)

    assert summary["preference_counts"] == {"beaches": 2, "nightlife": 1}
    assert summary["participant_count"] == 2
    assert all("Austin" not in value for value in summary["preference_counts"].keys())


@pytest.mark.asyncio
async def test_agent_prompt_and_generation_use_only_allowed_data():
    trip = _make_trip()
    trip.target_start_date = trip.created_at
    trip.target_end_date = trip.created_at + timedelta(days=4)
    trip_window = build_trip_window(trip)
    preferences = {"preference_counts": {"spa_wellness": 2}, "top_preferences": ["spa_wellness"], "participant_count": 1}

    agent = RecommendationAgent(_DummyGateway())
    prompt = agent.build_prompt(trip_window=trip_window, preference_summary=preferences, candidate_count=2)

    assert "Alex Example" not in prompt
    assert "+1555" not in prompt
    assert "Secret Trip" not in prompt

    recommendations = await agent.generate(
        trip_window=trip_window,
        preference_summary=preferences,
        candidate_count=2,
        prompt_variant="baseline",
    )

    assert len(recommendations) == 2
    assert all(rec["details"].get("source") == "preference_synthesis" for rec in recommendations)
