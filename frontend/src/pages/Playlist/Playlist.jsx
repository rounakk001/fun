import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Header from '../../components/Header/Header';
import Sidebar from '../../components/Sidebar/Sidebar';
import VideoCard from '../../components/VideoCard/VideoCard';
import PlaylistFormModal from '../../components/PlaylistFormModal/PlaylistFormModal';
import { getPlaylistById, updatePlaylist, deletePlaylist, removeVideoFromPlaylist, addVideoToPlaylist, setPlaylistCover } from '../../api/playlist.api';
import { getVideos } from '../../api/video.api';
import { useAuth } from '../../context/AuthContext';
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog';
import SaveToPlaylistModal from '../../components/SaveToPlaylistModal/SaveToPlaylistModal';
import './Playlist.css';

/* ── Add-Videos panel ─────────────────────────────────────────── */

function AddVideosPanel({ playlistId, existingVideoIds, onAdd, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addingMap, setAddingMap] = useState({});

  // Debounced search
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timeout = setTimeout(() => {
      setIsSearching(true);
      getVideos({ page: 1, limit: 10, query: query.trim() })
        .then((res) => setResults(res.data.data?.docs || []))
        .catch(() => setResults([]))
        .finally(() => setIsSearching(false));
    }, 350);
    return () => clearTimeout(timeout);
  }, [query]);

  const handleAdd = async (video) => {
    if (existingVideoIds.has(video._id)) return; // already in playlist
    setAddingMap((prev) => ({ ...prev, [video._id]: true }));
    try {
      await addVideoToPlaylist(video._id, playlistId);
      onAdd(video); // parent updates its list
    } catch (err) {
      console.error('Failed to add video', err);
    } finally {
      setAddingMap((prev) => ({ ...prev, [video._id]: false }));
    }
  };

  return (
    <div className="playlist-add-panel">
      <div className="playlist-add-panel__header">
        <h3 className="playlist-add-panel__title">Add Videos</h3>
        <button className="save-modal__close" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <input
        className="playlist-add-panel__search"
        type="search"
        placeholder="Search for videos…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      <div className="playlist-add-panel__results">
        {isSearching && <p className="playlist-add-panel__msg">Searching…</p>}
        {!isSearching && query && results.length === 0 && (
          <p className="playlist-add-panel__msg">No videos found.</p>
        )}
        {!query && <p className="playlist-add-panel__msg">Type to search for videos to add.</p>}
        {results.map((video) => {
          const alreadyIn = existingVideoIds.has(video._id);
          const isAdding = addingMap[video._id];
          return (
            <div key={video._id} className="playlist-add-panel__item">
              <img src={video.thumbnail} alt={video.title} className="playlist-add-panel__thumb" />
              <span className="playlist-add-panel__vtitle">{video.title}</span>
              <button
                className={`btn btn-sm ${alreadyIn ? 'btn-secondary' : 'btn-primary'}`}
                onClick={() => handleAdd(video)}
                disabled={alreadyIn || isAdding}
              >
                {alreadyIn ? 'Added' : isAdding ? '…' : 'Add'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Playlist page ────────────────────────────────────────────── */

function Playlist() {
  const { playlistId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);
  const [playlist, setPlaylist] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [is404, setIs404] = useState(false);
  
  // Edit & Delete state
  const [showEditModal, setShowEditModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Remove video confirm
  const [pendingRemoveId, setPendingRemoveId] = useState(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // Add videos panel
  const [showAddPanel, setShowAddPanel] = useState(false);

  // Dropdown menus
  const [openMenuVideoId, setOpenMenuVideoId] = useState(null);
  const [saveVideoId, setSaveVideoId] = useState(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!openMenuVideoId) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest('.playlist-video-menu-wrap')) {
        setOpenMenuVideoId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuVideoId]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setIs404(false);

    getPlaylistById(playlistId)
      .then((res) => {
        if (!cancelled) setPlaylist(res.data.data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.response?.status === 404) {
          setIs404(true);
        } else {
          setError(err.response?.data?.message || 'Failed to load playlist');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [playlistId]);

  const isOwner = user && playlist?.owner?._id === user._id;

  const handleUpdate = async (data) => {
    setIsUpdating(true);
    try {
      const res = await updatePlaylist(playlistId, data);
      setPlaylist(res.data.data);
      setShowEditModal(false);
    } catch (err) {
      console.error('Failed to update playlist', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deletePlaylist(playlistId);
      navigate(`/channel/${user.username}`, { replace: true });
    } catch (err) {
      console.error('Failed to delete playlist', err);
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleRemoveVideo = async () => {
    if (!pendingRemoveId) return;
    setIsRemoving(true);
    try {
      await removeVideoFromPlaylist(pendingRemoveId, playlistId);
      setPlaylist((prev) => ({
        ...prev,
        videos: prev.videos.filter((v) => v._id !== pendingRemoveId)
      }));
      setPendingRemoveId(null);
    } catch (err) {
      console.error('Failed to remove video', err);
    } finally {
      setIsRemoving(false);
      setPendingRemoveId(null);
    }
  };

  const handleSetCover = async (videoId) => {
    try {
      await setPlaylistCover(videoId, playlistId);
      
      // Update local state without replacing the populated videos array with the backend's raw response
      setPlaylist((prev) => {
        const selectedVideo = prev.videos.find(v => v._id === videoId);
        return {
          ...prev,
          coverVideo: selectedVideo ? { _id: selectedVideo._id, thumbnail: selectedVideo.thumbnail } : prev.coverVideo
        };
      });
    } catch (err) {
      console.error('Failed to set cover:', err);
      alert(err.response?.data?.message || 'Failed to set playlist cover');
    }
  };

  const handleVideoAdded = useCallback((video) => {
    setPlaylist((prev) => ({
      ...prev,
      videos: [...prev.videos, video],
    }));
  }, []);

  const existingVideoIds = new Set(playlist?.videos?.map((v) => v._id) || []);
  const thumb = playlist?.coverVideo?.thumbnail || playlist?.videos?.[0]?.thumbnail;

  return (
    <div className="playlist-root">
      <Header onMenuToggle={() => setSidebarOpen((p) => !p)} />

      <div className={`playlist-layout ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="playlist-main" id="main-content">
          {isLoading && <div className="playlist-loading">Loading playlist...</div>}
          
          {!isLoading && is404 && (
            <div className="playlist-error">
              <h2>Playlist not found</h2>
              <p>This playlist doesn't exist, is private, or has been removed.</p>
              <Link to="/home" className="btn btn-primary">Go Home</Link>
            </div>
          )}

          {!isLoading && error && (
            <div className="playlist-error">
              <h2>Oops</h2>
              <p>{error}</p>
              <Link to="/home" className="btn btn-primary">Go Home</Link>
            </div>
          )}

          {!isLoading && playlist && (
            <div className="playlist-content">
              {/* Sidebar / Info column */}
              <div className="playlist-info-col">
                <div className="playlist-info-card">
                  <div className="playlist-cover">
                    {thumb ? (
                      <img src={thumb} alt={playlist.name} className="playlist-cover__img" />
                    ) : (
                      <div className="playlist-cover__fallback">No videos yet</div>
                    )}
                  </div>
                  
                  <h1 className="playlist-title">{playlist.name}</h1>
                  
                  <div className="playlist-meta">
                    <Link to={`/channel/${playlist.owner.username}`} className="playlist-owner">
                      {playlist.owner.fullName || playlist.owner.username}
                    </Link>
                    <span className="playlist-count">
                      {playlist.videos.length} video{playlist.videos.length !== 1 ? 's' : ''}
                    </span>
                    <span className="playlist-visibility">
                      {playlist.isPublic ? '🌐 Public' : '🔒 Private'}
                    </span>
                  </div>

                  {playlist.description && (
                    <p className="playlist-desc">{playlist.description}</p>
                  )}

                  {playlist.videos.length > 0 && (
                    <Link to={`/watch/${playlist.videos[0]._id}`} className="btn btn-primary playlist-play-btn">
                      ▶ Play All
                    </Link>
                  )}

                  {isOwner && (
                    <div className="playlist-actions">
                      <button className="btn btn-secondary" onClick={() => setShowAddPanel(true)}>
                        + Add Videos
                      </button>
                      <button className="btn btn-secondary" onClick={() => setShowEditModal(true)}>
                        Edit
                      </button>
                      <button className="btn btn-secondary playlist-btn-danger" onClick={() => setShowDeleteConfirm(true)}>
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                {/* Add Videos panel (inline on desktop) */}
                {isOwner && showAddPanel && (
                  <AddVideosPanel
                    playlistId={playlistId}
                    existingVideoIds={existingVideoIds}
                    onAdd={handleVideoAdded}
                    onClose={() => setShowAddPanel(false)}
                  />
                )}
              </div>

              {/* Videos column */}
              <div className="playlist-videos-col">
                {playlist.videos.length === 0 ? (
                  <div className="playlist-empty">
                    <p>There are no videos in this playlist yet.</p>
                    {isOwner && (
                      <button className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }} onClick={() => setShowAddPanel(true)}>
                        Add Videos
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="playlist-videos-list">
                    {playlist.videos.map((video, index) => (
                      <div key={video._id} className="playlist-video-item">
                        <span className="playlist-video-index">{index + 1}</span>
                        <div className="playlist-video-card-wrap">
                          <VideoCard video={video} />
                        </div>
                        <div className="playlist-video-menu-wrap">
                          <button
                            className="playlist-menu-btn"
                            title="More actions"
                            aria-expanded={openMenuVideoId === video._id}
                            onClick={() => setOpenMenuVideoId(openMenuVideoId === video._id ? null : video._id)}
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                              <path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                            </svg>
                          </button>
                          
                          {openMenuVideoId === video._id && (
                            <div className="playlist-video-dropdown">
                              <button 
                                className="playlist-dropdown-item"
                                onClick={() => { setSaveVideoId(video._id); setOpenMenuVideoId(null); }}
                              >
                                Add to playlist
                              </button>
                              
                              {isOwner && (
                                <>
                                  <button 
                                    className="playlist-dropdown-item"
                                    onClick={() => { handleSetCover(video._id); setOpenMenuVideoId(null); }}
                                  >
                                    Set as playlist thumbnail
                                  </button>
                                  <button 
                                    className="playlist-dropdown-item text-danger"
                                    onClick={() => { setPendingRemoveId(video._id); setOpenMenuVideoId(null); }}
                                  >
                                    Remove from {playlist.name}
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {showEditModal && (
        <PlaylistFormModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSubmit={handleUpdate}
          initialData={playlist}
          title="Edit Playlist"
          submitText="Save Changes"
          isLoading={isUpdating}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Playlist?"
          message="Are you sure you want to delete this playlist? This action cannot be undone. The videos inside will NOT be deleted."
          confirmText="Delete Playlist"
          cancelText="Cancel"
          variant="danger"
          isLoading={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {pendingRemoveId && (
        <ConfirmDialog
          title="Remove Video?"
          message="Remove this video from the playlist?"
          confirmText="Remove"
          cancelText="Cancel"
          variant="danger"
          isLoading={isRemoving}
          onConfirm={handleRemoveVideo}
          onCancel={() => setPendingRemoveId(null)}
        />
      )}

      {saveVideoId && (
        <SaveToPlaylistModal
          isOpen={true}
          videoId={saveVideoId}
          userId={user?._id}
          onClose={() => setSaveVideoId(null)}
        />
      )}
    </div>
  );
}

export default Playlist;
