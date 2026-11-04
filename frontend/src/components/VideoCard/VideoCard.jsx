import { Link } from 'react-router-dom';
import './VideoCard.css';

/**
 * VideoCard — displays a single video in the feed grid.
 *
 * Props:
 *   video {object} — one item from the GET /videos docs[] array
 *     _id, thumbnail, title, duration, views, createdAt,
 *     owner: { _id, username, fullName, avatar }
 *
 * DOM structure (valid HTML — no nested <a> elements):
 *
 *   <div.video-card>                   ← plain div, not an anchor
 *     <a.video-card__video-link>       ← Link to /watch/:id
 *       <div.video-card__thumb-wrapper>
 *         <img /> <span.duration />
 *       </div>
 *     </a>
 *     <div.video-card__meta>
 *       <a.video-card__owner-avatar>   ← Link to /channel/:username (sibling, NOT inside video-link)
 *       <div.video-card__info>
 *         <a.video-card__title-link>   ← Link to /watch/:id (title — also a sibling)
 *         <a.video-card__channel-link> ← Link to /channel/:username
 *         <span.video-card__stats />
 *       </div>
 *     </div>
 *   </div>
 */

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '';
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function formatViews(views) {
  if (!views && views !== 0) return '0 views';
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M views`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K views`;
  return `${views} view${views !== 1 ? 's' : ''}`;
}

function timeAgo(dateString) {
  if (!dateString) return '';
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
  if (diffWeek < 5) return `${diffWeek} week${diffWeek !== 1 ? 's' : ''} ago`;
  if (diffMonth < 12) return `${diffMonth} month${diffMonth !== 1 ? 's' : ''} ago`;
  return `${diffYear} year${diffYear !== 1 ? 's' : ''} ago`;
}

function ownerInitials(owner) {
  if (!owner) return '?';
  const name = owner.fullName || owner.username || '';
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?';
}

function VideoCard({ video }) {
  const { _id, thumbnail, title, duration, views, createdAt, owner } = video;

  const watchHref = `/watch/${_id}`;
  const channelHref = `/channel/${owner?.username}`;

  return (
    // Plain div — no anchor here. All clickable areas are individual sibling <Link>s below.
    <div className="video-card">

      {/* ── Thumbnail link (→ watch page) ─────────────────────── */}
      <Link to={watchHref} className="video-card__video-link" tabIndex={-1} aria-hidden="true">
        <div className="video-card__thumb-wrapper">
          <img
            src={thumbnail}
            alt={title}
            className="video-card__thumbnail"
            loading="lazy"
          />
          {duration != null && (
            <span className="video-card__duration">{formatDuration(duration)}</span>
          )}
        </div>
      </Link>

      {/* ── Meta row ──────────────────────────────────────────── */}
      <div className="video-card__meta">

        {/* Channel avatar (→ channel page) */}
        <Link
          to={channelHref}
          className="video-card__owner-avatar"
          aria-label={`Visit ${owner?.fullName || owner?.username}'s channel`}
        >
          {owner?.avatar ? (
            <img
              src={owner.avatar}
              alt={owner.fullName || owner.username}
              className="video-card__owner-img"
              loading="lazy"
            />
          ) : (
            <span className="video-card__owner-initials">{ownerInitials(owner)}</span>
          )}
        </Link>

        {/* Title + channel info */}
        <div className="video-card__info">
          {/* Title (→ watch page) */}
          <Link to={watchHref} className="video-card__title-link" aria-label={`Watch ${title}`}>
            <h3 className="video-card__title">{title}</h3>
          </Link>

          {/* Channel name (→ channel page) */}
          <Link to={channelHref} className="video-card__channel video-card__channel-link">
            {owner?.fullName || owner?.username || 'Unknown'}
          </Link>

          <span className="video-card__stats">
            {formatViews(views)} · {timeAgo(createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default VideoCard;
