import { useState, useEffect } from 'react';
import { updateVideo } from '../../api/video.api';
import './EditVideoModal.css';

function EditVideoModal({ video, onClose, onSuccess }) {
  const [title, setTitle] = useState(video?.title || '');
  const [description, setDescription] = useState(video?.description || '');
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState(video?.thumbnail || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // If the modal was opened with a different video, reset state
    if (video) {
      setTitle(video.title || '');
      setDescription(video.description || '');
      setThumbnailFile(null);
      setThumbnailPreview(video.thumbnail || '');
      setError(null);
    }
  }, [video]);

  if (!video) return null;

  const handleThumbnailChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setThumbnailFile(file);
      setThumbnailPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      if (title !== video.title) formData.append('title', title);
      if (description !== video.description) formData.append('description', description);
      if (thumbnailFile) formData.append('thumbnail', thumbnailFile);

      // Only send request if something changed
      let updatedVideo = { ...video }; // Start with current values

      // If FormData has keys, do the request
      let hasChanges = false;
      for (let key of formData.keys()) {
        hasChanges = true;
        break;
      }

      if (hasChanges) {
        const res = await updateVideo(video._id, formData);
        updatedVideo = res.data.data;
      }
      
      onSuccess(updatedVideo); // Always succeed, even if no changes
    } catch (err) {
      console.error('Failed to update video', err);
      setError(err.response?.data?.message || 'Failed to update video. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="edit-video-modal-backdrop" onClick={onClose}>
      <div className="edit-video-modal" onClick={(e) => e.stopPropagation()}>
        <div className="edit-video-modal__header">
          <h2>Edit Video</h2>
          <button className="edit-video-modal__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="edit-video-form">
          {error && <div className="edit-video-form__error">{error}</div>}

          <div className="edit-video-form__group">
            <label htmlFor="edit-title">Title</label>
            <input
              id="edit-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="edit-video-form__group">
            <label htmlFor="edit-description">Description</label>
            <textarea
              id="edit-description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="edit-video-form__group">
            <label>Thumbnail</label>
            <div className="edit-video-form__thumbnail-preview">
              {thumbnailPreview ? (
                <img src={thumbnailPreview} alt="Thumbnail preview" />
              ) : (
                <div className="edit-video-form__thumbnail-placeholder">No Thumbnail</div>
              )}
            </div>
            <label htmlFor="edit-thumbnail" className="btn btn-secondary mt-2">
              Choose New Thumbnail
            </label>
            <input
              id="edit-thumbnail"
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleThumbnailChange}
            />
          </div>

          <div className="edit-video-modal__actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditVideoModal;
