import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Spinner from './ui/Spinner';

/**
 * ProtectedRoute
 *
 * Wraps any route that requires authentication.
 * - While the boot-time session check is in progress: shows a full-page spinner
 *   (prevents flashing the login page before the cookie check resolves)
 * - If no authenticated user: redirects to /login
 * - If authenticated: renders the nested <Outlet /> (the actual page)
 */
function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <Spinner fullPage />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
