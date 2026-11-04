import math
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

class PopularityRecommender:
    """
    Popularity and Trending Video Recommender.
    Implements a multi-signal engagement model with gravity-based time decay:
    
      Trending Score = (WeightedEngagement - NegativePenalties) / ((HoursAge + 2) ^ Gravity)
    
    Prevents old viral videos from permanently clogging the trending feed.
    """

    WEIGHT_VIEW = 1.0
    WEIGHT_COMPLETION = 2.5
    WEIGHT_LIKE = 3.0
    WEIGHT_SKIP_PENALTY = 1.5
    WEIGHT_DISLIKE_PENALTY = 2.0

    def __init__(self, gravity: float = 1.5):
        self.gravity = gravity
        self.videos: List[Dict[str, Any]] = []
        self.video_metrics: Dict[str, Dict[str, float]] = {}

    def fit(
        self,
        videos: List[Dict[str, Any]],
        interactions: List[Dict[str, Any]]
    ) -> "PopularityRecommender":
        self.videos = videos
        metrics: Dict[str, Dict[str, float]] = {
            str(v["_id"]): {
                "views": float(v.get("views", 0)),
                "completions": 0.0,
                "likes": 0.0,
                "dislikes": 0.0,
                "skips": 0.0
            }
            for v in videos
        }

        # Aggregate interaction signals
        for event in interactions:
            vid = event.get("videoId")
            if not vid:
                continue
            vid_str = str(vid)
            if vid_str not in metrics:
                continue

            etype = event.get("eventType")
            if etype == "watch":
                comp = event.get("completionPct")
                if comp is not None and float(comp) >= 70.0:
                    metrics[vid_str]["completions"] += 1.0
            elif etype == "like":
                metrics[vid_str]["likes"] += 1.0
            elif etype == "dislike":
                metrics[vid_str]["dislikes"] += 1.0
            elif etype == "skip":
                metrics[vid_str]["skips"] += 1.0

        self.video_metrics = metrics
        return self

    def _compute_age_in_hours(self, video: Dict[str, Any], now: datetime) -> float:
        created_at = video.get("createdAt")
        if isinstance(created_at, str):
            try:
                dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            except Exception:
                dt = now
        elif isinstance(created_at, datetime):
            dt = created_at
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = now

        diff_seconds = max(0.0, (now - dt).total_seconds())
        return diff_seconds / 3600.0

    def get_trending(
        self,
        top_k: int = 10,
        time_window_hours: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """
        Calculates time-decayed trending scores.
        """
        now = datetime.now(timezone.utc)
        scored_videos = []

        for video in self.videos:
            vid = str(video["_id"])
            m = self.video_metrics.get(vid, {"views": 0, "completions": 0, "likes": 0, "dislikes": 0, "skips": 0})

            age_hours = self._compute_age_in_hours(video, now)

            if time_window_hours and age_hours > time_window_hours:
                continue

            positive_engagement = (
                m["views"] * self.WEIGHT_VIEW +
                m["completions"] * self.WEIGHT_COMPLETION +
                m["likes"] * self.WEIGHT_LIKE
            )
            penalties = (
                m["skips"] * self.WEIGHT_SKIP_PENALTY +
                m["dislikes"] * self.WEIGHT_DISLIKE_PENALTY
            )

            raw_score = max(0.1, positive_engagement - penalties)
            time_decay = (age_hours + 2.0) ** self.gravity
            trending_score = raw_score / time_decay

            scored_videos.append({
                "video_id": vid,
                "score": round(trending_score, 4),
                "views": int(m["views"]),
                "likes": int(m["likes"]),
                "age_hours": round(age_hours, 1),
                "algorithm": "time_decay_trending"
            })

        scored_videos.sort(key=lambda x: x["score"], reverse=True)
        return scored_videos[:top_k]

    def get_popular(self, top_k: int = 10) -> List[Dict[str, Any]]:
        """
        Returns all-time popular videos based on weighted engagement.
        """
        scored_videos = []
        for video in self.videos:
            vid = str(video["_id"])
            m = self.video_metrics.get(vid, {"views": 0, "completions": 0, "likes": 0, "dislikes": 0, "skips": 0})

            # Log-scaled engagement to prevent extreme outliers from permanently monopolizing
            total_score = (
                math.log1p(m["views"]) * self.WEIGHT_VIEW +
                m["completions"] * self.WEIGHT_COMPLETION +
                m["likes"] * self.WEIGHT_LIKE -
                m["dislikes"] * self.WEIGHT_DISLIKE_PENALTY
            )

            scored_videos.append({
                "video_id": vid,
                "score": round(max(0.0, total_score), 4),
                "views": int(m["views"]),
                "algorithm": "weighted_popular"
            })

        scored_videos.sort(key=lambda x: x["score"], reverse=True)
        return scored_videos[:top_k]
