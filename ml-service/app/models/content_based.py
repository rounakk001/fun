import re
import numpy as np
from typing import List, Dict, Any, Optional
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

class ContentBasedRecommender:
    """
    Content-Based Filtering recommender using TF-IDF and Cosine Similarity.
    Constructs a weighted textual corpus from video title, category, tags, and description.
    """

    def __init__(self):
        self.vectorizer = TfidfVectorizer(
            stop_words="english",
            ngram_range=(1, 2),
            sublinear_tf=True,
            max_features=25000
        )
        self.video_ids: List[str] = []
        self.id_to_index: Dict[str, int] = {}
        self.tfidf_matrix = None
        self.similarity_matrix = None
        self.is_fitted = False

    @staticmethod
    def preprocess_text(text: Optional[str]) -> str:
        if not text:
            return ""
        # Lowercase, strip URLs, keep alphanumeric and basic spaces
        text = text.lower()
        text = re.sub(r"https?://\S+|www\.\S+", "", text)
        text = re.sub(r"[^\w\s]", " ", text)
        return " ".join(text.split())

    def _build_video_document(self, video: Dict[str, Any]) -> str:
        title = self.preprocess_text(video.get("title", ""))
        category = self.preprocess_text(video.get("category", ""))
        
        tags_raw = video.get("tags", [])
        if isinstance(tags_raw, list):
            tags_text = " ".join([self.preprocess_text(str(t)) for t in tags_raw])
        elif isinstance(tags_raw, str):
            tags_text = self.preprocess_text(tags_raw)
        else:
            tags_text = ""

        description = self.preprocess_text(video.get("description", ""))

        # Weighted composition: title (3x) + tags (2.5x) + category (2x) + description (1x)
        # Repeating tokens proportionally emphasizes them in TF-IDF calculations
        weighted_doc = f"{title} {title} {title} {tags_text} {tags_text} {category} {category} {description}"
        return weighted_doc.strip()

    def fit(self, videos: List[Dict[str, Any]]) -> "ContentBasedRecommender":
        if not videos:
            self.video_ids = []
            self.id_to_index = {}
            self.tfidf_matrix = None
            self.similarity_matrix = None
            self.is_fitted = False
            return self

        self.video_ids = [str(v["_id"]) for v in videos]
        self.id_to_index = {vid: idx for idx, vid in enumerate(self.video_ids)}

        documents = [self._build_video_document(v) for v in videos]

        # Handle empty documents fallback
        if all(len(doc.strip()) == 0 for doc in documents):
            documents = ["video" for _ in documents]

        self.tfidf_matrix = self.vectorizer.fit_transform(documents)
        self.similarity_matrix = cosine_similarity(self.tfidf_matrix, self.tfidf_matrix)
        self.is_fitted = True
        return self

    def recommend_similar(
        self,
        video_id: str,
        top_k: int = 10,
        exclude_ids: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Returns top_k most similar videos to the given video_id.
        """
        if not self.is_fitted or video_id not in self.id_to_index:
            return []

        idx = self.id_to_index[video_id]
        sim_scores = self.similarity_matrix[idx].copy()

        # Always exclude itself
        sim_scores[idx] = -1.0

        if exclude_ids:
            for ex_id in exclude_ids:
                if ex_id in self.id_to_index:
                    sim_scores[self.id_to_index[ex_id]] = -1.0

        # Argsort descending
        top_indices = np.argsort(sim_scores)[::-1]

        results = []
        for i in top_indices:
            score = float(sim_scores[i])
            if score <= 0.0 or len(results) >= top_k:
                break
            results.append({
                "video_id": self.video_ids[i],
                "score": round(score, 4),
                "algorithm": "content_based"
            })

        return results
