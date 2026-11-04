import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Header.css';

/**
 * Header — persistent top navigation bar.
 *
 * Sections:
 *   Left  : hamburger (mobile) + Yeonix logo
 *   Center : search bar (placeholder — non-functional for now)
 *   Right  : upload icon, notifications icon, user avatar + dropdown
 *
 * Props:
 *   onMenuToggle {function} — called when the hamburger is clicked;
 *                             parent (Home) manages sidebar open state
 */

function Header({ onMenuToggle }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setDropdownOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Escape') setSearchQuery('');
  };

  // Fallback initials for avatar if no image
  const initials = user?.fullName
    ? user.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <header className="header" role="banner">
      {/* ── Left: Hamburger + Logo ──────────────────────────────── */}
      <div className="header__left">
        <button
          id="header-menu-toggle"
          className="header__icon-btn"
          onClick={onMenuToggle}
          aria-label="Toggle sidebar menu"
        >
          <HamburgerIcon />
        </button>

        <Link to="/home" className="header__logo" aria-label="Yeonix home">
          <span className="header__logo-mark">Y</span>
          <span className="header__logo-word">eonix</span>
        </Link>
      </div>

      {/* ── Center: Search ─────────────────────────────────────── */}
      <div className="header__center">
        <form
          className="header__search"
          role="search"
          onSubmit={handleSearchSubmit}
        >
          <span className="header__search-icon" aria-hidden="true">
            <SearchIcon />
          </span>
          <input
            id="header-search-input"
            type="search"
            className="header__search-input"
            placeholder="Search videos..."
            aria-label="Search videos"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            autoComplete="off"
          />
          <button
            id="header-search-btn"
            className="header__search-btn"
            type="submit"
            aria-label="Submit search"
          >
            <SearchIcon />
          </button>
        </form>
      </div>

      {/* ── Right: Actions + User ──────────────────────────────── */}
      <div className="header__right">
        {/* Upload */}
        <button
          id="header-upload-btn"
          className="header__icon-btn"
          aria-label="Upload video"
          title="Upload video"
          onClick={() => navigate('/upload')}
        >
          <UploadIcon />
        </button>


        {/* Notifications — placeholder */}
        <button
          id="header-notifications-btn"
          className="header__icon-btn"
          aria-label="Notifications (coming soon)"
          title="Notifications"
          disabled
        >
          <BellIcon />
        </button>

        {/* User avatar + dropdown */}
        <div className="header__user" ref={dropdownRef}>
          <button
            id="header-user-menu-btn"
            className="header__avatar-btn"
            onClick={() => setDropdownOpen((prev) => !prev)}
            aria-haspopup="true"
            aria-expanded={dropdownOpen}
            aria-label="User menu"
          >
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.fullName || 'User avatar'}
                className="header__avatar-img"
              />
            ) : (
              <div className="header__avatar-fallback" aria-hidden="true">
                {initials}
              </div>
            )}
          </button>

          {/* Dropdown menu */}
          {dropdownOpen && (
            <div
              className="header__dropdown"
              role="menu"
              aria-label="User account menu"
            >
              {/* User info */}
              <div className="header__dropdown-info">
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.fullName}
                    className="header__dropdown-avatar"
                  />
                ) : (
                  <div className="header__avatar-fallback header__avatar-fallback--lg">
                    {initials}
                  </div>
                )}
                <div className="header__dropdown-text">
                  <span className="header__dropdown-name">{user?.fullName}</span>
                  <span className="header__dropdown-email">{user?.email}</span>
                  <span className="header__dropdown-username">@{user?.username}</span>
                </div>
              </div>

              <div className="header__dropdown-divider" role="separator" />

              {/* Creator Studio Link */}
              <Link
                to="/dashboard"
                className="header__dropdown-item"
                role="menuitem"
                onClick={() => setDropdownOpen(false)}
              >
                <CreatorStudioIcon />
                Creator Studio
              </Link>

              <div className="header__dropdown-divider" role="separator" />

              {/* Logout */}
              <button
                id="header-logout-btn"
                className="header__dropdown-item header__dropdown-item--danger"
                role="menuitem"
                onClick={handleLogout}
              >
                <LogoutIcon />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/* ── Inline SVG icons ──────────────────────────────────────────── */

function HamburgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function CreatorStudioIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
      <line x1="12" y1="22.08" x2="12" y2="12"></line>
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export default Header;
