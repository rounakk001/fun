import axiosInstance from './axiosInstance';

export const getWatchHistory = () => {
  return axiosInstance.get('/users/history');
};
