import axiosInstance from './axiosInstance';

/**
 * GET /subscriptions/u/:subscriberId
 * Returns the list of channels the given user is subscribed to.
 * Each item: { channel: { _id, username, fullName, avatar }, hasNewContent, lastViewedAt }
 *
 * @param {string} subscriberId — the current user's MongoDB _id
 */
export const getUserSubscriptions = (subscriberId) => {
  return axiosInstance.get(`/subscriptions/u/${subscriberId}`);
};
