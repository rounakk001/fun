from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class ContentSimilarRequest(BaseModel):
    video_id: str = Field(..., description="Target video ObjectId")
    top_k: int = Field(10, ge=1, le=50, description="Number of recommendations")
    exclude_ids: Optional[List[str]] = Field(default=None, description="Optional list of video IDs to exclude")

class CollaborativeRequest(BaseModel):
    user_id: str = Field(..., description="Target user ObjectId or sessionId")
    top_k: int = Field(10, ge=1, le=50, description="Number of recommendations")
    exclude_interacted: bool = Field(True, description="Whether to exclude already watched/interacted videos")

class HomeRecommendationRequest(BaseModel):
    user_id: Optional[str] = Field(None, description="Logged-in user ObjectId (null for anonymous)")
    top_k: int = Field(20, ge=1, le=50, description="Number of recommendations")
    exclude_video_ids: Optional[List[str]] = Field(default=None, description="Video IDs to exclude (already seen)")
    last_watched_video_id: Optional[str] = Field(None, description="Most recent video watched, used as content seed")

class SimilarVideoRequest(BaseModel):
    video_id: str = Field(..., description="Source video ObjectId to find similar videos for")
    user_id: Optional[str] = Field(None, description="Optional user ObjectId for personalization lift")
    top_k: int = Field(15, ge=1, le=50, description="Number of similar videos to return")
    exclude_video_ids: Optional[List[str]] = Field(default=None, description="Video IDs to exclude")

# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class RecommendationItem(BaseModel):
    video_id: str
    score: float
    algorithm: str
    metadata: Optional[Dict[str, Any]] = None

class RecommendationResponse(BaseModel):
    success: bool = True
    total: int
    recommendations: List[RecommendationItem]
    is_cold_start: bool = False
    strategy: Optional[str] = None
    message: str = "Recommendations generated successfully"

class HealthResponse(BaseModel):
    status: str = "healthy"
    model_status: Dict[str, bool]
