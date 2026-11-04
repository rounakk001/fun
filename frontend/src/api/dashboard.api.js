import axiosInstance from './axiosInstance';

/**
 * dashboard.api.js
 * All functions return the full axios response; callers access response.data.data.
 */

export const getDashboardStats = () =>
  axiosInstance.get('/dashboard/stats');

export const getDashboardVideos = () =>
  axiosInstance.get('/dashboard/videos');

export const togglePublishStatus = (videoId) =>
  axiosInstance.patch(`/videos/toggle/publish/${videoId}`);
