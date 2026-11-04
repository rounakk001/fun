"""
hybrid.py — Hybrid Recommendation Engine

Orchestrates candidate generation, merging, filtering, diversity reranking, and
freshness boosting from three underlying signals:

  Signal           Weight   Notes
  ─────────────────────────────────────────────────────────────────────────────
  Collaborative    0.50     User-item matrix SVD scores (implicit feedback)
  Content-Based    0.30     TF-IDF cosine similarity to user's recent watches
  Popularity       0.20     Time-decayed trending + all-time popular

Two top-level recommendation surfaces:

  1. HOME FEED (for a given user_id)
     - PERSONALIZED:    0.50 CF + 0.30 CB (seeded from last-watched) + 0.20 Pop
     - SEMI-PERSONAL:   0.60 CB (last-watched seed) + 0.40 Pop
     - COLD-START:      0.70 Trending + 0.30 Popular

  2. SIMILAR VIDEOS (for a given video_id, user context optional)
     - Always content-based primary (cosine similarity)
     - Optionally boosted by collaborative signal if user data available
     - Diversity reranked with MMR

Candidate pool is deliberately oversized (top_k × 3) before ranking and
diversity filtering to improve final list quality.

Scores from different algorithms are normalized to [0, 1] before blending
so that TF-IDF cosines (0–1), SVD scores (arbitrary), and popularity scores
(arbitrary) are comparable.
"""

import math
import numpy as np
from typing import List, Dict, Any, Optional, Set

from app.models.content_based import ContentBasedRecommender
from app.models.collaborative import CollaborativeFilteringRecommender
from app.models.popularity import PopularityRecommender
from app.engine.cold_start import (
    ColdStartStrategy,
    resolve_strategy,
    get_user_interaction_count
)
from app.engine.diversity import mmr_rerank, category_diversity_filter


# ---------------------------------------------------------------------------
# Blending weights — document reasoning to avoid magic numbers
# ---------------------------------------------------------------------------

# Home feed weights (personalized path)
# CF has the most predictive signal; CB guards against popularity bias;
# Popularity injects freshness so feed doesn't stagnate on old CF embeddings.
HOME_WEIGHT_CF = 0.50
HOME_WEIGHT_CB = 0.30
HOME_WEIGHT_POP = 0.20

# Home feed weights (semi-personalized — not enough CF data yet)
# Shift toward content-based since we have at least one watched video.
SEMI_WEIGHT_CB = 0.60
SEMI_WEIGHT_POP = 0.40

# Similar-video weights (content always leads; CF provides personalization lift)
SIMILAR_WEIGHT_CB = 0.70
SIMILAR_WEIGHT_CF = 0.30

# Freshness boost constants
# Videos published in the last 72 hours get a multiplicative bonus.
# Rationale: newly uploaded content should get exposure before embeddings catch up.
FRESHNESS_WINDOW_HOURS = 72.0
FRESHNESS_BOOST = 1.15       # 15% score increase for fresh content

# Minimum candidate pool multiplier
CANDIDATE_POOL_MULTIPLIER = 3


