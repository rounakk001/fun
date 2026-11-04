import { Link } from 'react-router-dom';
import './PlaylistCard.css';

function PlaylistCard({ playlist, isOwner = false }) {
  const videoCount = playlist.videos?.length ?? 0;
  const thumb = playlist.coverVideo?.thumbnail || playlist.videos?.[0]?.thumbnail;

  return (
    <Link to={`/playlist/${playlist._id}`} className="playlist-card">
      <div className="playlist-card__thumb">
        {thumb ? (
          <img src={thumb} alt={playlist.name} className="playlist-card__img" />
        ) : (
          <div className="playlist-card__empty-thumb" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </div>
        )}
        <span className="playlist-card__count">{videoCount} video{videoCount !== 1 ? 's' : ''}</span>
      </div>

      <div className="playlist-card__info">
        <p className="playlist-card__name">{playlist.name}</p>
        {playlist.description && (
          <p className="playlist-card__desc">{playlist.description}</p>
        )}
        {isOwner && (
          <span className={`playlist-card__badge ${playlist.isPublic ? 'playlist-card__badge--public' : 'playlist-card__badge--private'}`}>
            {playlist.isPublic ? 'Public' : 'Private'}
          </span>
        )}
      </div>
    </Link>
  );
}

export default PlaylistCard;
