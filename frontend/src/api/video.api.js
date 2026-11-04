import axiosInstance from './axiosInstance';

/**
 * Video API functions.
 * All functions return the full axios response so callers can
 * access both response.data (the ApiResponse wrapper) and
 * response.data.data (the actual payload).
 *
 * Backend response shape:
 *   Success: { statusCode, data, message, success: true }
 *   Error:   { success: false, message, errors, data: null }
 */

/**
 * Fetch a paginated list of videos.
 * All params are optional.
 *
 * @param {Object} params
 * @param {number} [params.page=1]
 * @param {number} [params.limit=12]
 * @param {string} [params.query]        — searches title + description
 * @param {string} [params.sortBy]       — field name, e.g. "createdAt"
 * @param {string} [params.sortType]     — "asc" | "desc"
 * @param {string} [params.userId]       — filter to one channel's videos
 */
export const getVideos = (params = {}) => {
  return axiosInstance.get('/videos', { params });
};

/**
 * Fetch a single video by its ID.
 * The owner field is already populated with username/fullName/avatar.
 *
 * @param {string} videoId
 */
export const getVideoById = (videoId) => {
  return axiosInstance.get(`/videos/${videoId}`);
};

/**
 * Upload a new video.
 * Must be sent as multipart/form-data — do NOT set Content-Type manually;
 * axios handles the boundary automatically when given a FormData body.
 *
 * @param {FormData} formData   — Must include: title, description, videoFile (file), thumbnail (file)
 * @param {function} onProgress — Called with upload progress percentage (0–100)
 */
export const uploadVideo = (formData, onProgress) => {
  return axiosInstance.post('/videos', formData, {
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total) {
        const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress?.(pct);
      }
    },
  });
};

/**
 * Update a video (title, description, thumbnail).
 * 
 * @param {string} videoId
 * @param {FormData} formData
 */
export const updateVideo = (videoId, formData) => {
  return axiosInstance.patch(`/videos/${videoId}`, formData);
};

/**
 * Verify premium access passcode to unlock the VIP section.
 * @param {string} code
 */
export const verifyPremiumAccessCode = (code) => {
  return axiosInstance.post('/videos/verify-premium-code', { code });
};
