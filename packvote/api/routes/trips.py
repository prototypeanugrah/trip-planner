"""Trip management endpoints."""

from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlmodel import delete, select
from sqlmodel.ext.asyncio.session import AsyncSession

from ...enums import AuditEventType, TripStatus
from ...models import (
    AuditLog,
    AvailabilityWindow,
    DestinationRecommendation,
    Participant,
    Survey,
    SurveyResponse,
    Trip,
    Vote,
    VoteItem,
    VoteRound,
)
from ...schemas import TripCreate, TripRead, TripUpdate
from ..dependencies import get_db_session

router = APIRouter()


@router.post("", response_model=TripRead, status_code=status.HTTP_201_CREATED)
async def create_trip(
    payload: TripCreate,
    session: AsyncSession = Depends(get_db_session),
) -> Trip:
    from ...enums import ParticipantRole, SurveyType
    from ...models import Participant, Survey

    trip = Trip(**payload.model_dump())
    session.add(trip)

    # Auto-create organizer as participant
    organizer_participant = Participant(
        trip_id=trip.id,
        name=trip.organizer_name,
        phone=trip.organizer_phone,
        email=trip.organizer_email,
        role=ParticipantRole.organizer,
    )
    session.add(organizer_participant)
    await session.flush()  # Flush to get participant ID

    # Create default preferences survey
    preferences_survey = Survey(
        trip_id=trip.id,
        name="Travel Preferences",
        survey_type=SurveyType.preferences,
        questions=[
            {
                "id": "location",
                "text": "What is your current location?",
                "type": "text",
            },
            {
                "id": "budget",
                "text": "What is your budget range?",
                "type": "choice",
                "options": ["low", "medium", "high"],
            },
            {
                "id": "preferences",
                "text": "Select your travel preferences",
                "type": "multi_choice",
                "options": [
                    "beaches",
                    "city_sightseeing",
                    "outdoor_adventures",
                    "festivals_events",
                    "food_exploration",
                    "nightlife",
                    "shopping",
                    "spa_wellness",
                ],
            },
        ],
        is_active=True,
    )
    session.add(preferences_survey)
    await session.flush()  # Flush to get survey ID

    # Create empty survey response for organizer
    from ...models import SurveyResponse

    organizer_survey_response = SurveyResponse(
        survey_id=preferences_survey.id,
        participant_id=organizer_participant.id,
        answers={},
        channel="web",
    )
    session.add(organizer_survey_response)

    session.add(
        AuditLog(
            trip_id=trip.id,
            event_type=AuditEventType.trip_created,
            actor=trip.organizer_name,
            detail={"trip_name": trip.name},
        )
    )
    await session.commit()
    await session.refresh(trip)
    return trip


@router.get("", response_model=List[TripRead])
async def list_trips(
    email: Optional[str] = None,
    session: AsyncSession = Depends(get_db_session),
) -> List[Trip]:
    query = select(Trip).order_by(Trip.created_at.desc())

    if email:
        query = query.join(Participant).where(Participant.email == email).distinct()

    result = await session.exec(query)
    return result.all()


@router.get("/{trip_id}", response_model=TripRead)
async def get_trip(
    trip_id: UUID, session: AsyncSession = Depends(get_db_session)
) -> Trip:
    trip = await session.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip


