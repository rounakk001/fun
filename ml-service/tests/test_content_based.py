import pytest
from app.models.content_based import ContentBasedRecommender

def test_preprocess_text():
    raw = "Learn Python! Visit https://python.org for FREE tutorial #coding @2026"
    cleaned = ContentBasedRecommender.preprocess_text(raw)
    assert "https" not in cleaned
    assert "python" in cleaned
    assert "tutorial" in cleaned
    assert "coding" in cleaned

def test_content_based_fitting_and_recommendation():
    videos = [
        {
            "_id": "v1",
            "title": "Machine Learning Crash Course",
            "description": "Learn supervised and unsupervised learning algorithms with Python.",
            "category": "Technology",
            "tags": ["ml", "python", "ai"]
        },
        {
            "_id": "v2",
            "title": "Deep Learning with Neural Networks",
            "description": "Comprehensive guide to neural networks, backpropagation and AI.",
            "category": "Technology",
            "tags": ["deep-learning", "neural-networks", "ai"]
        },
        {
            "_id": "v3",
            "title": "Italian Pasta Recipe Cooking",
            "description": "Authentic homemade carbonara and tomato pasta sauce guide.",
            "category": "Cooking",
            "tags": ["pasta", "food", "recipe"]
        }
    ]

    recommender = ContentBasedRecommender()
    recommender.fit(videos)

    assert recommender.is_fitted is True
    assert len(recommender.video_ids) == 3

    # v1 (Machine Learning) should be most similar to v2 (Deep Learning)
    recs = recommender.recommend_similar("v1", top_k=2)
    assert len(recs) > 0
    assert recs[0]["video_id"] == "v2"
    assert recs[0]["score"] > 0

    # Test exclusion list
    recs_ex = recommender.recommend_similar("v1", top_k=2, exclude_ids=["v2"])
    for r in recs_ex:
        assert r["video_id"] != "v2"

def test_content_based_empty_inputs():
    recommender = ContentBasedRecommender()
    recommender.fit([])
    assert recommender.is_fitted is False
    assert recommender.recommend_similar("v1") == []
