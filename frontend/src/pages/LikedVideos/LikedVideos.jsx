import { useState, useEffect } from 'react';
import Header from '../../components/Header/Header';
import Sidebar from '../../components/Sidebar/Sidebar';
import VideoCard from '../../components/VideoCard/VideoCard';
import VideoCardSkeleton from '../../components/VideoCard/VideoCardSkeleton';
import { getLikedVideos } from '../../api/like.api';
import './LikedVideos.css';

function LikedVideos() {
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    getLikedVideos()
      .then((res) => {
        if (cancelled) return;
        setVideos(res.data.data || []);
      })
      .catch((err) => {
        if (!cancelled) setError('Failed to load liked videos. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  return (
    <div className="liked-root">
      <Header onMenuToggle={() => setSidebarOpen((prev) => !prev)} />

      <div className={`liked-layout ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="liked-main" id="main-content">
          <h1 className="liked-title">Liked Videos</h1>

          {isLoading && (
            <div className="liked-grid">
              {Array.from({ length: 8 }).map((_, i) => (
                <VideoCardSkeleton key={i} />
              ))}
            </div>
          )}

          {!isLoading && error && (
            <div className="liked-error">
              <span>⚠️</span>
              <p>{error}</p>
            </div>
          )}

          {!isLoading && !error && videos.length === 0 && (
            <div className="liked-empty">
              <span className="liked-empty__icon" aria-hidden="true">❤️</span>
              <h2>No liked videos yet</h2>
              <p>Videos you like will appear here.</p>
            </div>
          )}

          {!isLoading && !error && videos.length > 0 && (
            <div className="liked-grid">
              {videos.map((video) => (
                <VideoCard key={video._id} video={video} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default LikedVideos;
