import numpy as np
from scipy.sparse import csr_matrix
from sklearn.decomposition import TruncatedSVD
from typing import List, Dict, Any, Optional, Tuple

class CollaborativeFilteringRecommender:
    """
    Implicit Feedback Collaborative Filtering Recommender.
    Converts implicit events (watches, completion, likes, dislikes, skips, repeat views)
    into a sparse user-item interaction confidence matrix, and decomposes it using Matrix Factorization (TruncatedSVD).
    """

    # Scoring weights for implicit feedback signals
    WEIGHT_LIKE = 3.0
    WEIGHT_DISLIKE = -2.5
    WEIGHT_SKIP = -1.5
    WEIGHT_REPEAT_VIEW = 0.5

    def __init__(self, n_factors: int = 15, min_interactions: int = 2):
        self.n_factors = n_factors
        self.min_interactions = min_interactions
        
        self.user_ids: List[str] = []
        self.video_ids: List[str] = []
        self.user_to_idx: Dict[str, int] = {}
        self.video_to_idx: Dict[str, int] = {}
        
        self.user_item_matrix: Optional[csr_matrix] = None
        self.svd: Optional[TruncatedSVD] = None
        self.user_factors: Optional[np.ndarray] = None
        self.item_factors: Optional[np.ndarray] = None
        self.user_interaction_counts: Dict[str, int] = {}
        self.is_fitted = False

    def _compute_interaction_weights(
        self, interactions: List[Dict[str, Any]]
    ) -> Dict[Tuple[str, str], float]:
        """
        Aggregates raw interaction documents into an affinity score per (user_id, video_id).
        """
        scores: Dict[Tuple[str, str], float] = {}
        view_counts: Dict[Tuple[str, str], int] = {}

        for event in interactions:
            u_id = event.get("userId") or event.get("sessionId")
            v_id = event.get("videoId")
            if not u_id or not v_id:
                continue

            pair = (str(u_id), str(v_id))
            if pair not in scores:
                scores[pair] = 0.0
                view_counts[pair] = 0

            event_type = event.get("eventType")

            if event_type == "watch":
                view_counts[pair] += 1
                completion = event.get("completionPct")
                if completion is not None:
                    # Normalized completion score from 0.0 to 2.5
                    scores[pair] += (float(completion) / 100.0) * 2.5
                else:
                    scores[pair] += 0.5
            elif event_type == "like":
                scores[pair] += self.WEIGHT_LIKE
            elif event_type == "dislike":
                scores[pair] += self.WEIGHT_DISLIKE
            elif event_type == "skip":
                scores[pair] += self.WEIGHT_SKIP
            elif event_type == "click":
                scores[pair] += 0.3

        # Add repeat-view bonus (log scale)
        for pair, count in view_counts.items():
            if count > 1:
                scores[pair] += np.log1p(count) * self.WEIGHT_REPEAT_VIEW

        return scores

    def fit(self, interactions: List[Dict[str, Any]], all_video_ids: Optional[List[str]] = None) -> "CollaborativeFilteringRecommender":
        affinity_dict = self._compute_interaction_weights(interactions)

        if not affinity_dict:
            self.is_fitted = False
            return self

        # Extract distinct users and items
        unique_users = sorted(list(set(u for u, _ in affinity_dict.keys())))
        unique_items = set(v for _, v in affinity_dict.keys())
        if all_video_ids:
            unique_items.update(str(v) for v in all_video_ids)
        unique_items = sorted(list(unique_items))

        self.user_ids = unique_users
        self.video_ids = unique_items
        self.user_to_idx = {u: idx for idx, u in enumerate(self.user_ids)}
        self.video_to_idx = {v: idx for idx, v in enumerate(self.video_ids)}

        # Build sparse coordinate lists
        rows = []
        cols = []
        data = []
        user_counts = {u: 0 for u in self.user_ids}

        for (u, v), score in affinity_dict.items():
            if u in self.user_to_idx and v in self.video_to_idx:
                r = self.user_to_idx[u]
                c = self.video_to_idx[v]
                rows.append(r)
                cols.append(c)
                # Clip negative or excessive values to prevent gradient skew
                norm_score = max(0.01, min(score, 10.0))
                data.append(norm_score)
                user_counts[u] += 1

        self.user_interaction_counts = user_counts
        n_users = len(self.user_ids)
        n_items = len(self.video_ids)

        if n_users == 0 or n_items == 0 or len(data) == 0:
            self.is_fitted = False
            return self

        self.user_item_matrix = csr_matrix((data, (rows, cols)), shape=(n_users, n_items))

        # Fit TruncatedSVD (effective for sparse implicit feedback matrices)
        effective_factors = min(self.n_factors, min(n_users, n_items) - 1)
        if effective_factors >= 1:
            self.svd = TruncatedSVD(n_components=effective_factors, random_state=42)
            self.user_factors = self.svd.fit_transform(self.user_item_matrix)
            self.item_factors = self.svd.components_.T
        else:
            # Fallback if matrix is too small for SVD decomposition
            self.svd = None
            self.user_factors = None
            self.item_factors = None

        self.is_fitted = True
        return self

    def is_cold_start(self, user_id: str) -> bool:
        if not self.is_fitted or user_id not in self.user_to_idx:
            return True
        return self.user_interaction_counts.get(user_id, 0) < self.min_interactions

    def recommend_for_user(
        self,
        user_id: str,
        top_k: int = 10,
        exclude_interacted: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Generates personalized collaborative recommendations for user_id.
        Returns empty list if cold-start.
        """
        if self.is_cold_start(user_id):
            return []

        u_idx = self.user_to_idx[user_id]

        if self.user_factors is not None and self.item_factors is not None:
            # Reconstructed affinity vector = user_factors[u] dot item_factors.T
            pred_scores = np.dot(self.user_factors[u_idx], self.item_factors.T)
        else:
            # Fallback to direct raw interactions
            pred_scores = self.user_item_matrix[u_idx].toarray().flatten()

        # Optionally mask items already interacted with
        if exclude_interacted:
            interacted_indices = self.user_item_matrix[u_idx].nonzero()[1]
            pred_scores[interacted_indices] = -np.inf

        top_indices = np.argsort(pred_scores)[::-1]

        results = []
        for idx in top_indices:
            score = float(pred_scores[idx])
            if score <= 0.0 or np.isneginf(score) or len(results) >= top_k:
                break
            results.append({
                "video_id": self.video_ids[idx],
                "score": round(score, 4),
                "algorithm": "collaborative_filtering"
            })

        return results
