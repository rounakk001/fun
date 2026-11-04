"""
diversity.py — Maximal Marginal Relevance (MMR) based diversity filter.

MMR re-ranks candidates to balance relevance vs. similarity to already-selected items.
This prevents showing 10 near-identical videos from the same creator or topic cluster.

Formula (per candidate ci not yet selected):
  MMR(ci) = λ * relevance(ci) - (1 - λ) * max(sim(ci, cj)) for cj in selected

Where:
  - λ (lambda) = 0.7 means we weight relevance 70%, novelty 30%.
  - sim() uses cosine similarity of the content TF-IDF vectors, or a fallback category check.
"""
from typing import List, Dict, Any, Optional
import numpy as np


def mmr_rerank(
    candidates: List[Dict[str, Any]],
    tfidf_matrix,
    id_to_index: Dict[str, int],
    top_k: int,
    lambda_weight: float = 0.7
) -> List[Dict[str, Any]]:
    """
    MMR reranking using pre-computed content TF-IDF similarity matrix.

    Args:
        candidates: List of candidate dicts with 'video_id' and 'score'.
        tfidf_matrix: scipy sparse matrix of shape (n_videos, n_features).
        id_to_index: Mapping from video_id str -> matrix row index.
        top_k: Maximum number of results to return.
        lambda_weight: Balance between relevance (1.0) and novelty (0.0).

    Returns:
        Re-ranked list of at most top_k candidates.
    """
    if not candidates:
        return []

    if tfidf_matrix is None or not id_to_index:
        # No content model available: return first top_k by score
        return sorted(candidates, key=lambda x: x["score"], reverse=True)[:top_k]

    # Normalize scores into [0, 1] range for fair MMR weighting
    scores = np.array([c["score"] for c in candidates], dtype=float)
    max_score = scores.max() if scores.max() > 0 else 1.0
    norm_scores = scores / max_score

    # Filter to candidates that exist in the TF-IDF index
    valid = [(c, norm_scores[i]) for i, c in enumerate(candidates) if c["video_id"] in id_to_index]
    if not valid:
        return sorted(candidates, key=lambda x: x["score"], reverse=True)[:top_k]

    # Extract TF-IDF vectors for valid candidates
    valid_ids = [c["video_id"] for c, _ in valid]
    valid_idx = [id_to_index[vid] for vid in valid_ids]
    candidate_vectors = tfidf_matrix[valid_idx]  # sparse (n_candidates, n_features)

    selected: List[Dict[str, Any]] = []
    remaining_indices = list(range(len(valid)))

    while remaining_indices and len(selected) < top_k:
        best_mmr = -np.inf
        best_i = None

        for i in remaining_indices:
            c, norm_rel = valid[i]
            relevance = norm_rel

            if not selected:
                # No items selected yet — pick highest relevance
                novelty_penalty = 0.0
            else:
                # Compute cosine sim to all already-selected items
                sel_idx = [id_to_index[s["video_id"]] for s in selected if s["video_id"] in id_to_index]
                if sel_idx:
                    sel_vectors = tfidf_matrix[sel_idx]
                    cand_vec = candidate_vectors[i]
                    # Dot product / (norms) — for sparse matrices
                    numerator = (cand_vec * sel_vectors.T).toarray().flatten()
                    cand_norm = np.sqrt((cand_vec * cand_vec.T).toarray()[0, 0]) + 1e-10
                    sel_norms = np.sqrt(np.array(sel_vectors.multiply(sel_vectors).sum(axis=1)).flatten()) + 1e-10
                    cosines = numerator / (cand_norm * sel_norms)
                    novelty_penalty = cosines.max()
                else:
                    novelty_penalty = 0.0

            mmr_score = lambda_weight * relevance - (1.0 - lambda_weight) * novelty_penalty
            if mmr_score > best_mmr:
                best_mmr = mmr_score
                best_i = i

        if best_i is None:
            break

        selected_candidate = dict(valid[best_i][0])
        selected_candidate["mmr_score"] = round(float(best_mmr), 4)
        selected.append(selected_candidate)
        remaining_indices.remove(best_i)

    return selected


def category_diversity_filter(
    candidates: List[Dict[str, Any]],
    max_per_category: int = 3,
    top_k: int = 20
) -> List[Dict[str, Any]]:
    """
    Simple category-cap filter for when TF-IDF is unavailable.
    Limits the number of videos from the same category in the results.

    Args:
        candidates: Sorted list with 'category' field (optional).
        max_per_category: Max videos from any single category.
        top_k: Total result size cap.

    Returns:
        Filtered list respecting per-category limits.
    """
    seen_categories: Dict[str, int] = {}
    result = []

    for c in sorted(candidates, key=lambda x: x["score"], reverse=True):
        cat = c.get("category") or "__unknown__"
        count = seen_categories.get(cat, 0)
        if count < max_per_category:
            seen_categories[cat] = count + 1
            result.append(c)
        if len(result) >= top_k:
            break

    return result
