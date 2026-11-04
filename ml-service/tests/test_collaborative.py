import pytest
from app.models.collaborative import CollaborativeFilteringRecommender

def test_interaction_weights_computation():
    cf = CollaborativeFilteringRecommender()
    interactions = [
        {"userId": "u1", "videoId": "v1", "eventType": "watch", "completionPct": 90.0},
        {"userId": "u1", "videoId": "v1", "eventType": "like"},
        {"userId": "u2", "videoId": "v2", "eventType": "dislike"},
        {"userId": "u3", "videoId": "v1", "eventType": "skip"}
    ]
    weights = cf._compute_interaction_weights(interactions)

    # u1 + v1 should have high affinity (watch 90% + like)
    assert ("u1", "v1") in weights
    assert weights[("u1", "v1")] > 4.0

    # u2 + v2 should have negative weight for dislike
    assert ("u2", "v2") in weights
    assert weights[("u2", "v2")] < 0.0

    # u3 + v1 should have negative weight for skip
    assert ("u3", "v1") in weights
    assert weights[("u3", "v1")] < 0.0

def test_collaborative_cold_start_and_recommendation():
    cf = CollaborativeFilteringRecommender(n_factors=2, min_interactions=2)

    interactions = [
        # User 1 likes v1, v2
        {"userId": "u1", "videoId": "v1", "eventType": "watch", "completionPct": 100},
        {"userId": "u1", "videoId": "v1", "eventType": "like"},
        {"userId": "u1", "videoId": "v2", "eventType": "watch", "completionPct": 80},
        # User 2 likes v1, v2, v3
        {"userId": "u2", "videoId": "v1", "eventType": "watch", "completionPct": 90},
        {"userId": "u2", "videoId": "v2", "eventType": "watch", "completionPct": 95},
        {"userId": "u2", "videoId": "v3", "eventType": "like"},
        # User 3 is cold start (only 1 skip)
        {"userId": "u3", "videoId": "v4", "eventType": "skip"}
    ]

    cf.fit(interactions, all_video_ids=["v1", "v2", "v3", "v4"])

    assert cf.is_fitted is True
    # u3 has only 1 interaction -> cold start
    assert cf.is_cold_start("u3") is True
    assert cf.recommend_for_user("u3") == []

    # u1 has >= 2 interactions -> not cold start
    assert cf.is_cold_start("u1") is False
    recs = cf.recommend_for_user("u1", top_k=5, exclude_interacted=True)
    # v1 and v2 were already interacted with, so they should be excluded
    rec_vids = [r["video_id"] for r in recs]
    assert "v1" not in rec_vids
    assert "v2" not in rec_vids
