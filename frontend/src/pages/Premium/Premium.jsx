import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Header from '../../components/Header/Header';
import Sidebar from '../../components/Sidebar/Sidebar';
import VideoGrid from '../../components/VideoGrid/VideoGrid';
import { getVideos, verifyPremiumAccessCode } from '../../api/video.api';
import './Premium.css';

const STORAGE_KEY = 'yeonix_premium_unlocked';

function Premium() {
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return sessionStorage.getItem(STORAGE_KEY) === 'true';
  });

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

  // ── Fetch Premium Videos (isPremium: true ONLY) ──────────────────────
  const fetchPremiumVideos = useCallback(async (pageNum = 1) => {
    try {
      const response = await getVideos({
        page: pageNum,
        limit: 12,
        isPremium: true,
        sortBy: 'createdAt',
        sortType: 'desc'
      });
      const docs = response?.data?.data?.docs || [];
      const nextExists = response?.data?.data?.hasNextPage || false;

      if (pageNum === 1) {
        setVideos(docs);
      } else {
        setVideos((prev) => [...prev, ...docs]);
      }
      setHasNextPage(nextExists);
    } catch (err) {
      console.error('[Premium] Failed to load premium videos:', err);
    }
  }, []);

  // When unlocked, fetch the exclusive videos
  useEffect(() => {
    if (isUnlocked) {
      setIsLoading(true);
      fetchPremiumVideos(1).finally(() => setIsLoading(false));
    }
  }, [isUnlocked, fetchPremiumVideos]);

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
    await fetchPremiumVideos(nextPage);
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
                  Exclusive vault for private releases. Enter your secret VIP passcode to unlock access.
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
            <div>
              {/* Hero Banner */}
              <div className="premium-hero">
                <div>
                  <div className="premium-hero__badge">
                    <span>👑</span> Vault Unlocked
                  </div>
                  <h1 className="premium-hero__title">Yeonix VIP Vault</h1>
                  <p className="premium-hero__subtitle">
                    Private vault for exclusive creator content. Videos published here are strictly isolated and never appear in the public home feed.
                  </p>
                </div>

                <div className="premium-hero__actions">
                  <Link to="/upload?premium=true" className="btn-premium-upload">
                    <span>✦</span> Upload to Vault
                  </Link>
                  <button onClick={handleLock} className="btn-lock" title="Lock the VIP vault">
                    🔒 Lock Vault
                  </button>
                </div>
              </div>

              {/* Exclusive Video Grid */}
              <VideoGrid
                videos={videos}
                isLoading={isLoading}
                isLoadingMore={isLoadingMore}
                hasNextPage={hasNextPage}
                onLoadMore={handleLoadMore}
                emptyMessage="No vault videos yet. Be the first to publish exclusive VIP content!"
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default Premium;
