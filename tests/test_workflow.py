from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

API_PREFIX = "/api"


@pytest.mark.asyncio
async def test_end_to_end_trip_flow(app) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        trip_payload = {
            "name": "Ski Trip",
            "description": "Group ski adventure",
            "organizer_name": "Alex",
            "organizer_phone": "+15551234567",
            "budget_min": 500,
            "budget_max": 1500,
            "tags": ["snow", "nightlife"],
        }
        trip_response = await client.post(f"{API_PREFIX}/trips", json=trip_payload)
        assert trip_response.status_code == 201, trip_response.text
        trip = trip_response.json()
        trip_id = trip["id"]

        participant_response = await client.post(
            f"{API_PREFIX}/trips/{trip_id}/participants",
            json={"name": "Jamie", "phone": "+15559876543"},
        )
        assert participant_response.status_code == 201, participant_response.text
        participant_id = participant_response.json()["id"]

        survey_response = await client.post(
            f"{API_PREFIX}/trips/{trip_id}/surveys",
            json={
                "name": "Preferences",
                "survey_type": "preferences",
                "questions": [
                    {"id": "vibe", "text": "What vibe?", "type": "text"},
                    {"id": "budget", "text": "Budget tier", "type": "choice", "options": ["low", "mid", "high"]},
                ],
            },
        )
        assert survey_response.status_code == 201, survey_response.text
        survey_id = survey_response.json()["id"]

        response_submit = await client.post(
            f"{API_PREFIX}/trips/{trip_id}/surveys/{survey_id}/responses",
            json={
                "participant_id": participant_id,
                "answers": {"vibe": "party", "budget": "mid"},
            },
        )
        assert response_submit.status_code == 201, response_submit.text

        recommendations_response = await client.post(
            f"{API_PREFIX}/trips/{trip_id}/recommendations",
            json={"candidate_count": 3},
        )
        assert recommendations_response.status_code == 201, recommendations_response.text
        recommendations = recommendations_response.json()
        assert len(recommendations) == 3

        vote_payload = {
            "participant_id": participant_id,
            "rankings": [
                {"recommendation_id": rec["id"], "rank": idx + 1}
                for idx, rec in enumerate(recommendations)
            ],
        }
        vote_response = await client.post(f"{API_PREFIX}/trips/{trip_id}/votes", json=vote_payload)
        assert vote_response.status_code == 201, vote_response.text

        results_response = await client.get(f"{API_PREFIX}/trips/{trip_id}/results")
        assert results_response.status_code == 200, results_response.text
        results = results_response.json()
        assert results["vote_round"]["status"] == "closed"
        assert results["vote_round"]["results"]["winner"] is not None

        metrics_response = await client.get("/metrics")
        assert metrics_response.status_code == 200

        delete_response = await client.delete(f"{API_PREFIX}/trips/{trip_id}")
        assert delete_response.status_code == 204, delete_response.text

        confirm_deleted = await client.get(f"{API_PREFIX}/trips/{trip_id}")
        assert confirm_deleted.status_code == 404
