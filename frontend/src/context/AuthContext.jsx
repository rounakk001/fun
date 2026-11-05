import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as authApi from '../api/auth.api';

/**
 * AuthContext
 *
 * Why useReducer instead of multiple useState calls?
 * Auth state has 3 fields that change together (user, isLoading, isAuthenticated).
 * useReducer keeps state transitions explicit and atomic — easier to explain in interviews.
 *
 * State shape:
 *   { user: object|null, isLoading: boolean, isAuthenticated: boolean }
 */

// ---------- Reducer ----------

const initialState = {
  user: null,
  isLoading: true,       // true on boot — blocks rendering until session check resolves
  isAuthenticated: false,
};

const AUTH_ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  SET_USER: 'SET_USER',
  CLEAR_USER: 'CLEAR_USER',
};

function authReducer(state, action) {
  switch (action.type) {
    case AUTH_ACTIONS.SET_LOADING:
      return { ...state, isLoading: action.payload };

    case AUTH_ACTIONS.SET_USER:
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        isLoading: false,
      };

    case AUTH_ACTIONS.CLEAR_USER:
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
      };

    default:
      return state;
  }
}

// ---------- Context ----------

const AuthContext = createContext(null);

// ---------- Provider ----------

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const navigate = useNavigate();

  // On mount: check if the browser has a valid session cookie
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await authApi.getCurrentUser();
        // Backend shape: { statusCode, data, message, success }
        dispatch({ type: AUTH_ACTIONS.SET_USER, payload: response.data.data });
      } catch {
        // 401 or network error — no active session
        dispatch({ type: AUTH_ACTIONS.CLEAR_USER });
      }
    };

    checkSession();
  }, []);

  // Listen for the session-expired event fired by the axios interceptor
  // when both the original request and the refresh attempt return 401
  useEffect(() => {
    const handleSessionExpired = () => {
      try { sessionStorage.clear(); } catch {}
      dispatch({ type: AUTH_ACTIONS.CLEAR_USER });
      navigate('/login', { replace: true });
    };

    window.addEventListener('yeonix:session-expired', handleSessionExpired);
    return () => window.removeEventListener('yeonix:session-expired', handleSessionExpired);
  }, [navigate]);

  // ---------- Auth actions (exposed to consumers) ----------

  const login = useCallback(async (credentials) => {
    try { sessionStorage.clear(); } catch {}
    const response = await authApi.loginUser(credentials);
    // Backend returns { data: { user, accessToken, refreshToken } }
    dispatch({ type: AUTH_ACTIONS.SET_USER, payload: response.data.data.user });
    navigate('/home', { replace: true });
  }, [navigate]);

  const register = useCallback(async (formData) => {
    try { sessionStorage.clear(); } catch {}
    // register returns the created user — but does NOT set cookies (no auto-login)
    await authApi.registerUser(formData);
    // Redirect to login so user can sign in with their new credentials
    navigate('/login', { replace: true });
  }, [navigate]);

  const logout = useCallback(async () => {
    try { sessionStorage.clear(); } catch {}
    try {
      await authApi.logoutUser();
    } catch {
      // Even if the backend call fails, clear local state
    }
    dispatch({ type: AUTH_ACTIONS.CLEAR_USER });
    navigate('/login', { replace: true });
  }, [navigate]);

  const value = {
    user: state.user,
    isLoading: state.isLoading,
    isAuthenticated: state.isAuthenticated,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ---------- Hook ----------

/**
 * useAuth — consume AuthContext anywhere in the tree.
 * Throws if used outside AuthProvider so the error is clear.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}
