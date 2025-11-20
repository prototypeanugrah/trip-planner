"""Budget coordination logic for multi-agent travel planning."""

from __future__ import annotations

from typing import Any, Dict, List

from .state import (
    BUDGET_SAFETY_MARGIN,
    INITIAL_FLIGHT_BUDGET_RATIO,
    INITIAL_HOTEL_BUDGET_RATIO,
    ITINERARY_BUDGET_RESERVE,
)


class BudgetCoordinator:
    """Handles budget allocation, calculation, and validation for travel planning."""

    @staticmethod
    def allocate_initial_budget(total_budget: float) -> Dict[str, float]:
        """
        Allocate initial budget: travel_budget = total_budget - ITINERARY_RESERVE.
        
        Args:
            total_budget: User's total budget
            
        Returns:
            Dict with travel_budget, flight_budget, hotel_budget
        """
        travel_budget = total_budget - ITINERARY_BUDGET_RESERVE
        flight_budget = travel_budget * INITIAL_FLIGHT_BUDGET_RATIO
        hotel_budget = travel_budget * INITIAL_HOTEL_BUDGET_RATIO
        
        return {
            "travel_budget": travel_budget,
            "flight_budget": flight_budget,
            "hotel_budget": hotel_budget,
        }

    @staticmethod
    def calculate_best_flight_cost(
        outbound_flights: List[Dict[str, Any]], 
        return_flights: List[Dict[str, Any]]
    ) -> float:
        """
        Calculate combined cost of best outbound and return flights.
        
        Args:
            outbound_flights: List of outbound flight options
            return_flights: List of return flight options
            
        Returns:
            Combined cost of rank 1 flights, or 0 if not available
        """
        if not outbound_flights or not return_flights:
            return 0.0
        
        best_outbound = next(
            (f for f in outbound_flights if f.get("rank") == 1), 
            outbound_flights[0] if outbound_flights else None
        )
        best_return = next(
            (f for f in return_flights if f.get("rank") == 1), 
            return_flights[0] if return_flights else None
        )
        
        if best_outbound and best_return:
            return best_outbound.get("price_usd", 0) + best_return.get("price_usd", 0)
        return 0.0

    @staticmethod
    def calculate_best_hotel_cost(hotels: List[Dict[str, Any]]) -> float:
        """
        Calculate cost of best hotel recommendation.
        
        Args:
            hotels: List of hotel options
            
        Returns:
            Total cost of rank 1 hotel, or 0 if not available
        """
        if not hotels:
            return 0.0
        
        best_hotel = next(
            (h for h in hotels if h.get("rank") == 1), 
            hotels[0] if hotels else None
        )
        return best_hotel.get("total_price_usd", 0) if best_hotel else 0.0

    @staticmethod
    def calculate_remaining_hotel_budget(
        travel_budget: float,
        best_flight_cost: float,
        fallback_budget: float
    ) -> float:
        """
        Calculate how much budget remains for hotels after flight cost.
        
        This enables agent communication: hotel agent knows the flight cost
        and gets the remaining budget.
        
        Args:
            travel_budget: Total budget for travel logistics
            best_flight_cost: Cost of selected flights
            fallback_budget: Minimum budget to allocate
            
        Returns:
            Budget available for hotels
        """
        remaining = travel_budget - best_flight_cost
        return max(remaining, fallback_budget)

    @staticmethod
    def validate_budget_compliance(
        best_flight_cost: float,
        best_hotel_cost: float,
        travel_budget: float
    ) -> tuple[float, bool]:
        """
        Check if combined cost fits within travel budget.
        
        Args:
            best_flight_cost: Cost of best flights
            best_hotel_cost: Cost of best hotel
            travel_budget: Allocated travel budget
            
        Returns:
            Tuple of (total_cost, is_compliant)
        """
        total_cost = best_flight_cost + best_hotel_cost
        is_compliant = total_cost <= travel_budget
        return total_cost, is_compliant

    @staticmethod
    def refine_budgets(
        travel_budget: float,
        best_flight_cost: float,
        best_hotel_cost: float
    ) -> Dict[str, float]:
        """
        Calculate refined budgets when initial allocation exceeds travel_budget.
        
        Strategy: Reduce both budgets proportionally with a safety margin.
        
        Args:
            travel_budget: Total budget for travel logistics
            best_flight_cost: Current best flight cost
            best_hotel_cost: Current best hotel cost
            
        Returns:
            Dict with new_flight_budget and new_hotel_budget
        """
        total_cost = best_flight_cost + best_hotel_cost
        
        if total_cost > travel_budget:
            reduction_factor = (travel_budget / total_cost) * BUDGET_SAFETY_MARGIN
            new_flight_budget = best_flight_cost * reduction_factor
            new_hotel_budget = best_hotel_cost * reduction_factor
        else:
            # Fallback to equal split (shouldn't happen in normal flow)
            new_flight_budget = travel_budget * 0.5
            new_hotel_budget = travel_budget * 0.5
        
        return {
            "new_flight_budget": new_flight_budget,
            "new_hotel_budget": new_hotel_budget
        }
