import axiosInstance from './axiosInstance';

/**
 * Channel / Subscription API functions.
 *
 * Backend response shape (all endpoints):
 *   Success: { statusCode, data, message, success: true }
 *   Error:   { success: false, message, errors, data: null }
 */

/**
 * GET /users/c/:username  (public — no auth required)
 * Returns a channel's profile including _id, subscribersCount,
 * channelsSubscribedToCount, isSubscribed, avatar, coverImage, email.
 *
 * @param {string} username
 */
export const getChannelProfile = (username) => {
  return axiosInstance.get(`/users/c/${username}`);
};

/**
 * POST /subscriptions/c/:channelId  (auth required)
 * Toggles subscription. Returns { isSubscribed: boolean }.
 *
 * @param {string} channelId  — the channel's MongoDB _id (NOT username)
 */
export const toggleSubscription = (channelId) => {
  return axiosInstance.post(`/subscriptions/c/${channelId}`);
};
