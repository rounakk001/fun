from pymongo import MongoClient
from pymongo.errors import PyMongoError, ServerSelectionTimeoutError
from typing import List, Dict, Any
from app.config import settings

class Database:
    def __init__(self):
        self.client = None
        self.db = None

    def connect(self):
        if self.db is not None:
            return self.db

        primary_uri = settings.MONGODB_URI
        fallback_uri = "mongodb://127.0.0.1:27017"

        # Try primary URI (e.g. Atlas) with a 3-second timeout
        try:
            client = MongoClient(primary_uri, serverSelectionTimeoutMS=3000)
            # Ping to confirm connection
            client.admin.command("ping")
            self.client = client
            self.db = client[settings.DB_NAME]
            print("[ML-DB] Connected to primary MongoDB")
            return self.db
        except Exception as e:
            print(f"[ML-DB] Primary MongoDB connection failed ({e}). Attempting local fallback: {fallback_uri}...")

        # Fallback to local MongoDB
        try:
            client = MongoClient(fallback_uri, serverSelectionTimeoutMS=3000)
            client.admin.command("ping")
            self.client = client
            self.db = client[settings.DB_NAME]
            print(f"[ML-DB] Connected to local MongoDB fallback ({settings.DB_NAME})")
            return self.db
        except Exception as e:
            print(f"[ML-DB] Local fallback also failed: {e}")
            raise e

    def close(self):
        if self.client:
            self.client.close()
            self.client = None
            self.db = None

    def get_published_videos(self) -> List[Dict[str, Any]]:
        db = self.connect()
        cursor = db["videos"].find(
            {"isPublished": True},
            {"_id": 1, "title": 1, "description": 1, "category": 1, "tags": 1, "views": 1, "duration": 1, "createdAt": 1, "owner": 1}
        )
        videos = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            if "owner" in doc and doc["owner"]:
                doc["owner"] = str(doc["owner"])
            videos.append(doc)
        return videos

    def get_all_interactions(self, limit: int = 100000) -> List[Dict[str, Any]]:
        db = self.connect()
        cursor = db["interactions"].find().sort("createdAt", -1).limit(limit)
        interactions = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            if doc.get("userId"):
                doc["userId"] = str(doc["userId"])
            if doc.get("videoId"):
                doc["videoId"] = str(doc["videoId"])
            interactions.append(doc)
        return interactions

db = Database()
