import axiosInstance from './axiosInstance';

/**
 * Auth API functions.
 * All functions return the full axios response so callers can
 * access both response.data (the ApiResponse wrapper) and
 * response.data.data (the actual payload).
 *
 * Backend response shape:
 *   Success: { statusCode, data, message, success: true }
 *   Error:   { success: false, message, errors, data: null }
 */

/**
 * Register a new user.
 * @param {FormData} formData - Must include: fullName, email, username, password, avatar (file).
 *                              Optionally: coverImage (file).
 */
export const registerUser = (formData) => {
  // Do NOT set Content-Type here — when axios receives a FormData body it
  // automatically sets multipart/form-data AND includes the required boundary
  // string. Setting it manually omits the boundary, breaking multer on the server.
  return axiosInstance.post('/users/register', formData);
};

/**
 * Login an existing user.
 * Backend accepts either email or username alongside password.
 * @param {{ email?: string, username?: string, password: string }} credentials
 */
export const loginUser = (credentials) => {
  return axiosInstance.post('/users/login', credentials);
};

/**
 * Logout the current user.
 * Requires a valid accessToken cookie — backend will clear both cookies.
 */
export const logoutUser = () => {
  return axiosInstance.post('/users/logout');
};

/**
 * Fetch the currently authenticated user's data.
 * Used on app boot to rehydrate auth state from the existing cookie.
 * Returns 401 if no valid session exists.
 */
export const getCurrentUser = () => {
  return axiosInstance.get('/users/current-user');
};

/**
 * Explicitly call the refresh-token endpoint.
 * Note: the axiosInstance interceptor calls this automatically on 401.
 * This export exists for manual use if needed.
 */
export const refreshToken = () => {
  return axiosInstance.post('/users/refresh-token');
};
