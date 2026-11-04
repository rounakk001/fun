/**
 * mlClient.js
 * HTTP client for communicating with the Python FastAPI Recommendation Service.
 * 
 * Features:
 * - 2.5s request timeout
 * - Graceful fallback on network error/timeout (returns null so controllers can fall back to MongoDB)
 * - In-memory cache for fast repeated queries
 */

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://127.0.0.1:5000/api/v1";

// Simple in-memory cache: key -> { data, expiry }
const cache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

function getFromCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setInCache(key, data, ttlMs = CACHE_TTL_MS) {
  // Cap cache size at 500 entries to prevent memory leaks
  if (cache.size > 500) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  cache.set(key, { data, expiry: Date.now() + ttlMs });
}

async function requestWithTimeout(endpoint, options = {}, timeoutMs = 2500) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `${ML_SERVICE_URL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
      console.warn(`[ML-Client] ${endpoint} returned status ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (err) {
    if (err.name === "AbortError") {
      console.warn(`[ML-Client] Request to ${endpoint} timed out after ${timeoutMs}ms`);
    } else {
      console.warn(`[ML-Client] Request to ${endpoint} failed: ${err.message}`);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const mlClient = {
  /**
   * Get similar videos for a given videoId
   */
  async getSimilarVideos(videoId, userId = null, topK = 10) {
    const cacheKey = `similar:${videoId}:${userId || "anon"}:${topK}`;
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    const res = await requestWithTimeout("/recommend/similar", {
      method: "POST",
      body: JSON.stringify({
        video_id: videoId,
        user_id: userId || null,
        top_k: topK
      })
    });

    if (res && res.success) {
      setInCache(cacheKey, res);
      return res;
    }
    return null;
  },

  /**
   * Get personalized home recommendations for a user
   */
  async getHomeRecommendations(userId = null, topK = 20, lastWatchedVideoId = null) {
    const cacheKey = `home:${userId || "anon"}:${topK}:${lastWatchedVideoId || ""}`;
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    const res = await requestWithTimeout("/recommend/home", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId || null,
        top_k: topK,
        last_watched_video_id: lastWatchedVideoId || null
      })
    });

    if (res && res.success) {
      setInCache(cacheKey, res);
      return res;
    }
    return null;
  },

  /**
   * Get trending videos
   */
  async getTrendingVideos(limit = 10, timeWindowHours = null) {
    const cacheKey = `trending:${limit}:${timeWindowHours || "all"}`;
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    let endpoint = `/recommend/trending?limit=${limit}`;
    if (timeWindowHours) endpoint += `&time_window_hours=${timeWindowHours}`;

    const res = await requestWithTimeout(endpoint, { method: "GET" });
    if (res && res.success) {
      setInCache(cacheKey, res);
      return res;
    }
    return null;
  }
};
