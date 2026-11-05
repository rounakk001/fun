import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import Header from '../../components/Header/Header';
import Sidebar from '../../components/Sidebar/Sidebar';
import { getShortsFeed } from '../../api/recommendation.api';
import { toggleVideoLike, toggleVideoDislike } from '../../api/like.api';
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

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [shorts, setShorts] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [activeCommentShortId, setActiveCommentShortId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const containerRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  const fetchedIdsRef = useRef(new Set());

  const showToast = (msg) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 2500);
  };

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

  // ── Fetch Next Relatable Shorts via ML Service ─────────────────────
  const loadMoreRelatableShorts = useCallback(async (currentShortId) => {
    if (isFetchingMore) return;
    setIsFetchingMore(true);

    try {
      const res = await getShortsFeed({
        isPremium,
        currentShortId,
        limit: 8
      });
      const newDocs = res.data?.data?.shorts || [];
      const filtered = newDocs.filter((s) => !fetchedIdsRef.current.has(s._id));

      if (filtered.length > 0) {
        filtered.forEach((s) => fetchedIdsRef.current.add(s._id));
        setShorts((prev) => [...prev, ...filtered]);
      }
    } catch (err) {
      console.error('[Shorts] Failed to fetch relatable shorts', err);
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
        // Pre-fetch more relatable shorts using ML when nearing the end
        if (newIndex >= shorts.length - 2 && shorts[newIndex]?._id) {
          loadMoreRelatableShorts(shorts[newIndex]._id);
        }
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [activeIndex, shorts, loadMoreRelatableShorts]);

  // ── Keyboard Navigation (ArrowUp / ArrowDown) ──────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (activeCommentShortId) return; // Typing in comments

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
      const { isLiked, isDisliked } = res.data.data;

      setShorts((prev) =>
        prev.map((s) => {
          if (s._id !== videoId) return s;
          const delta = isLiked ? (s.isLiked ? 0 : 1) : s.isLiked ? -1 : 0;
          return {
            ...s,
            isLiked,
            isDisliked,
            likesCount: Math.max(0, (s.likesCount || 0) + delta)
          };
        })
      );
    } catch (err) {
      console.error('Like toggle failed', err);
    }
  };

  const handleDislike = async (videoId) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    try {
      const res = await toggleVideoDislike(videoId);
      const { isLiked, isDisliked } = res.data.data;

      setShorts((prev) =>
        prev.map((s) => {
          if (s._id !== videoId) return s;
          const delta = s.isLiked && !isLiked ? -1 : 0;
          return {
            ...s,
            isLiked,
            isDisliked,
            likesCount: Math.max(0, (s.likesCount || 0) + delta)
          };
        })
      );
    } catch (err) {
      console.error('Dislike toggle failed', err);
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
      showToast(isSubscribed ? 'Subscribed to creator!' : 'Unsubscribed');
    } catch (err) {
      console.error('Subscribe toggle failed', err);
    }
  };

  const handleShare = (short) => {
    const url = `${window.location.origin}/watch/${short._id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      showToast('Reel link copied to clipboard! 📋');
    } else {
      showToast(`Share URL: ${url}`);
    }
  };

  return (
    <div className={`shorts-page-root ${isPremium ? 'shorts-page-root--vip' : ''}`}>
      <Header onMenuToggle={() => setSidebarOpen((prev) => !prev)} />

      <div className="shorts-page-layout">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="shorts-page-main">
          {/* ── Top Bar with Modes & Upload Short Button ───────── */}
          <div className="shorts-top-bar">
            <div className="shorts-top-bar__left">
              <span className="shorts-badge-icon">{isPremium ? '👑' : '▶'}</span>
              <h1 className="shorts-top-title">
                {isPremium ? 'Yeonix VIP Shorts Lounge' : 'Yeonix Shorts'}
              </h1>
            </div>

            <div className="shorts-top-bar__actions">
              {/* Switch between Free and VIP Shorts */}
              <button
                className={`shorts-mode-pill ${!isPremium ? 'shorts-mode-pill--active' : ''}`}
                onClick={() => navigate('/shorts')}
              >
                <span>▶</span> Free Shorts
              </button>

              <button
                className={`shorts-mode-pill shorts-mode-pill--vip ${isPremium ? 'shorts-mode-pill--vip-active' : ''}`}
                onClick={() => navigate('/shorts?premium=true')}
              >
                <span>👑</span> VIP Vault Shorts
              </button>

              {/* Upload Short dedicated CTA */}
              <Link
                to={isPremium ? '/upload?premium=true&short=true' : '/upload?short=true'}
                className="btn-shorts-upload"
              >
                <span>+</span> Upload Short
              </Link>
            </div>
          </div>

          {/* ── Toast Notification ─────────────────────────────── */}
          {toastMessage && (
            <div className="shorts-toast" role="status">
              <span>✦</span> {toastMessage}
            </div>
          )}

          {/* ── Reels Container ─────────────────────────────────── */}
          {isLoading ? (
            <div className="shorts-loading-screen">
              <div className="shorts-reel-skeleton" />
            </div>
          ) : shorts.length === 0 ? (
            <div className="shorts-empty-screen">
              <span className="shorts-empty-icon">{isPremium ? '👑▶' : '🎬'}</span>
              <h2>{isPremium ? 'No VIP Shorts in Vault' : 'No Shorts Available Yet'}</h2>
              <p>
                {isPremium
                  ? 'Exclusive VIP shorts published by creators will appear right here.'
                  : 'Be the first creator to share quick, vertical short clips!'}
              </p>
              <Link
                to={isPremium ? '/upload?premium=true&short=true' : '/upload?short=true'}
                className="btn-shorts-upload btn-shorts-upload--lg"
              >
                <span>+</span> Upload First Short
              </Link>
            </div>
          ) : (
            <div className="shorts-player-container">
              {/* Floating Vertical Next/Prev Chevrons (Instagram / YouTube Style) */}
              <div className="shorts-floating-nav">
                <button
                  className="shorts-nav-arrow"
                  onClick={() => scrollToIndex(activeIndex - 1)}
                  disabled={activeIndex === 0}
                  aria-label="Previous short"
                  title="Previous short (Arrow Up)"
                >
                  <ChevronUpIcon />
                </button>
                <button
                  className="shorts-nav-arrow"
                  onClick={() => scrollToIndex(activeIndex + 1)}
                  disabled={activeIndex >= shorts.length - 1}
                  aria-label="Next short"
                  title="Next short (Arrow Down)"
                >
                  <ChevronDownIcon />
                </button>
              </div>

              {/* Scroll-Snap Vertical Feed */}
              <div className="shorts-feed-viewport" ref={containerRef}>
                {shorts.map((short, idx) => (
                  <ReelCard
                    key={short._id}
                    short={short}
                    isActive={idx === activeIndex}
                    isMuted={isMuted}
                    onToggleMute={() => setIsMuted((p) => !p)}
                    onLike={() => handleLike(short._id)}
                    onDislike={() => handleDislike(short._id)}
                    onSubscribe={() => handleSubscribe(short.owner?._id)}
                    onShare={() => handleShare(short)}
                    onOpenComments={() => setActiveCommentShortId(short._id)}
                    currentUser={currentUser}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Slide-up Comments Drawer ───────────────────────── */}
          {activeCommentShortId && (
            <div className="shorts-comments-overlay" onClick={() => setActiveCommentShortId(null)}>
              <div
                className="shorts-comments-drawer"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="shorts-comments-header">
                  <h3>Comments</h3>
                  <button
                    className="btn-close-comments"
                    onClick={() => setActiveCommentShortId(null)}
                    aria-label="Close comments"
                  >
                    ✕
                  </button>
                </div>
                <div className="shorts-comments-body">
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
    </div>
  );
}

/**
 * ReelCard — A single 9:16 vertical short reel with overlay and floating actions
 */
function ReelCard({
  short,
  isActive,
  isMuted,
  onToggleMute,
  onLike,
  onDislike,
  onSubscribe,
  onShare,
  onOpenComments,
  currentUser
}) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);

  // Auto-play/pause when this reel becomes active/inactive
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

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    setProgress((video.currentTime / video.duration) * 100);
  };

  const owner = short.owner || {};
  const ownerName = owner.fullName || owner.username || 'Creator';
  const isOwner = currentUser?._id && owner._id && currentUser._id === owner._id;

  return (
    <div className={`shorts-reel-item ${isActive ? 'shorts-reel-item--active' : ''}`}>
      <div className="shorts-video-wrapper">
        <video
          ref={videoRef}
          src={short.videoFile}
          className="shorts-video-element"
          loop
          playsInline
          muted={isMuted}
          onClick={handleVideoClick}
          onTimeUpdate={handleTimeUpdate}
          poster={short.thumbnail}
        />

        {/* Play/Pause Center Indicator */}
        {!isPlaying && (
          <div className="shorts-play-indicator" onClick={handleVideoClick}>
            <span>▶</span>
          </div>
        )}

        {/* Video Progress Bar at bottom */}
        <div className="shorts-video-progress-bar">
          <div className="shorts-video-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        {/* Bottom Left: Creator & Caption Overlay */}
        <div className="shorts-info-overlay">
          <div className="shorts-creator-row">
            <Link to={`/channel/${owner.username}`} className="shorts-creator-avatar-link">
              {owner.avatar ? (
                <img src={owner.avatar} alt={ownerName} className="shorts-creator-avatar" />
              ) : (
                <span className="shorts-creator-avatar-fallback">
                  {ownerName[0]?.toUpperCase() || '?'}
                </span>
              )}
            </Link>

            <Link to={`/channel/${owner.username}`} className="shorts-creator-handle">
              @{owner.username || 'creator'}
            </Link>

            {!isOwner && (
              <button
                className={`shorts-btn-follow ${short.isSubscribed ? 'shorts-btn-follow--active' : ''}`}
                onClick={onSubscribe}
              >
                {short.isSubscribed ? 'Subscribed' : 'Follow'}
              </button>
            )}
          </div>

          <p className="shorts-caption-title">{short.title}</p>
          {short.description && (
            <p className="shorts-caption-desc">{short.description}</p>
          )}

          {short.isPremium && (
            <div className="shorts-vip-tag">
              <span>👑 VIP Vault Exclusive</span>
            </div>
          )}
        </div>

        {/* Bottom Right Sound Toggle */}
        <button
          className="shorts-sound-btn"
          onClick={onToggleMute}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
          title={isMuted ? 'Unmute sound (m)' : 'Mute sound (m)'}
        >
          {isMuted ? <MutedIcon /> : <UnmutedIcon />}
        </button>
      </div>

      {/* Floating Right Actions Stack (Like, Dislike, Comment, Share, More) */}
      <div className="shorts-actions-stack">
        {/* Like */}
        <button
          className={`shorts-action-btn ${short.isLiked ? 'shorts-action-btn--liked' : ''}`}
          onClick={onLike}
          aria-label="Like this short"
        >
          <span className="shorts-action-icon">
            <HeartIcon filled={short.isLiked} />
          </span>
          <span className="shorts-action-count">{formatCount(short.likesCount || 0)}</span>
        </button>

        {/* Dislike */}
        <button
          className={`shorts-action-btn ${short.isDisliked ? 'shorts-action-btn--disliked' : ''}`}
          onClick={onDislike}
          aria-label="Dislike this short"
        >
          <span className="shorts-action-icon">
            <DislikeIcon filled={short.isDisliked} />
          </span>
          <span className="shorts-action-count">Dislike</span>
        </button>

        {/* Comments */}
        <button
          className="shorts-action-btn"
          onClick={onOpenComments}
          aria-label="View comments"
        >
          <span className="shorts-action-icon">
            <CommentIcon />
          </span>
          <span className="shorts-action-count">{formatCount(short.commentsCount || 0)}</span>
        </button>

        {/* Share */}
        <button
          className="shorts-action-btn"
          onClick={onShare}
          aria-label="Share short"
        >
          <span className="shorts-action-icon">
            <ShareIcon />
          </span>
          <span className="shorts-action-count">Share</span>
        </button>

        {/* Creator Channel shortcut */}
        <Link
          to={`/channel/${owner.username}`}
          className="shorts-action-btn shorts-action-btn--channel"
          aria-label="Visit creator channel"
        >
          <span className="shorts-action-icon">
            <ChannelIcon />
          </span>
          <span className="shorts-action-count">Channel</span>
        </Link>
      </div>
    </div>
  );
}

/* ── Inline SVG Icons matching Instagram / YouTube Shorts ───────────── */

function HeartIcon({ filled }) {
  if (filled) {
    return (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="#ff4444" stroke="#ff4444" strokeWidth="1.5">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    );
  }
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function DislikeIcon({ filled }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill={filled ? '#888' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function ChannelIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function MutedIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export default Shorts;
