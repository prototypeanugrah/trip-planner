"""Flight search sub-agent using LangGraph and Tavily."""

from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Any, Dict, List, TypedDict

from langchain_core.prompts import PromptTemplate
from langchain_tavily import TavilySearch
from langgraph.graph import END, StateGraph

from ..ai_gateway import ModelGateway, ModelRequest


class FlightAgentState(TypedDict, total=False):
    """State for the flight search agent."""
    source_location: str
    destination: str
    departure_date: datetime
    return_date: datetime
    budget_max: float
    
    # Search results
    outbound_search_results: str
    return_search_results: str
    
    # Structured recommendations
    outbound_flights: List[Dict[str, Any]]
    return_flights: List[Dict[str, Any]]
    
    metadata: Dict[str, Any]


class FlightAgent:
    """Agent that searches for flight recommendations using Tavily + LLM."""

    _SEARCH_PROMPT = """Search for flights from {source} to {destination} on {date}.
Find current pricing, airlines, and flight durations. Include direct flights and flights with stops."""

    _STRUCTURE_PROMPT = PromptTemplate.from_template(
        """You are a  flight search expert. Based on the following search results about flights from {source} to {destination} on {date}, 
extract and structure the TOP 3 flight options.

Search Results:
{search_results}

Return a JSON array of exactly 3 flight options (or fewer if less data available). Each should have:
- airline: string (airline name, e.g., "United Airlines")
- airline_logo_url: string (URL to airline logo, use https://www.gstatic.com/flights/airline_logos/70px/[IATA].png where [IATA] is the 2-letter airline code)
- flight_number: string (e.g., "UA1234")
- departure_airport: string (3-letter IATA code for {source})
- arrival_airport: string (3-letter IATA code for {destination})
- departure_time: string (ISO format with timezone, e.g., "2024-12-25T08:00:00-06:00")
- arrival_time: string (ISO format with timezone)
- price_usd: number (best price found)
- duration_minutes: number (total travel time including layovers)
- num_stops: number (0 for direct, 1+ for connecting)

Rank them by: 1) best overall value (price + convenience), 2) second best, 3) budget option.
Budget maximum: ${budget_max}. Filter out any flights exceeding this budget.

IMPORTANT: Return ONLY valid JSON array, no other text."""
    )

    def __init__(self, gateway: ModelGateway) -> None:
        self.gateway = gateway
        tavily_api_key = os.getenv("TAVILY_API_KEY")
        self.search_tool = TavilySearch(api_key=tavily_api_key, max_results=5) if tavily_api_key else None

        builder = StateGraph(FlightAgentState)
        builder.add_node("search_outbound", self._search_outbound)
        builder.add_node("search_return", self._search_return)
        builder.add_node("structure_outbound", self._structure_outbound)
        builder.add_node("structure_return", self._structure_return)
        
        builder.set_entry_point("search_outbound")
        builder.add_edge("search_outbound", "structure_outbound")
        builder.add_edge("structure_outbound", "search_return")
        builder.add_edge("search_return", "structure_return")
        builder.add_edge("structure_return", END)
        
        self._graph = builder.compile()

    async def search(
        self,
        *,
        source_location: str,
        destination: str,
        departure_date: datetime,
        return_date: datetime,
        budget_max: float = 10000.0
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Search for outbound and return flights."""
        state: FlightAgentState = {
            "source_location": source_location,
            "destination": destination,
            "departure_date": departure_date,
            "return_date": return_date,
            "budget_max": budget_max,
        }
        
        result = await self._graph.ainvoke(state)
        
        return {
            "outbound_flights": result.get("outbound_flights", []),
            "return_flights": result.get("return_flights", []),
            "metadata": result.get("metadata", {})
        }

    async def _search_outbound(self, state: FlightAgentState) -> FlightAgentState:
        """Search for outbound flights using Tavily."""
        if not self.search_tool:
            return {"outbound_search_results": "No search tool available"}
        
        query = self._SEARCH_PROMPT.format(
            source=state["source_location"],
            destination=state["destination"],
            date=state["departure_date"].strftime("%Y-%m-%d")
        )
        
        try:
            results = await self.search_tool.ainvoke({"query": query})
            search_text = "\n".join([f"- {r.get('content', '')}" for r in results if r.get('content')])
            return {"outbound_search_results": search_text}
        except Exception as e:
            print(f"Tavily search error (outbound): {e}")
            return {"outbound_search_results": "Search failed"}

    async def _search_return(self, state: FlightAgentState) -> FlightAgentState:
        """Search for return flights using Tavily."""
        if not self.search_tool:
            return {"return_search_results": "No search tool available"}
        
        query = self._SEARCH_PROMPT.format(
            source=state["destination"],
            destination=state["source_location"],
            date=state["return_date"].strftime("%Y-%m-%d")
        )
        
        try:
            results = await self.search_tool.ainvoke({"query": query})
            search_text = "\n".join([f"- {r.get('content', '')}" for r in results if r.get('content')])
            return {"return_search_results": search_text}
        except Exception as e:
            print(f"Tavily search error (return): {e}")
            return {"return_search_results": "Search failed"}

    async def _structure_outbound(self, state: FlightAgentState) -> FlightAgentState:
        """Structure outbound flight search results using LLM."""
        prompt = self._STRUCTURE_PROMPT.format(
            source=state["source_location"],
            destination=state["destination"],
            date=state["departure_date"].strftime("%Y-%m-%d"),
            search_results=state.get("outbound_search_results", ""),
            budget_max=state.get("budget_max", 10000)
        )
        
        request = ModelRequest(
            prompt=prompt,
            metadata={"agent": "flight", "direction": "outbound"},
            max_tokens=1500,
        )
        
        response = await self.gateway.generate(request)
        flights = self._parse_flights(response.content)
        
        # Fallback to mock data if parsing failed or returned no flights
        if not flights:
            print(f"No outbound flights parsed, using mock data")
            flights = self._generate_mock_flights(
                state["source_location"],
                state["destination"],
                state["departure_date"],
                "outbound"
            )
        
        return {
            "outbound_flights": flights,
            "metadata": {"model_name": response.model_name}
        }

    async def _structure_return(self, state: FlightAgentState) -> FlightAgentState:
        """Structure return flight search results using LLM."""
        prompt = self._STRUCTURE_PROMPT.format(
            source=state["destination"],
            destination=state["source_location"],
            date=state["return_date"].strftime("%Y-%m-%d"),
            search_results=state.get("return_search_results", ""),
            budget_max=state.get("budget_max", 10000)
        )
        
        request = ModelRequest(
            prompt=prompt,
            metadata={"agent": "flight", "direction": "return"},
            max_tokens=1500,
        )
        
        response = await self.gateway.generate(request)
        flights = self._parse_flights(response.content)
        
        # Fallback to mock data if parsing failed or returned no flights
        if not flights:
            print(f"No return flights parsed, using mock data")
            flights = self._generate_mock_flights(
                state["destination"],
                state["source_location"],
                state["return_date"],
                "return"
            )
        
        return {"return_flights": flights}

    def _parse_flights(self, text: str) -> List[Dict[str, Any]]:
        """Parse flight data from LLM JSON response."""
        try:
            start = text.find("[")
            end = text.rfind("]")
            if start != -1 and end != -1 and end > start:
                json_str = text[start:end + 1]
                flights = json.loads(json_str)
                # Add ranks if not present
                for i, flight in enumerate(flights[:3]):
                    flight["rank"] = i + 1
                return flights[:3]
            return []
        except json.JSONDecodeError:
            return []
