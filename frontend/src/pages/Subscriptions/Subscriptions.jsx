import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Header from '../../components/Header/Header';
import Sidebar from '../../components/Sidebar/Sidebar';
import { useAuth } from '../../context/AuthContext';
import { getUserSubscriptions } from '../../api/subscription.api';
import './Subscriptions.css';

function Subscriptions() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);
  const [subscriptions, setSubscriptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?._id) return;
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    getUserSubscriptions(user._id)
      .then((res) => {
        if (cancelled) return;
        setSubscriptions(res.data.data || []);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load subscriptions. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [user?._id]);

  return (
    <div className="subs-root">
      <Header onMenuToggle={() => setSidebarOpen((prev) => !prev)} />

      <div className={`subs-layout ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="subs-main" id="main-content">
          <h1 className="subs-title">Subscriptions</h1>

          {/* ── Loading skeleton ─────────────────────────── */}
          {isLoading && (
            <div className="subs-grid">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="subs-card subs-card--skeleton">
                  <div className="subs-card__avatar-wrap">
                    <div className="subs-card__avatar-skeleton" />
                  </div>
                  <div className="subs-card__name-skeleton" />
                </div>
              ))}
            </div>
          )}

          {/* ── Error state ──────────────────────────────── */}
          {!isLoading && error && (
            <div className="subs-error">
              <span>⚠️</span>
              <p>{error}</p>
            </div>
          )}

          {/* ── Empty state ──────────────────────────────── */}
          {!isLoading && !error && subscriptions.length === 0 && (
            <div className="subs-empty">
              <span className="subs-empty__icon" aria-hidden="true">📡</span>
              <h2>No subscriptions yet</h2>
              <p>Channels you subscribe to will appear here.</p>
            </div>
          )}

          {/* ── Subscription grid ────────────────────────── */}
          {!isLoading && !error && subscriptions.length > 0 && (
            <div className="subs-grid">
              {subscriptions.map(({ channel, hasNewContent }) => (
                <Link
                  key={channel._id}
                  to={`/channel/${channel.username}`}
                  className="subs-card"
                  title={channel.fullName || channel.username}
                >
                  <div className="subs-card__avatar-wrap">
                    {channel.avatar ? (
                      <img
                        src={channel.avatar}
                        alt={channel.fullName || channel.username}
                        className="subs-card__avatar"
                      />
                    ) : (
                      <div className="subs-card__avatar subs-card__avatar--fallback">
                        {(channel.fullName || channel.username || '?')[0].toUpperCase()}
                      </div>
                    )}
                    {hasNewContent && (
                      <span
                        className="subs-card__new-dot"
                        aria-label="New content available"
                        title="This channel has new content"
                      />
                    )}
                  </div>

                  <p className="subs-card__name">
                    {channel.fullName || channel.username}
                  </p>
                  <p className="subs-card__username">@{channel.username}</p>
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default Subscriptions;
