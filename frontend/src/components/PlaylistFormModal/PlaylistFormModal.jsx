import { useState, useEffect } from 'react';
import './PlaylistFormModal.css';

function PlaylistFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData = null,
  title = 'Create Playlist',
  submitText = 'Create',
  isLoading = false
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  // Reset form when modal opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      setName(initialData?.name || '');
      setDescription(initialData?.description || '');
      setIsPublic(initialData?.isPublic ?? true);
    }
  }, [isOpen, initialData]);

  // Handle escape key
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !description.trim()) return;
    onSubmit({ name, description, isPublic });
  };

  return (
    <div className="playlist-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="playlist-modal-title">
      <div className="playlist-modal" onClick={(e) => e.stopPropagation()}>
        <div className="playlist-modal__header">
          <h2 id="playlist-modal-title" className="playlist-modal__title">{title}</h2>
          <button className="playlist-modal__close" onClick={onClose} aria-label="Close modal">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="playlist-modal__form">
          <div className="form-group">
            <label htmlFor="playlist-name" className="form-label">Name</label>
            <input
              id="playlist-name"
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="E.g., Favorites"
              maxLength={100}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="playlist-desc" className="form-label">Description</label>
            <textarea
              id="playlist-desc"
              className="form-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this playlist about?"
              rows={3}
              required
            />
          </div>

          <div className="form-group playlist-modal__toggle">
            <label className="playlist-modal__toggle-label">
              <input
                type="checkbox"
                className="playlist-modal__checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              <span className="playlist-modal__toggle-text">
                <strong>Public</strong>
                <span>Anyone can view this playlist</span>
              </span>
            </label>
          </div>

          <div className="playlist-modal__actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isLoading || !name.trim() || !description.trim()}>
              {isLoading ? 'Saving...' : submitText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PlaylistFormModal;
