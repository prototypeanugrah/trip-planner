"""Recommendation generation pipeline."""

from __future__ import annotations

from typing import Dict, List

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ..enums import RecommendationStatus
from ..models import DestinationRecommendation, Survey, SurveyResponse, Trip
from ..schemas import RecommendationCreate
from .ai_gateway import ModelGateway, ModelRequest
from .metrics import recommendation_generated_counter


DEFAULT_FALLBACK_RECOMMENDATIONS: List[Dict[str, object]] = [
    {
        "title": "Lisbon & Algarve Road Trip",
        "description": "Blend city culture in Lisbon with coastal relaxation in the Algarve. Ideal for groups who want architecture, cuisine, and surf-friendly beaches.",
        "details": {
            "vibe": "Cultural afternoons, beach sunsets",
            "estimated_cost": 2100,
            "travel_tips": ["Use trains between cities", "Reserve beach villas early"],
        },
    },
    {
        "title": "Santorini & Crete Island Hop",
        "description": "Iconic caldera views in Santorini followed by laid-back tavernas and hidden coves in Crete.",
        "details": {
            "vibe": "Romantic evenings, seaside adventures",
            "estimated_cost": 2300,
            "travel_tips": ["Catch sunrise in Oia", "Rent a car to explore Crete"],
        },
    },
    {
        "title": "Bali Wellness Escape",
        "description": "Balinese massages, rice-terrace hikes, and beach clubs on the Bukit Peninsula make for a restorative-yet-active getaway.",
        "details": {
            "vibe": "Spa mornings, sunset surf",
            "estimated_cost": 1900,
            "travel_tips": ["Dress modestly for temples", "Book a villa with a plunge pool"],
        },
    },
    {
        "title": "Costa Rica Cloud Forest Adventure",
        "description": "Zip-lines, volcanic hot springs, and Pacific surf towns deliver a balanced itinerary of adrenaline and pura vida downtime.",
        "details": {
            "vibe": "Rainforest mornings, chill evenings",
            "estimated_cost": 2200,
            "travel_tips": ["Pack lightweight rain gear", "Plan a night hike to spot wildlife"],
        },
    },
    {
        "title": "Phuket & Phi Phi Discovery",
        "description": "Thai cooking classes by day and island-hopping long-tail boats by dawn across turquoise waters.",
        "details": {
            "vibe": "Lively nights, tranquil bays",
            "estimated_cost": 1800,
            "travel_tips": ["Visit Phi Phi at sunrise", "Sample night markets in Phuket Town"],
        },
    },
    {
        "title": "Barcelona & Balearic Break",
        "description": "Tapas-fueled city energy transitions into sailboat days around Mallorca’s hidden coves.",
        "details": {
            "vibe": "Creative city strolls, Mediterranean swims",
            "estimated_cost": 2400,
            "travel_tips": ["Reserve Sagrada Família tickets ahead", "Charter a catamaran for a day trip"],
        },
    },
]