def _normalize_scores(candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Min-max normalize score field to [0, 1] in-place (returns same list)."""
    if not candidates:
        return candidates
    scores = [c["score"] for c in candidates]
    min_s, max_s = min(scores), max(scores)
    spread = max_s - min_s if max_s > min_s else 1.0
    for c in candidates:
        c["score"] = (c["score"] - min_s) / spread
    return candidates


def _apply_freshness_boost(
    candidates: List[Dict[str, Any]],
    video_metadata: Dict[str, Dict[str, Any]],
    window_hours: float = FRESHNESS_WINDOW_HOURS,
    boost_factor: float = FRESHNESS_BOOST
) -> List[Dict[str, Any]]:
    """
    Apply a multiplicative freshness boost to recently uploaded videos.
    Requires video_metadata[video_id]["age_hours"] to be pre-computed.
    """
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)

    for c in candidates:
        vid = c["video_id"]
        meta = video_metadata.get(vid, {})
        age_hours = meta.get("age_hours")

        if age_hours is None:
            # Compute from createdAt if available
            created_at = meta.get("createdAt")
            if isinstance(created_at, datetime):
                if created_at.tzinfo is None:
                    created_at = created_at.replace(tzinfo=timezone.utc)
                age_hours = (now - created_at).total_seconds() / 3600.0
            else:
                age_hours = window_hours + 1  # unknown age → no boost

        if age_hours <= window_hours:
            c["score"] *= boost_factor
            c["freshness_boosted"] = True

    return candidates


def _deduplicate(candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Remove duplicate video_ids, keeping the highest-score entry."""
    seen: Dict[str, float] = {}
    result: List[Dict[str, Any]] = []
    for c in sorted(candidates, key=lambda x: x["score"], reverse=True):
        vid = c["video_id"]
        if vid not in seen:
            seen[vid] = c["score"]
            result.append(c)
    return result


def _merge_weighted(
    source_lists: List[tuple],  # [(weight, candidates_list), ...]
) -> List[Dict[str, Any]]:
    """
    Merge and weight-blend multiple candidate lists.

    Each list is normalized first, then multiplied by its weight.
    Results are deduplicated with highest blended score kept.
    """
    blended: Dict[str, Dict[str, Any]] = {}

    for weight, candidates in source_lists:
        normalized = _normalize_scores(list(candidates))  # copy
        for c in normalized:
            vid = c["video_id"]
            weighted_score = c["score"] * weight
            if vid not in blended:
                blended[vid] = dict(c)
                blended[vid]["score"] = weighted_score
                blended[vid]["sources"] = [c.get("algorithm", "unknown")]
            else:
                blended[vid]["score"] += weighted_score
                algo = c.get("algorithm", "unknown")
                if algo not in blended[vid].get("sources", []):
                    blended[vid].setdefault("sources", []).append(algo)

    result = list(blended.values())
    for item in result:
        item["algorithm"] = "hybrid:" + "+".join(sorted(item.pop("sources", ["hybrid"])))
    return result


class HybridRecommendationEngine:
    """
    Top-level hybrid engine that wraps all three Phase 3 recommenders.
    Stateless beyond holding references to the sub-models.
    """

    def __init__(
        self,
        content_model: ContentBasedRecommender,
        collab_model: CollaborativeFilteringRecommender,
        popularity_model: PopularityRecommender,
    ):
        self.content_model = content_model
        self.collab_model = collab_model
        self.popularity_model = popularity_model

        # Build a fast lookup: video_id → metadata dict for freshness and category info
        self._video_meta: Dict[str, Dict[str, Any]] = {}
        self._rebuild_video_meta()

    def _rebuild_video_meta(self):
        """Rebuild video metadata index from popularity model's video list."""
        self._video_meta = {}
        for v in self.popularity_model.videos:
            vid = str(v["_id"])
            self._video_meta[vid] = {
                "category": v.get("category"),
                "owner": str(v.get("owner", "")),
                "createdAt": v.get("createdAt"),
            }

    def _get_video_owner_set(self, video_ids: List[str]) -> Set[str]:
        """Get the set of owner IDs for a list of video IDs."""
        return {
            self._video_meta[vid]["owner"]
            for vid in video_ids
            if vid in self._video_meta and self._video_meta[vid].get("owner")
        }

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def recommend_home(
        self,
        user_id: Optional[str],
        top_k: int = 20,
        exclude_video_ids: Optional[List[str]] = None,
        last_watched_video_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate a personalized home feed for a user.

        Returns:
            dict with keys: recommendations (list), strategy (str), is_cold_start (bool)
        """
        pool_size = top_k * CANDIDATE_POOL_MULTIPLIER
        exclude_ids = set(exclude_video_ids or [])

        # --- Resolve cold-start strategy ---
        interaction_count = get_user_interaction_count(
            user_id or "",
            self.collab_model.user_interaction_counts if self.collab_model.is_fitted else {}
        )
        strategy = resolve_strategy(user_id, interaction_count)

        candidates: List[Dict[str, Any]] = []

        if strategy == ColdStartStrategy.PERSONALIZED:
            # --- Path A: Full personalized blend ---
            cf_candidates = self.collab_model.recommend_for_user(
                user_id=user_id,
                top_k=pool_size,
                exclude_interacted=True
            )

            cb_seed_id = last_watched_video_id
            cb_candidates = []
            if cb_seed_id and self.content_model.is_fitted:
                cb_candidates = self.content_model.recommend_similar(
                    video_id=cb_seed_id,
                    top_k=pool_size,
                    exclude_ids=list(exclude_ids)
                )

            pop_candidates = self.popularity_model.get_trending(top_k=pool_size)

            sources = [(HOME_WEIGHT_CF, cf_candidates)]
            if cb_candidates:
                sources.append((HOME_WEIGHT_CB, cb_candidates))
                sources.append((HOME_WEIGHT_POP, pop_candidates))
            else:
                # No CB signal: redistribute CB weight to popularity
                sources.append((HOME_WEIGHT_CB + HOME_WEIGHT_POP, pop_candidates))

            candidates = _merge_weighted(sources)

        elif strategy == ColdStartStrategy.SEMI_PERSONALIZED:
            # --- Path B: Content-based seed + popularity ---
            cb_seed_id = last_watched_video_id
            cb_candidates = []
            if cb_seed_id and self.content_model.is_fitted:
                cb_candidates = self.content_model.recommend_similar(
                    video_id=cb_seed_id,
                    top_k=pool_size,
                    exclude_ids=list(exclude_ids)
                )

            pop_candidates = self.popularity_model.get_trending(top_k=pool_size)

            if cb_candidates:
                candidates = _merge_weighted([
                    (SEMI_WEIGHT_CB, cb_candidates),
                    (SEMI_WEIGHT_POP, pop_candidates)
                ])
            else:
                candidates = _merge_weighted([(1.0, pop_candidates)])

        else:
            # --- Path C: Cold-start — pure popularity ---
            trending = self.popularity_model.get_trending(top_k=pool_size)
            popular = self.popularity_model.get_popular(top_k=pool_size)
            candidates = _merge_weighted([
                (0.70, trending),
                (0.30, popular)
            ])

        # --- Filter excluded IDs ---
        candidates = [c for c in candidates if c["video_id"] not in exclude_ids]

        # --- Apply freshness boost ---
        candidates = _apply_freshness_boost(candidates, self._video_meta)

        # --- Diversity reranking (MMR) ---
        if self.content_model.is_fitted and self.content_model.tfidf_matrix is not None:
            candidates = mmr_rerank(
                candidates=candidates,
                tfidf_matrix=self.content_model.tfidf_matrix,
                id_to_index=self.content_model.id_to_index,
                top_k=top_k,
                lambda_weight=0.7
            )
        else:
            # Fallback: category diversity cap
            candidates = category_diversity_filter(candidates, max_per_category=4, top_k=top_k)

        return {
            "recommendations": candidates[:top_k],
            "strategy": strategy.value,
            "is_cold_start": strategy == ColdStartStrategy.POPULARITY,
            "interaction_count": interaction_count
        }

    def recommend_similar(
        self,
        video_id: str,
        user_id: Optional[str] = None,
        top_k: int = 15,
        exclude_video_ids: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Find videos similar to video_id.
        Optionally personalizes using collaborative signal if user_id is known.
        """
        pool_size = top_k * CANDIDATE_POOL_MULTIPLIER
        exclude_ids = set(exclude_video_ids or [])
        exclude_ids.add(video_id)  # always exclude the source video

        cb_candidates = []
        if self.content_model.is_fitted:
            cb_candidates = self.content_model.recommend_similar(
                video_id=video_id,
                top_k=pool_size,
                exclude_ids=list(exclude_ids)
            )

        # Optionally blend collaborative signal if user provided and model is warm
        cf_candidates = []
        if (
            user_id
            and self.collab_model.is_fitted
            and not self.collab_model.is_cold_start(user_id)
        ):
            cf_candidates = self.collab_model.recommend_for_user(
                user_id=user_id,
                top_k=pool_size,
                exclude_interacted=False  # we want content-relevant items even if seen
            )

        if cf_candidates and cb_candidates:
            candidates = _merge_weighted([
                (SIMILAR_WEIGHT_CB, cb_candidates),
                (SIMILAR_WEIGHT_CF, cf_candidates)
            ])
        elif cb_candidates:
            candidates = list(cb_candidates)
        else:
            # Content model not fitted or video unknown — fallback to trending
            candidates = self.popularity_model.get_trending(top_k=pool_size)

        # Filter excluded
        candidates = [c for c in candidates if c["video_id"] not in exclude_ids]

        # Freshness boost
        candidates = _apply_freshness_boost(candidates, self._video_meta)

        # MMR diversity reranking
        if self.content_model.is_fitted and self.content_model.tfidf_matrix is not None:
            candidates = mmr_rerank(
                candidates=candidates,
                tfidf_matrix=self.content_model.tfidf_matrix,
                id_to_index=self.content_model.id_to_index,
                top_k=top_k,
                lambda_weight=0.65  # slightly more diverse for "related" section
            )
        else:
            candidates = category_diversity_filter(candidates, max_per_category=3, top_k=top_k)

        return {
            "recommendations": candidates[:top_k],
            "strategy": "content_based_hybrid",
            "is_cold_start": not bool(cb_candidates)
        }

    def recommend_trending(
        self,
        top_k: int = 20,
        time_window_hours: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """
        Public trending feed — no personalization.
        Applies freshness boost and diversity cap.
        """
        pool_size = top_k * CANDIDATE_POOL_MULTIPLIER
        trending = self.popularity_model.get_trending(top_k=pool_size, time_window_hours=time_window_hours)
        trending = _apply_freshness_boost(trending, self._video_meta)
        trending = category_diversity_filter(trending, max_per_category=4, top_k=top_k)
        return trending
