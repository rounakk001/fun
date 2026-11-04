import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.api.routes import content_model, collab_model, popularity_model

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_dummy_models():
    # Pre-fit models with sample data
    videos = [
        {"_id": "v1", "title": "React 19 Tutorial", "description": "Web development with React", "category": "Tech", "tags": ["react", "js"], "views": 100},
        {"_id": "v2", "title": "Vue.js Complete Guide", "description": "Web development with Vue framework", "category": "Tech", "tags": ["vue", "js"], "views": 50},
        {"_id": "v3", "title": "Baking Sourdough Bread", "description": "Artisan baking guide", "category": "Cooking", "tags": ["bread"], "views": 20}
    ]
    interactions = [
        {"userId": "u1", "videoId": "v1", "eventType": "watch", "completionPct": 95},
        {"userId": "u1", "videoId": "v1", "eventType": "like"},
        {"userId": "u1", "videoId": "v2", "eventType": "watch", "completionPct": 80},
        {"userId": "u2", "videoId": "v1", "eventType": "watch", "completionPct": 90},
        {"userId": "u2", "videoId": "v2", "eventType": "watch", "completionPct": 85},
        {"userId": "u2", "videoId": "v3", "eventType": "watch", "completionPct": 90}
    ]
    content_model.fit(videos)
    collab_model.fit(interactions, all_video_ids=["v1", "v2", "v3"])
    popularity_model.fit(videos, interactions)

def test_health_endpoint():
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "model_status" in data

def test_content_similar_endpoint():
    payload = {"video_id": "v1", "top_k": 2}
    res = client.post("/api/v1/recommend/content-similar", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert len(data["recommendations"]) > 0
    assert data["recommendations"][0]["video_id"] == "v2"

def test_collaborative_endpoint():
    payload = {"user_id": "u1", "top_k": 2, "exclude_interacted": True}
    res = client.post("/api/v1/recommend/collaborative", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True

def test_trending_and_popular_endpoints():
    res_t = client.get("/api/v1/recommend/trending?limit=2")
    assert res_t.status_code == 200
    assert len(res_t.json()["recommendations"]) > 0

    res_p = client.get("/api/v1/recommend/popular?limit=2")
    assert res_p.status_code == 200
    assert len(res_p.json()["recommendations"]) > 0
