"""Ranked-choice voting utilities."""

from __future__ import annotations

from collections import Counter, defaultdict
from typing import Iterable, List
from uuid import UUID

from ..models import DestinationRecommendation, Vote, VoteItem, VoteRound


def instant_runoff_round(recommendations: List[UUID], ballots: List[List[UUID]]) -> tuple[UUID | None, dict[UUID, int]]:
    tally = Counter()
    for ballot in ballots:
        for choice in ballot:
            if choice in recommendations:
                tally[choice] += 1
                break
    if not tally:
        return None, {}
    total_votes = sum(tally.values())
    for candidate, count in tally.items():
        if count > total_votes / 2:
            return candidate, dict(tally)
    lowest = min(tally.values())
    eliminated = [cand for cand, count in tally.items() if count == lowest]
    for elim in eliminated:
        recommendations.remove(elim)
    return None, dict(tally)


def compute_instant_runoff(recommendations: Iterable[DestinationRecommendation], votes: Iterable[Vote]) -> dict:
    recommendation_ids = [rec.id for rec in recommendations]
    ballots: List[List[UUID]] = []
    for vote in votes:
        ballot = sorted(
            (item.recommendation_id for item in vote.items),
            key=lambda rec_id: next(item.rank for item in vote.items if item.recommendation_id == rec_id),
        )
        ballots.append(ballot)

    active_candidates = recommendation_ids.copy()
    rounds: list[dict[UUID, int]] = []
    winner: UUID | None = None

    while active_candidates and winner is None:
        winner, tally = instant_runoff_round(active_candidates, ballots)
        rounds.append(tally)

    return {
        "winner": str(winner) if winner else None,
        "rounds": [{str(candidate): votes for candidate, votes in round_tally.items()} for round_tally in rounds],
    }


def summarize_votes(vote_round: VoteRound) -> dict:
    results = vote_round.results.copy()
    results.setdefault("status", vote_round.status.value)
    return results


