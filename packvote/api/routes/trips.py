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
    from ...services.agents.itinerary_agent import ItineraryAgent
    from ...services.agents.recommendation_agent import build_trip_window, summarize_preferences

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


@router.post("/{trip_id}/logistics/generate", status_code=status.HTTP_201_CREATED)
async def generate_travel_logistics(
    trip_id: UUID,
    user_email: str,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Generate travel logistics recommendations for the authenticated user."""
    from datetime import datetime as dt
    from ...models import TravelLogistics, FlightRecommendation, HotelRecommendation
    from ...services.ai_gateway import ModelGateway
    from ...services.agents.travel_planner import TravelPlannerAgent
    
    # Get trip
    trip = await session.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    # Find participant by email
    participant_result = await session.exec(
        select(Participant).where(
            Participant.trip_id == trip_id,
            Participant.email == user_email
        )
    )
    participant = participant_result.first()
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found for this user")
    
    # Get participant's survey response for location
    survey_response_result = await session.exec(
        select(SurveyResponse).where(SurveyResponse.participant_id == participant.id)
    )
    survey_response = survey_response_result.first()
    
    source_location = "Unknown"
    budget_max = 10000.0
    
    if survey_response and survey_response.answers:
        source_location = survey_response.answers.get("location", "Unknown")
        budget_str = survey_response.answers.get("budget", "medium")
        # Map budget to max values
        budget_map = {"low": 3000.0, "medium": 7000.0, "high": 15000.0}
        budget_max = budget_map.get(budget_str, 7000.0)
    
    # Get destination from finalized vote
    vote_round_result = await session.exec(
        select(VoteRound).where(VoteRound.trip_id == trip_id).order_by(VoteRound.created_at.desc())
    )
    last_round = vote_round_result.first()
    
    if not last_round or not last_round.results:
        raise HTTPException(status_code=400, detail="No voting results found")
    
    winner_id = last_round.results.get("winner")
    if not winner_id:
        raise HTTPException(status_code=400, detail="No winner determined yet")
    
    winner_rec = await session.get(DestinationRecommendation, UUID(winner_id))
    if not winner_rec:
        raise HTTPException(status_code=404, detail="Winning recommendation not found")
    
    destination = winner_rec.title
    
    # Delete existing logistics if any
    await session.exec(
        delete(TravelLogistics).where(
            TravelLogistics.trip_id == trip_id,
            TravelLogistics.participant_id == participant.id
        )
    )
    
    # Generate logistics using multi-agent system
    gateway = ModelGateway()
    planner = TravelPlannerAgent(gateway)
    
    results = await planner.plan_travel(
        trip_id=str(trip_id),
        participant_id=str(participant.id),
        source_location=source_location,
        destination=destination,
        departure_date=trip.target_start_date,
        return_date=trip.target_end_date,
        budget_max=budget_max
    )
    
    # Save to database
    logistics = TravelLogistics(
        trip_id=trip_id,
        participant_id=participant.id,
        model_name=results["metadata"].get("flight_metadata", {}).get("model_name", "gpt-4o"),
        prompt_variant="baseline"
    )
    session.add(logistics)
    await session.flush()
    
    # Save flight recommendations
    for flight_data in results.get("outbound_flights", []):
        flight_rec = FlightRecommendation(
            logistics_id=logistics.id,
            direction="outbound",
            rank=flight_data.get("rank", 1),
            airline=flight_data.get("airline", "Unknown"),
            airline_logo_url=flight_data.get("airline_logo_url"),
            flight_number=flight_data.get("flight_number", "N/A"),
            departure_airport=flight_data.get("departure_airport", ""),
            arrival_airport=flight_data.get("arrival_airport", ""),
            departure_time=dt.fromisoformat(flight_data.get("departure_time", trip.target_start_date.isoformat())),
            arrival_time=dt.fromisoformat(flight_data.get("arrival_time", trip.target_start_date.isoformat())),
            price_usd=float(flight_data.get("price_usd", 0)),
            duration_minutes=int(flight_data.get("duration_minutes", 0)),
            num_stops=int(flight_data.get("num_stops", 0)),
            extra=flight_data.get("extra", {})
        )
        session.add(flight_rec)
    
    for flight_data in results.get("return_flights", []):
        flight_rec = FlightRecommendation(
            logistics_id=logistics.id,
            direction="return",
            rank=flight_data.get("rank", 1),
            airline=flight_data.get("airline", "Unknown"),
            airline_logo_url=flight_data.get("airline_logo_url"),
            flight_number=flight_data.get("flight_number", "N/A"),
            departure_airport=flight_data.get("departure_airport", ""),
            arrival_airport=flight_data.get("arrival_airport", ""),
            departure_time=dt.fromisoformat(flight_data.get("departure_time", trip.target_end_date.isoformat())),
            arrival_time=dt.fromisoformat(flight_data.get("arrival_time", trip.target_end_date.isoformat())),
            price_usd=float(flight_data.get("price_usd", 0)),
            duration_minutes=int(flight_data.get("duration_minutes", 0)),
            num_stops=int(flight_data.get("num_stops", 0)),
            extra=flight_data.get("extra", {})
        )
        session.add(flight_rec)
    
    # Save hotel recommendations
    for hotel_data in results.get("hotels", []):
        hotel_rec = HotelRecommendation(
            logistics_id=logistics.id,
            rank=hotel_data.get("rank", 1),
            name=hotel_data.get("name", "Unknown Hotel"),
            star_rating=int(hotel_data.get("star_rating", 3)),
            check_in_date=dt.fromisoformat(hotel_data.get("check_in_date", trip.target_start_date.isoformat())),
            check_out_date=dt.fromisoformat(hotel_data.get("check_out_date", trip.target_end_date.isoformat())),
            num_nights=int(hotel_data.get("num_nights", 1)),
            price_per_night_usd=float(hotel_data.get("price_per_night_usd", 0)),
            total_price_usd=float(hotel_data.get("total_price_usd", 0)),
            address=hotel_data.get("address", ""),
            amenities=hotel_data.get("amenities", []),
            extra=hotel_data.get("extra", {})
        )
        session.add(hotel_rec)
    
    await session.commit()
    await session.refresh(logistics)
    
    return {
        "outbound_flights": results.get("outbound_flights", []),
        "return_flights": results.get("return_flights", []),
        "hotels": results.get("hotels", []),
        "metadata": results.get("metadata", {})
    }


@router.get("/{trip_id}/logistics")
async def get_travel_logistics(
    trip_id: UUID,
    user_email: str,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Retrieve existing travel logistics for the authenticated user."""
    from ...models import TravelLogistics, FlightRecommendation, HotelRecommendation
    
    # Find participant by email
    participant_result = await session.exec(
        select(Participant).where(
            Participant.trip_id == trip_id,
            Participant.email == user_email
        )
    )
    participant = participant_result.first()
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")
    
    # Get logistics
    logistics_result = await session.exec(
        select(TravelLogistics).where(
            TravelLogistics.trip_id == trip_id,
            TravelLogistics.participant_id == participant.id
        )
    )
    logistics = logistics_result.first()
    
    if not logistics:
        return {
            "outbound_flights": [],
            "return_flights": [],
            "hotels": []
        }
    
    # Get flight recommendations
    outbound_flights_result = await session.exec(
        select(FlightRecommendation).where(
            FlightRecommendation.logistics_id == logistics.id,
            FlightRecommendation.direction == "outbound"
        ).order_by(FlightRecommendation.rank)
    )
    outbound_flights = outbound_flights_result.all()
    
    return_flights_result = await session.exec(
        select(FlightRecommendation).where(
            FlightRecommendation.logistics_id == logistics.id,
            FlightRecommendation.direction == "return"
        ).order_by(FlightRecommendation.rank)
    )
    return_flights = return_flights_result.all()
    
    # Get hotel recommendations
    hotels_result = await session.exec(
        select(HotelRecommendation).where(
            HotelRecommendation.logistics_id == logistics.id
        ).order_by(HotelRecommendation.rank)
    )
    hotels = hotels_result.all()
    
    return {
        "outbound_flights": [
            {
                "id": str(f.id),
                "rank": f.rank,
                "airline": f.airline,
                "airline_logo_url": f.airline_logo_url,
                "flight_number": f.flight_number,
                "departure_airport": f.departure_airport,
                "arrival_airport": f.arrival_airport,
                "departure_time": f.departure_time.isoformat(),
                "arrival_time": f.arrival_time.isoformat(),
                "price_usd": f.price_usd,
                "duration_minutes": f.duration_minutes,
                "num_stops": f.num_stops,
            }
            for f in outbound_flights
        ],
        "return_flights": [
            {
                "id": str(f.id),
                "rank": f.rank,
                "airline": f.airline,
                "airline_logo_url": f.airline_logo_url,
                "flight_number": f.flight_number,
                "departure_airport": f.departure_airport,
                "arrival_airport": f.arrival_airport,
                "departure_time": f.departure_time.isoformat(),
                "arrival_time": f.arrival_time.isoformat(),
                "price_usd": f.price_usd,
                "duration_minutes": f.duration_minutes,
                "num_stops": f.num_stops,
            }
            for f in return_flights
        ],
        "hotels": [
            {
                "id": str(h.id),
                "rank": h.rank,
                "name": h.name,
                "star_rating": h.star_rating,
                "check_in_date": h.check_in_date.isoformat(),
                "check_out_date": h.check_out_date.isoformat(),
                "num_nights": h.num_nights,
                "price_per_night_usd": h.price_per_night_usd,
                "total_price_usd": h.total_price_usd,
                "address": h.address,
                "amenities": h.amenities,
            }
            for h in hotels
        ]
    }
