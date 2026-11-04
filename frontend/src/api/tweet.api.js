import axiosInstance from './axiosInstance';

/**
 * tweet.api.js
 * All functions return the full axios response; callers access response.data.data.
 */

export const getUserTweets = (userId) =>
  axiosInstance.get(`/tweets/user/${userId}`);

export const createTweet = (content) =>
  axiosInstance.post('/tweets', { content });

export const updateTweet = (tweetId, content) =>
  axiosInstance.patch(`/tweets/${tweetId}`, { content });

export const deleteTweet = (tweetId) =>
  axiosInstance.delete(`/tweets/${tweetId}`);

export const toggleTweetLike = (tweetId) =>
  axiosInstance.post(`/likes/toggle/t/${tweetId}`);
