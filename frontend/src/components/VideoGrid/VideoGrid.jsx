import VideoCard from '../VideoCard/VideoCard';
import VideoCardSkeleton from '../VideoCard/VideoCardSkeleton';
import './VideoGrid.css';

/**
 * VideoGrid — renders a CSS grid of VideoCards.
 *
 * Props:
 *   videos      {Array}    — array of video objects from GET /videos docs[]
 *   isLoading   {boolean}  — show skeleton cards for first page load
 *   isLoadingMore {boolean} — show extra skeleton row at bottom for "load more"
 *   hasNextPage {boolean}  — whether more pages exist
 *   onLoadMore  {function} — callback to load next page
 *   emptyMessage {string}  — custom empty-state message
 */

const SKELETON_COUNT = 12;

function VideoGrid({
  videos = [],
  isLoading = false,
  isLoadingMore = false,
  hasNextPage = false,
  onLoadMore,
  emptyMessage = 'No videos yet. Check back soon!',
}) {
  /* ── Initial skeleton load ──────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="video-grid" aria-busy="true" aria-label="Loading videos">
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <VideoCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  /* ── Empty state ────────────────────────────────────────────── */
  if (!isLoading && videos.length === 0) {
    return (
      <div className="video-grid__empty">
        <span className="video-grid__empty-icon" aria-hidden="true">📭</span>
        <p className="video-grid__empty-text">{emptyMessage}</p>
      </div>
    );
  }

  /* ── Populated grid ─────────────────────────────────────────── */
  return (
    <div className="video-grid-wrapper">
      <div className="video-grid" role="list" aria-label="Video feed">
        {videos.map((video) => (
          <div key={video._id} role="listitem">
            <VideoCard video={video} />
          </div>
        ))}

        {/* Extra skeleton cards while "load more" is in flight */}
        {isLoadingMore &&
          Array.from({ length: 4 }).map((_, i) => <VideoCardSkeleton key={`more-${i}`} />)}
      </div>

      {/* ── Load More button ───────────────────────────────────── */}
      {hasNextPage && !isLoadingMore && (
        <div className="video-grid__load-more">
          <button
            id="load-more-btn"
            className="btn btn-secondary video-grid__load-more-btn"
            onClick={onLoadMore}
          >
            Load more videos
          </button>
        </div>
      )}
    </div>
  );
}

export default VideoGrid;
