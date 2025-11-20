"""Agent for generating day-by-day itineraries."""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional, TypedDict

from langchain_core.prompts import PromptTemplate
from langchain_tavily import TavilySearch
from langgraph.graph import END, StateGraph

from ..ai_gateway import ModelGateway, ModelRequest
from .recommendation_agent import PreferenceSummary, TripWindow, _format_preferences, _format_window_text


class ItineraryAgentState(TypedDict, total=False):
    trip_window: TripWindow
    preferences: PreferenceSummary
    location: str
    prompt_variant: str
    search_results: str
    prompt: str
    itinerary: List[Dict[str, Any]]
    metadata: Dict[str, Any]


class ItineraryAgent:
    """Agent that builds prompts and generates detailed itineraries."""

    _PROMPT = PromptTemplate.from_template(
        (
            "You are an expert travel planner creating a detailed day-by-day itinerary for a trip to {location}.\n"
            "Travel window: {window_text}.\n"
            "Group preferences: {preference_text}.\n"
            "Generate a day-by-day itinerary. For each day, list 2-3 key activities.\n"
            "Return the result as a JSON array of objects, where each object represents a day and has:\n"
            "- 'day': integer (1, 2, ...)\n"
            "- 'date': string (YYYY-MM-DD) or 'Day X' if dates are unknown\n"
            "- 'activities': list of objects, each with:\n"
            "  - 'title': string (JUST the name of the specific place/venue/restaurant/attraction, e.g., 'Bangla Road', 'The Golden Temple', 'Mama's Fish House' - NOT 'nightlife at bangla road')\n"
            "  - 'description': string (brief one line description of what to do at this location, e.g., 'Experience vibrant nightlife with bars and clubs')\n"
            "  - 'location': object with 'lat' (float) and 'lng' (float) coordinates (approximate is fine, but try to be accurate)\n"
            "  - 'tags': list of strings showing preference categories (e.g., ['nightlife', 'food', 'culture', 'outdoor', 'shopping'])\n"
            "  - 'cost': string, one of '$', '$$', or '$$$' (budget/moderate/expensive)\n"
            "  - 'duration': string in format 'X min' or 'X hours' (e.g., '120 min', '2 hours')\n"
            "Ensure the itinerary is logical, considers the duration, and aligns with preferences."
        )
    )

    def __init__(self, gateway: ModelGateway) -> None:
        self.gateway = gateway
        
        # Initialize Tavily search tool
        tavily_api_key = os.getenv("TAVILY_API_KEY")
        self.search_tool = TavilySearch(api_key=tavily_api_key, max_results=5) if tavily_api_key else None
        
        builder = StateGraph(ItineraryAgentState)
        builder.add_node("search", self._search)
        builder.add_node("compose_prompt", self._compose_prompt)
        builder.add_node("generate", self._generate)
        builder.set_entry_point("search")
        builder.add_edge("search", "compose_prompt")
        builder.add_edge("compose_prompt", "generate")
        builder.add_edge("generate", END)
        self._graph = builder.compile()

    async def generate(
        self,
        *,
        trip_window: TripWindow,
        preference_summary: PreferenceSummary,
        location: str,
        prompt_variant: str = "baseline",
    ) -> List[Dict[str, Any]]:
        state: ItineraryAgentState = {
            "trip_window": trip_window,
            "preferences": preference_summary,
            "location": location,
            "prompt_variant": prompt_variant,
        }
        result = await self._graph.ainvoke(state)
        return result.get("itinerary", [])

    async def _search(self, state: ItineraryAgentState) -> ItineraryAgentState:
        """Search for current information about the destination."""
        if not self.search_tool:
            return {"search_results": ""}
        
        location = state["location"]
        window_text = _format_window_text(state["trip_window"])
        preference_text = _format_preferences(state["preferences"])
        
        # Create search query
        search_query = f"travel guide {location} {window_text} activities events things to do {preference_text}"
        
        try:
            results = await self.search_tool.ainvoke({"query": search_query})
            # Format results as text
            search_text = "\n".join([f"- {r.get('content', '')}" for r in results if r.get('content')])
            return {"search_results": search_text}
        except Exception as e:
            print(f"Tavily search error: {e}")
            return {"search_results": ""}
    
    async def _compose_prompt(self, state: ItineraryAgentState) -> ItineraryAgentState:
        window_text = _format_window_text(state["trip_window"])
        preference_text = _format_preferences(state["preferences"])
        
        # Include search results in the prompt if available
        search_context = ""
        if state.get("search_results"):
            search_context = f"\n\nCurrent information about {state['location']}:\n{state['search_results']}\n"
        
        prompt = self._PROMPT.format(
            location=state["location"],
            window_text=window_text,
            preference_text=preference_text,
        ) + search_context
        
        return {"prompt": prompt}

    async def _generate(self, state: ItineraryAgentState) -> ItineraryAgentState:
        prompt = state["prompt"]
        request = ModelRequest(
            prompt=prompt,
            prompt_variant=state["prompt_variant"],
            metadata={"provider": self.gateway.default_order[0] if self.gateway.default_order else "openai", "agent": "itinerary"},
            max_tokens=2000,
        )

        response = await self.gateway.generate(request)
        itinerary = self._parse_itinerary(response.content)
        
        # Fallback if parsing fails or returns empty
        if not itinerary:
             itinerary = self._fallback_itinerary(state["trip_window"], state["location"])

        return {
            "itinerary": itinerary,
            "metadata": {
                "model_name": response.model_name,
                "prompt_variant": response.prompt_variant,
                "cost_usd": response.cost_usd,
            },
        }

    def _parse_itinerary(self, text: str) -> List[Dict[str, Any]]:
        try:
            # Try to find JSON array in text
            start = text.find("[")
            end = text.rfind("]")
            if start != -1 and end != -1 and end > start:
                json_str = text[start : end + 1]
                return json.loads(json_str)
            return []
        except json.JSONDecodeError:
            return []

    def _fallback_itinerary(self, trip_window: TripWindow, location: str) -> List[Dict[str, Any]]:
        """Generate a simple fallback itinerary if AI fails."""
        duration = trip_window.get("duration_days") or 3
        itinerary = []
        for i in range(1, duration + 1):
            itinerary.append({
                "day": i,
                "date": f"Day {i}",
                "activities": [
                    {
                        "title": f"Explore {location}",
                        "description": "Walk around and see the sights.",
                        "location": {"lat": 0.0, "lng": 0.0},
                        "tags": ["exploration"],
                        "cost": "$$",
                        "duration": "180 min"
                    }
                ]
            })
        return itinerary
