import { useState, useEffect, useCallback } from 'react';
import Header from '../../components/Header/Header';
import Sidebar from '../../components/Sidebar/Sidebar';
import VideoGrid from '../../components/VideoGrid/VideoGrid';
import { getVideos } from '../../api/video.api';
import { getHomeRecommendations } from '../../api/recommendation.api';
import './Home.css';

/**
 * Home — the top-level app shell with a real video feed.
 *
 * Data strategy:
 *   - Fetch first page on mount
 *   - "Load more" appends next page to local state
 *   - Uses hasNextPage from paginated API response to show/hide the button
 *
 * Search:
 *   - The Header's search bar navigates to /search?q=... (dedicated page)
 *   - Home always shows the general feed
 */
function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);

  // ── Video feed state ────────────────────────────────────────────
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);

  // ── Fetch a page of videos (ML Hybrid recommendations on page 1) ──
  const fetchVideos = useCallback(async (pageNum) => {
    try {
      if (pageNum === 1) {
        try {
          const recRes = await getHomeRecommendations({ limit: 12 });
          const recs = recRes.data?.data?.recommendations;
          if (recs && recs.length > 0) {
            setVideos(recs);
            setHasNextPage(false);
            setError(null);
            return;
          }
        } catch (recErr) {
          console.warn('[Home] Recommendation API fallback to chronological:', recErr);
        }
      }

      const response = await getVideos({ page: pageNum, limit: 12, sortBy: 'createdAt', sortType: 'desc' });
      const { docs, hasNextPage: nextExists } = response.data.data;
      if (pageNum === 1) {
        setVideos(docs);
      } else {
        setVideos((prev) => [...prev, ...docs]);
      }
      setHasNextPage(nextExists);
      setError(null);
    } catch (err) {
      console.error('[Home] Failed to fetch videos:', err);
      setError('Could not load videos. Please try again.');
    }
  }, []);

  // ── Initial load ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchVideos(1).finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [fetchVideos]);

  // ── Load more ───────────────────────────────────────────────────
  const handleLoadMore = async () => {
    const nextPage = page + 1;
    setIsLoadingMore(true);
    await fetchVideos(nextPage);
    setPage(nextPage);
    setIsLoadingMore(false);
  };

  return (
    <div className="home-root">
      <Header onMenuToggle={() => setSidebarOpen((prev) => !prev)} />

      <div className={`home-layout ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="content-area" id="main-content">
          {error ? (
            <div className="home-error">
              <span className="home-error__icon" aria-hidden="true">⚠️</span>
              <p className="home-error__text">{error}</p>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setIsLoading(true);
                  fetchVideos(1).finally(() => setIsLoading(false));
                }}
              >
                Retry
              </button>
            </div>
          ) : (
            <VideoGrid
              videos={videos}
              isLoading={isLoading}
              isLoadingMore={isLoadingMore}
              hasNextPage={hasNextPage}
              onLoadMore={handleLoadMore}
              emptyMessage="No videos yet. Be the first to upload!"
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default Home;
