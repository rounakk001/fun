import axiosInstance from './axiosInstance';

/**
 * Fetch a paginated list of comments for a video.
 * @param {string} videoId 
 * @param {Object} params - page, limit
 */
export const getVideoComments = (videoId, params = {}) => {
  return axiosInstance.get(`/comments/${videoId}`, { params });
};

/**
 * Add a new comment to a video.
 * @param {string} videoId 
 * @param {string} content 
 */
export const addComment = (videoId, content) => {
  return axiosInstance.post(`/comments/${videoId}`, { content });
};

/**
 * Update an existing comment.
 * @param {string} commentId 
 * @param {string} content 
 */
export const updateComment = (commentId, content) => {
  return axiosInstance.patch(`/comments/c/${commentId}`, { content });
};

/**
 * Delete a comment.
 * @param {string} commentId 
 */
export const deleteComment = (commentId) => {
  return axiosInstance.delete(`/comments/c/${commentId}`);
};
