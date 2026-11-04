import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Spinner from './ui/Spinner';

/**
 * PublicRoute
 *
 * Wraps routes that should only be accessible when NOT logged in
 * (Login, Register). Logged-in users are redirected to /home.
 * Also shows the full-page spinner during the boot session check
 * so we don't briefly flash the login page to an already-authed user.
 */
function PublicRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <Spinner fullPage />;
  }

  if (isAuthenticated) {
    return <Navigate to="/home" replace />;
  }

  return <Outlet />;
}

export default PublicRoute;
