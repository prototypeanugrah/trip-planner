"""Travel planner agent - main orchestrator for multi-agent travel logistics."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict

from langgraph.graph import END, StateGraph

from ...ai_gateway import ModelGateway
from ..flight_agent import FlightAgent
from ..hotel_agent import HotelAgent
from .budget_coordinator import BudgetCoordinator
from .state import (
    ITINERARY_BUDGET_RESERVE,
    MAX_REFINEMENT_ITERATIONS,
    TravelPlannerState,
)


class TravelPlannerAgent:
    """
    Multi-agent orchestrator with inter-agent communication for budget coordination.
    
    Architecture:
    1. Allocate travel_budget = total_budget - 300 (reserve for itinerary)
    2. Flight agent searches with allocated budget
    3. Hotel agent searches with remaining budget after flight cost
    4. Validate combined cost <= travel_budget
    5. If budget exceeded, refine recommendations iteratively
    6. Use conditional routing for refinement loop
    """

    def __init__(self, gateway: ModelGateway) -> None:
        self.gateway = gateway
        self.flight_agent = FlightAgent(gateway)
        self.hotel_agent = HotelAgent(gateway)
        self.budget_coordinator = BudgetCoordinator()
        self._graph = self._build_graph()

    def _build_graph(self) -> StateGraph:
        """Build the LangGraph state graph with all nodes and edges."""
        builder = StateGraph(TravelPlannerState)
        
        # Add all nodes
        builder.add_node("allocate_budget", self._allocate_budget)
        builder.add_node("search_flights", self._search_flights)
        builder.add_node("search_hotels", self._search_hotels)
        builder.add_node("validate_budget", self._validate_budget)
        builder.add_node("refine_recommendations", self._refine_recommendations)
        builder.add_node("finalize", self._finalize)
        
        # Define workflow
        builder.set_entry_point("allocate_budget")
        builder.add_edge("allocate_budget", "search_flights")
        builder.add_edge("search_flights", "search_hotels")
        builder.add_edge("search_hotels", "validate_budget")
        
        # Conditional routing based on budget compliance
        builder.add_conditional_edges(
            "validate_budget",
            self._should_refine,
            {"refine": "refine_recommendations", "finalize": "finalize"}
        )
        
        # Loop back after refinement
        builder.add_edge("refine_recommendations", "search_flights")
        builder.add_edge("finalize", END)
        
        return builder.compile()

    async def plan_travel(
        self,
        *,
        trip_id: str,
        participant_id: str,
        source_location: str,
        destination: str,
        departure_date: datetime,
        return_date: datetime,
        budget_max: float = 10000.0
    ) -> Dict[str, Any]:
        """
        Generate budget-coordinated travel logistics recommendations.
        
        Args:
            trip_id: Trip ID
            participant_id: Participant ID
            source_location: User's starting location
            destination: Trip destination
            departure_date: Trip start date
            return_date: Trip end date
            budget_max: User's TOTAL budget (travel_budget will be budget_max - 300)
            
        Returns:
            Dictionary with outbound_flights, return_flights, hotels lists
        """
        state: TravelPlannerState = {
            "trip_id": trip_id,
            "participant_id": participant_id,
            "source_location": source_location,
            "destination": destination,
            "departure_date": departure_date,
            "return_date": return_date,
            "total_budget": budget_max,
            "iteration": 0,
            "budget_compliant": False,
            "metadata": {}
        }
        
        try:
            result = await self._graph.ainvoke(state)
            return {
                "outbound_flights": result.get("outbound_flights", []),
                "return_flights": result.get("return_flights", []),
                "hotels": result.get("hotels", []),
                "metadata": {
                    **result.get("metadata", {}),
                    "total_cost": result.get("total_cost", 0),
                    "travel_budget": result.get("travel_budget", 0),
                    "iterations": result.get("iteration", 0)
                }
            }
        except Exception as e:
            print(f"Travel planner error: {e}")
            return {
                "outbound_flights": [],
                "return_flights": [],
                "hotels": [],
                "metadata": {"error": str(e)}
            }

    # ========================================================================
    # GRAPH NODE IMPLEMENTATIONS
    # ========================================================================

    async def _allocate_budget(self, state: TravelPlannerState) -> TravelPlannerState:
        """Allocate initial budget using BudgetCoordinator."""
        budgets = self.budget_coordinator.allocate_initial_budget(state["total_budget"])
        
        return {
            **budgets,
            "metadata": {
                **state.get("metadata", {}),
                "total_budget": state["total_budget"],
                "travel_budget_allocated": budgets["travel_budget"],
                "itinerary_reserve": ITINERARY_BUDGET_RESERVE
            }
        }

    async def _search_flights(self, state: TravelPlannerState) -> TravelPlannerState:
        """Search for flights with allocated budget."""
        try:
            flight_results = await self.flight_agent.search(
                source_location=state["source_location"],
                destination=state["destination"],
                departure_date=state["departure_date"],
                return_date=state["return_date"],
                budget_max=state.get("flight_budget", state.get("travel_budget", 10000.0))
            )
            
            outbound = flight_results.get("outbound_flights", [])
            returns = flight_results.get("return_flights", [])
            
            # Calculate best flight cost for coordination
            best_flight_cost = self.budget_coordinator.calculate_best_flight_cost(
                outbound, returns
            )
            
            return {
                "outbound_flights": outbound,
                "return_flights": returns,
                "metadata": {
                    **state.get("metadata", {}),
                    "flight_metadata": flight_results.get("metadata", {}),
                    "best_flight_cost": best_flight_cost
                }
            }
        except Exception as e:
            print(f"Flight search error: {e}")
            return {
                "outbound_flights": [],
                "return_flights": [],
                "error": f"Flight search failed: {str(e)}"
            }

    async def _search_hotels(self, state: TravelPlannerState) -> TravelPlannerState:
        """Search for hotels with remaining budget after flight cost."""
        try:
            # Agent communication: hotel gets remaining budget
            best_flight_cost = state.get("metadata", {}).get("best_flight_cost", 0)
            hotel_budget = self.budget_coordinator.calculate_remaining_hotel_budget(
                travel_budget=state.get("travel_budget", 10000.0),
                best_flight_cost=best_flight_cost,
                fallback_budget=state.get("hotel_budget", 0)
            )
            
            hotel_results = await self.hotel_agent.search(
                destination=state["destination"],
                check_in_date=state["departure_date"],
                check_out_date=state["return_date"],
                budget_max=hotel_budget
            )
            
            hotels = hotel_results.get("hotels", [])
            best_hotel_cost = self.budget_coordinator.calculate_best_hotel_cost(hotels)
            
            return {
                "hotels": hotels,
                "metadata": {
                    **state.get("metadata", {}),
                    "hotel_metadata": hotel_results.get("metadata", {}),
                    "best_hotel_cost": best_hotel_cost,
                    "hotel_budget_used": hotel_budget
                }
            }
        except Exception as e:
            print(f"Hotel search error: {e}")
            return {"hotels": [], "error": f"Hotel search failed: {str(e)}"}

    async def _validate_budget(self, state: TravelPlannerState) -> TravelPlannerState:
        """Validate combined cost using BudgetCoordinator."""
        best_flight_cost = state.get("metadata", {}).get("best_flight_cost", 0)
        best_hotel_cost = state.get("metadata", {}).get("best_hotel_cost", 0)
        travel_budget = state.get("travel_budget", 10000.0)
        
        total_cost, budget_compliant = self.budget_coordinator.validate_budget_compliance(
            best_flight_cost, best_hotel_cost, travel_budget
        )
        
        print(
            f"Budget validation: flight=${best_flight_cost:.2f}, "
            f"hotel=${best_hotel_cost:.2f}, total=${total_cost:.2f}, "
            f"budget=${travel_budget:.2f}, compliant={budget_compliant}"
        )
        
        return {
            "total_cost": total_cost,
            "budget_compliant": budget_compliant,
            "metadata": {
                **state.get("metadata", {}),
                "budget_validation": {
                    "total_cost": total_cost,
                    "travel_budget": travel_budget,
                    "compliant": budget_compliant,
                    "iteration": state.get("iteration", 0)
                }
            }
        }

    def _should_refine(self, state: TravelPlannerState) -> str:
        """Conditional routing: refine or finalize."""
        budget_compliant = state.get("budget_compliant", False)
        iteration = state.get("iteration", 0)
        
        if not budget_compliant and iteration < MAX_REFINEMENT_ITERATIONS:
            return "refine"
        return "finalize"

    async def _refine_recommendations(self, state: TravelPlannerState) -> TravelPlannerState:
        """Refine budget allocation using BudgetCoordinator."""
        iteration = state.get("iteration", 0) + 1
        
        refined = self.budget_coordinator.refine_budgets(
            travel_budget=state.get("travel_budget", 10000.0),
            best_flight_cost=state.get("metadata", {}).get("best_flight_cost", 0),
            best_hotel_cost=state.get("metadata", {}).get("best_hotel_cost", 0)
        )
        
        print(
            f"Refinement iteration {iteration}: "
            f"flight=${refined['new_flight_budget']:.2f}, "
            f"hotel=${refined['new_hotel_budget']:.2f}"
        )
        
        return {
            "iteration": iteration,
            "flight_budget": refined["new_flight_budget"],
            "hotel_budget": refined["new_hotel_budget"],
            "metadata": {
                **state.get("metadata", {}),
                f"refinement_{iteration}": refined
            }
        }

    async def _finalize(self, state: TravelPlannerState) -> TravelPlannerState:
        """Finalize recommendations with summary metadata."""
        return {
            "metadata": {
                **state.get("metadata", {}),
                "completed": True,
                "final_budget_compliant": state.get("budget_compliant", False),
                "final_total_cost": state.get("total_cost", 0),
                "total_iterations": state.get("iteration", 0)
            }
        }
