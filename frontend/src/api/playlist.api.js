import axiosInstance from './axiosInstance';

/**
 * playlist.api.js
 * All functions return the full axios response; callers access response.data.data.
 */

export const createPlaylist = (data) =>
  axiosInstance.post('/playlists', data);

export const getUserPlaylists = (userId) =>
  axiosInstance.get(`/playlists/user/${userId}`);

export const getPlaylistById = (playlistId) =>
  axiosInstance.get(`/playlists/${playlistId}`);

export const addVideoToPlaylist = (videoId, playlistId) =>
  axiosInstance.patch(`/playlists/add/${videoId}/${playlistId}`);

export const removeVideoFromPlaylist = (videoId, playlistId) =>
  axiosInstance.patch(`/playlists/remove/${videoId}/${playlistId}`);

export const updatePlaylist = (playlistId, data) =>
  axiosInstance.patch(`/playlists/${playlistId}`, data);

export const deletePlaylist = (playlistId) =>
  axiosInstance.delete(`/playlists/${playlistId}`);

export const setPlaylistCover = (videoId, playlistId) =>
  axiosInstance.patch(`/playlists/cover/${videoId}/${playlistId}`);
