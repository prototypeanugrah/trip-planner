"""State definition for travel planner multi-agent system."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional, TypedDict


class TravelPlannerState(TypedDict, total=False):
    """
    Shared state for travel planner orchestrator with inter-agent communication.
    
    This state is passed between all nodes in the LangGraph workflow and enables
    agents to coordinate on budget constraints.
    """
    # Input parameters
    trip_id: str
    participant_id: str
    source_location: str
    destination: str
    departure_date: datetime
    return_date: datetime
    total_budget: float  # User's total budget
    travel_budget: float  # Budget for flights + hotels (total - ITINERARY_RESERVE)
    
    # Dynamic budget allocation (updated during refinement)
    flight_budget: float
    hotel_budget: float
    
    # Sub-agent outputs
    outbound_flights: List[Dict[str, Any]]
    return_flights: List[Dict[str, Any]]
    hotels: List[Dict[str, Any]]
    
    # Coordination state
    iteration: int  # Refinement iteration counter
    budget_compliant: bool  # Whether total cost fits within travel_budget
    total_cost: float  # Combined cost of best flight + best hotel
    
    # Metadata and errors
    metadata: Dict[str, Any]
    error: Optional[str]


# Configuration constants
ITINERARY_BUDGET_RESERVE = 300.0  # Reserve for itinerary activities
INITIAL_FLIGHT_BUDGET_RATIO = 0.6  # 60% of travel budget initially
INITIAL_HOTEL_BUDGET_RATIO = 0.4   # 40% of travel budget initially
MAX_REFINEMENT_ITERATIONS = 3      # Prevent infinite loops
BUDGET_SAFETY_MARGIN = 0.95        # 5% safety margin when refining
