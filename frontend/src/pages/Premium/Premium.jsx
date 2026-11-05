import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Header from '../../components/Header/Header';
import Sidebar from '../../components/Sidebar/Sidebar';
import VideoGrid from '../../components/VideoGrid/VideoGrid';
import { getVideos, verifyPremiumAccessCode } from '../../api/video.api';
import './Premium.css';

const STORAGE_KEY = 'yeonix_premium_unlocked';

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '';
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, '0')}`;
}

function Premium() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'shorts' ? 'shorts' : 'videos';

  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return sessionStorage.getItem(STORAGE_KEY) === 'true';
  });
  const [activeTab, setActiveTab] = useState(initialTab);

  // Passcode verification state
  const [code, setCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Video feed state
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setSearchParams(newTab === 'shorts' ? { tab: 'shorts' } : {});
  };

  // ── Fetch Premium Content ──────────────────────────────────────────
  const fetchPremiumContent = useCallback(async (pageNum = 1, tab = 'videos') => {
    try {
      const params = {
        page: pageNum,
        limit: 12,
        isPremium: true,
        sortBy: 'createdAt',
        sortType: 'desc',
      };
      if (tab === 'shorts') {
        params.isShort = true;
      }

      const response = await getVideos(params);
      const docs = response?.data?.data?.docs || [];
      const nextExists = response?.data?.data?.hasNextPage || false;

      if (pageNum === 1) {
        setVideos(docs);
      } else {
        setVideos((prev) => [...prev, ...docs]);
      }
      setHasNextPage(nextExists);
    } catch (err) {
      console.error('[Premium] Failed to load premium content:', err);
    }
  }, []);

  // When unlocked or tab changes, fetch content
  useEffect(() => {
    if (isUnlocked) {
      setIsLoading(true);
      setVideos([]);
      setPage(1);
      fetchPremiumContent(1, activeTab).finally(() => setIsLoading(false));
    }
  }, [isUnlocked, activeTab, fetchPremiumContent]);

  // ── Unlock Handler ──────────────────────────────────────────────────
  const handleUnlock = async (e) => {
    e.preventDefault();
    if (!code.trim()) {
      setErrorMsg('Please enter an access code.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      await verifyPremiumAccessCode(code.trim());
      sessionStorage.setItem(STORAGE_KEY, 'true');
      setIsUnlocked(true);
      setCode('');
    } catch (err) {
      const message =
        err.response?.data?.message ||
        'Invalid access code. Please check the code and try again.';
      setErrorMsg(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLock = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setIsUnlocked(false);
    setVideos([]);
  };

  const handleLoadMore = async () => {
    const nextPage = page + 1;
    setIsLoadingMore(true);
    await fetchPremiumContent(nextPage, activeTab);
    setPage(nextPage);
    setIsLoadingMore(false);
  };

  return (
    <div className="premium-root">
      <Header onMenuToggle={() => setSidebarOpen((prev) => !prev)} />

      <div className={`premium-layout ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="premium-content">
          {!isUnlocked ? (
            /* ── Lock Screen ── */
            <div className="premium-lock-wrapper">
              <div className="premium-lock-card">
                <div className="premium-lock__icon-wrap">
                  <span>👑</span>
                </div>
                <h1 className="premium-lock__title">Yeonix VIP Vault</h1>
                <p className="premium-lock__desc">
                  Private release vault for members. Enter your secret VIP passcode to unlock.
                </p>

                <form onSubmit={handleUnlock} className="premium-lock__form">
                  <div className="premium-input-wrap">
                    <input
                      type="password"
                      className="premium-input"
                      placeholder="ENTER VIP PASSCODE"
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value);
                        setErrorMsg('');
                      }}
                      autoFocus
                    />
                  </div>

                  {errorMsg && (
                    <p className="premium-lock__error">
                      <span>⚠️</span> {errorMsg}
                    </p>
                  )}

                  <button type="submit" className="btn-unlock" disabled={isSubmitting}>
                    {isSubmitting ? 'Authenticating...' : 'Unlock VIP Vault ✦'}
                  </button>
                </form>
              </div>
            </div>
          ) : (
            /* ── Unlocked Premium Hub ── */
            <div className="premium-hub">
              {/* Luxury Hero Banner */}
              <div className="premium-hero">
                <div className="premium-hero__text">
                  <div className="premium-hero__badge">
                    <span>👑</span> VIP Vault Unlocked
                  </div>
                  <h1 className="premium-hero__title">Exclusive VIP Lounge</h1>
                  <p className="premium-hero__subtitle">
                    Strictly isolated creator sanctuary. Premium videos and shorts published here will never appear in the public home feed.
                  </p>
                </div>

                {/* Explicit Separate Upload Actions */}
                <div className="premium-hero__action-bar">
                  <Link to="/upload?premium=true" className="btn-vault-action btn-vault-action--video">
                    <span className="btn-vault-action__icon">🎬</span>
                    <span className="btn-vault-action__text">
                      <span className="btn-vault-action__title">Upload VIP Video</span>
                      <span className="btn-vault-action__sub">Standard 16:9 format</span>
                    </span>
                  </Link>

                  <Link to="/upload?premium=true&short=true" className="btn-vault-action btn-vault-action--short">
                    <span className="btn-vault-action__icon">▶</span>
                    <span className="btn-vault-action__text">
                      <span className="btn-vault-action__title">Upload VIP Short</span>
                      <span className="btn-vault-action__sub">Vertical 9:16 clip</span>
                    </span>
                  </Link>

                  <button onClick={handleLock} className="btn-vault-lock" title="Lock the VIP vault">
                    🔒 Lock Vault
                  </button>
                </div>
              </div>

              {/* Clean Segmented Tab Navigation */}
              <div className="premium-nav-bar">
                <div className="premium-tabs-pills">
                  <button
                    className={`premium-pill-btn ${activeTab === 'videos' ? 'premium-pill-btn--active' : ''}`}
                    onClick={() => handleTabChange('videos')}
                  >
                    <span className="pill-icon">🎬</span>
                    <span>Exclusive Videos</span>
                  </button>
                  <button
                    className={`premium-pill-btn ${activeTab === 'shorts' ? 'premium-pill-btn--active' : ''}`}
                    onClick={() => handleTabChange('shorts')}
                  >
                    <span className="pill-icon">▶</span>
                    <span>VIP Shorts</span>
                  </button>
                </div>

                <div className="premium-tab-label">
                  {activeTab === 'videos' ? 'Showing Exclusive VIP Videos' : 'Showing Exclusive VIP Shorts'}
                </div>
              </div>

              {/* Content Grid */}
              {activeTab === 'videos' ? (
                /* Regular 16:9 Video Grid */
                <VideoGrid
                  videos={videos}
                  isLoading={isLoading}
                  isLoadingMore={isLoadingMore}
                  hasNextPage={hasNextPage}
                  onLoadMore={handleLoadMore}
                  emptyMessage="No VIP videos yet. Be the first to publish exclusive VIP video content!"
                />
              ) : (
                /* Portrait 9:16 Shorts Grid */
                <div className="premium-shorts-section">
                  {isLoading ? (
                    <div className="premium-shorts-grid">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="premium-short-skeleton" />
                      ))}
                    </div>
                  ) : videos.length === 0 ? (
                    <div className="premium-empty-box">
                      <span className="empty-icon">👑▶</span>
                      <h3>No VIP Shorts Yet</h3>
                      <p>Publish vertical exclusive shorts strictly for VIP Vault members.</p>
                      <Link to="/upload?premium=true&short=true" className="btn-vault-action btn-vault-action--short">
                        <span>▶</span> Upload First VIP Short
                      </Link>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.2rem' }}>
                        <Link to="/shorts?premium=true" className="btn-vault-action btn-vault-action--short">
                          <span>▶</span> Open Fullscreen VIP Reels
                        </Link>
                      </div>
                      <div className="premium-shorts-grid">
                        {videos.map((short) => (
                          <PremiumShortCard key={short._id} short={short} />
                        ))}
                      </div>
                      {hasNextPage && (
                        <div className="premium-load-more">
                          <button
                            className="btn-vault-load-more"
                            onClick={handleLoadMore}
                            disabled={isLoadingMore}
                          >
                            {isLoadingMore ? 'Loading VIP Shorts...' : 'Load More VIP Shorts'}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function PremiumShortCard({ short }) {
  const ownerName = short.owner?.fullName || short.owner?.username || 'VIP Creator';
  const ownerInitial = ownerName[0]?.toUpperCase() || '?';

  return (
    <Link to="/shorts?premium=true" className="premium-short-card" title="Play in VIP Reels Player">
      <div className="premium-short-card__thumb-wrap">
        <img
          src={short.thumbnail}
          alt={short.title}
          className="premium-short-card__thumb"
          loading="lazy"
        />
        <div className="premium-short-card__badge">👑 VIP</div>
        <span className="premium-short-card__play">▶</span>
        {short.duration && (
          <span className="premium-short-card__duration">{formatDuration(short.duration)}</span>
        )}
      </div>
      <div className="premium-short-card__info">
        <div className="premium-short-card__avatar-wrap">
          {short.owner?.avatar ? (
            <img src={short.owner.avatar} alt={ownerName} className="premium-short-card__avatar" />
          ) : (
            <span className="premium-short-card__avatar-fallback">{ownerInitial}</span>
          )}
        </div>
        <div className="premium-short-card__details">
          <p className="premium-short-card__title">{short.title}</p>
          <p className="premium-short-card__owner">{ownerName}</p>
        </div>
      </div>
    </Link>
  );
}

export default Premium;
