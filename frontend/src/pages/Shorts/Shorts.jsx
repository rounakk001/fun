import { useState, useEffect, useCallback } from 'react';
import Header from '../../components/Header/Header';
import Sidebar from '../../components/Sidebar/Sidebar';
import { getVideos } from '../../api/video.api';
import { Link } from 'react-router-dom';
import './Shorts.css';

function Shorts() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [shorts, setShorts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchShorts = useCallback(async (pageNum = 1) => {
    try {
      const response = await getVideos({
        page: pageNum,
        limit: 12,
        isShort: true,
        sortBy: 'createdAt',
        sortType: 'desc',
      });
      const docs = response?.data?.data?.docs || [];
      const nextExists = response?.data?.data?.hasNextPage || false;
      if (pageNum === 1) setShorts(docs);
      else setShorts((prev) => [...prev, ...docs]);
      setHasNextPage(nextExists);
    } catch (err) {
      console.error('[Shorts] Failed to load shorts:', err);
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    fetchShorts(1).finally(() => setIsLoading(false));
  }, [fetchShorts]);

  const handleLoadMore = async () => {
    const nextPage = page + 1;
    setIsLoadingMore(true);
    await fetchShorts(nextPage);
    setPage(nextPage);
    setIsLoadingMore(false);
  };

  return (
    <div className="shorts-root">
      <Header onMenuToggle={() => setSidebarOpen((prev) => !prev)} />
      <div className="shorts-layout">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="shorts-main">
          <div className="shorts-header">
            <span className="shorts-header__icon">▶</span>
            <h1 className="shorts-header__title">Shorts</h1>
            <p className="shorts-header__sub">Quick clips from the community</p>
          </div>

          {isLoading ? (
            <div className="shorts-loading">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="shorts-skeleton" />
              ))}
            </div>
          ) : shorts.length === 0 ? (
            <div className="shorts-empty">
              <span>🎬</span>
              <p>No shorts yet. Be the first to upload a short!</p>
              <Link to="/upload?short=true" className="shorts-upload-btn">Upload a Short</Link>
            </div>
          ) : (
            <>
              <div className="shorts-grid">
                {shorts.map((short) => (
                  <ShortCard key={short._id} short={short} />
                ))}
              </div>
              {hasNextPage && (
                <div className="shorts-load-more">
                  <button
                    className="shorts-load-more__btn"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? 'Loading...' : 'Load more shorts'}
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function ShortCard({ short }) {
  const ownerName = short.owner?.fullName || short.owner?.username || 'Unknown';
  const ownerInitial = ownerName[0]?.toUpperCase() || '?';

  return (
    <Link to={`/watch/${short._id}`} className="short-card">
      <div className="short-card__thumb-wrap">
        <img
          src={short.thumbnail}
          alt={short.title}
          className="short-card__thumb"
          loading="lazy"
        />
        <span className="short-card__play-icon">▶</span>
        {short.duration && (
          <span className="short-card__duration">{formatDuration(short.duration)}</span>
        )}
      </div>
      <div className="short-card__info">
        <div className="short-card__avatar-wrap">
          {short.owner?.avatar ? (
            <img src={short.owner.avatar} alt={ownerName} className="short-card__avatar" />
          ) : (
            <span className="short-card__avatar short-card__avatar--fallback">{ownerInitial}</span>
          )}
        </div>
        <div className="short-card__text">
          <p className="short-card__title">{short.title}</p>
          <p className="short-card__owner">{ownerName}</p>
        </div>
      </div>
    </Link>
  );
}

function formatDuration(seconds) {
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, '0')}`;
}

export default Shorts;