class RecommendationService:
    """Orchestrates prompt building, model execution, and persistence."""

    def __init__(self, gateway: ModelGateway) -> None:
        self.gateway = gateway

    async def generate_for_trip(
        self,
        session: AsyncSession,
        trip: Trip,
        request: RecommendationCreate,
    ) -> List[DestinationRecommendation]:
        prompt = await self._build_prompt(session, trip, request)
        model_request = ModelRequest(
            prompt=prompt,
            prompt_variant=request.prompt_variant,
            trip_id=str(trip.id),
            metadata={"provider": self.gateway.default_order[0] if self.gateway.default_order else "openai"},
            max_tokens=1200,
        )

        response = await self.gateway.generate(model_request)
        formatted = self.gateway.format_recommendation_payload(
            [response], max_items=request.candidate_count * 4
        )
        recommendations: List[DestinationRecommendation] = []
        seen_titles: set[str] = set()
        for payload in formatted:
            title = (payload.get("title") or "Destination Idea").strip()
            if title.lower() in seen_titles:
                continue
            seen_titles.add(title.lower())
            rec = DestinationRecommendation(
                trip_id=trip.id,
                title=title,
                description=payload.get("description", ""),
                prompt_version=trip.prompt_bundle_version,
                model_name=payload.get("model_name", "unknown"),
                prompt_variant=payload.get("prompt_variant", request.prompt_variant),
                status=RecommendationStatus.completed,
                evaluation=payload.get("evaluation", {}),
                extra={"usage": payload.get("usage", {}), **payload.get("details", {})},
                cost_usd=payload.get("cost_usd"),
            )
            session.add(rec)
            recommendations.append(rec)
            recommendation_generated_counter.labels(rec.prompt_variant, rec.model_name).inc()
            if len(recommendations) >= request.candidate_count:
                break

        if len(recommendations) < request.candidate_count:
            fallback_payloads = self._fallback_payloads(
                request.candidate_count - len(recommendations),
                seen_titles,
            )
            for payload in fallback_payloads:
                rec = DestinationRecommendation(
                    trip_id=trip.id,
                    title=payload.get("title", "Destination Idea"),
                    description=payload.get("description", ""),
                    prompt_version=trip.prompt_bundle_version,
                    model_name=response.model_name,
                    prompt_variant=request.prompt_variant,
                    status=RecommendationStatus.completed,
                    evaluation={},
                    extra={"usage": response.usage, **payload.get("details", {})},
                    cost_usd=response.cost_usd,
                )
                session.add(rec)
                recommendations.append(rec)
                recommendation_generated_counter.labels(rec.prompt_variant, rec.model_name).inc()
                if len(recommendations) >= request.candidate_count:
                    break

        await session.flush()
        return recommendations

    async def _build_prompt(self, session: AsyncSession, trip: Trip, request: RecommendationCreate) -> str:
        surveys = await session.exec(select(Survey).where(Survey.trip_id == trip.id))
        survey_list = surveys.all()
        responses = await session.exec(
            select(SurveyResponse)
            .where(SurveyResponse.prompt_variant == request.prompt_variant)
            .join(Survey)
            .where(Survey.trip_id == trip.id)
        )
        response_list = responses.all()

        prompt_lines = [
            f"Trip name: {trip.name}",
            f"Organizer: {trip.organizer_name}",
            f"Budget range: {trip.budget_min or 'unknown'} - {trip.budget_max or 'unknown'}",
            f"Dates: {trip.target_start_date or 'unknown'} to {trip.target_end_date or 'unknown'}",
            f"Tags: {', '.join(trip.tags) if trip.tags else 'none'}",
            "Participants:",
        ]

        for participant in trip.participants:
            prompt_lines.append(f"- {participant.name} ({participant.role})")

        prompt_lines.append("Survey responses summary:")
        for response in response_list:
            answers_preview = ", ".join(f"{k}: {v}" for k, v in response.answers.items())
            prompt_lines.append(f"- {response.participant_id}: {answers_preview}")

        prompt_lines.append("Survey questions overview:")
        for survey in survey_list:
            prompt_lines.append(f"Survey {survey.name} ({survey.survey_type})")
            for question in survey.questions:
                prompt_lines.append(f"  * {question.get('text', 'question')} [{question.get('type', 'text')}]")

        prompt_lines.append(
            "Generate realistic travel destinations tailored to group preferences."
            " Return JSON list with title, description, vibe, estimated_cost, highlights,"
            " travel_tips, and confidence score."
        )
        return "\n".join(prompt_lines)

    def _fallback_payloads(self, needed: int, seen_titles: set[str]) -> List[Dict[str, object]]:
        payloads: List[Dict[str, object]] = []
        for candidate in DEFAULT_FALLBACK_RECOMMENDATIONS:
            key = candidate["title"].strip().lower()
            if key in seen_titles:
                continue
            payloads.append(candidate)
            seen_titles.add(key)
            if len(payloads) >= needed:
                return payloads

        counter = 1
        while len(payloads) < needed:
            title = f"Destination Idea {len(seen_titles) + counter}"
            key = title.lower()
            counter += 1
            if key in seen_titles:
                continue
            payloads.append(
                {
                    "title": title,
                    "description": "Curated placeholder suggestion generated for development mode.",
                    "details": {},
                }
            )
            seen_titles.add(key)
        return payloads
