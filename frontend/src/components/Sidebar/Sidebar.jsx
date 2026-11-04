import { useState, useEffect } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getUserSubscriptions } from '../../api/subscription.api';
import './Sidebar.css';

const INITIAL_VISIBLE = 4;

function Sidebar({ isOpen, onClose }) {
  const { isAuthenticated, user } = useAuth();
  const [subscriptions, setSubscriptions] = useState([]);
  const [showAll, setShowAll] = useState(false);

  /* Fetch subscriptions once the user is known */
  useEffect(() => {
    if (!isAuthenticated || !user?._id) return;
    getUserSubscriptions(user._id)
      .then((res) => setSubscriptions(res.data.data || []))
      .catch(() => {/* silently fail in sidebar */});
  }, [isAuthenticated, user?._id]);

  const visibleSubs = showAll ? subscriptions : subscriptions.slice(0, INITIAL_VISIBLE);
  const hasMore = subscriptions.length > INITIAL_VISIBLE;

  const NAV_ITEMS_BEFORE = [
    {
      id: 'nav-home',
      label: 'Home',
      to: '/home',
      icon: HomeIcon,
      enabled: true,
    },
    {
      id: 'nav-premium',
      label: '👑 VIP Vault',
      to: '/premium',
      icon: CrownIcon,
      enabled: true,
    },
    {
      id: 'nav-trending',
      label: 'Trending',
      icon: TrendingIcon,
      enabled: false,
    },
  ];

  const NAV_ITEMS_AFTER = [
    {
      id: 'nav-library',
      label: 'Library',
      icon: LibraryIcon,
      enabled: false,
    },
    {
      id: 'nav-history',
      label: 'History',
      to: '/history',
      icon: HistoryIcon,
      enabled: true,
    },
    {
      id: 'nav-playlists',
      label: 'Playlists',
      to: isAuthenticated && user ? `/channel/${user.username}?tab=playlists` : null,
      icon: PlaylistIcon,
      enabled: isAuthenticated,
    },
    {
      id: 'nav-liked',
      label: 'Liked Videos',
      to: '/liked-videos',
      icon: LikedIcon,
      enabled: isAuthenticated,
    },
  ];

  const renderNavItems = (items) => items.map(({ id, label, to, icon: Icon, enabled }) => {
    if (enabled) {
      return (
        <li key={id}>
          <NavLink
            id={id}
            to={to}
            className={({ isActive }) =>
              `sidebar__nav-item${isActive ? ' sidebar__nav-item--active' : ''}`
            }
            onClick={onClose}
            end
          >
            <Icon />
            <span>{label}</span>
          </NavLink>
        </li>
      );
    }
    return (
      <li key={id}>
        <div
          id={id}
          className="sidebar__nav-item sidebar__nav-item--disabled"
          role="link"
          aria-disabled="true"
          title={`${label} — coming soon`}
        >
          <Icon />
          <span>{label}</span>
        </div>
      </li>
    );
  });

  return (
    <>
      {/* Backdrop — mobile only */}
      {isOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <nav
        className={`sidebar${isOpen ? ' sidebar--open' : ''}`}
        aria-label="Main navigation"
      >
        <ul className="sidebar__nav" role="list">

          {/* ── Home + Trending ───────────────────────────── */}
          {renderNavItems(NAV_ITEMS_BEFORE)}

          {/* ── Subscriptions section (auth-only) ───────── */}
          {isAuthenticated && (
            <li className="sidebar__subs-section">
              {/* Header row: "Subscriptions  >" */}
              <div className="sidebar__subs-header">
                <NavLink
                  id="nav-subscriptions"
                  to="/subscriptions"
                  className={({ isActive }) =>
                    `sidebar__subs-label${isActive ? ' sidebar__subs-label--active' : ''}`
                  }
                  onClick={onClose}
                  end
                >
                  <SubscriptionsIcon />
                  <span>Subscriptions</span>
                </NavLink>
                <Link
                  to="/subscriptions"
                  className="sidebar__subs-chevron"
                  aria-label="Go to Subscriptions page"
                  onClick={onClose}
                  title="See all subscriptions"
                >
                  <ChevronRightIcon />
                </Link>
              </div>

              {/* Nested channel list */}
              {subscriptions.length > 0 && (
                <ul className="sidebar__subs-list" role="list">
                  {visibleSubs.map(({ channel, hasNewContent }) => (
                    <li key={channel._id}>
                      <NavLink
                        to={`/channel/${channel.username}`}
                        className="sidebar__sub-item"
                        onClick={onClose}
                      >
                        <span className="sidebar__sub-avatar-wrap">
                          {channel.avatar ? (
                            <img
                              src={channel.avatar}
                              alt={channel.fullName || channel.username}
                              className="sidebar__sub-avatar"
                            />
                          ) : (
                            <span className="sidebar__sub-avatar sidebar__sub-avatar--fallback">
                              {(channel.fullName || channel.username || '?')[0].toUpperCase()}
                            </span>
                          )}
                          {hasNewContent && (
                            <span className="sidebar__sub-dot" aria-label="New content" />
                          )}
                        </span>
                        <span className="sidebar__sub-name">
                          {channel.fullName || channel.username}
                        </span>
                      </NavLink>
                    </li>
                  ))}

                  {/* Show more / Show less */}
                  {hasMore && (
                    <li>
                      <button
                        className="sidebar__subs-toggle"
                        onClick={() => setShowAll((prev) => !prev)}
                        aria-expanded={showAll}
                      >
                        {showAll ? <ChevronUpIcon /> : <ChevronDownIcon />}
                        <span>{showAll ? 'Show less' : 'Show more'}</span>
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </li>
          )}
          {/* ── Library, History, Playlists, Liked Videos ─ */}
          {renderNavItems(NAV_ITEMS_AFTER)}

        </ul>
      </nav>
    </>
  );
}

/* ── Inline SVG icons ──────────────────────────────────────────── */

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function TrendingIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function SubscriptionsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function LibraryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="12 8 12 12 14 14" />
      <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5" />
    </svg>
  );
}

function LikedIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function PlaylistIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"></line>
      <line x1="8" y1="12" x2="21" y2="12"></line>
      <line x1="8" y1="18" x2="21" y2="18"></line>
      <line x1="3" y1="6" x2="3.01" y2="6"></line>
      <line x1="3" y1="12" x2="3.01" y2="12"></line>
      <line x1="3" y1="18" x2="3.01" y2="18"></line>
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

function CrownIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f5c518" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14v2H5v-2z" />
    </svg>
  );
}

export default Sidebar;
