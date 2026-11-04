import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import './styles/global.css';

/**
 * Entry point.
 *
 * Provider order (inside-out):
 *   BrowserRouter  — provides routing context (must wrap AuthProvider
 *                    because AuthProvider uses useNavigate)
 *   AuthProvider   — provides auth state + login/logout/register actions
 *   App            — route definitions
 */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
