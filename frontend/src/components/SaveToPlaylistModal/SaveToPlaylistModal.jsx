import { useState, useEffect } from 'react';
import { getUserPlaylists, addVideoToPlaylist, removeVideoFromPlaylist, createPlaylist } from '../../api/playlist.api';
import './SaveToPlaylistModal.css';

function SaveToPlaylistModal({ isOpen, onClose, videoId, userId }) {
  const [playlists, setPlaylists] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [togglingMap, setTogglingMap] = useState({});

  // ── Inline new-playlist form state ─────────────────────────────
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newIsPublic, setNewIsPublic] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    if (!isOpen || !userId) return;
    
    setIsLoading(true);
    setShowCreateForm(false);
    setNewName('');
    setNewDesc('');
    setCreateError('');
    getUserPlaylists(userId)
      .then((res) => setPlaylists(res.data.data))
      .catch((err) => console.error('Failed to load playlists', err))
      .finally(() => setIsLoading(false));
  }, [isOpen, userId]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // ── Toggle existing playlist ──────────────────────────────────
  const handleToggle = async (playlist) => {
    const isChecked = playlist.videos?.some((v) => (v._id || v) === videoId);
    setTogglingMap((prev) => ({ ...prev, [playlist._id]: true }));
    
    try {
      if (isChecked) {
        await removeVideoFromPlaylist(videoId, playlist._id);
        setPlaylists((prev) =>
          prev.map((p) =>
            p._id === playlist._id
              ? { ...p, videos: p.videos.filter((v) => (v._id || v) !== videoId) }
              : p
          )
        );
      } else {
        await addVideoToPlaylist(videoId, playlist._id);
        setPlaylists((prev) =>
          prev.map((p) =>
            p._id === playlist._id
              ? { ...p, videos: [...p.videos, videoId] }
              : p
          )
        );
      }
    } catch (err) {
      console.error('Failed to toggle playlist', err);
    } finally {
      setTogglingMap((prev) => ({ ...prev, [playlist._id]: false }));
    }
  };

  // ── Create new playlist + auto-add video ─────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) {
      setCreateError('Playlist name is required.');
      return;
    }
    setCreateError('');
    setIsCreating(true);
    try {
      // 1. Create the playlist
      const res = await createPlaylist({ name: newName.trim(), description: newDesc.trim(), isPublic: newIsPublic });
      const newPlaylist = res.data.data;

      // 2. Immediately add the current video
      await addVideoToPlaylist(videoId, newPlaylist._id);

      // 3. Optimistically add to list with this video already inside
      setPlaylists((prev) => [{ ...newPlaylist, videos: [videoId] }, ...prev]);

      // 4. Reset form
      setNewName('');
      setNewDesc('');
      setNewIsPublic(true);
      setShowCreateForm(false);
    } catch (err) {
      console.error('Failed to create playlist', err);
      setCreateError('Failed to create playlist. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="save-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="save-modal-title">
      <div className="save-modal" onClick={(e) => e.stopPropagation()}>
        <div className="save-modal__header">
          <h2 id="save-modal-title" className="save-modal__title">Save to playlist</h2>
          <button className="save-modal__close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        
        <div className="save-modal__body">
          {isLoading ? (
            <div className="save-modal__loading">Loading...</div>
          ) : (
            <>
              {playlists.length > 0 && (
                <ul className="save-modal__list">
                  {playlists.map((playlist) => {
                    const isChecked = playlist.videos?.some((v) => (v._id || v) === videoId);
                    const isToggling = togglingMap[playlist._id];
                    
                    return (
                      <li key={playlist._id} className="save-modal__item">
                        <label className={`save-modal__label ${isToggling ? 'save-modal__label--disabled' : ''}`}>
                          <input
                            type="checkbox"
                            className="save-modal__checkbox"
                            checked={isChecked}
                            onChange={() => handleToggle(playlist)}
                            disabled={isToggling}
                          />
                          <span className="save-modal__name">{playlist.name}</span>
                          {!playlist.isPublic && (
                            <span className="save-modal__badge" title="Private">🔒</span>
                          )}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* ── Create new playlist ───────────────────────── */}
              {showCreateForm ? (
                <form className="save-modal__create-form" onSubmit={handleCreate}>
                  <input
                    className="save-modal__input"
                    type="text"
                    placeholder="Playlist name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    maxLength={100}
                    autoFocus
                    required
                  />
                  <input
                    className="save-modal__input"
                    type="text"
                    placeholder="Description (optional)"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    maxLength={300}
                  />
                  <label className="save-modal__privacy-toggle">
                    <input
                      type="checkbox"
                      className="save-modal__checkbox"
                      checked={!newIsPublic}
                      onChange={(e) => setNewIsPublic(!e.target.checked)}
                    />
                    <span className="save-modal__name">Private</span>
                  </label>
                  {createError && <p className="save-modal__error">{createError}</p>}
                  <div className="save-modal__create-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => { setShowCreateForm(false); setCreateError(''); }}
                      disabled={isCreating}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary btn-sm"
                      disabled={isCreating || !newName.trim()}
                    >
                      {isCreating ? 'Creating…' : 'Create & Save'}
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  className="save-modal__new-btn"
                  onClick={() => setShowCreateForm(true)}
                >
                  <span className="save-modal__new-icon">＋</span>
                  New playlist
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default SaveToPlaylistModal;
