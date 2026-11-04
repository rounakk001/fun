import { useState, useEffect } from 'react';
import Header from '../../components/Header/Header';
import Sidebar from '../../components/Sidebar/Sidebar';
import VideoGrid from '../../components/VideoGrid/VideoGrid';
import { getWatchHistory } from '../../api/user.api';
import './History.css';

function History() {
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    getWatchHistory()
      .then((res) => {
        if (cancelled) return;
        setVideos(res.data.data || []);
      })
      .catch((err) => {
        if (!cancelled) setError('Failed to load history. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  return (
    <div className="history-root">
      <Header onMenuToggle={() => setSidebarOpen((prev) => !prev)} />

      <div className={`history-layout ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="history-main" id="main-content">
          <div className="history-header">
            <h1 className="history-title">Watch History</h1>
          </div>

          {error && (
            <div className="history-error">
              <span>⚠️</span>
              <p>{error}</p>
            </div>
          )}

          {!error && (
            <VideoGrid
              videos={videos}
              isLoading={isLoading}
              emptyMessage="Videos you watch will appear here."
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default History;
