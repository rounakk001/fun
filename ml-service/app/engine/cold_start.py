"""
cold_start.py — Cold-Start Strategy Resolver.

Handles the three cold-start scenarios:
  1. Brand-new anonymous user (no userId, no session history).
  2. New registered user (userId exists but < min_interactions events).
  3. Partially warmed user (some data but not enough for full collaborative filtering).

Strategy waterfall:
  - Personalized (collaborative) — requires ≥ min_interactions events
  - Semi-personalized (content-based on last watched + trending blend) — ≥ 1 interaction
  - Popularity fallback (trending + globally popular) — zero interactions

This module only decides WHICH strategy to use.
The actual recommendation calls are made by hybrid.py.
"""
from enum import Enum
from typing import Optional


class ColdStartStrategy(str, Enum):
    """Recommendation strategy selector based on user interaction history depth."""
    PERSONALIZED = "personalized"           # Full collaborative + content-based blend
    SEMI_PERSONALIZED = "semi_personalized" # Content-based on recent history + trending
    POPULARITY = "popularity"               # Pure trending + popular (no user signal)


def resolve_strategy(
    user_id: Optional[str],
    interaction_count: int,
    min_interactions_for_full: int = 5,
    min_interactions_for_semi: int = 1
) -> ColdStartStrategy:
    """
    Decide which recommendation strategy to apply for a user.

    Args:
        user_id: MongoDB ObjectId string, or None for anonymous session.
        interaction_count: How many tracked events exist for this user.
        min_interactions_for_full: Threshold for personalized recommendations.
        min_interactions_for_semi: Threshold for semi-personalized recommendations.

    Returns:
        ColdStartStrategy enum value.

    Rationale:
        - 0 interactions → no signal at all → popularity only
        - 1–4 interactions → some signal, not enough for reliable matrix factorization
          → use last-watched video as content-based seed + trending blend
        - ≥ 5 interactions → enough to compute collaborative embeddings reliably
    """
    if not user_id:
        # Anonymous session: no persistent user, can only use popularity
        return ColdStartStrategy.POPULARITY

    if interaction_count < min_interactions_for_semi:
        return ColdStartStrategy.POPULARITY

    if interaction_count < min_interactions_for_full:
        return ColdStartStrategy.SEMI_PERSONALIZED

    return ColdStartStrategy.PERSONALIZED


def get_user_interaction_count(user_id: str, interaction_counts: dict) -> int:
    """
    Look up the interaction count for a user_id from the collaborative model's
    precomputed interaction_counts dictionary.

    Returns 0 if user is unknown (new user).
    """
    return interaction_counts.get(user_id, 0)