@router.patch("/{trip_id}", response_model=TripRead)
async def update_trip(
    trip_id: UUID,
    payload: TripUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> Trip:
    trip = await session.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(trip, key, value)

    if update_data.get("status") == TripStatus.finalized:
        session.add(
            AuditLog(
                trip_id=trip.id,
                event_type=AuditEventType.vote_results_finalized,
                actor=trip.organizer_name,
                detail={"status": TripStatus.finalized.value},
            )
        )

    await session.commit()
    await session.refresh(trip)
    return trip


@router.delete("/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trip(
    trip_id: UUID,
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    trip = await session.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    vote_round_ids_result = await session.exec(
        select(VoteRound.id).where(VoteRound.trip_id == trip_id)
    )
    vote_round_ids = vote_round_ids_result.all()
    if vote_round_ids:
        vote_ids_result = await session.exec(
            select(Vote.id).where(Vote.vote_round_id.in_(vote_round_ids))
        )
        vote_ids = vote_ids_result.all()
        if vote_ids:
            await session.exec(delete(VoteItem).where(VoteItem.vote_id.in_(vote_ids)))
            await session.exec(delete(Vote).where(Vote.id.in_(vote_ids)))
        await session.exec(delete(VoteRound).where(VoteRound.id.in_(vote_round_ids)))

    survey_ids_result = await session.exec(
        select(Survey.id).where(Survey.trip_id == trip_id)
    )
    survey_ids = survey_ids_result.all()
    if survey_ids:
        await session.exec(
            delete(SurveyResponse).where(SurveyResponse.survey_id.in_(survey_ids))
        )
        await session.exec(delete(Survey).where(Survey.id.in_(survey_ids)))

    participant_ids_result = await session.exec(
        select(Participant.id).where(Participant.trip_id == trip_id)
    )
    participant_ids = participant_ids_result.all()
    if participant_ids:
        await session.exec(
            delete(AvailabilityWindow).where(
                AvailabilityWindow.participant_id.in_(participant_ids)
            )
        )
        await session.exec(
            delete(Participant).where(Participant.id.in_(participant_ids))
        )

    await session.exec(
        delete(DestinationRecommendation).where(
            DestinationRecommendation.trip_id == trip_id
        )
    )
    await session.exec(delete(AuditLog).where(AuditLog.trip_id == trip_id))

    await session.delete(trip)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{trip_id}/itinerary/generate", status_code=status.HTTP_201_CREATED)
async def generate_itinerary(
    trip_id: UUID,
    session: AsyncSession = Depends(get_db_session),
) -> List[Dict[str, Any]]:
    from ...models import Itinerary
    from ...services.ai_gateway import ModelGateway
    from ...services.itinerary_agent import ItineraryAgent
    from ...services.recommendation_agent import build_trip_window, summarize_preferences

    trip = await session.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    # Check if itinerary already exists
    existing = await session.exec(select(Itinerary).where(Itinerary.trip_id == trip_id))
    if existing.first():
         # For now, just return existing. Or we could allow regeneration.
         # Let's allow regeneration by deleting old one or just creating new one?
         # Let's just return the existing one to avoid waste for now, or maybe add a force flag.
         # But the requirement implies generating one. Let's delete old if exists.
         await session.exec(delete(Itinerary).where(Itinerary.trip_id == trip_id))

    # Get finalized location
    # Assuming the winner of the last closed vote round is the finalized location
    # Or we can check trip.status == finalized, but we might want to generate before finalizing?
    # The prompt says "once i click on 'Finalize Location' after voting ends... spin a research agent"
    # So we should probably look for the winning recommendation.
    
    vote_round = await session.exec(
        select(VoteRound).where(VoteRound.trip_id == trip_id).order_by(VoteRound.created_at.desc())
    )
    last_round = vote_round.first()
    
    if not last_round or last_round.status != "closed" or not last_round.results:
        raise HTTPException(status_code=400, detail="Voting not completed or no results found.")
        
    winner_id = last_round.results.get("winner")
    if not winner_id:
        raise HTTPException(status_code=400, detail="No winner determined yet.")
        
    winner_rec = await session.get(DestinationRecommendation, UUID(winner_id))
    if not winner_rec:
        raise HTTPException(status_code=404, detail="Winning recommendation not found.")

    # Gather data
    gateway = ModelGateway()
    agent = ItineraryAgent(gateway)
    
    # Get preferences
    # We need to fetch all survey responses for this trip
    responses_result = await session.exec(select(SurveyResponse).join(Survey).where(Survey.trip_id == trip_id))
    responses = responses_result.all()
    pref_summary = summarize_preferences(responses)
    
    trip_window = build_trip_window(trip)
    
    # Generate
    itinerary_content = await agent.generate(
        trip_window=trip_window,
        preference_summary=pref_summary,
        location=winner_rec.title # or destination
    )
    
    # Save
    itinerary = Itinerary(
        trip_id=trip_id,
        content=itinerary_content,
        model_name="gpt-4o", # This should ideally come from metadata
    )
    session.add(itinerary)
    await session.commit()
    await session.refresh(itinerary)
    
    return itinerary.content


@router.get("/{trip_id}/itinerary")
async def get_itinerary(
    trip_id: UUID,
    session: AsyncSession = Depends(get_db_session),
) -> List[Dict[str, Any]]:
    from ...models import Itinerary
    
    result = await session.exec(select(Itinerary).where(Itinerary.trip_id == trip_id))
    itinerary = result.first()
    
    if not itinerary:
        return []
        
    return itinerary.content
