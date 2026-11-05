import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Header from '../../components/Header/Header';
import Sidebar from '../../components/Sidebar/Sidebar';
import VideoCard from '../../components/VideoCard/VideoCard';
import VideoCardSkeleton from '../../components/VideoCard/VideoCardSkeleton';
import SubscribeButton from '../../components/SubscribeButton/SubscribeButton';
import { useAuth } from '../../context/AuthContext';
import { getVideoById, getVideos } from '../../api/video.api';
import { getSimilarVideos } from '../../api/recommendation.api';
import { getChannelProfile } from '../../api/channel.api';
import { toggleVideoLike } from '../../api/like.api';
import CommentSection from '../../components/CommentSection/CommentSection';
import SaveToPlaylistModal from '../../components/SaveToPlaylistModal/SaveToPlaylistModal';
import MoveToPremiumModal from '../../components/MoveToPremiumModal/MoveToPremiumModal';
import './Watch.css';

/* ─── Helpers ───────────────────────────────────────────────────── */

function formatViews(views) {
  if (!views && views !== 0) return '0';
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K`;
  return String(views);
}

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '';
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function formatDate(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function ownerInitials(owner) {
  if (!owner) return '?';
  const name = owner.fullName || owner.username || '';
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?';
}

/* ─── Toast hook ────────────────────────────────────────────────── */

function useToast() {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const showToast = (message) => {
    clearTimeout(timerRef.current);
    setToast(message);
    timerRef.current = setTimeout(() => setToast(null), 2200);
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return { toast, showToast };
}

/* ─── Watch page ────────────────────────────────────────────────── */

function Watch() {
  const { videoId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, isAuthenticated } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);

  // ── Video data ────────────────────────────────────────────────
  const [video, setVideo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [is404, setIs404] = useState(false);
  const [error, setError] = useState(null);

  // ── Subscription state for the channel shown on this video ────
  // Fetched from GET /users/c/:username after the video loads.
  // null = still loading / not yet fetched; boolean = real value.
  const [isSubscribed, setIsSubscribed] = useState(null);

  // ── Video like state (real, from video fetch response) ────────
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  
  // ── Playlist State ───────────────────────────────────────────
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showMoveToPremiumModal, setShowMoveToPremiumModal] = useState(false);
  const [isLikeLoading, setIsLikeLoading] = useState(false);

  // ── Related videos ────────────────────────────────────────────
  const [related, setRelated] = useState([]);
  const [relatedLoading, setRelatedLoading] = useState(true);

  // ── Description expand/collapse ───────────────────────────────
  const [descExpanded, setDescExpanded] = useState(false);

  // ── Toast for action buttons ──────────────────────────────────
  const { toast, showToast } = useToast();

  // ── Ref to the <video> element (for muted-fallback autoplay) ──
  const videoRef = useRef(null);

  // ── StrictMode guard for the video-detail fetch ───────────────
  // StrictMode intentionally double-invokes effects in dev to surface
  // cleanup bugs. Because GET /videos/:videoId increments views on the
  // backend, a double-fire causes views += 2 instead of += 1.
  //
  // fetchedForRef stores the videoId of the last-initiated request:
  //   - Run 2 (StrictMode re-invoke): ref already === videoId → early return ✓
  //   - Navigate to new video: ref !== new videoId → guard passes, fresh fetch ✓
  //
  // cancelRef replaces the per-closure `cancelled` local variable.
  // This is critical: when StrictMode runs cleanup (setting cancelRef=true)
  // then immediately re-runs the effect, the guard's early-return path
  // resets cancelRef back to false — un-cancelling the first fetch so
  // its .then()/.finally() state updates are not discarded.
  const fetchedForRef = useRef(null);
  const cancelRef = useRef(false);

  // ── Refs kept in sync for use inside event handlers ─────────────
  // useCallback closures capture the *value* of state at the time
  // they are memoised. Storing the latest related list + current
  // videoId in refs means the 'ended' handler always sees fresh data
  // without needing to be re-created on every render.
  const relatedRef = useRef([]);
  const videoIdRef = useRef(videoId);

  // Keep refs in sync whenever their source values change
  useEffect(() => { relatedRef.current = related; }, [related]);
  useEffect(() => { videoIdRef.current = videoId; }, [videoId]);

  // ── Played-history set (persists across autoplay advances) ──────
  // Tracks IDs that have already played this session so autoplay
  // never revisits a video. Reset when the user manually navigates
  // (i.e. videoId changes without being triggered by handleVideoEnded).
  const playedSetRef = useRef(new Set());
  // Flag: was the last navigation triggered by autoplay-next?
  const autoplayedRef = useRef(false);

  // Autoplay toggle state (persisted in localStorage, default true)
  const [autoplayEnabled, setAutoplayEnabled] = useState(() => {
    return localStorage.getItem('yeonix_autoplay') !== 'false';
  });
  const [autoplayCountdown, setAutoplayCountdown] = useState(null);
  const countdownTimerRef = useRef(null);

  const handleToggleAutoplay = () => {
    setAutoplayEnabled((prev) => {
      const nextVal = !prev;
      localStorage.setItem('yeonix_autoplay', String(nextVal));
      return nextVal;
    });
  };

  // When videoId changes, mark it as played. If the change came from
  // a manual click (not autoplay), clear the played history so the
  // user starts a fresh sequence from the new video.
  useEffect(() => {
    if (!autoplayedRef.current) {
      // Manual navigation — reset history, start fresh from here
      playedSetRef.current = new Set();
    }
    playedSetRef.current.add(videoId);
    autoplayedRef.current = false; // reset the flag
    setAutoplayCountdown(null);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
  }, [videoId]);

  // ── Autoplay Countdown Timer Effect ─────────────────────────────
  useEffect(() => {
    if (!autoplayCountdown) {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      return;
    }

    countdownTimerRef.current = setInterval(() => {
      setAutoplayCountdown((prev) => {
        if (!prev) return null;
        if (prev.seconds <= 1) {
          clearInterval(countdownTimerRef.current);
          autoplayedRef.current = true;
          navigate(`/watch/${prev.nextVideo._id}`);
          return null;
        }
        return { ...prev, seconds: prev.seconds - 1 };
      });
    }, 1000);

    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [autoplayCountdown, navigate]);

  const handlePlayNow = () => {
    if (autoplayCountdown?.nextVideo) {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      const nextId = autoplayCountdown.nextVideo._id;
      setAutoplayCountdown(null);
      autoplayedRef.current = true;
      navigate(`/watch/${nextId}`);
    }
  };

  const handleCancelAutoplay = () => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setAutoplayCountdown(null);
  };

  // ── Autoplay with muted fallback ──────────────────────────────
  // Called once the video element's src is ready (onCanPlay).
  // We attempt sound-on play first; if the browser rejects it
  // (NotAllowedError — autoplay policy), we silently retry muted.
  const handleCanPlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    const playPromise = el.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        // Only retry muted for autoplay-policy errors, not other errors
        if (err.name === 'NotAllowedError') {
          el.muted = true;
          el.play().catch(() => {/* give up silently */});
        }
      });
    }
  }, []);

  // ── ML Service-Based Autoplay Next Video ──────────────────────
  // Reads from refs (not state) so it always has the current values.
  // Advances to the top ML-recommended unplayed video.
  const handleVideoEnded = useCallback(() => {
    if (!autoplayEnabled) return;

    const currentId = videoIdRef.current;
    const list = relatedRef.current;
    const played = playedSetRef.current;

    // Find first unplayed ML-recommended video that isn't the one currently showing
    const next = list.find((v) => v._id !== currentId && !played.has(v._id));

    const triggerNext = (nextVid) => {
      if (!nextVid) return;
      setAutoplayCountdown({ seconds: 4, nextVideo: nextVid });
    };

    if (next) {
      triggerNext(next);
    } else {
      // Actively query ML service if current list is exhausted or not yet populated
      const isPremium = video?.isPremium === true;
      getSimilarVideos(currentId, { limit: 6, ...(isPremium ? { isPremium: 'true' } : {}) })
        .then((res) => {
          const recs = res.data?.data?.recommendations || [];
          const candidate = recs.find((v) => v._id !== currentId && !played.has(v._id)) || recs[0];
          if (candidate) {
            triggerNext(candidate);
          }
        })
        .catch((err) => {
          console.warn('[Watch] Failed to fetch ML fallback for autoplay', err);
        });
    }
  }, [autoplayEnabled, video?.isPremium]);

  // ── Fetch video ───────────────────────────────────────────────
  useEffect(() => {
    if (!videoId) return;

    if (fetchedForRef.current === videoId) {
      // StrictMode's second invocation: the HTTP request is already in-flight
      // from Run 1. Run 1's cleanup set cancelRef = true, which would cause
      // the response to be discarded. Reset it here so the response is kept.
      cancelRef.current = false;
      return;
    }

    fetchedForRef.current = videoId;
    cancelRef.current = false;

    setIsLoading(true);
    setVideo(null);
    setIs404(false);
    setError(null);
    setIsSubscribed(null);   // reset subscription state for the new video
    setIsLiked(false);       // reset like state for the new video
    setLikesCount(0);
    setDescExpanded(false);

    getVideoById(videoId)
      .then((res) => {
        if (cancelRef.current) return;
        const videoData = res.data.data;
        setVideo(videoData);
        // Initialise like state from the video fetch response (no extra API call needed)
        setIsLiked(videoData.isLiked ?? false);
        setLikesCount(videoData.likesCount ?? 0);

        // ── Secondary fetch: real isSubscribed for this channel ──
        // Only meaningful when logged in and not viewing own channel.
        // Runs silently in the background — failure just leaves the
        // button defaulting to false (safe, not a blocking error).
        if (isAuthenticated && videoData.owner?.username &&
            currentUser?.username !== videoData.owner.username) {
          getChannelProfile(videoData.owner.username)
            .then((profileRes) => {
              if (cancelRef.current) return;
              console.log("DEBUG isSubscribed from API:", profileRes.data.data.isSubscribed)
              setIsSubscribed(profileRes.data.data.isSubscribed ?? false);
            })
            .catch(() => {
              // Non-critical: leave isSubscribed as null → button defaults to false
            });
        } else {
          // Logged-out or own channel: subscription status is irrelevant
          setIsSubscribed(false);
        }
      })
      .catch((err) => {
        if (cancelRef.current) return;
        const status = err.response?.status;
        if (status === 404 || status === 400) {
          setIs404(true);
        } else {
          setError('Failed to load video. Please try again.');
        }
      })
      .finally(() => {
        if (!cancelRef.current) setIsLoading(false);
      });

    // Real unmount (navigate away): set cancelRef so the in-flight response
    // is discarded. Do NOT reset fetchedForRef here — the next mount will
    // have a different videoId and the guard will pass naturally.
    return () => { cancelRef.current = true; };
  }, [videoId]);

  // ── Fetch ML-recommended related videos ─────────────────────────
  // Waits for `video` state to be populated so we know if this is a premium video.
  // Premium watch page → only recommend other premium videos (isPremium=true).
  // Normal watch page  → only recommend non-premium videos (default).
  useEffect(() => {
    // Don't fire until we know the video's premium status
    if (video === null) return;

    let cancelled = false;
    setRelatedLoading(true);

    const isPremium = video.isPremium === true;
    const params = { limit: 8 };
    if (isPremium) params.isPremium = 'true';

    getSimilarVideos(videoId, params)
      .then((res) => {
        if (cancelled) return;
        const recs = res.data?.data?.recommendations || [];
        const filtered = recs.filter((v) => v._id !== videoId);
        setRelated(filtered);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('[Watch] ML recommendation fetch failed, using fallback:', err);
        // Fallback: show videos from the same section (premium or normal)
        const fallbackParams = { page: 1, limit: 8, sortBy: 'createdAt', sortType: 'desc' };
        if (isPremium) fallbackParams.isPremium = 'true';
        getVideos(fallbackParams)
          .then((res) => {
            if (cancelled) return;
            const docs = res?.data?.data?.docs || [];
            const fallbackFiltered = docs.filter((v) => v._id !== videoId);
            setRelated(fallbackFiltered);
          })
          .catch(() => {
            if (!cancelled) setRelated([]);
          });
      })
      .finally(() => {
        if (!cancelled) setRelatedLoading(false);
      });

    return () => { cancelled = true; };
  }, [videoId, video]);

  /* ── Video like toggle ──────────────────────────────────────── */
  const handleToggleLike = async () => {
    if (!isAuthenticated) {
      showToast('Sign in to like videos');
      return;
    }
    if (isLikeLoading || !video) return;

    // Optimistic update
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikesCount((prev) => prev + (wasLiked ? -1 : 1));
    setIsLikeLoading(true);

    try {
      await toggleVideoLike(video._id);
    } catch (err) {
      // Revert on error
      setIsLiked(wasLiked);
      setLikesCount((prev) => prev + (wasLiked ? 1 : -1));
    } finally {
      setIsLikeLoading(false);
    }
  };

  /* ── Placeholder action handler (share, save, etc.) ────────── */
  const handlePlaceholderAction = (label) => {
    showToast(`${label} — coming soon!`);
  };

  return (
    <div className="watch-root">
      <Header onMenuToggle={() => setSidebarOpen((prev) => !prev)} />

      {/* Toast notification */}
      {toast && (
        <div className="watch-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}

      <div className={`watch-layout ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="watch-main" id="main-content">
          {/* ── Loading skeleton ──────────────────────────────── */}
          {isLoading && <WatchSkeleton />}

          {/* ── 404 state ─────────────────────────────────────── */}
          {!isLoading && is404 && (
            <div className="watch-404">
              <span className="watch-404__icon" aria-hidden="true">🎞️</span>
              <h1 className="watch-404__title">Video not found</h1>
              <p className="watch-404__text">
                This video may have been removed or the link is invalid.
              </p>
              <Link to="/home" className="btn btn-primary">
                Go to Home
              </Link>
            </div>
          )}

          {/* ── Error state ───────────────────────────────────── */}
          {!isLoading && error && (
            <div className="watch-404">
              <span className="watch-404__icon" aria-hidden="true">⚠️</span>
              <h1 className="watch-404__title">Something went wrong</h1>
              <p className="watch-404__text">{error}</p>
              <Link to="/home" className="btn btn-primary">
                Go to Home
              </Link>
            </div>
          )}

          {/* ── Video content ─────────────────────────────────── */}
          {!isLoading && video && (
            <div className="watch-content">
              {/* ── Player + details column ───────────────────── */}
              <div className="watch-player-col">
                {/* ── Video player ──────────────────────────── */}
                <div className="watch-player-wrapper">
                  <video
                    id="watch-video-player"
                    ref={videoRef}
                    className="watch-player"
                    src={video.videoFile}
                    controls
                    autoPlay
                    preload="auto"
                    poster={video.thumbnail}
                    aria-label={video.title}
                    onCanPlay={handleCanPlay}
                    onEnded={handleVideoEnded}
                  >
                    Your browser does not support HTML5 video.
                  </video>

                  {autoplayCountdown && autoplayCountdown.nextVideo && (
                    <div className="watch-autoplay-overlay">
                      <div className="watch-autoplay-card">
                        <div className="watch-autoplay-card__badge">
                          <span className="watch-autoplay-sparkle">✨</span>
                          <span>ML Recommended Next</span>
                        </div>
                        <div className="watch-autoplay-card__timer">
                          Playing next video in <strong>{autoplayCountdown.seconds}s</strong>
                        </div>
                        <div className="watch-autoplay-card__preview">
                          <img
                            src={autoplayCountdown.nextVideo.thumbnail}
                            alt={autoplayCountdown.nextVideo.title}
                            className="watch-autoplay-card__thumb"
                          />
                          <div className="watch-autoplay-card__details">
                            <p className="watch-autoplay-card__title">{autoplayCountdown.nextVideo.title}</p>
                            <p className="watch-autoplay-card__channel">
                              {autoplayCountdown.nextVideo.owner?.fullName || autoplayCountdown.nextVideo.owner?.username}
                            </p>
                          </div>
                        </div>
                        <div className="watch-autoplay-card__actions">
                          <button
                            type="button"
                            className="btn-autoplay-cancel"
                            onClick={handleCancelAutoplay}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="btn-autoplay-play"
                            onClick={handlePlayNow}
                          >
                            Play Now ▶
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Title (with optional premium badge) ─── */}
                <h1 className="watch-title">
                  {video.isPremium && (
                    <span
                      className="watch-premium-badge"
                      title="VIP Vault exclusive video"
                      aria-label="VIP Vault exclusive"
                    >
                      VAULT
                    </span>
                  )}
                  {video.isShort && (
                    <Link
                      to={video.isPremium ? '/shorts?premium=true' : '/shorts'}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'linear-gradient(135deg, #ff4444 0%, #cc2222 100%)',
                        color: '#fff',
                        padding: '4px 12px',
                        borderRadius: '999px',
                        fontSize: '0.82rem',
                        fontWeight: '700',
                        textDecoration: 'none',
                        marginRight: '10px',
                        verticalAlign: 'middle',
                        boxShadow: '0 2px 8px rgba(255, 68, 68, 0.4)'
                      }}
                      title="Open in Reels / Shorts Player"
                    >
                      ▶ Open in Shorts Player
                    </Link>
                  )}
                  {video.title}
                </h1>

                {/* ── Stats + actions row ──────────────────── */}
                <div className="watch-meta-row">
                  <div className="watch-stats">
                    <span className="watch-views">
                      {formatViews(video.views)} views
                    </span>
                    <span className="watch-dot" aria-hidden="true">·</span>
                    <span className="watch-date">{formatDate(video.createdAt)}</span>
                    {video.duration != null && (
                      <>
                        <span className="watch-dot" aria-hidden="true">·</span>
                        <span className="watch-dur">{formatDuration(video.duration)}</span>
                      </>
                    )}
                  </div>

                  {/* ── Action buttons ── */}
                  <div className="watch-actions" role="group" aria-label="Video actions">
                    <button
                      id="watch-like-btn"
                      className={`watch-action-btn${isLiked ? ' watch-action-btn--active' : ''}`}
                      aria-label={isLiked ? 'Unlike video' : 'Like video'}
                      aria-pressed={isLiked}
                      onClick={handleToggleLike}
                      disabled={isLikeLoading}
                    >
                      <ThumbUpIcon filled={isLiked} />
                      <span>{likesCount > 0 ? likesCount : 'Like'}</span>
                    </button>
                    <button
                      id="watch-dislike-btn"
                      className="watch-action-btn"
                      aria-label="Dislike video"
                      onClick={() => handlePlaceholderAction('Dislike')}
                      title="Dislike (coming soon)"
                    >
                      <ThumbDownIcon />
                      <span>Dislike</span>
                    </button>
                    <button
                      id="watch-share-btn"
                      className="watch-action-btn"
                      aria-label="Share video"
                      onClick={() => handlePlaceholderAction('Share')}
                      title="Share (coming soon)"
                    >
                      <ShareIcon />
                      <span>Share</span>
                    </button>
                    <button
                      id="watch-playlist-btn"
                      className="watch-action-btn"
                      aria-label="Add to playlist"
                      onClick={() => setShowSaveModal(true)}
                    >
                      <PlaylistIcon />
                      <span>Save</span>
                    </button>
                    {currentUser?._id && video?.owner && (currentUser._id === (video.owner._id || video.owner)) && !video.isPremium && (
                      <button
                        id="watch-move-premium-btn"
                        className="watch-action-btn watch-action-btn--vip"
                        aria-label="Move to VIP Vault"
                        onClick={() => setShowMoveToPremiumModal(true)}
                        title="Move this video to the VIP Vault (Owner only)"
                      >
                        <VaultLockIcon />
                        <span>Move to Vault</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="watch-divider" />

                {/* ── Channel info ──────────────────────────── */}
                <div className="watch-channel-row">
                  {/* Avatar — links to channel page */}
                  <Link
                    to={`/channel/${video.owner?.username}`}
                    className="watch-channel-avatar"
                    aria-label={`Visit ${video.owner?.fullName || video.owner?.username}'s channel`}
                  >
                    {video.owner?.avatar ? (
                      <img
                        src={video.owner.avatar}
                        alt={video.owner.fullName || video.owner.username}
                        className="watch-channel-avatar__img"
                      />
                    ) : (
                      <span className="watch-channel-avatar__initials">
                        {ownerInitials(video.owner)}
                      </span>
                    )}
                  </Link>

                  {/* Channel name / username — link to channel page */}
                  <div className="watch-channel-info">
                    <Link
                      to={`/channel/${video.owner?.username}`}
                      className="watch-channel-name watch-channel-name-link"
                    >
                      {video.owner?.fullName || video.owner?.username || 'Unknown'}
                    </Link>
                    <span className="watch-channel-username">
                      @{video.owner?.username || 'unknown'}
                    </span>
                  </div>

                  {/* Subscribe — hidden on own videos */}
                  {video.owner?.username &&
                   !(isAuthenticated && currentUser?.username === video.owner.username) && (
                    <SubscribeButton
                      channelId={video.owner._id}
                      initialValue={isSubscribed ?? false}
                    />
                  )}
                </div>

                <div className="watch-divider" />

                {/* ── Description ──────────────────────────── */}
                {video.description && (
                  <div className="watch-description">
                    <p
                      className={`watch-description__text${descExpanded ? ' watch-description__text--expanded' : ''}`}
                    >
                      {video.description}
                    </p>
                    {video.description.length > 200 && (
                      <button
                        id="watch-desc-toggle"
                        className="watch-description__toggle"
                        onClick={() => setDescExpanded((prev) => !prev)}
                        aria-expanded={descExpanded}
                      >
                        {descExpanded ? 'Show less' : 'Show more'}
                        <ChevronIcon expanded={descExpanded} />
                      </button>
                    )}
                  </div>
                )}

                <div className="watch-divider" />

                {/* ── Real comments ── */}
                <CommentSection videoId={video._id} videoOwnerId={video.owner?._id} />
              </div>

              {/* ── Related videos sidebar ──────────────────────── */}
              <aside className="watch-related" aria-label="Related videos">
                <div className="watch-related__header">
                  <h2 className="watch-related__heading">Up next</h2>
                  <div className="watch-autoplay-toggle">
                    <span className="watch-autoplay-toggle-text">Autoplay</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={autoplayEnabled}
                      className={`watch-autoplay-switch ${autoplayEnabled ? 'watch-autoplay-switch--on' : ''}`}
                      onClick={handleToggleAutoplay}
                      title={autoplayEnabled ? 'ML Autoplay enabled' : 'Autoplay disabled'}
                    >
                      <span className="watch-autoplay-switch-dot" />
                    </button>
                  </div>
                </div>
                <div className="watch-related__list">
                  {relatedLoading
                    ? Array.from({ length: 4 }).map((_, i) => (
                        <VideoCardSkeleton key={i} />
                      ))
                    : related.length === 0
                    ? (
                      <p className="watch-related__empty">No related videos.</p>
                    )
                    : related.map((v) => <VideoCard key={v._id} video={v} />)}
                </div>
              </aside>
            </div>
          )}
        </main>
      </div>

      {showSaveModal && (
        <SaveToPlaylistModal
          isOpen={showSaveModal}
          onClose={() => setShowSaveModal(false)}
          videoId={videoId}
          userId={currentUser?._id}
        />
      )}

      {showMoveToPremiumModal && video && (
        <MoveToPremiumModal
          isOpen={showMoveToPremiumModal}
          video={video}
          onClose={() => setShowMoveToPremiumModal(false)}
          onSuccess={(updated) => {
            setVideo((prev) => ({ ...prev, isPremium: true }));
            showToast('Video moved to Vault successfully.');
          }}
        />
      )}
    </div>
  );
}

