import asyncio
import os
from uuid import uuid4
from sqlmodel import select
from packvote.models import Trip, VoteRound, Participant
from packvote.enums import VoteStatus
from packvote.db import get_session
from packvote.api.routes.votes import _get_latest_vote_round
from packvote.api.routes.recommendations import generate_recommendations
from packvote.schemas import RecommendationCreate

# Mock service
class MockService:
    async def generate_for_trip(self, session, trip, payload):
        return []

async def verify_fix():
    async for session in get_session():
        print("Creating test trip...")
        trip = Trip(
            name="Test Trip",
            organizer_id="user_123",
            organizer_name="Test User",
            organizer_email="test@example.com",
            organizer_phone="1234567890"
        )
        session.add(trip)
        await session.commit()
        await session.refresh(trip)
        
        print(f"Trip created: {trip.id}")
        
        # 1. Get current round (should create new open round)
        print("Getting initial vote round...")
        round1 = await _get_latest_vote_round(session, trip.id)
        print(f"Round 1 status: {round1.status}")
        assert round1.status == VoteStatus.open
        
        # 2. Close the round manually (simulating end of voting)
        print("Closing round 1...")
        round1.status = VoteStatus.closed
        session.add(round1)
        await session.commit()
        
        # 3. Get current round again (should return CLOSED round, NOT create new one)
        print("Getting vote round after closing...")
        round2 = await _get_latest_vote_round(session, trip.id)
        print(f"Round 2 status: {round2.status}")
        print(f"Round 2 ID: {round2.id}")
        print(f"Round 1 ID: {round1.id}")
        
        if round2.id != round1.id:
            print("FAIL: Created new round instead of returning closed one!")
        elif round2.status != VoteStatus.closed:
            print("FAIL: Returned round is not closed!")
        else:
            print("PASS: Returned closed round correctly.")
            
        # 4. Generate recommendations (should trigger NEW round)
        print("Generating recommendations...")
        payload = RecommendationCreate(candidate_count=3)
        await generate_recommendations(trip.id, payload, session, MockService())
        
        # 5. Get current round again (should be NEW open round)
        print("Getting vote round after recommendations...")
        round3 = await _get_latest_vote_round(session, trip.id)
        print(f"Round 3 status: {round3.status}")
        print(f"Round 3 ID: {round3.id}")
        
        if round3.id == round1.id:
            print("FAIL: Did not create new round after recommendations!")
        elif round3.status != VoteStatus.open:
            print("FAIL: New round is not open!")
        else:
            print("PASS: Created new open round after recommendations.")

if __name__ == "__main__":
    asyncio.run(verify_fix())
