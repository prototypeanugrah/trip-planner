"\"\"\"LangGraph-powered recommendation agent that only uses preferences + travel dates.\"\"\""

from __future__ import annotations

from collections import Counter
from typing import Any, Dict, List, Optional, TypedDict

from langchain_core.prompts import PromptTemplate
from langgraph.graph import END, StateGraph

from ..models import SurveyResponse, Trip
from .ai_gateway import ModelGateway, ModelRequest, ModelResponse


class TripWindow(TypedDict, total=False):
    start_date: Optional[str]
    end_date: Optional[str]
    duration_days: Optional[int]
    season_hint: Optional[str]


class PreferenceSummary(TypedDict, total=False):
    preference_counts: Dict[str, int]
    top_preferences: List[str]
    participant_count: int


class RecommendationAgentState(TypedDict, total=False):
    trip_window: TripWindow
    preferences: PreferenceSummary
    candidate_count: int
    prompt_variant: str
    custom_preference: Optional[str]
    prompt: str
    recommendations: List[Dict[str, Any]]
    metadata: Dict[str, Any]


def build_trip_window(trip: Trip) -> TripWindow:
    """Return ISO-formatted travel window information derived solely from trip dates."""

    start_iso: Optional[str] = None
    end_iso: Optional[str] = None
    duration_days: Optional[int] = None
    if trip.target_start_date:
        start_iso = trip.target_start_date.date().isoformat()
    if trip.target_end_date:
        end_iso = trip.target_end_date.date().isoformat()
    if trip.target_start_date and trip.target_end_date:
        delta = trip.target_end_date.date() - trip.target_start_date.date()
        duration_days = max(1, delta.days)

    season_hint: Optional[str] = None
    reference_date = trip.target_start_date or trip.target_end_date
    if reference_date:
        season_hint = _season_from_month(reference_date.month)

    return {
        "start_date": start_iso,
        "end_date": end_iso,
        "duration_days": duration_days,
        "season_hint": season_hint,
    }


def summarize_preferences(responses: List[SurveyResponse]) -> PreferenceSummary:
    """Aggregate participant preference tags without exposing personal identifiers."""

    counts: Counter[str] = Counter()
    participant_samples = 0

    for response in responses:
        answers = response.answers or {}
        raw_preferences = answers.get("preferences")
        if not isinstance(raw_preferences, list):
            continue
        normalized = [str(pref).strip().lower() for pref in raw_preferences if isinstance(pref, str) and pref.strip()]
        if not normalized:
            continue
        participant_samples += 1
        counts.update(normalized)

    top_preferences = [pref for pref, _ in counts.most_common()]
    return {
        "preference_counts": dict(counts),
        "top_preferences": top_preferences,
        "participant_count": participant_samples,
    }


