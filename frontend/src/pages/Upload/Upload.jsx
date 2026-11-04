import { useState, useRef, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header/Header';
import Sidebar from '../../components/Sidebar/Sidebar';
import { uploadVideo } from '../../api/video.api';
import './Upload.css';

/**
 * Upload — video upload page at /upload.
 *
 * Form fields: title, description, videoFile, thumbnail.
 * Uses axios onUploadProgress for a real progress bar (not fake/simulated).
 * On success → redirect to /watch/:id.
 * On failure → show backend error.message, keep form filled, allow retry.
 */
function Upload() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Form state ────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoFile, setVideoFile] = useState(null);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState(null);

  // ── Validation errors ─────────────────────────────────────────
  const [errors, setErrors] = useState({});

  // ── Upload state ──────────────────────────────────────────────
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  // Phase: 'uploading' (bytes in flight) | 'processing' (Cloudinary side, 100% but no response yet)
  const [uploadPhase, setUploadPhase] = useState(null);
  const [serverError, setServerError] = useState(null);

  // Refs for hidden file inputs
  const videoInputRef = useRef(null);
  const thumbInputRef = useRef(null);

  // Unique IDs for form labels (accessibility)
  const titleId = useId();
  const descId = useId();

  // ── Thumbnail file handler ─────────────────────────────────────
  const handleThumbnailChange = (e) => {
    const file = e.target.files?.[0] ?? null;
    setThumbnailFile(file);
    setErrors((prev) => ({ ...prev, thumbnail: undefined }));

    // Revoke any existing object URL to avoid memory leaks
    if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    setThumbnailPreview(file ? URL.createObjectURL(file) : null);
  };

  // ── Video file handler ─────────────────────────────────────────
  const handleVideoChange = (e) => {
    const file = e.target.files?.[0] ?? null;
    setVideoFile(file);
    setErrors((prev) => ({ ...prev, videoFile: undefined }));
  };

  // ── Client-side validation ─────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (!title.trim()) errs.title = 'Title is required.';
    if (!description.trim()) errs.description = 'Description is required.';
    if (!videoFile) errs.videoFile = 'Please select a video file.';
    if (!thumbnailFile) errs.thumbnail = 'Please select a thumbnail image.';
    return errs;
  };

  // ── Submit ─────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError(null);

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const formData = new FormData();
    formData.append('title', title.trim());
    formData.append('description', description.trim());
    formData.append('videoFile', videoFile);
    formData.append('thumbnail', thumbnailFile);

    setIsUploading(true);
    setUploadProgress(0);
    setUploadPhase('uploading');

    try {
      const response = await uploadVideo(formData, (pct) => {
        setUploadProgress(pct);
        if (pct === 100) {
          // Bytes are on the server; Cloudinary processing begins
          setUploadPhase('processing');
        }
      });

      const newVideoId = response.data.data._id;
      navigate(`/watch/${newVideoId}`, { replace: true });
    } catch (err) {
      // Extract the most useful error message
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Upload failed. Please try again.';
      setServerError(msg);
      setIsUploading(false);
      setUploadPhase(null);
      setUploadProgress(0);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────
  const formatBytes = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const progressLabel =
    uploadPhase === 'processing'
      ? 'Processing on server…'
      : `Uploading… ${uploadProgress}%`;

  return (
    <div className="upload-root">
      <Header onMenuToggle={() => setSidebarOpen((prev) => !prev)} />

      <div className="upload-layout">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="upload-main" id="main-content">
          <div className="upload-container">
            {/* ── Page heading ─────────────────────────────── */}
            <div className="upload-heading">
              <h1 className="upload-heading__title">Upload a video</h1>
              <p className="upload-heading__sub">
                Share your content with the Yeonix community.
              </p>
            </div>

            {/* ── Form ─────────────────────────────────────── */}
            <form
              className="upload-form"
              onSubmit={handleSubmit}
              noValidate
              aria-label="Video upload form"
            >
              {/* ── Server error banner ───────────────────── */}
              {serverError && (
                <div className="upload-error-banner" role="alert">
                  <ErrorIcon />
                  <span>{serverError}</span>
                </div>
              )}

              {/* ── Title ─────────────────────────────────── */}
              <div className="form-group">
                <label htmlFor={titleId} className="form-label">
                  Title <span className="upload-required" aria-hidden="true">*</span>
                </label>
                <input
                  id={titleId}
                  type="text"
                  className={`form-input${errors.title ? ' has-error' : ''}`}
                  placeholder="Give your video a clear, descriptive title"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (errors.title) setErrors((p) => ({ ...p, title: undefined }));
                  }}
                  disabled={isUploading}
                  maxLength={150}
                  aria-describedby={errors.title ? `${titleId}-err` : undefined}
                />
                {errors.title && (
                  <span id={`${titleId}-err`} className="form-error" role="alert">
                    <ErrorIcon size={13} />
                    {errors.title}
                  </span>
                )}
              </div>

              {/* ── Description ───────────────────────────── */}
              <div className="form-group">
                <label htmlFor={descId} className="form-label">
                  Description <span className="upload-required" aria-hidden="true">*</span>
                </label>
                <textarea
                  id={descId}
                  className={`form-input upload-textarea${errors.description ? ' has-error' : ''}`}
                  placeholder="Tell viewers what your video is about"
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    if (errors.description) setErrors((p) => ({ ...p, description: undefined }));
                  }}
                  disabled={isUploading}
                  rows={4}
                  maxLength={5000}
                  aria-describedby={errors.description ? `${descId}-err` : undefined}
                />
                {errors.description && (
                  <span id={`${descId}-err`} className="form-error" role="alert">
                    <ErrorIcon size={13} />
                    {errors.description}
                  </span>
                )}
              </div>

              {/* ── File pickers row ──────────────────────── */}
              <div className="upload-files-row">
                {/* Video file picker */}
                <div className="form-group upload-file-group">
                  <span className="form-label">
                    Video file <span className="upload-required" aria-hidden="true">*</span>
                  </span>
                  <button
                    type="button"
                    className={`upload-dropzone${errors.videoFile ? ' upload-dropzone--error' : ''}${videoFile ? ' upload-dropzone--filled' : ''}`}
                    onClick={() => !isUploading && videoInputRef.current?.click()}
                    disabled={isUploading}
                    aria-label="Select video file"
                  >
                    {videoFile ? (
                      <div className="upload-dropzone__file-info">
                        <VideoFileIcon />
                        <div className="upload-dropzone__file-text">
                          <span className="upload-dropzone__file-name">{videoFile.name}</span>
                          <span className="upload-dropzone__file-size">{formatBytes(videoFile.size)}</span>
                        </div>
                        <span className="upload-dropzone__change">Change</span>
                      </div>
                    ) : (
                      <div className="upload-dropzone__prompt">
                        <UploadCloudIcon />
                        <span className="upload-dropzone__label">Click to select video</span>
                        <span className="upload-dropzone__hint">MP4, MOV, AVI, etc.</span>
                      </div>
                    )}
                  </button>
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    className="sr-only"
                    onChange={handleVideoChange}
                    disabled={isUploading}
                    aria-hidden="true"
                    tabIndex={-1}
                  />
                  {errors.videoFile && (
                    <span className="form-error" role="alert">
                      <ErrorIcon size={13} />
                      {errors.videoFile}
                    </span>
                  )}
                </div>

                {/* Thumbnail picker + preview */}
                <div className="form-group upload-file-group">
                  <span className="form-label">
                    Thumbnail <span className="upload-required" aria-hidden="true">*</span>
                  </span>
                  <button
                    type="button"
                    className={`upload-dropzone upload-dropzone--thumb${errors.thumbnail ? ' upload-dropzone--error' : ''}${thumbnailFile ? ' upload-dropzone--filled' : ''}`}
                    onClick={() => !isUploading && thumbInputRef.current?.click()}
                    disabled={isUploading}
                    aria-label="Select thumbnail image"
                  >
                    {thumbnailPreview ? (
                      <div className="upload-thumb-preview-wrap">
                        <img
                          src={thumbnailPreview}
                          alt="Thumbnail preview"
                          className="upload-thumb-preview"
                        />
                        <span className="upload-thumb-change">Change</span>
                      </div>
                    ) : (
                      <div className="upload-dropzone__prompt">
                        <ImageIcon />
                        <span className="upload-dropzone__label">Click to select thumbnail</span>
                        <span className="upload-dropzone__hint">JPG, PNG, WebP</span>
                      </div>
                    )}
                  </button>
                  <input
                    ref={thumbInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleThumbnailChange}
                    disabled={isUploading}
                    aria-hidden="true"
                    tabIndex={-1}
                  />
                  {errors.thumbnail && (
                    <span className="form-error" role="alert">
                      <ErrorIcon size={13} />
                      {errors.thumbnail}
                    </span>
                  )}
                </div>
              </div>

              {/* ── Progress bar (only visible while uploading) ── */}
              {isUploading && (
                <div className="upload-progress-block" aria-live="polite" aria-label={progressLabel}>
                  <div className="upload-progress-header">
                    <span className="upload-progress-label">{progressLabel}</span>
                    {uploadPhase === 'uploading' && (
                      <span className="upload-progress-pct">{uploadProgress}%</span>
                    )}
                  </div>
                  <div className="upload-progress-track" role="progressbar" aria-valuenow={uploadProgress} aria-valuemin={0} aria-valuemax={100}>
                    <div
                      className={`upload-progress-fill${uploadPhase === 'processing' ? ' upload-progress-fill--pulse' : ''}`}
                      style={{ width: `${uploadPhase === 'processing' ? 100 : uploadProgress}%` }}
                    />
                  </div>
                  {uploadPhase === 'processing' && (
                    <p className="upload-progress-note">
                      Video uploaded successfully. Waiting for Cloudinary to process it…
                    </p>
                  )}
                </div>
              )}

              {/* ── Submit ─────────────────────────────────── */}
              <div className="upload-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => navigate('/home')}
                  disabled={isUploading}
                >
                  Cancel
                </button>
                <button
                  id="upload-submit-btn"
                  type="submit"
                  className="btn btn-primary upload-submit-btn"
                  disabled={isUploading}
                  aria-busy={isUploading}
                >
                  {isUploading ? (
                    <>
                      <SpinnerIcon />
                      {uploadPhase === 'processing' ? 'Processing…' : 'Uploading…'}
                    </>
                  ) : (
                    <>
                      <UploadIcon />
                      Publish video
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ── Inline SVG icons ──────────────────────────────────────────── */

function UploadCloudIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function VideoFileIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function ErrorIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="upload-spinner">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

export default Upload;
