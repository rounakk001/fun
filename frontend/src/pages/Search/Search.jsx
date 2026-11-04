import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '../../components/Header/Header';
import Sidebar from '../../components/Sidebar/Sidebar';
import VideoGrid from '../../components/VideoGrid/VideoGrid';
import { getVideos } from '../../api/video.api';
import './Search.css';

/**
 * Search — dedicated results page at /search?q=...
 *
 * Why a separate page instead of inline filtering on the home feed?
 * - URL is shareable and bookmarkable
 * - Keeps home feed state clean — no need to reset it after searching
 * - Natural browser back navigation returns to the unfiltered feed
 *
 * Search is debounced at 400ms via the Header's submit event (navigate),
 * so no further debounce is needed here. This page reacts to URLSearchParams.
 */
function Search() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);

  // Abort controller ref to cancel in-flight requests when query changes
  const abortRef = useRef(null);

  useEffect(() => {
    if (!query) return;

    // Cancel any previous request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let cancelled = false;
    setIsLoading(true);
    setVideos([]);
    setPage(1);
    setHasNextPage(false);

    getVideos({ page: 1, limit: 12, query, sortBy: 'createdAt', sortType: 'desc' })
      .then((response) => {
        if (cancelled) return;
        const { docs, hasNextPage: nextExists } = response.data.data;
        setVideos(docs);
        setHasNextPage(nextExists);
        setError(null);
      })
      .catch((err) => {
        if (cancelled || err.code === 'ERR_CANCELED') return;
        console.error('[Search] Failed:', err);
        setError('Search failed. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  const handleLoadMore = async () => {
    const nextPage = page + 1;
    setIsLoadingMore(true);
    try {
      const response = await getVideos({ page: nextPage, limit: 12, query, sortBy: 'createdAt', sortType: 'desc' });
      const { docs, hasNextPage: nextExists } = response.data.data;
      setVideos((prev) => [...prev, ...docs]);
      setHasNextPage(nextExists);
      setPage(nextPage);
    } catch (err) {
      console.error('[Search] Load more failed:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <div className="search-root">
      <Header onMenuToggle={() => setSidebarOpen((prev) => !prev)} />

      <div className="search-layout">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="content-area search-content" id="main-content">
          {/* ── Page heading ─────────────────────────────────────── */}
          <div className="search-heading">
            {query ? (
              <>
                <h1 className="search-heading__title">
                  Results for <span className="search-heading__query">"{query}"</span>
                </h1>
                {!isLoading && videos.length > 0 && (
                  <p className="search-heading__count">
                    {videos.length} video{videos.length !== 1 ? 's' : ''} found
                  </p>
                )}
              </>
            ) : (
              <h1 className="search-heading__title">Search videos</h1>
            )}
          </div>

          {/* ── Error ────────────────────────────────────────────── */}
          {error ? (
            <div className="search-error">
              <span aria-hidden="true">⚠️</span>
              <p>{error}</p>
            </div>
          ) : !query ? (
            /* No query yet */
            <div className="search-empty">
              <span className="search-empty__icon" aria-hidden="true">🔍</span>
              <p className="search-empty__text">Type something in the search bar above to find videos.</p>
            </div>
          ) : (
            <VideoGrid
              videos={videos}
              isLoading={isLoading}
              isLoadingMore={isLoadingMore}
              hasNextPage={hasNextPage}
              onLoadMore={handleLoadMore}
              emptyMessage={`No results for "${query}". Try different keywords.`}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default Search;
