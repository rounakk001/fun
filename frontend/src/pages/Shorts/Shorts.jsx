import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { getShortsFeed } from '../../api/recommendation.api';
import { toggleVideoLike } from '../../api/like.api';
import { toggleSubscription } from '../../api/channel.api';
import { useAuth } from '../../context/AuthContext';
import CommentSection from '../../components/CommentSection/CommentSection';
import './Shorts.css';

function formatCount(n) {
  if (!n && n !== 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function Shorts() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user: currentUser } = useAuth();

  const isPremium = new URLSearchParams(location.search).get('premium') === 'true';

  const [shorts, setShorts] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [activeCommentShortId, setActiveCommentShortId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [savedSet, setSavedSet] = useState(new Set());

  const containerRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  const fetchedIdsRef = useRef(new Set());

  const showToast = (msg) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 2500);
  };

  // Strict Vault Check: if accessing VIP Shorts, must be unlocked by current user
  useEffect(() => {
    if (isPremium) {
      const isUnlocked = currentUser?._id
        ? sessionStorage.getItem(`yeonix_premium_unlocked_${currentUser._id}`) === 'true'
        : false;
      if (!isUnlocked) {
        navigate('/premium', { replace: true });
      }
    }
  }, [isPremium, currentUser?._id, navigate]);

  // ── Fetch Initial Shorts Feed ──────────────────────────────────────
  const loadInitialShorts = useCallback(async () => {
    setIsLoading(true);
    fetchedIdsRef.current.clear();
    try {
      const res = await getShortsFeed({ isPremium, limit: 10 });
      const docs = res.data?.data?.shorts || [];
      docs.forEach((s) => fetchedIdsRef.current.add(s._id));
      setShorts(docs);
      setActiveIndex(0);
    } catch (err) {
      console.error('[Shorts] Failed to load initial shorts feed', err);
    } finally {
      setIsLoading(false);
    }
  }, [isPremium]);

  useEffect(() => {
    loadInitialShorts();
  }, [loadInitialShorts]);

  // ── Fetch Next Latest Shorts While Scrolling ───────────────────────
  const loadMoreLatestShorts = useCallback(async () => {
    if (isFetchingMore) return;
    setIsFetchingMore(true);

    try {
      const excludeIds = Array.from(fetchedIdsRef.current).join(',');
      const res = await getShortsFeed({
        isPremium,
        excludeIds,
        limit: 8
      });
      const newDocs = res.data?.data?.shorts || [];
      const filtered = newDocs.filter((s) => !fetchedIdsRef.current.has(s._id));

      if (filtered.length > 0) {
        filtered.forEach((s) => fetchedIdsRef.current.add(s._id));
        setShorts((prev) => [...prev, ...filtered]);
      }
    } catch (err) {
      console.error('[Shorts] Failed to fetch more latest shorts', err);
    } finally {
      setIsFetchingMore(false);
    }
  }, [isPremium, isFetchingMore]);

  // ── Scroll & Active Item Observer ──────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const itemHeight = container.clientHeight;
      if (itemHeight === 0) return;
      const scrollPos = container.scrollTop;
      const newIndex = Math.round(scrollPos / itemHeight);

      if (newIndex !== activeIndex && newIndex >= 0 && newIndex < shorts.length) {
        setActiveIndex(newIndex);
        if (newIndex >= shorts.length - 2) {
          loadMoreLatestShorts();
        }
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [activeIndex, shorts.length, loadMoreLatestShorts]);

  // ── Keyboard Navigation (ArrowUp / ArrowDown / m) ──────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (activeCommentShortId) return;

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        scrollToIndex(activeIndex + 1);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        scrollToIndex(activeIndex - 1);
      } else if (e.key === 'm') {
        setIsMuted((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, shorts.length, activeCommentShortId]);

  const scrollToIndex = (index) => {
    if (index < 0 || index >= shorts.length || !containerRef.current) return;
    const itemHeight = containerRef.current.clientHeight;
    containerRef.current.scrollTo({
      top: index * itemHeight,
      behavior: 'smooth'
    });
  };

  // ── Interaction Handlers ───────────────────────────────────────────
  const handleLike = async (videoId) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    try {
      const res = await toggleVideoLike(videoId);
      const { isLiked } = res.data.data;

      setShorts((prev) =>
        prev.map((s) => {
          if (s._id !== videoId) return s;
          const delta = isLiked ? (s.isLiked ? 0 : 1) : s.isLiked ? -1 : 0;
          return {
            ...s,
            isLiked,
            likesCount: Math.max(0, (s.likesCount || 0) + delta)
          };
        })
      );
    } catch (err) {
      console.error('Like toggle failed', err);
    }
  };

  const handleSubscribe = async (channelId) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    try {
      const res = await toggleSubscription(channelId);
      const isSubscribed = res.data.data.isSubscribed;

      setShorts((prev) =>
        prev.map((s) => {
          if (s.owner?._id === channelId) {
            return { ...s, isSubscribed };
          }
          return s;
        })
      );
      showToast(isSubscribed ? 'Following creator' : 'Unfollowed');
    } catch (err) {
      console.error('Subscribe toggle failed', err);
    }
  };

  const handleBookmark = (videoId) => {
    setSavedSet((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) {
        next.delete(videoId);
        showToast('Removed from saved');
      } else {
        next.add(videoId);
        showToast('Saved to collection');
      }
      return next;
    });
  };

  const handleShare = (short) => {
    const url = `${window.location.origin}/shorts?id=${short._id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      showToast('Link copied to clipboard');
    } else {
      showToast(`Share URL: ${url}`);
    }
  };

  return (
    <div className="ig-reels-root">
      {/* ── Left Slim Navigation Rail (Instagram Web Style) ── */}
      <aside className="ig-nav-rail" aria-label="Main navigation">
        <div className="ig-nav-top">
          <Link to="/home" className="ig-nav-logo" title="Yeonix">
            <span className="ig-logo-letter">Y</span>
          </Link>

          <nav className="ig-nav-items">
            <Link to="/home" className="ig-nav-btn" title="Home">
              <HomeIcon />
            </Link>

            <Link to="/search" className="ig-nav-btn" title="Search">
              <SearchIcon />
            </Link>

            <Link
              to="/shorts"
              className={`ig-nav-btn ${!isPremium ? 'ig-nav-btn--active' : ''}`}
              title="Reels"
            >
              <ReelsIcon />
            </Link>

            <Link
              to="/shorts?premium=true"
              className={`ig-nav-btn ig-nav-btn--vip ${isPremium ? 'ig-nav-btn--vip-active' : ''}`}
              title="VIP Vault Reels"
            >
              <CrownIcon />
            </Link>

            <Link
              to={isPremium ? '/upload?premium=true&short=true' : '/upload?short=true'}
              className="ig-nav-btn"
              title="Create Short"
            >
              <CreateIcon />
            </Link>

            <Link
              to={currentUser?.username ? `/channel/${currentUser.username}` : '/login'}
              className="ig-nav-btn ig-nav-avatar-btn"
              title="Profile"
            >
              {currentUser?.avatar ? (
                <img src={currentUser.avatar} alt="Profile" className="ig-nav-avatar" />
              ) : (
                <span className="ig-nav-avatar-placeholder">
                  {currentUser?.fullName?.[0]?.toUpperCase() || '?'}
                </span>
              )}
            </Link>
          </nav>
        </div>

        <div className="ig-nav-bottom">
          <Link to="/home" className="ig-nav-btn" title="More">
            <MenuIcon />
          </Link>
        </div>
      </aside>

      {/* ── Main Reel Stream (Centered Instagram Layout) ── */}
      <main className="ig-reels-main">
        {toastMessage && (
          <div className="ig-toast" role="status">
            {toastMessage}
          </div>
        )}

        {isLoading ? (
          <div className="ig-loading-screen">
            <div className="ig-reel-skeleton" />
          </div>
        ) : shorts.length === 0 ? (
          <div className="ig-empty-screen">
            <span className="ig-empty-icon">{isPremium ? '👑' : '🎬'}</span>
            <h2>{isPremium ? 'No VIP Reels Yet' : 'No Reels Yet'}</h2>
            <p>
              {isPremium
                ? 'Exclusive releases published to the VIP Vault will appear here.'
                : 'Share your first vertical short clip with the community!'}
            </p>
            <Link
              to={isPremium ? '/upload?premium=true&short=true' : '/upload?short=true'}
              className="ig-empty-btn"
            >
              Upload Reel
            </Link>
          </div>
        ) : (
          <div className="ig-stage-container">
            {/* Scroll-Snap Vertical Reels Container */}
            <div className="ig-reels-viewport" ref={containerRef}>
              {shorts.map((short, idx) => (
                <InstagramReelCard
                  key={short._id}
                  short={short}
                  isActive={idx === activeIndex}
                  isMuted={isMuted}
                  isSaved={savedSet.has(short._id)}
                  onToggleMute={() => setIsMuted((p) => !p)}
                  onLike={() => handleLike(short._id)}
                  onSubscribe={() => handleSubscribe(short.owner?._id)}
                  onBookmark={() => handleBookmark(short._id)}
                  onShare={() => handleShare(short)}
                  onOpenComments={() => setActiveCommentShortId(short._id)}
                  currentUser={currentUser}
                />
              ))}
            </div>

            {/* Far Right Instagram Up/Down Chevrons */}
            <div className="ig-floating-chevrons">
              <button
                className="ig-chevron-btn"
                onClick={() => scrollToIndex(activeIndex - 1)}
                disabled={activeIndex === 0}
                aria-label="Previous reel"
                title="Previous"
              >
                <ChevronUpIcon />
              </button>
              <button
                className="ig-chevron-btn"
                onClick={() => scrollToIndex(activeIndex + 1)}
                disabled={activeIndex >= shorts.length - 1}
                aria-label="Next reel"
                title="Next"
              >
                <ChevronDownIcon />
              </button>
            </div>
          </div>
        )}

        {/* ── Sliding Comments Drawer ── */}
        {activeCommentShortId && (
          <div className="ig-comments-overlay" onClick={() => setActiveCommentShortId(null)}>
            <div className="ig-comments-panel" onClick={(e) => e.stopPropagation()}>
              <div className="ig-comments-header">
                <h3>Comments</h3>
                <button
                  className="ig-close-btn"
                  onClick={() => setActiveCommentShortId(null)}
                  aria-label="Close comments"
                >
                  ✕
                </button>
              </div>
              <div className="ig-comments-body">
                <CommentSection
                  videoId={activeCommentShortId}
                  videoOwnerId={
                    shorts.find((s) => s._id === activeCommentShortId)?.owner?._id
                  }
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * InstagramReelCard — Exact Instagram Reels Card
 */
function InstagramReelCard({
  short,
  isActive,
  isMuted,
  isSaved,
  onToggleMute,
  onLike,
  onSubscribe,
  onBookmark,
  onShare,
  onOpenComments,
  currentUser
}) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      video.currentTime = 0;
      video
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [isActive]);

  const handleVideoClick = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const owner = short.owner || {};
  const ownerName = owner.username || owner.fullName || 'creator';
  const isOwner = currentUser?._id && owner._id && currentUser._id === owner._id;

  return (
    <div className={`ig-reel-row ${isActive ? 'ig-reel-row--active' : ''}`}>
      {/* 9:16 Video Player Container */}
      <div className="ig-video-frame">
        <video
          ref={videoRef}
          src={short.videoFile}
          className="ig-video-player"
          loop
          playsInline
          muted={isMuted}
          onClick={handleVideoClick}
          poster={short.thumbnail}
        />

        {/* Center Pause/Play Indicator */}
        {!isPlaying && (
          <div className="ig-play-flash" onClick={handleVideoClick}>
            <span>▶</span>
          </div>
        )}

        {/* Bottom Left Overlay on Video */}
        <div className="ig-video-overlay">
          <div className="ig-creator-line">
            <Link to={`/channel/${owner.username}`} className="ig-avatar-link">
              {owner.avatar ? (
                <img src={owner.avatar} alt={ownerName} className="ig-creator-avatar" />
              ) : (
                <span className="ig-creator-avatar-fb">{ownerName[0]?.toUpperCase() || '?'}</span>
              )}
            </Link>

            <Link to={`/channel/${owner.username}`} className="ig-creator-username">
              {owner.username || 'user'}
            </Link>

            {!isOwner && (
              <>
                <span className="ig-dot-separator">•</span>
                <button
                  className={`ig-follow-btn ${short.isSubscribed ? 'ig-follow-btn--active' : ''}`}
                  onClick={onSubscribe}
                >
                  {short.isSubscribed ? 'Following' : 'Follow'}
                </button>
              </>
            )}

            {short.isPremium && (
              <span className="ig-vip-badge">👑 VIP</span>
            )}
          </div>

          <p className="ig-caption-text">{short.title}</p>
          {short.description && (
            <p className="ig-caption-sub">{short.description}</p>
          )}

          <div className="ig-audio-row">
            <span className="ig-music-icon">♫</span>
            <span className="ig-audio-name">Original audio - {ownerName}</span>
          </div>
        </div>

        {/* Bottom Right Mute Button */}
        <button
          className="ig-sound-btn"
          onClick={onToggleMute}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <MutedIcon /> : <UnmutedIcon />}
        </button>
      </div>

      {/* Right Side Bare Action Stack (No Background Circles - Just Like Instagram) */}
      <div className="ig-actions-column">
        {/* Like */}
        <button
          className={`ig-action-item ${short.isLiked ? 'ig-action-item--liked' : ''}`}
          onClick={onLike}
          aria-label="Like"
        >
          <span className="ig-action-svg">
            <HeartIcon filled={short.isLiked} />
          </span>
          <span className="ig-action-text">{formatCount(short.likesCount || 0)}</span>
        </button>

        {/* Comments */}
        <button
          className="ig-action-item"
          onClick={onOpenComments}
          aria-label="Comment"
        >
          <span className="ig-action-svg">
            <CommentBubbleIcon />
          </span>
          <span className="ig-action-text">{formatCount(short.commentsCount || 0)}</span>
        </button>

        {/* Share */}
        <button
          className="ig-action-item"
          onClick={onShare}
          aria-label="Share"
        >
          <span className="ig-action-svg">
            <PaperPlaneIcon />
          </span>
          <span className="ig-action-text">Share</span>
        </button>

        {/* Bookmark / Save */}
        <button
          className={`ig-action-item ${isSaved ? 'ig-action-item--saved' : ''}`}
          onClick={onBookmark}
          aria-label="Save"
        >
          <span className="ig-action-svg">
            <BookmarkIcon filled={isSaved} />
          </span>
        </button>

        {/* More Options */}
        <button
          className="ig-action-item"
          onClick={onShare}
          aria-label="More options"
        >
          <span className="ig-action-svg">
            <ThreeDotsIcon />
          </span>
        </button>

        {/* Bottom Audio Thumbnail Square */}
        <div className="ig-audio-thumb" title="Audio">
          {owner.avatar ? (
            <img src={owner.avatar} alt="" className="ig-audio-img" />
          ) : (
            <span className="ig-audio-img-fb">♫</span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Precise Instagram SVGs ─────────────────────────────────────────── */

function HomeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function ReelsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="4" />
      <line x1="7" y1="2" x2="7" y2="22" />
      <line x1="17" y1="2" x2="17" y2="22" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="2" y1="7" x2="7" y2="7" />
      <line x1="2" y1="17" x2="7" y2="17" />
      <line x1="17" y1="17" x2="22" y2="17" />
      <line x1="17" y1="7" x2="22" y2="7" />
    </svg>
  );
}

function CrownIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f5c518" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14v2H5v-2z" />
    </svg>
  );
}

function CreateIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function HeartIcon({ filled }) {
  if (filled) {
    return (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="#ff3040" stroke="#ff3040" strokeWidth="1">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    );
  }
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function CommentBubbleIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.656 17.008a9.993 9.993 0 1 0-3.59 3.615L22 22z" />
    </svg>
  );
}

function PaperPlaneIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function BookmarkIcon({ filled }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={filled ? '#fff' : 'none'} stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ThreeDotsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff">
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="6" cy="12" r="1.75" />
      <circle cx="18" cy="12" r="1.75" />
    </svg>
  );
}

function MutedIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function UnmutedIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export default Shorts;
