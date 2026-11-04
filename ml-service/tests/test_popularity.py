import pytest
from datetime import datetime, timezone, timedelta
from app.models.popularity import PopularityRecommender

def test_popularity_and_time_decay():
    now = datetime.now(timezone.utc)
    one_hour_ago = (now - timedelta(hours=1)).isoformat()
    three_weeks_ago = (now - timedelta(days=21)).isoformat()

    videos = [
        # Fresh video: uploaded 1 hour ago, 50 views, 10 likes
        {
            "_id": "v_fresh",
            "title": "Breaking Tech Announcement",
            "views": 50,
            "createdAt": one_hour_ago
        },
        # Old video: uploaded 3 weeks ago, 200 views, 15 likes
        {
            "_id": "v_old",
            "title": "Old Tutorial From Last Month",
            "views": 200,
            "createdAt": three_weeks_ago
        }
    ]

    interactions = [
        {"videoId": "v_fresh", "eventType": "watch", "completionPct": 90},
        {"videoId": "v_fresh", "eventType": "like"},
        {"videoId": "v_old", "eventType": "watch", "completionPct": 90},
        {"videoId": "v_old", "eventType": "like"},
        {"videoId": "v_old", "eventType": "like"},
        {"videoId": "v_old", "eventType": "like"},
    ]

    pop = PopularityRecommender(gravity=1.5)
    pop.fit(videos, interactions)

    # Trending uses time decay: fresh video with high engagement rate should outrank old video
    trending = pop.get_trending(top_k=2)
    assert len(trending) == 2
    assert trending[0]["video_id"] == "v_fresh"
    assert trending[0]["score"] > trending[1]["score"]

    # All-time popular uses total weighted volume (old video with 200 views should rank higher in all-time)
    popular = pop.get_popular(top_k=2)
    assert len(popular) == 2
    assert popular[0]["video_id"] == "v_old"
