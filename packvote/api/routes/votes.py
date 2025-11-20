"""Voting endpoints for Pack Vote."""

from __future__ import annotations

from uuid import UUID

from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ...enums import AuditEventType, VoteStatus
from ...models import (
    AuditLog,
    DestinationRecommendation,
    Participant,
    Vote,
    VoteItem,
    VoteRound,
)
from ...schemas import (
    RecommendationRead,
    VoteRead,
    VoteResults,
    VoteRoundRead,
    VoteSubmission,
)
from ...services.voting import compute_instant_runoff
from ..dependencies import get_db_session

router = APIRouter()


async def _get_open_vote_round(session: AsyncSession, trip_id: UUID) -> VoteRound:
    vote_round_result = await session.exec(
        select(VoteRound)
        .where(VoteRound.trip_id == trip_id, VoteRound.status == VoteStatus.open)
        .options(selectinload(VoteRound.votes))
    )
    vote_round = vote_round_result.one_or_none()
    if vote_round:
        return vote_round
    vote_round = VoteRound(trip_id=trip_id)
    session.add(vote_round)
    await session.commit()
    await session.refresh(vote_round)
    return vote_round


async def _get_latest_vote_round(session: AsyncSession, trip_id: UUID) -> VoteRound:
    vote_round_result = await session.exec(
        select(VoteRound)
        .where(VoteRound.trip_id == trip_id)
        .order_by(VoteRound.created_at.desc())
        .options(selectinload(VoteRound.votes))
    )
    vote_round = vote_round_result.first()
    if vote_round:
        return vote_round
    
    # Fallback: create first round if none exist
    vote_round = VoteRound(trip_id=trip_id)
    session.add(vote_round)
    await session.commit()
    await session.refresh(vote_round)
    return vote_round


@router.post(
    "/{trip_id}/votes", response_model=VoteRead, status_code=status.HTTP_201_CREATED
)
async def submit_vote(
    trip_id: UUID,
    payload: VoteSubmission,
    x_user_email: Optional[str] = Header(None),
    session: AsyncSession = Depends(get_db_session),
) -> Vote:
    participant = await session.get(Participant, payload.participant_id)
    if not participant or participant.trip_id != trip_id:
        raise HTTPException(
            status_code=404, detail="Participant not found for this trip"
        )

    if x_user_email and participant.email != x_user_email:
        raise HTTPException(
            status_code=403, detail="Not authorized to vote for this participant"
        )

    sorted_rankings = sorted(payload.rankings, key=lambda entry: entry.rank)
    recommendation_uuid_ids = [item.recommendation_id for item in sorted_rankings]
    recommendation_ids = [str(item_id) for item_id in recommendation_uuid_ids]
    recs_result = await session.exec(
        select(DestinationRecommendation).where(
            DestinationRecommendation.trip_id == trip_id,
            DestinationRecommendation.id.in_(recommendation_uuid_ids),
        )
    )
    recs = recs_result.all()
    if len(recs) != len(recommendation_ids):
        raise HTTPException(
            status_code=400, detail="Invalid recommendation in rankings"
        )

    vote_round = await _get_open_vote_round(session, trip_id)

    if vote_round.candidates:
        allowed = set(vote_round.candidates)
        submitted = set(recommendation_ids)
        if not submitted.issubset(allowed):
            raise HTTPException(
                status_code=400,
                detail="Vote contains invalid candidates for this runoff round",
            )

    # Check for existing vote to support editing
    existing_vote_result = await session.exec(
        select(Vote)
        .where(
            Vote.vote_round_id == vote_round.id, Vote.participant_id == participant.id
        )
        .options(selectinload(Vote.items))
    )
    vote = existing_vote_result.one_or_none()

    if vote:
        # Update existing vote
        vote.rankings = recommendation_ids
        # Remove old items
        for item in vote.items:
            await session.delete(item)
        # Clear items locally to avoid issues
        vote.items = []
    else:
        # Create new vote
        vote = Vote(
            vote_round_id=vote_round.id,
            participant_id=participant.id,
            rankings=recommendation_ids,
        )
        session.add(vote)

    await session.flush()

    for item in sorted_rankings:
        session.add(
            VoteItem(
                vote_id=vote.id,
                recommendation_id=item.recommendation_id,
                rank=item.rank,
            )
        )

    session.add(
        AuditLog(
            trip_id=vote_round.trip_id,
            event_type=AuditEventType.vote_submitted,
            actor=participant.name,
            detail={
                "vote_round_id": str(vote_round.id),
                "action": "update" if existing_vote_result else "create",
            },
        )
    )

    await session.commit()
    await session.refresh(vote)
    return vote


@router.get("/{trip_id}/vote-rounds/current", response_model=VoteRoundRead)
async def get_current_vote_round(
    trip_id: UUID, session: AsyncSession = Depends(get_db_session)
) -> VoteRoundRead:
    vote_round = await _get_latest_vote_round(session, trip_id)
    return VoteRoundRead.model_validate(vote_round)


@router.get("/{trip_id}/results", response_model=VoteResults)
async def get_results(
    trip_id: UUID, session: AsyncSession = Depends(get_db_session)
) -> VoteResults:
    vote_round_result = await session.exec(
        select(VoteRound)
        .where(VoteRound.trip_id == trip_id)
        .order_by(VoteRound.created_at.desc())
        .options(selectinload(VoteRound.votes).selectinload(Vote.items))
    )
    vote_round = vote_round_result.first()
    if not vote_round:
        raise HTTPException(status_code=404, detail="No vote round for trip")

    recs_result = await session.exec(
        select(DestinationRecommendation).where(
            DestinationRecommendation.trip_id == trip_id
        )
    )
    recommendations = recs_result.all()
    results = compute_instant_runoff(recommendations, vote_round.votes)

    winner = results.get("winner")
    tied = results.get("tied")

    if winner:
        vote_round.results = results
        vote_round.status = VoteStatus.closed
    elif tied:
        if vote_round.candidates:
            # Already restricted -> Final Tie
            vote_round.results = results
            vote_round.status = VoteStatus.closed
            results["status"] = "tie"
        else:
            # Create Runoff
            vote_round.results = results
            vote_round.status = VoteStatus.closed
            results["status"] = "runoff_required"
            results["runoff_candidates"] = tied

            # Create new round
            new_round = VoteRound(
                trip_id=trip_id,
                candidates=tied,
                status=VoteStatus.open,
            )
            session.add(new_round)
    else:
        vote_round.results = results
        vote_round.status = VoteStatus.closed

    await session.commit()

    # Re-fetch to ensure relationships are loaded
    vote_round_result = await session.exec(
        select(VoteRound)
        .where(VoteRound.id == vote_round.id)
        .options(selectinload(VoteRound.votes))
    )
    vote_round = vote_round_result.one()

    return VoteResults(
        vote_round=VoteRoundRead.model_validate(vote_round),
        recommendations=[
            RecommendationRead.model_validate(rec) for rec in recommendations
        ],
    )
