import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';
import Login from './pages/Login/Login';
import Register from './pages/Register/Register';
import Home from './pages/Home/Home';
import Search from './pages/Search/Search';
import Watch from './pages/Watch/Watch';
import Upload from './pages/Upload/Upload';
import Channel from './pages/Channel/Channel';
import LikedVideos from './pages/LikedVideos/LikedVideos';
import Playlist from './pages/Playlist/Playlist';
import Dashboard from './pages/Dashboard/Dashboard';
import History from './pages/History/History';
import Subscriptions from './pages/Subscriptions/Subscriptions';
import Premium from './pages/Premium/Premium';
import Shorts from './pages/Shorts/Shorts';

/**
 * App — route definitions.
 *
 * Route structure:
 *   /              → redirect to /home
 *   /login         → PublicRoute (redirects to /home if already logged in)
 *   /register      → PublicRoute (same)
 *   /home          → ProtectedRoute (requires auth)
 *   /search        → ProtectedRoute (requires auth — same shell)
 *   /watch/:videoId → ProtectedRoute (requires auth — same shell)
 *
 * Both GET /videos and GET /videos/:id are public on the backend,
 * but we still wrap them in ProtectedRoute so they get the Header/Sidebar shell
 * with the user's avatar + logout. Unauthenticated users see the login page.
 */
function App() {
  return (
    <Routes>
      {/* Default redirect: direct unauthenticated users to login first */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Public routes — redirect away if already logged in */}
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      {/* Routes accessible to everyone (logged in or logged out) */}
      <Route path="/playlist/:playlistId" element={<Playlist />} />

      {/* Protected routes — require authentication */}
      <Route element={<ProtectedRoute />}>
        <Route path="/home" element={<Home />} />
        <Route path="/search" element={<Search />} />
        <Route path="/watch/:videoId" element={<Watch />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/channel/:username" element={<Channel />} />
        <Route path="/liked-videos" element={<LikedVideos />} />
        <Route path="/history" element={<History />} />
        <Route path="/subscriptions" element={<Subscriptions />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/premium" element={<Premium />} />
        <Route path="/shorts" element={<Shorts />} />
      </Route>

      {/* Catch-all — redirect any unknown path to login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
