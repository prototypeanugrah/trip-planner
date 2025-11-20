import asyncio
import os
from uuid import uuid4
from datetime import datetime, timedelta

from sqlmodel import select
from packvote.db import get_session
from packvote.models import Trip, Participant, Survey, SurveyResponse, DestinationRecommendation, VoteRound, Vote, Itinerary
from packvote.enums import TripStatus, ParticipantRole, SurveyType, VoteStatus
from packvote.services.ai_gateway import ModelGateway
from packvote.services.itinerary_agent import ItineraryAgent, TripWindow, PreferenceSummary

async def verify_itinerary_generation():
    async for session in get_session():
        print("Setting up test data...")
        
        # 1. Create Trip
        trip = Trip(
            name="Test Itinerary Trip",
            organizer_name="Tester",
            organizer_phone="1234567890",
            status=TripStatus.voting,
            target_start_date=datetime.now(),
            target_end_date=datetime.now() + timedelta(days=3)
        )
        session.add(trip)
        await session.flush()
        
        # 2. Create Recommendation (Winner)
        rec = DestinationRecommendation(
            trip_id=trip.id,
            title="Paris, France",
            description="City of lights",
            model_name="test",
            prompt_version="v1"
        )
        session.add(rec)
        await session.flush()
        
        # 3. Create Vote Round & Results
        round = VoteRound(
            trip_id=trip.id,
            status=VoteStatus.closed,
            results={"winner": str(rec.id)}
        )
        session.add(round)
        
        # 4. Create Survey Response (Preferences)
        participant = Participant(trip_id=trip.id, name="Tester", role=ParticipantRole.organizer)
        session.add(participant)
        await session.flush()
        
        survey = Survey(trip_id=trip.id, name="Prefs", survey_type=SurveyType.preferences)
        session.add(survey)
        await session.flush()
        
        response = SurveyResponse(
            survey_id=survey.id,
            participant_id=participant.id,
            answers={"preferences": ["food_exploration", "culture"]}
        )
        session.add(response)
        await session.commit()
        
        print(f"Trip ID: {trip.id}")
        print(f"Winner: {rec.title}")
        
        # 5. Run Agent directly (mocking gateway if needed, but let's try real first if key exists)
        # If no key, it will use fallback
        print("Running ItineraryAgent...")
        gateway = ModelGateway()
        agent = ItineraryAgent(gateway)
        
        trip_window: TripWindow = {
            "start_date": trip.target_start_date.date().isoformat(),
            "end_date": trip.target_end_date.date().isoformat(),
            "duration_days": 3,
            "season_hint": "spring"
        }
        
        pref_summary: PreferenceSummary = {
            "preference_counts": {"food_exploration": 1, "culture": 1},
            "top_preferences": ["food_exploration", "culture"],
            "participant_count": 1
        }
        
        itinerary = await agent.generate(
            trip_window=trip_window,
            preference_summary=pref_summary,
            location=rec.title
        )
        
        print("Generated Itinerary:")
        import json
        print(json.dumps(itinerary, indent=2))
        
        assert len(itinerary) > 0
        assert "day" in itinerary[0]
        assert "activities" in itinerary[0]
        
        print("Verification Successful!")
        
        # Cleanup skipped to avoid cascade issues
        # await session.delete(trip) 
        # await session.commit()

if __name__ == "__main__":
    asyncio.run(verify_itinerary_generation())
