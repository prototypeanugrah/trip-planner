"""Hotel search sub-agent using LangGraph and Tavily."""

from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Any, Dict, List, TypedDict

from langchain_core.prompts import PromptTemplate
from langchain_tavily import TavilySearch
from langgraph.graph import END, StateGraph

from ..ai_gateway import ModelGateway, ModelRequest


class HotelAgentState(TypedDict, total=False):
    """State for the hotel search agent."""
    destination: str
    check_in_date: datetime
    check_out_date: datetime
    num_nights: int
    budget_max: float
    
    # Search results
    search_results: str
    
    # Structured recommendations
    hotels: List[Dict[str, Any]]
    metadata: Dict[str, Any]


class HotelAgent:
    """Agent that searches for hotel recommendations using Tavily + LLM."""

    _SEARCH_PROMPT = """Search for hotels in {destination} for check-in on {check_in} and check-out on {check_out} ({num_nights} nights).
Find current pricing, hotel ratings (star ratings), amenities, and locations. Include a range of budget options."""

    _STRUCTURE_PROMPT = PromptTemplate.from_template(
        """You are a hotel search expert. Based on the following search results about hotels in {destination} 
for {num_nights} nights (check-in: {check_in}, check-out: {check_out}), extract and structure the TOP 3 hotel options.

Search Results:
{search_results}

Return a JSON array of exactly 3 hotel options (or fewer if less data available). Each should have:
- name: string (hotel name)
- star_rating: number (1-5, based on hotel quality/class)
- check_in_date: string (ISO format: "{check_in}")
- check_out_date: string (ISO format: "{check_out}")
- num_nights: number ({num_nights})
- price_per_night_usd: number (price per night)
- total_price_usd: number (price_per_night * num_nights)
- address: string (hotel address or area in {destination})
- amenities: array of strings (e.g., ["WiFi", "Pool", "Breakfast", "Gym", "Parking"])

Rank them by: 1) best overall value (quality + price), 2) mid-range option, 3) budget-friendly option.
Budget maximum for total stay: ${budget_max}. Filter out any hotels where total_price_usd exceeds this budget.

IMPORTANT: Return ONLY valid JSON array, no other text."""
    )

    def __init__(self, gateway: ModelGateway) -> None:
        self.gateway = gateway
        tavily_api_key = os.getenv("TAVILY_API_KEY")
        self.search_tool = TavilySearch(api_key=tavily_api_key, max_results=5) if tavily_api_key else None

        builder = StateGraph(HotelAgentState)
        builder.add_node("search_hotels", self._search_hotels)
        builder.add_node("structure_hotels", self._structure_hotels)
        
        builder.set_entry_point("search_hotels")
        builder.add_edge("search_hotels", "structure_hotels")
        builder.add_edge("structure_hotels", END)
        
        self._graph = builder.compile()

    async def search(
        self,
        *,
        destination: str,
        check_in_date: datetime,
        check_out_date: datetime,
        budget_max: float = 10000.0
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Search for hotel recommendations."""
        num_nights = (check_out_date - check_in_date).days
        
        state: HotelAgentState = {
            "destination": destination,
            "check_in_date": check_in_date,
            "check_out_date": check_out_date,
            "num_nights": num_nights,
            "budget_max": budget_max,
        }
        
        result = await self._graph.ainvoke(state)
        
        return {
            "hotels": result.get("hotels", []),
            "metadata": result.get("metadata", {})
        }

    async def _search_hotels(self, state: HotelAgentState) -> HotelAgentState:
        """Search for hotels using Tavily."""
        if not self.search_tool:
            return {"search_results": "No search tool available"}
        
        query = self._SEARCH_PROMPT.format(
            destination=state["destination"],
            check_in=state["check_in_date"].strftime("%Y-%m-%d"),
            check_out=state["check_out_date"].strftime("%Y-%m-%d"),
            num_nights=state["num_nights"]
        )
        
        try:
            results = await self.search_tool.ainvoke({"query": query})
            search_text = "\n".join([f"- {r.get('content', '')}" for r in results if r.get('content')])
            return {"search_results": search_text}
        except Exception as e:
            print(f"Tavily search error (hotels): {e}")
            return {"search_results": "Search failed"}

    async def _structure_hotels(self, state: HotelAgentState) -> HotelAgentState:
        """Structure hotel search results using LLM."""
        prompt = self._STRUCTURE_PROMPT.format(
            destination=state["destination"],
            check_in=state["check_in_date"].strftime("%Y-%m-%d"),
            check_out=state["check_out_date"].strftime("%Y-%m-%d"),
            num_nights=state["num_nights"],
            search_results=state.get("search_results", ""),
            budget_max=state.get("budget_max", 10000)
        )
        
        request = ModelRequest(
            prompt=prompt,
            metadata={"agent": "hotel"},
            max_tokens=1500,
        )
        
        response = await self.gateway.generate(request)
        hotels = self._parse_hotels(response.content)
        
        return {
            "hotels": hotels,
            "metadata": {"model_name": response.model_name}
        }

    def _parse_hotels(self, text: str) -> List[Dict[str, Any]]:
        """Parse hotel data from LLM JSON response."""
        try:
            start = text.find("[")
            end = text.rfind("]")
            if start != -1 and end != -1 and end > start:
                json_str = text[start:end + 1]
                hotels = json.loads(json_str)
                # Add ranks if not present
                for i, hotel in enumerate(hotels[:3]):
                    hotel["rank"] = i + 1
                return hotels[:3]
            return []
        except json.JSONDecodeError:
            return []
