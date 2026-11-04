import axios from 'axios';

/**
 * Pre-configured axios instance for all Yeonix API calls.
 *
 * Key decisions:
 * - baseURL sourced from VITE env var — never hardcoded
 * - withCredentials: true globally — required for httpOnly cookie auth
 * - Response interceptor: silent 401 → refresh token → retry once
 *   If refresh also fails, dispatches a custom DOM event so AuthContext
 *   can clear user state without importing context here (avoids circular deps)
 */

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  withCredentials: true,
  // Note: do NOT set a global Content-Type header here.
  // Axios sets it automatically per-request:
  //   - application/json for plain object bodies
  //   - multipart/form-data (with boundary) for FormData bodies
});

// Track whether a refresh is already in flight to avoid parallel refresh calls
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

if (typeof window !== 'undefined') {
  window.addEventListener('yeonix:session-expired', () => {
    isRefreshing = false;
    failedQueue = [];
  });
}

axiosInstance.interceptors.response.use(
  // Pass through successful responses unchanged
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    // Never attempt token refresh on auth endpoints:
    // - /users/login: 401 means invalid credentials, NOT an expired session. Refreshing here masks the error!
    // - /users/register: 401 means registration/validation failure.
    // - /users/logout: 401 means already logged out/token missing — we are logging out anyway.
    // - /users/refresh-token: the refresh attempt itself failed; attempting another would deadlock/loop.
    const isAuthBypassUrl = [
      '/users/login',
      '/users/register',
      '/users/logout',
      '/users/refresh-token',
    ].some((path) => originalRequest?.url?.includes(path));

    if (error.response?.status === 401 && isAuthBypassUrl) {
      if (originalRequest?.url?.includes('/users/refresh-token')) {
        isRefreshing = false;
        processQueue(error);
        window.dispatchEvent(new CustomEvent('yeonix:session-expired'));
      }
      return Promise.reject(error);
    }
    
    // Only attempt refresh on 401, and only once per request
    if (error.response?.status === 401 && !originalRequest._retried) {
      if (isRefreshing) {
        // Queue additional requests while refresh is in flight
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => axiosInstance(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retried = true;
      isRefreshing = true;

      try {
        // Attempt token refresh — uses refreshToken cookie automatically
        await axiosInstance.post('/users/refresh-token');
        processQueue(null);
        isRefreshing = false;
        // Retry the original request with fresh cookies
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        isRefreshing = false;
        // Refresh failed — session is dead. Notify AuthContext via DOM event.
        window.dispatchEvent(new CustomEvent('yeonix:session-expired'));
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
