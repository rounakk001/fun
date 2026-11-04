import axiosInstance from './axiosInstance';

/**
 * Toggle like on a video.
 * @param {string} videoId 
 */
export const toggleVideoLike = (videoId) => {
  return axiosInstance.post(`/likes/toggle/v/${videoId}`);
};

/**
 * Toggle like on a comment.
 * @param {string} commentId 
 */
export const toggleCommentLike = (commentId) => {
  return axiosInstance.post(`/likes/toggle/c/${commentId}`);
};

/**
 * Get all videos liked by the current user.
 */
export const getLikedVideos = () => {
  return axiosInstance.get('/likes/videos');
};