/* ── Watch skeleton ─────────────────────────────────────────────── */

function WatchSkeleton() {
  return (
    <div className="watch-skeleton">
      {/* Player */}
      <div className="watch-skeleton__player skeleton-shimmer" />
      {/* Title */}
      <div className="watch-skeleton__title skeleton-shimmer" />
      <div className="watch-skeleton__title watch-skeleton__title--short skeleton-shimmer" />
      {/* Meta row */}
      <div className="watch-skeleton__meta">
        <div className="watch-skeleton__avatar skeleton-shimmer" />
        <div className="watch-skeleton__channel">
          <div className="watch-skeleton__channel-name skeleton-shimmer" />
          <div className="watch-skeleton__channel-sub skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}

/* ── Placeholder comments data ──────────────────────────────────── */

const PLACEHOLDER_COMMENTS = [
  {
    id: 1,
    initials: 'AK',
    name: 'Aryan Kumar',
    time: '2 days ago',
    text: 'Great video! Really enjoyed the content. Keep it up 🔥',
  },
  {
    id: 2,
    initials: 'PS',
    name: 'Priya Sharma',
    time: '5 days ago',
    text: 'This is exactly what I was looking for. Thanks for uploading!',
  },
  {
    id: 3,
    initials: 'MR',
    name: 'Mihir Rathod',
    time: '1 week ago',
    text: "Quality content as always. Subscribed! Can't wait to see more.",
  },
];

/* ── Icons ──────────────────────────────────────────────────────── */

function ThumbUpIcon({ filled = false }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
      <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

function ThumbDownIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" />
      <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function PlaylistIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function ChevronIcon({ expanded }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function VaultLockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      <circle cx="12" cy="16" r="1" fill="currentColor" />
    </svg>
  );
}

export default Watch;
