from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from app.api.schemas import (
    ContentSimilarRequest,
    CollaborativeRequest,
    HomeRecommendationRequest,
    SimilarVideoRequest,
    RecommendationResponse,
    RecommendationItem,
    HealthResponse
)
from app.models.content_based import ContentBasedRecommender
from app.models.collaborative import CollaborativeFilteringRecommender
from app.models.popularity import PopularityRecommender
from app.engine.hybrid import HybridRecommendationEngine
from app.db import db

router = APIRouter()

# ---------------------------------------------------------------------------
# Global model instances (stateful — refitted via /train)
# ---------------------------------------------------------------------------
content_model = ContentBasedRecommender()
collab_model = CollaborativeFilteringRecommender()
popularity_model = PopularityRecommender()

# Hybrid engine holds references to the three sub-models
hybrid_engine = HybridRecommendationEngine(content_model, collab_model, popularity_model)


def train_all_models():
    """Fetches data from MongoDB and fits all recommendation engines."""
    videos = db.get_published_videos()
    interactions = db.get_all_interactions()

    video_ids = [v["_id"] for v in videos]
    content_model.fit(videos)
    collab_model.fit(interactions, all_video_ids=video_ids)
    popularity_model.fit(videos, interactions)

    # Rebuild hybrid engine's internal video metadata cache after training
    hybrid_engine._rebuild_video_meta()


# ---------------------------------------------------------------------------
# Health & Training
# ---------------------------------------------------------------------------

@router.get("/health", response_model=HealthResponse)
def health_check():
    return HealthResponse(
        status="healthy",
        model_status={
            "content_based": content_model.is_fitted,
            "collaborative": collab_model.is_fitted,
            "popularity": len(popularity_model.videos) > 0,
            "hybrid": content_model.is_fitted or collab_model.is_fitted or len(popularity_model.videos) > 0
        }
    )

@router.post("/train")
def trigger_training():
    try:
        train_all_models()
        return {
            "success": True,
            "message": "All models trained successfully",
            "videos_indexed": len(content_model.video_ids),
            "users_indexed": len(collab_model.user_ids)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")


# ---------------------------------------------------------------------------
# Phase 3 endpoints (kept for backward compatibility and direct ML inspection)
# ---------------------------------------------------------------------------

@router.post("/recommend/content-similar", response_model=RecommendationResponse)
def recommend_content_similar(req: ContentSimilarRequest):
    recs = content_model.recommend_similar(
        video_id=req.video_id,
        top_k=req.top_k,
        exclude_ids=req.exclude_ids
    )
    items = [RecommendationItem(**r) for r in recs]
    return RecommendationResponse(
        total=len(items),
        recommendations=items,
        is_cold_start=False,
        strategy="content_based"
    )

@router.post("/recommend/collaborative", response_model=RecommendationResponse)
def recommend_collaborative(req: CollaborativeRequest):
    is_cold = collab_model.is_cold_start(req.user_id)
    if is_cold:
        popular = popularity_model.get_popular(top_k=req.top_k)
        items = [RecommendationItem(**p) for p in popular]
        return RecommendationResponse(
            total=len(items),
            recommendations=items,
            is_cold_start=True,
            strategy="popularity_fallback",
            message="Cold-start user; returned popularity fallback"
        )

    recs = collab_model.recommend_for_user(
        user_id=req.user_id,
        top_k=req.top_k,
        exclude_interacted=req.exclude_interacted
    )
    items = [RecommendationItem(**r) for r in recs]
    return RecommendationResponse(
        total=len(items),
        recommendations=items,
        is_cold_start=False,
        strategy="collaborative_filtering"
    )

@router.get("/recommend/trending", response_model=RecommendationResponse)
def recommend_trending(
    limit: int = Query(10, ge=1, le=50),
    time_window_hours: Optional[float] = Query(None, ge=1.0)
):
    trending = popularity_model.get_trending(top_k=limit, time_window_hours=time_window_hours)
    items = [RecommendationItem(**t) for t in trending]
    return RecommendationResponse(
        total=len(items),
        recommendations=items,
        is_cold_start=False,
        strategy="time_decay_trending"
    )

@router.get("/recommend/popular", response_model=RecommendationResponse)
def recommend_popular(
    limit: int = Query(10, ge=1, le=50)
):
    popular = popularity_model.get_popular(top_k=limit)
    items = [RecommendationItem(**p) for p in popular]
    return RecommendationResponse(
        total=len(items),
        recommendations=items,
        is_cold_start=False,
        strategy="weighted_popular"
    )


# ---------------------------------------------------------------------------
# Phase 4 endpoints — Hybrid Engine
# ---------------------------------------------------------------------------

@router.post("/recommend/home", response_model=RecommendationResponse)
def recommend_home(req: HomeRecommendationRequest):
    """
    Personalized home feed for a user.
    Uses hybrid CF + CB + Popularity blend with cold-start fallback.
    """
    try:
        result = hybrid_engine.recommend_home(
            user_id=req.user_id,
            top_k=req.top_k,
            exclude_video_ids=req.exclude_video_ids,
            last_watched_video_id=req.last_watched_video_id
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Hybrid home recommendation failed: {str(e)}")

    recs = result["recommendations"]
    items = [
        RecommendationItem(
            video_id=r["video_id"],
            score=round(r.get("score", 0.0), 4),
            algorithm=r.get("algorithm", "hybrid"),
            metadata={
                "freshness_boosted": r.get("freshness_boosted", False),
                "mmr_score": r.get("mmr_score")
            }
        )
        for r in recs
    ]
    return RecommendationResponse(
        total=len(items),
        recommendations=items,
        is_cold_start=result.get("is_cold_start", False),
        strategy=result.get("strategy", "hybrid"),
        message=f"Home recommendations via {result.get('strategy', 'hybrid')} strategy"
    )


@router.post("/recommend/similar", response_model=RecommendationResponse)
def recommend_similar(req: SimilarVideoRequest):
    """
    Related/similar videos for a given video (watch page sidebar).
    Optionally personalized if user_id is provided.
    """
    try:
        result = hybrid_engine.recommend_similar(
            video_id=req.video_id,
            user_id=req.user_id,
            top_k=req.top_k,
            exclude_video_ids=req.exclude_video_ids
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Similar video recommendation failed: {str(e)}")

    recs = result["recommendations"]
    items = [
        RecommendationItem(
            video_id=r["video_id"],
            score=round(r.get("score", 0.0), 4),
            algorithm=r.get("algorithm", "hybrid_similar"),
            metadata={
                "freshness_boosted": r.get("freshness_boosted", False),
                "mmr_score": r.get("mmr_score")
            }
        )
        for r in recs
    ]
    return RecommendationResponse(
        total=len(items),
        recommendations=items,
        is_cold_start=result.get("is_cold_start", False),
        strategy=result.get("strategy", "content_based_hybrid"),
        message="Similar video recommendations"
    )
