"""Recommendation generation pipeline."""

from __future__ import annotations

from typing import List

from sqlmodel import delete, select
from sqlmodel.ext.asyncio.session import AsyncSession

from ..enums import RecommendationStatus
from ..models import (
    DestinationRecommendation,
    Survey,
    SurveyResponse,
    Trip,
    Vote,
    VoteItem,
    VoteRound,
)
from ..schemas import RecommendationCreate
from .ai_gateway import ModelGateway
from .metrics import recommendation_generated_counter
from .agents.recommendation_agent import (
    RecommendationAgent,
    build_trip_window,
    summarize_preferences,
)


class RecommendationService:
    """Orchestrates prompt building, model execution, and persistence."""

    def __init__(self, gateway: ModelGateway) -> None:
        self.gateway = gateway
        self.agent = RecommendationAgent(gateway)

    async def generate_for_trip(
        self,
        session: AsyncSession,
        trip: Trip,
        request: RecommendationCreate,
    ) -> List[DestinationRecommendation]:
        responses = await session.exec(
            select(SurveyResponse)
            .where(SurveyResponse.prompt_variant == request.prompt_variant)
            .join(Survey)
            .where(Survey.trip_id == trip.id)
        )
        response_list = responses.all()

        trip_window = build_trip_window(trip)
        preference_summary = summarize_preferences(response_list)

        formatted = await self.agent.generate(
            trip_window=trip_window,
            preference_summary=preference_summary,
            candidate_count=request.candidate_count,
            prompt_variant=request.prompt_variant,
            custom_preference=request.custom_preference,
        )

        # Clear existing recommendations before saving new ones
        # This also requires clearing associated votes to maintain referential integrity
        # and reset the voting state as requested.

        # 1. Find all vote rounds for this trip
        vote_rounds_result = await session.exec(
            select(VoteRound).where(VoteRound.trip_id == trip.id)
        )
        vote_rounds = vote_rounds_result.all()

        # 2. Delete all vote items, votes, and vote rounds
        for round in vote_rounds:
            # Delete votes associated with the round
            votes_result = await session.exec(
                select(Vote).where(Vote.vote_round_id == round.id)
            )
            votes = votes_result.all()
            for vote in votes:
                # Delete vote items
                await session.exec(delete(VoteItem).where(VoteItem.vote_id == vote.id))
                await session.delete(vote)
            await session.delete(round)

        # 3. Delete existing recommendations
        await session.exec(
            delete(DestinationRecommendation).where(
                DestinationRecommendation.trip_id == trip.id
            )
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
            recommendation_generated_counter.labels(
                rec.prompt_variant, rec.model_name
            ).inc()

        await session.flush()
        return recommendations
