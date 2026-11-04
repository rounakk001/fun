import './VideoCardSkeleton.css';

/**
 * VideoCardSkeleton — animated placeholder shown while video data loads.
 * Matches the exact layout of VideoCard so the transition is seamless.
 */
function VideoCardSkeleton() {
  return (
    <div className="skeleton-card" aria-hidden="true">
      {/* Thumbnail */}
      <div className="skeleton skeleton--thumb" />

      {/* Meta row */}
      <div className="skeleton-card__meta">
        <div className="skeleton skeleton--avatar" />
        <div className="skeleton-card__info">
          <div className="skeleton skeleton--title" />
          <div className="skeleton skeleton--title skeleton--title-short" />
          <div className="skeleton skeleton--text" />
        </div>
      </div>
    </div>
  );
}

export default VideoCardSkeleton;