class RecommendationAgent:
    """LangGraph agent that builds prompts and generates recommendations."""

    _PROMPT = PromptTemplate.from_template(
        (
            "You are an AI travel planner building destinations for a group trip.\n"
            "Travel window: {window_text}.\n"
            "Top group preferences (frequency): {preference_text}.\n"
            "{custom_preference_text}"
            "Return exactly {candidate_count} unique destination ideas as JSON array. "
            "Each item must include title, description, vibe, estimated_cost, "
            "highlights, travel_tips, and confidence (0-1). "
            "Use only the provided preferences and travel window; do not assume names "
            "or specific personal details."
        )
    )

    def __init__(self, gateway: ModelGateway) -> None:
        self.gateway = gateway
        builder = StateGraph(RecommendationAgentState)
        builder.add_node("compose_prompt", self._compose_prompt)
        builder.add_node("generate", self._generate)
        builder.set_entry_point("compose_prompt")
        builder.add_edge("compose_prompt", "generate")
        builder.add_edge("generate", END)
        self._graph = builder.compile()

    async def generate(
        self,
        *,
        trip_window: TripWindow,
        preference_summary: PreferenceSummary,
        candidate_count: int,
        prompt_variant: str,
        custom_preference: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        state: RecommendationAgentState = {
            "trip_window": trip_window,
            "preferences": preference_summary,
            "candidate_count": candidate_count,
            "prompt_variant": prompt_variant,
            "custom_preference": custom_preference,
        }
        result = await self._graph.ainvoke(state)
        return result.get("recommendations", [])

    def build_prompt(
        self,
        *,
        trip_window: TripWindow,
        preference_summary: PreferenceSummary,
        candidate_count: int,
        custom_preference: Optional[str] = None,
    ) -> str:
        """Expose prompt rendering for tests."""

        window_text = _format_window_text(trip_window)
        preference_text = _format_preferences(preference_summary)
        custom_preference_text = f"Additional user instructions: {custom_preference}.\n" if custom_preference else ""

        return self._PROMPT.format(
            window_text=window_text,
            preference_text=preference_text,
            custom_preference_text=custom_preference_text,
            candidate_count=candidate_count,
        )

    async def _compose_prompt(self, state: RecommendationAgentState) -> RecommendationAgentState:
        prompt = self.build_prompt(
            trip_window=state["trip_window"],
            preference_summary=state["preferences"],
            candidate_count=state["candidate_count"],
            custom_preference=state.get("custom_preference"),
        )
        metadata = {
            "preference_counts": state["preferences"].get("preference_counts", {}),
            "duration_days": state["trip_window"].get("duration_days"),
        }
        return {"prompt": prompt, "metadata": metadata}

    async def _generate(self, state: RecommendationAgentState) -> RecommendationAgentState:
        prompt = state["prompt"]
        candidate_count = state["candidate_count"]
        request = ModelRequest(
            prompt=prompt,
            prompt_variant=state["prompt_variant"],
            trip_id=None,
            metadata={"provider": self.gateway.default_order[0] if self.gateway.default_order else "openai", "agent": "langgraph"},
            max_tokens=1200,
        )

        response = await self.gateway.generate(request)
        payloads = self.gateway.format_recommendation_payload([response], max_items=candidate_count)

        if len(payloads) < candidate_count:
            payloads.extend(
                self._synthesize_recommendations(
                    trip_window=state["trip_window"],
                    preference_summary=state["preferences"],
                    shortfall=candidate_count - len(payloads),
                    response=response,
                )
            )

        # Trim in case the LLM returned more than needed after synthesis.
        payloads = payloads[:candidate_count]
        return {
            "recommendations": payloads,
            "metadata": {
                **state.get("metadata", {}),
                "model_name": response.model_name,
                "prompt_variant": response.prompt_variant,
                "cost_usd": response.cost_usd,
            },
        }

    def _synthesize_recommendations(
        self,
        *,
        trip_window: TripWindow,
        preference_summary: PreferenceSummary,
        shortfall: int,
        response: ModelResponse,
    ) -> List[Dict[str, Any]]:
        """Deterministic structured recommendations when the provider gives no JSON."""

        synthesized: List[Dict[str, Any]] = []
        top_preferences = preference_summary.get("top_preferences") or []
        season = trip_window.get("season_hint")
        duration = trip_window.get("duration_days")
        window_text = _format_window_text(trip_window)

        for idx in range(shortfall):
            pref_key = top_preferences[idx % len(top_preferences)] if top_preferences else "exploration"
            template = _PREFERENCE_LIBRARY.get(pref_key, _PREFERENCE_LIBRARY["exploration"])
            title = f"{template['title']} ({pref_key.replace('_', ' ').title()}) #{idx + 1}".strip()
            description = template["description"].format(
                window=window_text,
                season=season or "any season",
                duration=duration or "flexible",
            )
            synthesized.append(
                {
                    "title": title,
                    "description": description,
                    "model_name": response.model_name or "contextual-synth",
                    "prompt_variant": response.prompt_variant,
                    "usage": response.usage,
                    "cost_usd": response.cost_usd,
                    "details": {
                        "vibe": template["vibe"],
                        "estimated_cost": template["estimated_cost"],
                        "highlights": template["highlights"],
                        "travel_tips": template["travel_tips"],
                        "confidence": 0.55,
                        "source": "preference_synthesis",
                    },
                }
            )
        return synthesized


def _format_window_text(window: TripWindow) -> str:
    start = window.get("start_date") or "flexible start"
    end = window.get("end_date") or "flexible end"
    duration = window.get("duration_days")
    duration_text = f"{duration} days" if duration else "flexible duration"
    season = window.get("season_hint")
    if season:
        return f"{start} to {end} ({duration_text}, likely {season} season)"
    return f"{start} to {end} ({duration_text})"


def _format_preferences(preferences: PreferenceSummary) -> str:
    counts = preferences.get("preference_counts") or {}
    if not counts:
        return "no dominant preferences provided"
    ordered = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    return ", ".join(f"{pref}: {count}" for pref, count in ordered)


def _season_from_month(month: int) -> str:
    if month in (12, 1, 2):
        return "winter"
    if month in (3, 4, 5):
        return "spring"
    if month in (6, 7, 8):
        return "summer"
    return "autumn"


_PREFERENCE_LIBRARY: Dict[str, Dict[str, Any]] = {
    "beaches": {
        "title": "Coastal Escape",
        "description": "Blend low-key surf towns and protected coves for {duration}. {window} is ideal for quieter sands and {season} breezes.",
        "vibe": "Sunrise swims and beach club evenings",
        "estimated_cost": 2100,
        "highlights": ["Snorkeling reefs", "Catamaran sunset sail", "Local seafood crawl"],
        "travel_tips": ["Pack reef-safe sunscreen", "Reserve coastal lodging early"],
    },
    "city_sightseeing": {
        "title": "Urban Discovery Circuit",
        "description": "Stack design-forward cities with walkable districts. {window} lets you pair museums with skyline lounges.",
        "vibe": "Gallery mornings, rooftop nights",
        "estimated_cost": 2300,
        "highlights": ["Modern art tours", "Chef's table tasting", "Hidden speakeasies"],
        "travel_tips": ["Prebook skip-the-line passes", "Use metro day cards"],
    },
    "outdoor_adventures": {
        "title": "High-Energy Expedition",
        "description": "Alternate alpine hikes with river canyons. {duration} gives room for acclimation and a finale via zip-line course.",
        "vibe": "Trail dawns, campfire nights",
        "estimated_cost": 2000,
        "highlights": ["Guided summit day", "White-water rafting", "Stargazing lodge"],
        "travel_tips": ["Layer technical fabrics", "Schedule rest day mid-trip"],
    },
    "festivals_events": {
        "title": "Festival & Culture Loop",
        "description": "Anchor the itinerary around seasonal celebrations happening {window}. Balance street parades with culinary pop-ups.",
        "vibe": "Live music bursts, late-night tastings",
        "estimated_cost": 2400,
        "highlights": ["Insider festival passes", "Local market tour", "After-hours DJ set"],
        "travel_tips": ["Book tickets as soon as they drop", "Stay near transit corridors"],
    },
    "food_exploration": {
        "title": "Culinary Field Trip",
        "description": "Progress from farmers' markets to chef-led kitchens. {duration} lets you mix cooking classes with vineyard tastings.",
        "vibe": "Hands-on cooking, twilight pairings",
        "estimated_cost": 2200,
        "highlights": ["Regional tasting menu", "Winery blending lab", "Street food safari"],
        "travel_tips": ["Reserve teaching kitchens", "Note dietary preferences early"],
    },
    "nightlife": {
        "title": "After-Dusk Playground",
        "description": "Focus on districts where lounges, live sets, and speakeasies cluster. {window} promises peak venue lineups.",
        "vibe": "Late-night DJ sets, neon walks",
        "estimated_cost": 2100,
        "highlights": ["VIP club table", "Craft cocktail class", "Sunrise recovery brunch"],
        "travel_tips": ["Pack smart casual attire", "Plan safe rides after midnight"],
    },
    "shopping": {
        "title": "Design & Market Trail",
        "description": "Pair flagship boutiques with heritage markets. {duration} keeps room for custom fittings and shipping logistics.",
        "vibe": "Boutique afternoons, concept store drops",
        "estimated_cost": 2500,
        "highlights": ["Personal stylist session", "Artisan workshop visit", "Duty-free finale"],
        "travel_tips": ["Bring expandable luggage", "Track currency conversion fees"],
    },
    "spa_wellness": {
        "title": "Wellness Sanctuary Loop",
        "description": "Cycle through hot springs, forest bathing, and guided breathwork. {window} is perfect for slow mornings.",
        "vibe": "Thermal soaks, meditation decks",
        "estimated_cost": 2300,
        "highlights": ["Private yoga retreat", "Hydrotherapy circuit", "Organic chef table"],
        "travel_tips": ["Reserve therapists ahead", "Limit screen time to reset"],
    },
    "exploration": {
        "title": "Balanced Escape",
        "description": "Use {duration} to blend light adventure with cultural detours. {window} keeps timing flexible across hemispheres.",
        "vibe": "Curated mix of activity and downtime",
        "estimated_cost": 2000,
        "highlights": ["Guided neighborhood walk", "Boat excursion", "Taste of local cuisine"],
        "travel_tips": ["Stay central for easy pivots", "Keep a buffer day for surprises"],
    },
}
