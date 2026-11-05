import axiosInstance from "./axiosInstance";

/**
 * Recommendation API Client (Phase 5 & 6 Frontend Integration)
 */

/**
 * Fetch similar/related videos for the Watch page sidebar.
 * @param {string} videoId - Current video ObjectId
 * @param {object} params - Optional { limit }
 */
export const getSimilarVideos = (videoId, params = {}) => {
  return axiosInstance.get(`/recommendations/similar/${videoId}`, { params });
};

/**
 * Fetch personalized home feed recommendations.
 * @param {object} params - Optional { limit, lastWatchedVideoId }
 */
export const getHomeRecommendations = (params = {}) => {
  return axiosInstance.get('/recommendations/home', { params });
};

/**
 * Fetch trending videos.
 * @param {object} params - Optional { limit }
 */
export const getTrendingRecommendations = (params = {}) => {
  return axiosInstance.get('/recommendations/trending', { params });
};

/**
 * Fetch ML-powered Reels/Shorts feed (supports ?isPremium=true and ?currentShortId)
 */
export const getShortsFeed = (params = {}) => {
  return axiosInstance.get('/recommendations/shorts', { params });
};
